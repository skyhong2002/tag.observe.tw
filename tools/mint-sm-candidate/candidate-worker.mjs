import * as fs from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {join,resolve} from 'node:path';
import {digest,privateBytes,verifyInput,verifySources,verifyMintObservation,verifyLease,verifySshFiles,sshArgs,mintRpcReceipt,smJob,ownerStopRequested} from './candidate-contract.mjs';
import {validateSample,validateRuntime,candidatePlan,verifyRuntime,effectiveSsh,checkExactPorts,assertOwnedListener,forwardedReadiness,ports,candidateTiming,inventoryPin,manifestPin,stopBeforeCheckpoint,stopOwnChildren} from './candidate-core.mjs';
const [inputPath,job,parentPidText,inputSha]=process.argv.slice(2);const parentPid=Number(parentPidText);
if(!inputPath||!job||!Number.isInteger(parentPid)||parentPid<1||!/^[a-f0-9]{64}$/.test(inputSha))throw Error('Reviewed parent invocation required');
if(fs.realpathSync(process.execPath)!==fs.realpathSync('/home/deck/.local/bin/node'))throw Error('Exact SM node required');
const inputBytes=privateBytes(inputPath,65536);if(digest(inputBytes)!==inputSha)throw Error('Input differs');const input=verifyInput(JSON.parse(inputBytes));verifySources(input);
if(resolve(job)!==smJob(input))throw Error('Exact new isolated candidate job required');
const js=fs.lstatSync(job);if(!js.isDirectory()||js.isSymbolicLink()||js.uid!==process.getuid()||(js.mode&0o077)||fs.realpathSync(job)!==resolve(job))throw Error('New private canonical parent job required');
const checkPins=()=>{if(digest(privateBytes(inputPath,65536))!==inputSha)throw Error('Input changed');verifyInput(input);verifySources(input);if(digest(privateBytes(input.frontdoorConfigPath,65536))!==input.frontdoorConfigSha256)throw Error('Private frontdoor config changed');validateRuntime(process,fs.readFileSync('/etc/machine-id','utf8').trim());};
const mint=phase=>{
 checkPins();verifySshFiles(input);const startedAtMs=Date.now();
 const result=spawnSync('/usr/bin/ssh',sshArgs(input),{encoding:null,timeout:12000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C'}});
 const rpc=mintRpcReceipt(result,input,{startedAtMs,endedAtMs:Date.now(),caller:'worker'});
 fs.appendFileSync(join(job,'worker-mint-rpc.jsonl'),JSON.stringify({phase,utc:new Date().toISOString(),rpc})+'\n',{mode:0o600});
 if(result.error||result.status!==0)throw Error('Real SM→Mint kernel/admission probe unavailable');
 const observation={...JSON.parse(rpc.stdout),transport:rpc};verifyMintObservation(observation,input);
 fs.appendFileSync(join(job,'worker-mint-lock.jsonl'),JSON.stringify({phase,utc:new Date().toISOString(),...observation})+'\n',{mode:0o600});return true;
};
const currentSmSample=phase=>{
 checkPins();const request={phase,nonce:randomBytes(16).toString('hex'),parentPid,workerPid:process.pid,inputSha256:inputSha,workerSha256:input.driverPins[resolve(process.argv[1])],requestedAtMs:Date.now()};
 const temporary=join(job,'request-'+request.nonce+'.tmp');fs.writeFileSync(temporary,JSON.stringify(request),{flag:'wx',mode:0o600});fs.renameSync(temporary,join(job,'phase-request.json'));
 // Poll in a child within the same guarded process group: STOP also stops waits.
 const poll="const fs=require('node:fs');const deadline=Date.now()+55000;const q=JSON.parse(process.argv[1]);const p=process.argv[2];function tick(){try{const v=JSON.parse(fs.readFileSync(p,'utf8'));if(v.nonce===q.nonce&&v.phase===q.phase&&v.workerPid===q.workerPid){process.stdout.write(JSON.stringify(v));return;}}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))process.exit(2);}if(Date.now()>=deadline)process.exit(3);else setTimeout(tick,100);}tick();";
 const result=spawnSync('/home/deck/.local/bin/node',['-e',poll,JSON.stringify(request),join(job,'sm-lease.json')],{encoding:'utf8',timeout:60000,maxBuffer:131072,env:{PATH:'/usr/bin:/bin',LANG:'C'}});
 if(result.error||result.status!==0)throw Error('Phase lease unavailable/timeout');
 const actualBytes=privateBytes(join(job,'sm-lease.json'),131072);const lease=JSON.parse(actualBytes);verifyLease(lease,request,input,inputSha);verifyMintObservation(lease.mint,input);validateSample(lease.sm);checkPins();return lease.sm;
};
const checkpoint=phase=>{mint(phase);validateSample(currentSmSample(phase));};
const configBytes=privateBytes(input.frontdoorConfigPath,65536);if(digest(configBytes)!==input.frontdoorConfigSha256)throw Error('Private frontdoor config differs');
const plan=candidatePlan(input,JSON.parse(configBytes));const timing=candidateTiming(input.expiresAtMs);const children=[];let failure=null,stopping=false;
const alive=()=>{if(failure)throw failure;for(const child of children)if(child.exitCode!==null)throw Error('Own candidate child exited');};
const startTicks=pid=>fs.readFileSync('/proc/'+pid+'/stat','utf8').split(')').slice(1).join(')').trim().split(/\s+/)[19];
const killOwn=(child,signal)=>{if(!child.pid||child.exitCode!==null||child.signalCode!==null)return 'already-exited';try{if(startTicks(child.pid)!==child.ownStartTicks)throw Error('Own process identity changed');return child.kill(signal)?'sent':'not-sent';}catch(e){if(!['ENOENT','ESRCH'].includes(e.code))throw e;return 'process-gone';}};
const shutdownRecord=entry=>fs.appendFileSync(join(job,'own-shutdown.jsonl'),JSON.stringify({inputSha256:inputSha,scope:'own candidate process shutdown; n/a-ui',observedAtMs:Date.now(),utc:new Date().toISOString(),...entry})+'\n',{mode:0o600});
const launch=entry=>{const child=spawn(entry.bin,entry.args,{cwd:entry.cwd,env:entry.env,stdio:'inherit'});children.push(child);if(child.pid)child.ownStartTicks=startTicks(child.pid);child.once('error',e=>{failure=e;});child.once('exit',(code,signal)=>{try{shutdownRecord({event:'own-exit',name:entry.name,pid:child.pid,startTicks:child.ownStartTicks,code,signal});}catch(error){failure=error;}});child.once('close',(code,signal)=>{if(!stopping)failure=Error(entry.name+' exited '+code+'/'+signal);});return child;};
const waitOwn=async(child,endpoint)=>{const until=Date.now()+10000;let last;while(Date.now()<until){alive();try{assertOwnedListener(child,endpoint);return;}catch(e){last=e;}await new Promise(done=>setTimeout(done,100));}throw last||Error('Own listener did not start');};
let stopPromise;
const stop=()=>stopPromise??=(async()=>{
 stopping=true;let auditError;
 const record=entry=>{try{shutdownRecord(entry);}catch(error){auditError??=error;}};
 record({event:'shutdown-start',plannedStopAtMs:timing.plannedStopAtMs,hardDeadlineMs:timing.hardDeadlineMs});
 const wait=async(ms)=>{const deadline=Date.now()+ms;while(children.some(c=>c.exitCode===null&&c.signalCode===null)&&Date.now()<deadline)await new Promise(done=>setTimeout(done,25));};
 await stopOwnChildren(children,{killOwn,wait,record});
 if(auditError)throw auditError;if(failure)throw failure;
})();
process.once('SIGTERM',()=>{stop().catch(error=>{failure=error;});});process.once('SIGINT',()=>{stop().catch(error=>{failure=error;});});
try{
 checkpoint('before-inventory');verifyRuntime(input);checkpoint('before-ports');await checkExactPorts();
 const effective=effectiveSsh(input);fs.writeFileSync(join(job,'effective-ssh.raw'),effective.raw,{flag:'wx',mode:0o600});
 checkpoint('before-tunnel');const tunnel=launch(plan[0]);await waitOwn(tunnel,ports[0]);checkpoint('forwarded-readiness');const readiness=await forwardedReadiness(input);assertOwnedListener(tunnel,ports[0]);
 fs.writeFileSync(join(job,'forwarded-readiness.json'),JSON.stringify(readiness)+'\n',{flag:'wx',mode:0o600});
 checkpoint('before-next');const next=launch(plan[1]);await waitOwn(next,ports[1]);
 checkpoint('before-frontdoor');const frontdoor=launch(plan[2]);await waitOwn(frontdoor,ports[2]);checkpoint('frontdoor-started');
 fs.writeFileSync(join(job,'candidate-started.json'),JSON.stringify({sessionId:input.sessionId,controlOpsSha:input.controlOpsSha,ownerPid:process.pid,ownerStartTicks:startTicks(process.pid),ports,inputSha256:inputSha,utc:new Date().toISOString(),scope:'SM isolated candidate listeners owned; not browser reachability or UI review',origin:'http://100.85.214.25:18196',appSha:input.appSha,opsSha:input.opsSha,buildId:'PmjYScQDDoJKBr43SLkhd',artifactInventorySha256:inventoryPin,manifestSha256:manifestPin,actor:JSON.parse(configBytes).actor,plannedStopAtMs:timing.plannedStopAtMs,hardDeadlineMs:timing.hardDeadlineMs,children:children.map((c,i)=>({name:plan[i].name,pid:c.pid,startTicks:c.ownStartTicks})),deployEligible:false})+'\n',{flag:'wx',mode:0o600});
 while(!stopping&&Date.now()<timing.plannedStopAtMs){if(ownerStopRequested(job,input,inputSha))break;checkpoint('candidate-heartbeat');if(ownerStopRequested(job,input,inputSha))break;alive();for(let i=0;i<children.length;i++)assertOwnedListener(children[i],ports[i]);await new Promise(done=>setTimeout(done,5000));}
 await stopBeforeCheckpoint(stop,checkpoint);
}finally{await stop();verifyRuntime(input);checkpoint('after-stop-hash');fs.writeFileSync(join(job,'candidate-stopped.json'),JSON.stringify({sessionId:input.sessionId,controlOpsSha:input.controlOpsSha,ownerPid:process.pid,ownerStartTicks:startTicks(process.pid),ports,inputSha256:inputSha,utc:new Date().toISOString(),originalRuntimeUnchanged:true,deployEligible:false,uiReview:'not reviewed'})+'\n',{flag:'wx',mode:0o600});}


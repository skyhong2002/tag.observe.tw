import * as fs from 'node:fs';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest,privateBytes,verifyInput,verifySources,verifyMintObservation,verifySshFiles,sshArgs,sourceRoot,smJob,mintRpcReceipt,classifyProbeFailure,verifyPhaseRequest,validateSmProbe,saveSmProbeReply} from './candidate-contract.mjs';
import {validateSample,validateRuntime,verifyRuntime,runtimeRoot as target,candidateTiming,outerGuardedInvocation,candidateReceiptBinding,verifyOwnerSessionReceipt} from './candidate-core.mjs';
const execute=promisify(execFile);const [inputPath,jobArg,expectedInputSha]=process.argv.slice(2);
if(!inputPath||!jobArg||!/^[a-f0-9]{64}$/.test(expectedInputSha||''))throw Error('Usage: /home/deck/.local/bin/node candidate-parent.mjs PRIVATE_ADMISSION_JSON NEW_PRIVATE_JOB_DIRECTORY REVIEWED_INPUT_SHA256');
if(fs.realpathSync(process.execPath)!==fs.realpathSync('/home/deck/.local/bin/node'))throw Error('Exact SM node required');
const inputBytes=privateBytes(inputPath,65536),inputSha=digest(inputBytes),input=verifyInput(JSON.parse(inputBytes));if(inputSha!==expectedInputSha)throw Error('Reviewed command input hash differs');verifySources(input);validateRuntime(process,fs.readFileSync('/etc/machine-id','utf8').trim());
const job=resolve(jobArg);if(job!==smJob(input))throw Error('Exact new isolated candidate job required');if(job===target||job.startsWith(target+'/')||fs.realpathSync(resolve(job,'..'))!==resolve(job,'..'))throw Error('New canonical evidence sibling required');fs.mkdirSync(job,{mode:0o700});
const {guardedBuild}=await import(pathToFileURL(join(sourceRoot,'../guard-next-build.js')).href);const {remoteScript}=await import(pathToFileURL(join(sourceRoot,'../mint-f1-sm-adapter.js')).href);


const timing=candidateTiming(input.expiresAtMs);
let group=null,started=false,guardActive=false,fatalError=null;
const taskDeadlineMs=Math.min(input.expiresAtMs,Date.now()+20*60*1000);
const fatal=error=>{fatalError=error;if(guardActive)process.emit('SIGTERM');};
const verifyImmutable=()=>{if(digest(privateBytes(inputPath,65536))!==inputSha)throw Error('Admission changed');verifyInput(input);verifySources(input);if(digest(privateBytes(input.frontdoorConfigPath,65536))!==input.frontdoorConfigSha256)throw Error('Private frontdoor config changed');validateRuntime(process,fs.readFileSync('/etc/machine-id','utf8').trim());};
const mint=async()=>{
 verifySshFiles(input);const startedAtMs=Date.now();let r,error;
 try{const reply=await execute('/usr/bin/ssh',sshArgs(input),{encoding:null,timeout:12000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C'}});r={...reply,status:0};}
 catch(failure){error=failure;r={stdout:failure.stdout,stderr:failure.stderr,status:typeof failure.code==='number'?failure.code:null,signal:failure.signal,error:failure};}
 const rpc=mintRpcReceipt(r,input,{startedAtMs,endedAtMs:Date.now(),caller:'parent'});
 // Raw bytes, original remote timestamps and local receipt are kept before parsing/verifying.
 fs.appendFileSync(join(job,'parent-mint-rpc.jsonl'),JSON.stringify({utc:new Date().toISOString(),rpc})+'\n',{mode:0o600});
 if(error){error.transient=error.code===255||error.killed===true||error.code==='ETIMEDOUT';throw error;}
 const observation={...JSON.parse(rpc.stdout),transport:rpc};verifyMintObservation(observation,input,Date.now(),{starting:!started});return observation;
};
const smProbeReply=async()=>{
 const startedAtMs=Date.now();let reply,failure;
 try{reply={...await execute('/usr/bin/python3',['-c',remoteScript],{encoding:null,timeout:40000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',LANG:'C'}}),status:0};}
 catch(error){failure=error;reply={stdout:error.stdout,stderr:error.stderr,status:typeof error.code==='number'?error.code:null,signal:error.signal};}
 // Persist original process bytes and status even if another concurrent probe rejects.
 saveSmProbeReply(reply,{startedAtMs,endedAtMs:Date.now(),sourceSha256:digest(remoteScript),inputSha256:inputSha},record=>{
  fs.appendFileSync(join(job,'parent-sm-probe-raw.jsonl'),JSON.stringify(record)+'\n',{mode:0o600});
 });
 if(failure){failure.transient=true;throw failure;}return reply;
};
const probe=async()=>{
 const tick=Date.now();try{
  if(fatalError)throw fatalError;if(Date.now()>=taskDeadlineMs)throw Error('Task/admission deadline expired');verifyImmutable();
  const [smResult,mintResult]=await Promise.all([smProbeReply(),mint()]);
  const sm={...JSON.parse(smResult.stdout),dnt:'1'};validateSmProbe(sm,validateSample,{starting:!started});verifyMintObservation(mintResult,input,Date.now(),{starting:!started});verifyImmutable();
  const sample={...sm,finishedAt:new Date(sm.finishedAtMs).toISOString(),sites:sm.sites,mintObservation:mintResult};
  fs.appendFileSync(join(job,'actual-probes.jsonl'),JSON.stringify({utc:new Date().toISOString(),probeStartedAtMs:tick,probeFinishedAtMs:Date.now(),smRawStdoutSha256:digest(smResult.stdout),sm,mint:mintResult})+'\n',{mode:0o600});
  if(started&&group){let request;try{request=JSON.parse(privateBytes(join(job,'phase-request.json'),65536));}catch(e){if(e.code!=='ENOENT')throw e;}
   if(request){verifyPhaseRequest(request,{input,inputSha,parentPid:process.pid,workerPid:group});
    const lease={...request,finishedAtMs:sm.finishedAtMs,sm,mint:mintResult};const p=join(job,'sm-lease-'+request.nonce+'-'+Date.now()+'.tmp');fs.writeFileSync(p,JSON.stringify(lease),{flag:'wx',mode:0o600});fs.renameSync(p,join(job,'sm-lease.json'));
   }
  }
  return sample;
 }catch(error){
  if(classifyProbeFailure(error)==='fatal')fatal(error);
  try{fs.appendFileSync(join(job,'probe-errors.jsonl'),JSON.stringify({utc:new Date().toISOString(),message:error.message,classification:classifyProbeFailure(error)})+'\n',{mode:0o600});}catch(auditError){fatal(auditError);}
  return {sites:[],probeError:error.message};
 }
};
const record=entry=>{if(entry.event==='started'){group=entry.processGroup;started=true;}fs.appendFileSync(join(job,'guard.jsonl'),JSON.stringify({utc:new Date().toISOString(),...entry})+'\n',{mode:0o600});};
let code;const workerLogFd=fs.openSync(join(job,'worker-stage.log'),'wx',0o600);guardActive=true;const deadlineTimer=setTimeout(()=>fatal(Error('Task/admission deadline expired')),Math.max(1,taskDeadlineMs-Date.now()));
try{code=await guardedBuild({command:'/home/deck/.local/bin/node',args:[join(sourceRoot,'candidate-worker.mjs'),resolve(inputPath),job,String(process.pid),inputSha],cwd:sourceRoot,record,probe,intervalMs:5000,estimatedUsageGiB:0.05,spawnBuild:(command,args,options)=>{if(command!=='ionice'||JSON.stringify(args.slice(0,5))!==JSON.stringify(['-c','3','nice','-n','19'])||args[5]!=='/home/deck/.local/bin/node')throw Error('Unexpected guard priority/group launch');const exact=outerGuardedInvocation(args.slice(6));return spawn(exact.bin,exact.args,{...options,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C',DNT:'1',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',workerLogFd,workerLogFd]});}});}finally{guardActive=false;clearTimeout(deadlineTimer);fs.closeSync(workerLogFd);}
if(fatalError)throw fatalError;
if(code!==0)throw Error('SM worker failed; all private evidence retained');
// Candidate session stopped; never label HTTP listen as capture/UI/native proof.
verifyImmutable();verifyRuntime(input);const finalGate=await probe();if(finalGate.probeError)throw Error('Final actual candidate gate failed');verifyImmutable();
const ended={...candidateReceiptBinding(input,inputSha),status:'owner-session-ended',utc:new Date().toISOString(),scope:'SM isolated candidate supervision ended; no Mint capture or UI review',timing,finalGate,deployEligible:false,manifestPublished:false,uiReview:'not reviewed',originalRuntimeUnchanged:true};
verifyOwnerSessionReceipt(ended,input,inputSha);
fs.writeFileSync(join(job,'owner-session-ended.json'),JSON.stringify(ended)+'\n',{flag:'wx',mode:0o600});

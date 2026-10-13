import * as fs from 'node:fs';
import {createHash} from 'node:crypto';
import {isAbsolute,join,dirname,resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const digest=b=>createHash('sha256').update(b).digest('hex');
export const sourceRoot=fs.realpathSync(dirname(fileURLToPath(import.meta.url)));
export const sourcePins=Object.freeze({"../guard-next-build.js": "08e7493c25b207952cc2c43bf4a6bcef869266467ea0b48533ed423e3a581d76", "../shared-host-baseline.cjs": "8b0907c5f3b170b333a841d6619d77c8677cfe8d7374ccbb944418727b6a4ee7", "../mint-f1-sm-adapter.js": "7f6112ccd49090915680e03cec11552c9bb3b804eb50d3b5c0d60b3af6fae6e0", "../native-elf-proof.js": "8abd96728fe07cd580b5604583f5a5961d88a89526d51445d5b47e32ee4d11bb", "../mint-f1-artifact.js": "771a1292f48ea4813962f1c2cbd30c806ab62a77de8003f4da1015cd6471bf95", "../mint-f1-candidate-plan.js": "1e5a860ca362dfe25a7265a93101d584c7ac9b1d94d42754618e708bf6f41a90", "../mint-fixture-frontdoor.js": "8388415339877d7e7621641951934fea5e88062563d44b36481ec8c9da5a888c", "../../package.json": "3fd868b63aa70da72f49a0e8af107f14c7df4dcefc63d410eecd0e3821ef1d63"});
export function validatedAttemptSuffix(value=''){if(typeof value!=='string'||! /^(?:|-r(?:[2-9]|[1-9][0-9]{1,2}))$/.test(value))throw Error('Strict optional retry suffix required');return value;}
export function sessionPaths(sessionId,attemptSuffix=''){attemptSuffix=validatedAttemptSuffix(attemptSuffix);if(typeof sessionId!=='string'||!/^batch-[0-9]{3}$/.test(sessionId)||sessionId==='batch-000')throw Error('Strict new batch session required');return {smJob:'/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/candidate-'+sessionId+attemptSuffix,mintControlLeasePath:'/var/lib/observe-worker/tag/candidate-sm-c70425b0-'+sessionId+attemptSuffix+'/lease.json',mintAdmissionPath:'/var/lib/observe-worker/tag/private/sm-candidate-c70425b0-'+sessionId+attemptSuffix+'.json',frontdoorConfigPath:join(sourceRoot,'frontdoor-config-'+sessionId+attemptSuffix+'.json')};}
export const smJob=input=>sessionPaths(input.sessionId,input.attemptSuffix).smJob;
export function sourceBytes(path,max=4*1024*1024){const st=fs.lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.uid!==process.getuid()||(st.mode&0o022)||st.size>max||fs.realpathSync(path)!==resolve(path))throw Error('Canonical owner source required');return fs.readFileSync(path);}
export function privateBytes(path,max=4*1024*1024){const st=fs.lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.uid!==process.getuid()||(st.mode&0o077)||st.size>max)throw Error('Private bounded control/source file required');return fs.readFileSync(path);}
export function verifyInput(input,now=Date.now()){
 const allowed=['schema','sessionId','attemptSuffix','controlOpsSha','sourcePins','reviewed','appSha','opsSha','expiresAtMs','mintLockPid','mintLockDev','mintLockInode','mintPidStartTicks','mintLockCmdlineSha256','mintAdmissionPath','mintAdmissionSha256','mintControlLeasePath','sshConfigSha256','sshKnownHostsSha256','driverPins','frontdoorConfigPath','frontdoorConfigSha256','nativeReceiptPath','nativeReceiptSha256','sshEffectiveHostName','sshEffectiveUser','isolationReceiptId','mintApiPort'];
 if(!input||Object.keys(input).some(key=>!allowed.includes(key)))throw Error('Unknown admission field');
 if(![18131,18137].includes(input.mintApiPort))throw Error('Reviewed Mint API port required');
 const session=sessionPaths(input.sessionId,input.attemptSuffix);if(input.mintControlLeasePath!==session.mintControlLeasePath)throw Error('Fixed Mint controller lease path required');
 const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 if(!(/^[a-f0-9]{40}$/).test(input.controlOpsSha||'')||input.schema!=='sm-isolated-candidate-v1'||input.reviewed!==true||input.appSha!=='677a0c793eeda0c4d850c81ac574c95508d08e0a'||input.opsSha!=='c70425b007bdac9fdbef62b935811ee0d7f30d18'||!Number.isFinite(input.expiresAtMs)||input.expiresAtMs<=now||input.expiresAtMs-now>900000)throw Error('Fresh independently reviewed fixed admission required');
 if(input.mintAdmissionPath!==session.mintAdmissionPath)throw Error('Exact new candidate Mint admission required');
 if(!Number.isInteger(input.mintLockPid)||input.mintLockPid<1||!/^\d+$/.test(input.mintLockDev)||!/^\d+$/.test(input.mintLockInode)||!/^\d+$/.test(input.mintPidStartTicks)||!hex(input.mintLockCmdlineSha256)||!hex(input.mintAdmissionSha256)||!/^\/var\/lib\/observe-worker\/tag\/private\/[a-zA-Z0-9._-]+\.json$/.test(input.mintAdmissionPath))throw Error('Specific external Mint PID/kernel lock/admission required');
 if(typeof input.isolationReceiptId!=='string'||!input.isolationReceiptId.trim()||input.isolationReceiptId.length>200)throw Error('Existing actual fixture isolation receipt required');
 if(input.frontdoorConfigPath!==session.frontdoorConfigPath||!hex(input.frontdoorConfigSha256)||input.nativeReceiptPath!=='/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/native-smoke-job-r2/native-evidence/worker-result.json'||!hex(input.nativeReceiptSha256)||typeof input.sshEffectiveHostName!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9.-]+$/.test(input.sshEffectiveHostName)||input.sshEffectiveUser!=='sky')throw Error('Pinned candidate config/native receipt/SSH effective identity required');
 if(!hex(input.sshConfigSha256)||!hex(input.sshKnownHostsSha256)||!input.driverPins||Object.keys(input.driverPins).some(p=>!isAbsolute(p)||!hex(input.driverPins[p])))throw Error('Reviewed SSH/source pins required');
 const required=[join(sourceRoot,'candidate-parent.mjs'),join(sourceRoot,'candidate-worker.mjs'),join(sourceRoot,'candidate-contract.mjs'),join(sourceRoot,'candidate-core.mjs')];
 if(Object.keys(input.driverPins).length!==required.length||required.some(p=>!hex(input.driverPins[p])))throw Error('All parent/worker/contract/smoke sources must be pinned');
 const expected=Object.fromEntries(Object.entries(sourcePins).map(([name,sha])=>[resolve(sourceRoot,name),sha]));if(!input.sourcePins||Object.keys(input.sourcePins).length!==Object.keys(expected).length||Object.entries(expected).some(([path,sha])=>input.sourcePins[path]!==sha))throw Error('Exact fixed helper source pins required');
 return input;
}
export function verifyControlSource(input){
 const repo=fs.realpathSync(join(sourceRoot,'../..'));
 const git=args=>{
  const result=spawnSync('/usr/bin/git',args,{cwd:repo,encoding:null,timeout:5000,maxBuffer:1024*1024,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C'}});
  if(result.error||result.status!==0)throw Error('Actual control Git provenance unavailable');
  return result.stdout;
 };
 if(!/^[a-f0-9]{40}$/.test(input.controlOpsSha||'')||git(['rev-parse','--show-toplevel']).toString().trim()!==repo||git(['rev-parse','HEAD']).toString().trim()!==input.controlOpsSha||git(['status','--porcelain','--untracked-files=no']).toString().trim())throw Error('Clean exact control commit required');
 for(const [path,sha]of [...Object.entries(input.driverPins),...Object.entries(input.sourcePins)]){
  const name=relative(repo,path);
  if(name.startsWith('../')||isAbsolute(name)||!(/^(?:tools\/[a-zA-Z0-9./_-]+|package\.json)$/).test(name)||digest(git(['show',input.controlOpsSha+':'+name]))!==sha||digest(sourceBytes(path))!==sha)throw Error('Actual control commit blob/source mismatch');
 }
 return true;
}
export function verifySources(input){verifyControlSource(input);for(const [path,sha]of Object.entries(input.sourcePins))if(digest(sourceBytes(path))!==sha)throw Error('Git helper pin differs');for(const [path,sha]of Object.entries(input.driverPins))if(digest(sourceBytes(path))!==sha)throw Error('Reviewed driver pin differs');}
export function verifyMintObservation(observation,input,now=Date.now(),{starting=false}={}){
 if(observation.machineId!=='f80413057e6d4a179e248e5f8c08cac6'||observation.observedHost!=='Mint'||observation.lockHeld!==true||observation.pid!==input.mintLockPid||observation.dev!==input.mintLockDev||observation.inode!==input.mintLockInode||observation.startTicks!==input.mintPidStartTicks||observation.cmdlineSha256!==input.mintLockCmdlineSha256||observation.admissionSha256!==input.mintAdmissionSha256||!Number.isFinite(observation.finishedAtMs))throw Error('Real specific Mint kernel lock/admission mismatch');
 verifyMintTransport(observation,input,now);
 verifyControllerLeaseObservation(observation,input,now);
 if(observation.diskMeasurementPath!=='/var/lib/observe-worker')throw Error('Mint volume path binding mismatch');
 if(!Number.isFinite(observation.load1)||observation.load1<0||observation.load1>12||!Number.isFinite(observation.volumeAvailableBytes)||observation.volumeAvailableBytes<(starting?40:30)*1024**3||!Number.isInteger(observation.localBuildCount)||observation.localBuildCount!==0){const error=Error('Actual Mint resource/concurrent-build gate failed');error.transient=true;throw error;}return true;
}
export function verifyLease(lease,request,input,inputSha,now=Date.now()){
 if(lease.inputSha256!==inputSha||lease.parentPid!==request.parentPid||lease.workerPid!==request.workerPid||lease.phase!==request.phase||lease.nonce!==request.nonce||lease.workerSha256!==input.driverPins[join(sourceRoot,'candidate-worker.mjs')]||!Number.isFinite(lease.finishedAtMs)||lease.finishedAtMs>now||now-lease.finishedAtMs>30000)throw Error('Phase/input/self-bound fresh SM lease required');return lease;
}
export const mintLockScript=`import os,sys,json,time,stat,hashlib,base64
from pathlib import Path
q=json.loads(base64.b64decode(sys.argv[1]))
pid=q['mintLockPid']; p=Path('/run/lock/mint-global-build.lock'); s=p.lstat()
assert stat.S_ISREG(s.st_mode) and not p.is_symlink()
assert str(s.st_dev)==q['mintLockDev'] and str(s.st_ino)==q['mintLockInode']
mid=Path('/etc/machine-id').read_text().strip(); assert mid=='f80413057e6d4a179e248e5f8c08cac6'
ps=Path('/proc/'+str(pid)+'/stat').read_text().rsplit(')',1)[1].split(); assert ps[0] not in ('Z','X') and ps[19]==q['mintPidStartTicks']
cmd=hashlib.sha256(Path('/proc/'+str(pid)+'/cmdline').read_bytes()).hexdigest(); assert cmd==q['mintLockCmdlineSha256']
a=Path(q['mintAdmissionPath']); st=a.lstat(); assert stat.S_ISREG(st.st_mode) and not a.is_symlink() and st.st_mode&0o077==0 and st.st_uid==os.getuid() and st.st_size<=65536
ab=a.read_bytes(); ah=hashlib.sha256(ab).hexdigest(); assert ah==q['mintAdmissionSha256']
ad=json.loads(ab); assert ad['schema']=='mint-specific-sm-candidate-admission-v1' and ad['reviewed'] is True and ad['mintLockPid']==pid and ad['expiresAtMs']==q['expiresAtMs'] and ad['expiresAtMs']>int(time.time()*1000) and ad['opsSha']==q['opsSha'] and ad['appSha']==q['appSha'] and ad['scope']=='sm-isolated-candidate' and ad['buildId']=='PmjYScQDDoJKBr43SLkhd' and ad['artifactInventorySha256']=='f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7'
assert ad['mintControlLeasePath']==q['mintControlLeasePath']=='/var/lib/observe-worker/tag/candidate-sm-c70425b0-'+q['sessionId']+q.get('attemptSuffix','')+'/lease.json'
assert ad.get('attemptSuffix','')==q.get('attemptSuffix','')
assert ad['mintApiPort']==q['mintApiPort'] and ad['sessionId']==q['sessionId'] and ad['controlOpsSha']==q['controlOpsSha']
cp=Path(q['mintControlLeasePath']); cs=cp.lstat(); assert stat.S_ISREG(cs.st_mode) and not cp.is_symlink() and cs.st_mode&0o777==0o600 and cs.st_uid==os.getuid() and cs.st_size<=65536
cb=cp.read_bytes(); control=json.loads(cb); assert control['schema']=='tag-isolated-candidate-lease-v1'
binding=dict(driverSha256=ad['driverSha256'],inputSha256=ad['inputSha256'],planSha256=ad['planSha256'],lockPid=pid,opsSha=ad['opsSha'],controlOpsSha=ad['controlOpsSha'],sessionId=ad['sessionId'],mintApiPort=ad['mintApiPort'])
if q.get('attemptSuffix',''):binding['attemptSuffix']=q['attemptSuffix']
for key,value in binding.items():
 assert control[key]==value
assert all(isinstance(binding[key],str) and len(binding[key])==64 and all(x in '0123456789abcdef' for x in binding[key]) for key in ('driverSha256','inputSha256','planSha256'))
held=False
for line in Path('/proc/locks').read_text().splitlines():
 f=line.split()
 if len(f)<6 or f[1]!='FLOCK' or f[3]!='WRITE': continue
 d=f[5].split(':')
 if len(d)==3 and f[4]==str(pid) and int(d[0],16)==os.major(s.st_dev) and int(d[1],16)==os.minor(s.st_dev) and d[2]==str(s.st_ino): held=True
assert held and p.lstat().st_ino==s.st_ino and p.lstat().st_dev==s.st_dev
disk=os.statvfs('/var/lib/observe-worker'); builds=0
for proc in Path('/proc').iterdir():
 if not proc.name.isdigit(): continue
 try:
  args=(proc/'cmdline').read_bytes().decode().split('\\0'); names=[os.path.basename(x) for x in args]
  if (any(n in ('next','next.js') for n in names) and 'build' in args) or (any(n in ('docker','buildctl','buildkitd') for n in names) and any(a in ('build','buildx','buildkitd') for a in args)): builds+=1
 except (FileNotFoundError,ProcessLookupError): pass
finished=int(time.time()*1000); observed=control.get('observedAtMs'); leaseAge=finished-observed if isinstance(observed,(int,float)) else None
print(json.dumps(dict(observedHost='Mint',machineId=mid,pid=pid,dev=str(s.st_dev),inode=str(s.st_ino),startTicks=ps[19],cmdlineSha256=cmd,admissionSha256=ah,lockHeld=True,mintControlLeasePath=q['mintControlLeasePath'],controllerLeaseBound=True,controllerLeaseSchema=control['schema'],controllerLeaseSha256=hashlib.sha256(cb).hexdigest(),admissionBinding=binding,controllerLeaseBinding={k:control[k] for k in binding},admissionExpiresAtMs=ad['expiresAtMs'],observedAtMs=control.get('observedAtMs'),decision=control.get('decision'),apiReady=control.get('apiReady'),load1=os.getloadavg()[0],diskMeasurementPath='/var/lib/observe-worker',volumeAvailableBytes=disk.f_bavail*disk.f_frsize,localBuildCount=builds,controllerLeaseAgeMs=leaseAge,finishedAtMs=finished)))`;
export function sshArgs(input){const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";const encoded=Buffer.from(JSON.stringify(input)).toString('base64');return ['-F','/home/deck/.ssh/config','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile=/home/deck/.ssh/known_hosts','-o','GlobalKnownHostsFile=/dev/null','-o','ConnectTimeout=5','-o','ConnectionAttempts=1','-o','ClearAllForwardings=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','ControlPersist=no','-o','PermitLocalCommand=no','-o','ForwardAgent=no','-o','RequestTTY=no','-o','ProxyCommand=none','-o','ProxyJump=none','Mint-MBP','python3 -c '+quote(mintLockScript)+' '+quote(encoded)];}
export function verifySshFiles(input){const config=privateBytes('/home/deck/.ssh/config',65536).toString();if(/^\s*Include\b|^\s*Match\b[^\n]*\bexec\b/im.test(config))throw Error('Unpinned include/Match exec config forbidden');if(digest(privateBytes('/home/deck/.ssh/config',65536))!==input.sshConfigSha256||digest(privateBytes('/home/deck/.ssh/known_hosts',262144))!==input.sshKnownHostsSha256)throw Error('SSH foundation pin changed');}
export function classifyProbeFailure(error){return error?.transient===true?'pause':'fatal';}
export function verifyPhaseRequest(request,{input,inputSha,parentPid,workerPid,now=Date.now()}){
 if(request.inputSha256!==inputSha||request.parentPid!==parentPid||request.workerPid!==workerPid||request.workerSha256!==input.driverPins[join(sourceRoot,'candidate-worker.mjs')]||!/^[-a-z]+$/.test(request.phase)||!/^[a-f0-9]{32}$/.test(request.nonce)||!Number.isFinite(request.requestedAtMs)||request.requestedAtMs>now||now-request.requestedAtMs>120000)throw Error('Worker phase request binding mismatch/stale');return request;
}
export function validateSmProbe(sample,validator,{starting=false,now=Date.now()}={}){
 if(sample.machineId!=='302c2528bd464ad0953cf5fa743b6171'||sample.observedHost!=='SM'||sample.measuredFromMachineId!==sample.machineId)throw Error('SM probe own-host binding differs');
 try{if(!Number.isInteger(sample.localSmBuildCount)||sample.localSmBuildCount!==0)throw Error('Actual SM competing build present/unverifiable');validator(sample,{starting,now});}catch(error){error.transient=true;throw error;}return sample;
}

export function verifyControllerLeaseObservation(observation,input,now=Date.now()){
 verifyMintTransport(observation,input,now);
 const effectiveLeaseAgeMs=observation.controllerLeaseAgeMs+(now-observation.transport.startedAtMs);
 const ad=observation.admissionBinding,lease=observation.controllerLeaseBinding,hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 if((ad?.attemptSuffix??'')!==validatedAttemptSuffix(input.attemptSuffix)||(lease?.attemptSuffix??'')!==validatedAttemptSuffix(input.attemptSuffix))throw Error('Attempt admission/lease binding mismatch');
 if(observation.controllerLeaseBound!==true||observation.controllerLeaseSchema!=='tag-isolated-candidate-lease-v1'||observation.mintControlLeasePath!==input.mintControlLeasePath||!hex(observation.controllerLeaseSha256)||observation.admissionExpiresAtMs!==input.expiresAtMs||!ad||!lease||ad.lockPid!==input.mintLockPid||ad.opsSha!==input.opsSha||ad.controlOpsSha!==input.controlOpsSha||ad.sessionId!==input.sessionId||ad.mintApiPort!==input.mintApiPort||['driverSha256','inputSha256','planSha256'].some(key=>!hex(ad[key]))||['driverSha256','inputSha256','planSha256','lockPid','opsSha','controlOpsSha','sessionId','mintApiPort'].some(key=>lease[key]!==ad[key]))throw Error('Mint controller/admission self/input/plan binding mismatch');
 if(observation.decision!=='run'||observation.apiReady!==true||!Number.isFinite(observation.observedAtMs)||!Number.isFinite(observation.controllerLeaseAgeMs)||observation.controllerLeaseAgeMs!==observation.finishedAtMs-observation.observedAtMs||observation.controllerLeaseAgeMs<0||observation.controllerLeaseAgeMs>30000||!Number.isFinite(effectiveLeaseAgeMs)||effectiveLeaseAgeMs>30000){const error=Error('Mint controller API/decision lease paused/stale');error.transient=true;throw error;}
 return true;
}

export function mintRpcReceipt(result,input,{startedAtMs,endedAtMs,caller}){
 const stdoutBytes=Buffer.isBuffer(result.stdout)?result.stdout:Buffer.from(String(result.stdout??'')),stderrBytes=Buffer.isBuffer(result.stderr)?result.stderr:Buffer.from(String(result.stderr??''));
 const stdout=stdoutBytes.toString('utf8'),stderr=stderrBytes.toString('utf8');
 return {schema:'sm-mint-ssh-receipt-v1',smMachineId:'302c2528bd464ad0953cf5fa743b6171',caller,callerSha256:input.driverPins[join(sourceRoot,'candidate-'+caller+'.mjs')],requestSha256:digest(JSON.stringify(sshArgs(input))),sourceScriptSha256:digest(mintLockScript),startedAtMs,endedAtMs,status:result.status??null,signal:result.signal??null,error:result.error?.message??null,stdout,stderr,stdoutBase64:stdoutBytes.toString('base64'),stderrBase64:stderrBytes.toString('base64'),stdoutSha256:digest(stdoutBytes),stderrSha256:digest(stderrBytes)};
}
export function verifyMintTransport(observation,input,now=Date.now()){
 const rpc=observation.transport;
 if(!rpc||rpc.schema!=='sm-mint-ssh-receipt-v1'||rpc.smMachineId!=='302c2528bd464ad0953cf5fa743b6171'||!['parent','worker'].includes(rpc.caller)||rpc.callerSha256!==input.driverPins[join(sourceRoot,'candidate-'+rpc.caller+'.mjs')]||rpc.requestSha256!==digest(JSON.stringify(sshArgs(input)))||rpc.sourceScriptSha256!==digest(mintLockScript)||typeof rpc.stdout!=='string'||typeof rpc.stderr!=='string'||typeof rpc.stdoutBase64!=='string'||typeof rpc.stderrBase64!=='string'||Buffer.from(rpc.stdoutBase64,'base64').toString('base64')!==rpc.stdoutBase64||Buffer.from(rpc.stderrBase64,'base64').toString('base64')!==rpc.stderrBase64||Buffer.from(rpc.stdoutBase64,'base64').toString('utf8')!==rpc.stdout||Buffer.from(rpc.stderrBase64,'base64').toString('utf8')!==rpc.stderr||digest(Buffer.from(rpc.stdoutBase64,'base64'))!==rpc.stdoutSha256||digest(Buffer.from(rpc.stderrBase64,'base64'))!==rpc.stderrSha256)throw Error('Actual source/input-bound SM SSH transport receipt missing/mismatch');
 if(rpc.status!==0||rpc.error||rpc.signal)throw Error('SM SSH transport unsuccessful');
 if(!Number.isFinite(rpc.startedAtMs)||!Number.isFinite(rpc.endedAtMs)||rpc.endedAtMs-rpc.startedAtMs<0||rpc.endedAtMs-rpc.startedAtMs>15000||now-rpc.endedAtMs<0||now-rpc.endedAtMs>10000){const error=Error('Local SM RPC duration/reply freshness invalid');error.transient=true;throw error;}
 const {transport,...raw}=observation;let decoded;try{decoded=JSON.parse(rpc.stdout);}catch{throw Error('Raw Mint response JSON unavailable');}
 if(JSON.stringify(raw)!==JSON.stringify(decoded))throw Error('Raw Mint response was modified after receipt');return true;
}

export function saveSmProbeReply(reply,context,persist){
 const bytes=value=>value===undefined?Buffer.alloc(0):Buffer.isBuffer(value)?value:Buffer.from(value);
 const stdout=bytes(reply.stdout),stderr=bytes(reply.stderr);
 if(stdout.length>65536||stderr.length>65536||!Number.isFinite(context.startedAtMs)||!Number.isFinite(context.endedAtMs)||context.endedAtMs<context.startedAtMs||!(/^[a-f0-9]{64}$/).test(context.sourceSha256)||!(/^[a-f0-9]{64}$/).test(context.inputSha256))throw Error('Bounded actual SM probe receipt required');
 const record={schema:'sm-candidate-probe-raw-v1',...context,status:Number.isInteger(reply.status)?reply.status:null,signal:reply.signal??null,stdoutBase64:stdout.toString('base64'),stderrBase64:stderr.toString('base64'),stdoutSha256:digest(stdout),stderrSha256:digest(stderr)};
 const result=persist(record);if(result===false||result?.then)throw Error('Synchronous raw probe persistence required');return record;
}

export function validateOwnerStop(value,input,inputSha,now=Date.now()){
 const keys=['schema','inputSha256','sessionId','controlOpsSha','requestedAtMs'];
 if(!value||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key))||value.schema!=='sm-isolated-owner-stop-v1'||value.inputSha256!==inputSha||value.sessionId!==input.sessionId||value.controlOpsSha!==input.controlOpsSha||!Number.isFinite(value.requestedAtMs)||now-value.requestedAtMs<0||now-value.requestedAtMs>120000)throw Error('Own current source/input-bound stop request required');
 return true;
}
export function ownerStopRequested(job,input,inputSha){
 if(job!==smJob(input))throw Error('Exact owned session job required');
 try{return validateOwnerStop(JSON.parse(privateBytes(join(job,'owner-stop-request.json'),16384)),input,inputSha);}
 catch(error){if(error.code==='ENOENT')return false;throw error;}
}

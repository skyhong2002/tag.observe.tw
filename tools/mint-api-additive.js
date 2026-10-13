// Additive isolated API plan. No host operations at import; real adapter separately reviewed.
const reasons=new Set(['identity-quarantined','identity-inflight-mismatch','identity-waiter-limit','identity-query-failed','identity-timeout','identity-result-mismatch','verification-failed']);
const phases=new Set(['receipt','runtime-source-isolation','database-identity','post-await-verification']);
export function diagnosticSink(write,{maxBytes=1024**2,now=Date.now}={}){let bytes=0,failed=false;return value=>{
 if(failed)throw Error('Private diagnostic sink unavailable');
 const line=JSON.stringify({schema:'mint-f1-readiness-diagnostic-v1',observedAtMs:now(),phase:phases.has(value?.phase)?value.phase:'verification',reason:reasons.has(value?.reason)?value.reason:'verification-failed'})+'\n';
 try{if(bytes+Buffer.byteLength(line)>maxBytes)throw Error('Private diagnostic cap exceeded');const result=write(line);if(result===false||result?.then)throw Error('Synchronous private sink required');bytes+=Buffer.byteLength(line);}catch{failed=true;throw Error('Private diagnostic sink unavailable');}
 };}
export function planApi(input){
 if(input?.schema!=='mint-api-additive-v1'||typeof input.reviewed!=='boolean'||!/^api-[0-9]{3}$/.test(input.sessionId||'')||input.sessionId==='api-000'||!/^[a-f0-9]{40}$/.test(input.controlOpsSha||''))throw Error('Exact API additive plan required');
 const root='/home/sky/observe-worker/sources/tag-api-additive-'+input.controlOpsSha,job='/var/lib/observe-worker/tag/'+input.sessionId;
 return {reviewed:input.reviewed,controlOpsSha:input.controlOpsSha,sourceRoot:root,job,bridgePath:root+'/tools/mint-f1-api-bootstrap.js',configPath:job+'/bootstrap.json',receiptPath:job+'/readiness.json',ownerPath:job+'/owner.json',diagnosticPath:job+'/diagnostic.jsonl',apiOrigin:'http://127.0.0.1:18137',publicOrigin:'http://100.108.108.109:18196',appRoot:'/var/lib/observe-worker/tag/app-source',databaseConfigPath:'/var/lib/observe-worker/tag/private/db.json',priority:['/usr/bin/ionice','-c','3','/usr/bin/nice','-n','19'],env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C',UV_THREADPOOL_SIZE:'2',VIPS_CONCURRENCY:'1',DNT:'1'},deployEligible:false};
}
export async function startAdditive(input,adapter){
 const plan=planApi(input);if(!plan.reviewed)throw Error('Execution not admitted');
 const keys=['withGuard','freshGate','verifySourcesAndInputs','assert18137Free','prepareExclusive','spawnOwned','verifyOwnedReady','stopOwned','publishOwner'];
 for(const key of keys)if(typeof adapter?.[key]!=='function')throw Error('Reviewed actual adapter missing: '+key);
 const call=async(key,...args)=>{const value=await adapter[key](...args);if(value===false)throw Error('Owner adapter refused: '+key);return value;};
 return call('withGuard',async()=>{let child;
  try{await call('freshGate','start',plan);await call('verifySourcesAndInputs',plan);await call('assert18137Free',plan);await call('prepareExclusive',plan);await call('freshGate','before-start',plan);await call('assert18137Free',plan);
   child=await call('spawnOwned',plan);if(!child||!Number.isInteger(child.pid)||child.pid<1||!/^\d+$/.test(child.startTicks||''))throw Error('Owned new API process required');
   const proof=await call('verifyOwnedReady',child,plan);if(proof?.apiOrigin!==plan.apiOrigin||proof.pid!==child.pid||proof.startTicks!==child.startTicks||proof.socketOwned!==true||proof.sourceVerified!==true||proof.httpReady!==true||proof.legacyUnchanged!==true)throw Error('Actual additive API source/socket/readiness proof required');
   await call('verifySourcesAndInputs',plan);await call('freshGate','before-owner-receipt',plan);await call('publishOwner',{status:'additive-api-persistent',proof,deployEligible:false},plan);return {status:'additive-api-persistent',deployEligible:false};
  }catch(error){if(child)await call('stopOwned',child,plan);throw error;}
 });
}

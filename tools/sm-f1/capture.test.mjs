import test from 'node:test';
import{EventEmitter}from'node:events';
import assert from 'node:assert/strict';
import {admittedTarget,stripHop,ORIGIN} from './proxy.cjs';
import {requireGate,GiB} from './probe.mjs';
import {validateInput,ROUTES,networkCounts,googleURL,bounded,privateBytes,ownStopRequest,validateBrowserLease,waitWatchdog,watchdogLifecycle} from './capture.mjs';
import baseline from '../shared-host-baseline.cjs';
import{homepageSiteFixture}from'../test-fixtures/homepage-probe.mjs';
const now=1000000;
const input=()=>({schema:'sm-f1-capture-input-v1',reviewed:true,executionPermission:true,globalSlotAcknowledged:true,controlOpsSha:'a'.repeat(40),startedReceiptSha256:'b'.repeat(64),expiresAtMs:now+500000,actor:'anonymous',origin:ORIGIN,routes:ROUTES,sessionId:'sm-batch-001',job:'/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-001',startedReceiptPath:'/home/deck/tag-analysis-private/f1-release/simple-web-aff5c028-001/local-candidate-sm-batch-001/candidate-started.json',additionalBuilds:0,additionalBrowsers:0});
const sample=()=>({startedAtMs:now,finishedAtMs:now,resourceObservedAtMs:now,load1:2,availableBytes:50*GiB,memoryAvailableBytes:3*GiB,localBuildRoots:0,localBrowserRoots:0,sites:Object.keys(baseline.siteBudgetsSeconds).map(url=>homepageSiteFixture(url,[.2,.2,.2],{startedAtMs:now}))});
test('pre-launch proxy admits only literal anonymous candidate GET/HEAD',()=>{
 for(const path of ['/','/tag/%E6%9F%AF/','/_next/static/a.js'])for(const method of ['GET','HEAD'])assert.equal(admittedTarget(ORIGIN+path,method)?.origin,ORIGIN);
 for(const value of ['https://google-analytics.com/g/collect','http://127.0.0.1:18199.evil/','http://localhost:18199/','http://127.1:18199/','http://127.0.0.1:18199@evil/','http://user@127.0.0.1:18199/','http://127.0.0.1:18199/#x','/relative','http://127.0.0.1:18199\\@evil/'])assert.equal(admittedTarget(value,'GET'),null);
 for(const method of ['POST','CONNECT','PUT','OPTIONS'])assert.equal(admittedTarget(ORIGIN+'/',method),null);
});
test('dynamic Connection tokens cannot forward credential or framing headers',()=>{
 const raw={connection:'X-Custom, DNT', 'x-custom':'credential',dnt:'0','proxy-authorization':'private','transfer-encoding':'chunked','content-length':'1',accept:'text/html'};
 assert.deepEqual(stripHop(raw),{accept:'text/html'});assert.equal(raw['x-custom'],'credential');
});
test('exact capture approval rejects redirects, expiry, namespaces and excess slots',()=>{
 assert.equal(validateInput(input(),now).sessionId,'sm-batch-001');
 for(const patch of [{reviewed:false},{executionPermission:false},{globalSlotAcknowledged:false},{actor:'admin'},{origin:'https://tag.observe.tw'},{sessionId:'sm-batch-001-r2'},{expiresAtMs:now},{expiresAtMs:now+540001},{additionalBrowsers:2},{routes:['/']},{controlOpsSha:'bad'},{startedReceiptSha256:'bad'}])assert.throws(()=>validateInput({...input(),...patch},now));
});
test('site baselines are end-to-end caps 2 / 6.17 / 2',()=>{
 const s=sample(),i=s.sites.findIndex(r=>r.url.includes('blog'));s.sites[i]=homepageSiteFixture(s.sites[i].url,[1,6.17,8],{startedAtMs:now});requireGate(s,{starting:true,now});
 s.sites[i]=homepageSiteFixture(s.sites[i].url,[1,6.171,8],{startedAtMs:now});assert.throws(()=>requireGate(s,{starting:true,now}));
});
test('transport errors, 5xx and stale samples reject admission',()=>{
 for(const patch of [{finishedAtMs:now-30001},{resourceObservedAtMs:now-5001},{startedAtMs:now-30001},{finishedAtMs:now+1},{load1:12.01},{memoryAvailableBytes:GiB},{availableBytes:39.99*GiB},{localBrowserRoots:2},{localBuildRoots:2}])assert.throws(()=>requireGate({...sample(),...patch},{starting:true,now}));
 for(const patch of [{exitCode:56},{status:500},{total:NaN}]){const s=sample();Object.assign(s.sites[0],patch);assert.throws(()=>requireGate(s,{now}));}
});
test('coordination counts add to actual local roots, never replace them',()=>{
 const s=sample();s.localBuildRoots=1;assert.throws(()=>requireGate(s,{additionalBuilds:1,now}));
 s.localBuildRoots=0;s.localBrowserRoots=1;requireGate(s,{starting:true,now});assert.throws(()=>requireGate(s,{starting:true,additionalBrowsers:1,now}));
 s.localBrowserRoots=2;requireGate(s,{now});assert.throws(()=>requireGate(s,{additionalBrowsers:1,now}));
});
test('actual request attempts, blocked attempts and outgoing count are distinct',()=>{
 assert.equal(googleURL('https://region1.google-analytics.com/g/collect'),true);assert.equal(googleURL('https://google-analytics.com.evil/'),false);
 const h={log:{entries:[{request:{url:ORIGIN+'/'}}]}},rows=[{event:'request',url:ORIGIN+'/'},{event:'response',url:ORIGIN+'/',status:200},{event:'blocked',url:'https://www.googletagmanager.com/gtag/js'}];
 assert.deepEqual(networkCounts(h,rows),{harGoogleRequests:0,recordedGoogleRequests:0,blockedGoogleRequests:1});
 assert.throws(()=>networkCounts({log:{entries:[]}},rows));assert.throws(()=>networkCounts(h,[]));
});
test('bounded cleanup retains timeout/failure verdict and drains timer',async()=>{
 assert.equal(await bounded(Promise.resolve(1),20),1);await assert.rejects(bounded(Promise.reject(Error('original')),20),/original/);
 await assert.rejects(bounded(new Promise(()=>{}),10),/cleanup timeout/);
});
test('absent private receipt does not become simulated candidate evidence',()=>assert.throws(()=>privateBytes('/path-that-does-not-exist/sm-started.json')));

test('capture stop request uses actual candidate identity, not arbitrary PID or input',()=>{
 const r={schema:'sm-f1-candidate-started-v1',sessionId:'sm-batch-001',inputSha256:'a'.repeat(64),owner:{pid:123,startTicks:'456'}};
 assert.deepEqual(ownStopRequest(r,now),{schema:'sm-f1-candidate-stop-v1',sessionId:r.sessionId,inputSha256:r.inputSha256,ownerPid:123,ownerStartTicks:'456',requestedAtMs:now});
 assert.throws(()=>ownStopRequest({...r,sessionId:'../sm-batch-002'},now));assert.throws(()=>ownStopRequest({...r,inputSha256:'invalid'},now));
});

test('browser watchdog lease binds original start, exact input/parent and age',()=>{
 const bind={inputSha256:'a'.repeat(64),parent:{pid:123,startTicks:'456'},now};
 const l={schema:'sm-f1-browser-lease-v1',inputSha256:bind.inputSha256,parentPid:123,parentStartTicks:'456',observedAtMs:now,sample:sample()};validateBrowserLease(l,bind);
 for(const patch of [{inputSha256:'b'.repeat(64)},{parentPid:1},{observedAtMs:now-30001},{observedAtMs:now+1},{sample:{...sample(),startedAtMs:now-30001}}])assert.throws(()=>validateBrowserLease({...l,...patch},bind));
});
test('watchdog readiness refuses failed/unconfirmed child and owns its timer',async()=>{
 const child=()=>Object.assign(new EventEmitter(),{exitCode:null,signalCode:null});let c=child();await waitWatchdog(c,()=>true,100);assert.equal(c.listenerCount('error'),0);
 c=child();c.exitCode=1;await assert.rejects(waitWatchdog(c,()=>true,100),/startup/);assert.equal(c.listenerCount('error'),0);
 c=child();await assert.rejects(waitWatchdog(c,()=>false,10),/timeout/);assert.equal(c.listenerCount('error'),0);
});

test('watchdog always attempts owned cleanup after scan/check error despite a stopped parent',async()=>{
 for(const why of ['registry scan failed','private lease failed','parent STOP']){
  let stops=0,receipt;await assert.rejects(watchdogLifecycle({step:async()=>{throw Error(why);},stop:async()=>{stops++;},record:r=>{receipt=r;},sleep:async()=>assert.fail('exception cannot continue')}),AggregateError);
  assert.equal(stops,1);assert.deepEqual(receipt,{event:'watchdog-finished',failed:true,cleanupFailed:false});
 }
 let stops=0;await watchdogLifecycle({step:async()=>false,stop:async()=>{stops++;},sleep:async()=>assert.fail('unhealthy cannot continue')});assert.equal(stops,1);
});
test('watchdog retains both original and cleanup errors without authorizing capture',async()=>{
 await assert.rejects(watchdogLifecycle({step:async()=>{throw Error('scan');},stop:async()=>{throw Error('stop');}}),e=>e instanceof AggregateError&&e.errors.length===2&&e.errors[0].message==='scan'&&e.errors[1].message==='stop');
});

test('capture and watchdog health gates use three originals and reject one hidden failed trial',()=>{
 const s=sample(),i=s.sites.findIndex(r=>r.url.includes('blog'));s.sites[i]=homepageSiteFixture(s.sites[i].url,[3,8,3],{startedAtMs:now});requireGate(s,{now});
 s.sites[i]=homepageSiteFixture(s.sites[i].url,[3,8,9],{startedAtMs:now});assert.throws(()=>requireGate(s,{now}));
 for(const patch of [{status:500},{status:301},{exitCode:28}]){s.sites[i]=homepageSiteFixture(s.sites[i].url,[3,3,3],{startedAtMs:now,patches:[{},patch]});assert.throws(()=>requireGate(s,{now}));}
});

test('retry uses a new three-digit namespace and binds all evidence paths to it',()=>{
 const q=input(),id='sm-batch-002',next={...q,sessionId:id,job:q.job.replace('sm-batch-001',id),startedReceiptPath:q.startedReceiptPath.replace('sm-batch-001',id)};validateInput(next,now);
 assert.throws(()=>validateInput({...next,startedReceiptPath:q.startedReceiptPath},now));assert.throws(()=>validateInput({...next,job:q.job},now));
 for(const bad of ['sm-batch-000','sm-batch-1000','../sm-batch-002'])assert.throws(()=>validateInput({...next,sessionId:bad},now));
});

test('proxy audit counter commits only after raw evidence and denial classes never expose URL',async()=>{const {commitCounter,deniedClass}=await import('./proxy.cjs');const stats={admitted:0},rows=[];assert.equal(commitCounter(stats,'admitted',()=>false,{event:'admitted'}),false);assert.equal(stats.admitted,0);assert.equal(commitCounter(stats,'admitted',row=>{rows.push(row);return true;},{event:'admitted'}),true);assert.equal(stats.admitted,rows.length);assert.equal(deniedClass('https://googletagmanager.com/SECRET?token=SECRET'),'google');assert.equal(deniedClass('https://unknown.invalid/SECRET?token=SECRET'),'other');assert.equal(deniedClass('http://127.0.0.1:18199/private?SECRET'),'candidate');});

test('actual native DNT/GPC/webdriver is recorded before any goto, including partial failures',async()=>{const {observeNativeBeforeGoto,requireProxyRaw}=await import('./capture.mjs');const calls=[];const page={evaluate:async()=>({DNT:'1',GPC:{present:false,value:null},webdriver:true}),goto:()=>assert.fail('must not navigate in helper')};const state=await observeNativeBeforeGoto(page,x=>calls.push(x),{path:'/'});assert.equal(state.webdriver,true);assert.equal(calls[0].state.GPC.present,false);await assert.rejects(observeNativeBeforeGoto({...page,evaluate:async()=>({DNT:null,GPC:{present:true,value:false},webdriver:true})},x=>calls.push(x),{}),/DNT/);assert.equal(calls.length,2);assert.equal(requireProxyRaw([{event:'admitted'},{event:'denied'}],{admitted:1,denied:1}),true);assert.throws(()=>requireProxyRaw([{event:'admitted'}],{admitted:2,denied:0}),/disagree/);});

test('proxy Google denial class includes analytics.google.com HTTPS and CONNECT without evil suffix matches',async()=>{const {deniedClass}=await import('./proxy.cjs');for(const target of ['analytics.google.com:443','https://analytics.google.com/collect?SECRET','sub.analytics.google.com:443','https://sub.analytics.google.com/collect'])assert.equal(deniedClass(target),'google');for(const target of ['evilanalytics.google.com:443','analytics.google.com.evil.invalid:443','https://evilanalytics.google.com/collect','https://analytics.google.com.evil.invalid/collect'])assert.equal(deniedClass(target),'other');});

test('evidence budget never scans profile/cache; evidence/security failures stay fatal',async()=>{
 const {bytesIn}=await import('./capture.mjs');const root='/private/job',temp=root+'/profile/Default/Cache/Cache_Data/todelete_993ea6d84c25872d_0_1',uid=1000;
 const dirs=[root,root+'/profile',root+'/profile/Default',root+'/profile/Default/Cache',root+'/profile/Default/Cache/Cache_Data'];const stat=(type,patch={})=>({uid,mode:0o700,size:4,isDirectory:()=>type==='directory',isFile:()=>type==='file',isSymbolicLink:()=>type==='symlink',...patch});
 const make=(path,code='ENOENT',patch={})=>({realpathSync:p=>p,readdirSync:p=>dirs.includes(p)?p===dirs.at(-1)?[{name:temp.split('/').at(-1),isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false}]:p===root?[{name:'profile',isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false},{name:'manifest.json',isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false}]:[{name:dirs[dirs.indexOf(p)+1].split('/').at(-1),isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false}]:[],lstatSync:p=>{if(p===path)throw Object.assign(Error('mock fs race'),{code});return dirs.includes(p)?stat('directory'):stat('file',patch);}});
 assert.equal(bytesIn(root,{io:make(temp),uid}),4);assert.equal(bytesIn(root,{io:make(temp,'EACCES'),uid}),4);assert.equal(bytesIn(root,{io:make(dirs[1],'ENOENT'),uid}),4);for(const [path,code]of [[root+'/manifest.json','ENOENT'],[root,'ENOENT']])assert.throws(()=>bytesIn(root,{io:make(path,code),uid}));
 for(const patch of [{uid:999},{mode:0o666},{isFile:()=>false,isSymbolicLink:()=>true},{size:97*1024**2}])assert.throws(()=>bytesIn(root,{io:make('',undefined,patch),uid}));
});

test('cleanup proxy quiescence refuses candidate/CONNECT/new sockets without audit or outgoing window',async()=>{const {startProxy}=await import('./proxy.cjs');let server,upstream=0;const rows=[];const httpModule={createServer:handler=>{server=new EventEmitter();server.handler=handler;server.listen=(_port,_host,done)=>done();server.address=()=>({port:1234});server.close=done=>done();return server;},request:()=>{upstream++;assert.fail('quiesced proxy must not egress');}};const proxy=await startProxy(x=>rows.push(x),{httpModule});proxy.quiesce();let destroyed=0;const socket={destroy:()=>destroyed++};server.handler({url:ORIGIN+'/',method:'GET',socket},{});server.emit('connect',{url:'analytics.google.com:443'},socket);server.emit('connection',socket);assert.equal(destroyed,3);assert.equal(upstream,0);assert.equal(rows.length,1);assert.equal(rows[0].event,'quiesced');await proxy.close();assert.deepEqual(proxy.closedStats,{admitted:0,denied:0,googleOutgoing:0});assert.equal(proxy.failed,false);});
test('closing evidence journal buffers race-sensitive writes, preserves order/cap and failed rows',async()=>{const {cleanupJournal,evidenceFailureClass}=await import('./capture.mjs');const writes=[],journal=cleanupJournal((file,raw)=>writes.push({file,raw}),{maxBytes:8});assert.equal(journal.record('a','1'),false);journal.begin();assert.equal(journal.record('a','12'),true);journal.record('b','34');assert.equal(writes.length,0);journal.flush();assert.deepEqual(writes,[{file:'a',raw:'12'},{file:'b',raw:'34'}]);journal.begin();assert.throws(()=>journal.record('a','123456789'),/cap/);const failed=cleanupJournal((file)=>{if(file==='a')throw Error('append fail');writes.push(file);});failed.begin();failed.record('a','first');failed.record('b','second');assert.throws(()=>failed.flush(),/flush failed/);assert.deepEqual(failed.pending,[{file:'a',raw:'first'}]);assert.ok(writes.includes('b'));const row=evidenceFailureClass({syscall:'lstat',path:'/private/job/profile/SingletonLock'},'/private/job');assert.deepEqual(row,{operation:'lstat',pathClass:'profile-singleton'});assert.ok(!JSON.stringify(row).includes('/private'));assert.equal(evidenceFailureClass({path:'/unknown/SECRET',syscall:'unknown'},'/private/job').pathClass,'unknown');});

test('cleanup closes context/profile before event drain and raw flush; failure still attempts all stages',async()=>{const {closeBrowserEvidence,cleanupJournal}=await import('./capture.mjs');const order=[],errors=[],journal=cleanupJournal((file,raw)=>order.push('write '+raw));journal.begin();await closeBrowserEvidence({closeContext:async()=>{order.push('context');journal.record('requests','during-close');throw Error('context failed');},stopProfile:async()=>{order.push('profile gone');},drain:async()=>{order.push('events');journal.record('requests','final-event');},flush:()=>{order.push('flush');journal.flush();},closeProxy:async()=>order.push('proxy closed'),onError:e=>errors.push(e)});assert.deepEqual(order,['context','profile gone','events','flush','write during-close','write final-event','proxy closed']);assert.equal(errors.length,1);});

test('profile totals only use fixed owned stopped/start phases and capture-specific tiny cache flags',async()=>{const {profileTotal,captureCacheArgs}=await import('./capture.mjs');const profile='/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-011/profile',uid=1000,io={lstatSync:()=>({uid,mode:0o700,isDirectory:()=>true,isSymbolicLink:()=>false}),realpathSync:p=>p};let argv;assert.equal(profileTotal(profile,{uid,io,phase:'before-launch',execute:(bin,args)=>{argv={bin,args};return{status:0,stdout:'1234\t'+profile+'\n'};}}).totalBytes,1234);assert.deepEqual(argv,{bin:'/usr/bin/du',args:['-sx','--block-size=1','--',profile]});assert.deepEqual(captureCacheArgs,['--disk-cache-size=1','--disable-gpu-shader-disk-cache']);for(const opts of [{phase:'running'},{execute:()=>({status:1,stdout:''})},{execute:()=>({status:0,stdout:'NaN'})},{io:{...io,realpathSync:()=>'/foreign'}}])assert.throws(()=>profileTotal(profile,{uid,io,phase:'after-stop',execute:()=>({status:0,stdout:'0\t'+profile+'\n'}),...opts}));});

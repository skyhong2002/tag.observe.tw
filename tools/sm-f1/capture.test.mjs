import test from 'node:test';
import{EventEmitter}from'node:events';
import assert from 'node:assert/strict';
import {admittedTarget,stripHop,ORIGIN} from './proxy.cjs';
import {requireGate,GiB} from './probe.mjs';
import {validateInput,ROUTES,networkCounts,googleURL,bounded,privateBytes,ownStopRequest,validateBrowserLease,waitWatchdog,watchdogLifecycle} from './capture.mjs';
import baseline from '../shared-host-baseline.cjs';
const now=1000000;
const input=()=>({schema:'sm-f1-capture-input-v1',reviewed:true,executionPermission:true,globalSlotAcknowledged:true,controlOpsSha:'a'.repeat(40),startedReceiptSha256:'b'.repeat(64),expiresAtMs:now+500000,actor:'anonymous',origin:ORIGIN,routes:ROUTES,sessionId:'sm-batch-001',job:'/home/deck/tag-analysis-private/f1-release/sm-capture-sm-batch-001',startedReceiptPath:'/home/deck/tag-analysis-private/f1-release/mint-native-target-c70425b0/local-candidate-sm-batch-001/candidate-started.json',additionalBuilds:0,additionalBrowsers:0});
const sample=()=>({startedAtMs:now,finishedAtMs:now,resourceObservedAtMs:now,load1:2,availableBytes:50*GiB,memoryAvailableBytes:3*GiB,localBuildRoots:0,localBrowserRoots:0,sites:Object.keys(baseline.siteBudgetsSeconds).map(url=>({url,status:200,exitCode:0,total:.2}))});
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
 const s=sample();s.sites.find(r=>r.url.includes('blog')).total=6.17;requireGate(s,{starting:true,now});
 s.sites.find(r=>r.url.includes('blog')).total=6.171;assert.throws(()=>requireGate(s,{starting:true,now}));
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
 assert.throws(()=>ownStopRequest({...r,sessionId:'sm-batch-002'},now));assert.throws(()=>ownStopRequest({...r,inputSha256:'invalid'},now));
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

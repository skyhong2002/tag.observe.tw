import test from 'node:test';import assert from 'node:assert/strict';
import{collectHomepageTrials,median3,requireHomepageMedian,parseHomepageTrial}from'./homepage-median-probe.mjs';
import{homepageSiteFixture,curlStdoutFixture}from'./test-fixtures/homepage-probe.mjs';
const urls=['https://tag.observe.tw/','https://blog.observe.tw/','https://youtube.observe.tw/'];
test('a single slow response does not reject; median above cap rejects',()=>{
 assert.equal(median3([3,8,3]),3);requireHomepageMedian(homepageSiteFixture(urls[1],[3,8,3]),6.17);
 assert.throws(()=>requireHomepageMedian(homepageSiteFixture(urls[1],[3,8,9]),6.17));
 requireHomepageMedian(homepageSiteFixture(urls[1],[1,6.17,8]),6.17);
 assert.throws(()=>requireHomepageMedian(homepageSiteFixture(urls[1],[1,6.171,8]),6.17));
});
test('any HTTP non200 or curl error including28 cannot hide in two healthy samples',()=>{
 for(const patch of [{status:500},{status:503},{status:404},{status:301},{status:204},{exitCode:28,stderr:'timeout'},{exitCode:56},{exitCode:1},{transportError:'curl-failed'}])
  for(let i=0;i<3;i++){const patches=[];patches[i]=patch;assert.throws(()=>requireHomepageMedian(homepageSiteFixture(urls[0],[.2,.2,.2],{patches}),2));}
});
test('missing, forged and malformed original measurements fail closed',()=>{
 const make=()=>homepageSiteFixture(urls[0],[.2,.5,.3]);
 for(const mutate of [r=>{r.total=.1;},r=>{r.trials.pop();},r=>{delete r.trials[1].raw;},r=>{r.trials[1].bytes=999;},r=>{r.trials[1].cfCacheStatus='DYNAMIC';},r=>{r.trials[1].raw.url=urls[1];},r=>{r.trials[1].raw.stdoutBase64='broken';},r=>{r.trials[2].index=2;},r=>{r.startedAtMs=-1;}]){const row=make();mutate(row);assert.throws(()=>requireHomepageMedian(row,2));}
 assert.throws(()=>requireHomepageMedian({url:urls[0],status:200,total:.1,ttfb:.1,exitCode:0},2));
 const row=make(),raw={...row.trials[0].raw,stdoutBase64:Buffer.from('incomplete headers').toString('base64')};assert.notEqual(parseHomepageTrial(raw).parseError,null);
});
test('each trial retains CF status and downloaded bytes, including absent CF header',()=>{
 const row=homepageSiteFixture(urls[0],[.1,.2,.3],{patches:[{bytes:17,cfCacheStatus:'HIT'},{bytes:23,cfCacheStatus:'DYNAMIC'},{bytes:0,cfCacheStatus:null}]});requireHomepageMedian(row,2);
 assert.deepEqual(row.trials.map(r=>[r.bytes,r.cfCacheStatus]),[[17,'HIT'],[23,'DYNAMIC'],[0,null]]);
});
test('sampling performs exactly three sequential attempts per site, at most three concurrent curls',async()=>{
 const active=new Set(),counts=new Map(),raws=[],events=[];let maxActive=0,clock=100;
 const result=await collectHomepageTrials({urls,now:()=>clock++,record:r=>{events.push(r.type);if(r.type==='homepage-trial-raw')raws.push(r);},executeCommand:async(bin,args,opts)=>{
  assert.equal(bin,'/usr/bin/curl');assert.ok(args.includes('DNT: 1'));assert.ok(args.includes('Accept: text/html'));assert.ok(args.includes('-D'));assert.ok(!args.includes('-L'));assert.ok(!args.includes('--cookie'));
  assert.deepEqual(opts.env,{PATH:'/usr/bin:/bin',LANG:'C'});const url=args.at(-1);assert.ok(!active.has(url));active.add(url);maxActive=Math.max(maxActive,active.size);counts.set(url,(counts.get(url)||0)+1);
  await Promise.resolve();active.delete(url);return{stdout:curlStdoutFixture({total:counts.get(url)===2?8:.5,cfCacheStatus:'DYNAMIC'}),stderr:''};
 }});
 assert.equal(maxActive,3);assert.deepEqual([...counts.values()],[3,3,3]);assert.equal(raws.length,9);assert.equal(events.filter(x=>x==='homepage-trial').length,9);
 for(const row of result){requireHomepageMedian(row,2);assert.equal(row.total,.5);assert.deepEqual(row.trials.map(x=>x.index),[1,2,3]);for(const t of row.trials)assert.ok(t.endedAtMs>=t.startedAtMs);}
});
test('failed transport raw is recorded before parse, all nine attempts retained',async()=>{
 let calls=0;const events=[];
 const rows=await collectHomepageTrials({urls,record:r=>events.push(r),executeCommand:async()=>{calls++;if(calls===2)throw Object.assign(Error('timeout'),{code:28,stdout:curlStdoutFixture({status:0,total:10,ttfb:0,bytes:0,cfCacheStatus:null}),stderr:'curl: timed out'});return{stdout:curlStdoutFixture(),stderr:''};}});
 assert.equal(calls,9);const raw=events.find(r=>r.type==='homepage-trial-raw'&&r.exitCode===28);assert.ok(raw);assert.ok(raw.stderrBytes>0);assert.match(Buffer.from(raw.stderrBase64,'base64').toString(),/timed out/);
 const decoded=events.find(r=>r.type==='homepage-trial'&&r.sample.exitCode===28);assert.ok(events.indexOf(raw)<events.indexOf(decoded));assert.throws(()=>requireHomepageMedian(rows[1],6.17));
});
test('failed/async receipt sink rejects rather than considering unsaved results',async()=>{
 for(const record of [()=>false,()=>Promise.resolve()])await assert.rejects(collectHomepageTrials({urls,record,executeCommand:async()=>({stdout:curlStdoutFixture(),stderr:''})}),/durable/);
});

test('quoted curl status000 preserves failed metrics; null numeric metrics are rejected',async()=>{
 const events=[];const rows=await collectHomepageTrials({urls,record:r=>events.push(r),executeCommand:async()=>({stdout:curlStdoutFixture({total:.5}).replace('"http_code":200','"http_code":"200"'),stderr:''})});
 for(const row of rows)requireHomepageMedian(row,2);
 const failed=await collectHomepageTrials({urls,executeCommand:async()=>{throw Object.assign(Error('timeout'),{code:28,stdout:curlStdoutFixture({status:0,total:10,ttfb:0,bytes:0,cfCacheStatus:null}).replace('\"http_code\":0','\"http_code\":\"000\"'),stderr:'timed out'});}});
 for(const row of failed){assert.equal(row.trials[0].status,0);assert.equal(row.trials[0].bytes,0);assert.equal(row.trials[0].parseError,null);assert.throws(()=>requireHomepageMedian(row,2));}
 for(const patch of [{total:null},{ttfb:null},{bytes:null},{status:null}])assert.throws(()=>requireHomepageMedian(homepageSiteFixture(urls[0],[.5,.5,.5],{patches:[{},patch]}),2));
});

test('receipt failure stops new trials and waits for already started curls before rejecting',async()=>{
 let active=0,started=0,finished=0,rejected=false;const waiting=[],rows=[];
 const cohort=collectHomepageTrials({urls,record:r=>{rows.push(r);if(r.url===urls[0])throw Error('disk failure');},executeCommand:async()=>{started++;active++;return await new Promise(ok=>waiting.push(()=>{active--;finished++;ok({stdout:curlStdoutFixture(),stderr:''});}));}}).catch(e=>{rejected=true;throw e;});
 const asserted=assert.rejects(cohort,/disk failure/);await Promise.resolve();assert.equal(active,3);waiting[0]();await new Promise(ok=>setImmediate(ok));
 assert.equal(rejected,false);assert.equal(started,3);assert.equal(active,2);waiting[1]();waiting[2]();await asserted;
 assert.equal(finished,3);assert.equal(active,0);assert.equal(started,3);assert.ok(rows.some(r=>r.type==='homepage-trial-raw'&&r.url===urls[2]));
 let later=0;await collectHomepageTrials({urls,executeCommand:async()=>{assert.equal(active,0);later++;return{stdout:curlStdoutFixture(),stderr:''};}});assert.equal(later,9);
});

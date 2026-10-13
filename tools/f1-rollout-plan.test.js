import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCommands, runtimeCommands, validBuildOrigin, image } from './f1-rollout-plan.js';
const sha = 'ae9e18e581ec274b756995edbfe3c8cb9533ee5b';
test('existing isolated build origin 18170 is accepted, production and nonlocal origins rejected', () => {
  assert.equal(validBuildOrigin('http://127.0.0.1:18170'), true);
  for (const value of ['http://127.0.0.1:18130', 'http://tag.observe.tw:18170', 'https://127.0.0.1:18170', 'http://user:pass@127.0.0.1:18170', 'http://127.0.0.1:18170/path']) assert.equal(validBuildOrigin(value), false);
});
test('route commands preserve exact scoped rule and root host capabilities', () => {
  const rule = ['OUTPUT','-p','tcp','-d','127.0.0.1/32','--dport','18130','-m','comment','--comment',`tag-f1-${sha}`,'-j','REDIRECT','--to-ports','18194'];
  const prefix = ['docker','run','--rm','--pull=never','--user','0:0','--network','host','--cap-add','NET_ADMIN','--cap-add','SYS_CHROOT','--mount','type=bind,src=/,dst=/host,readonly','--entrypoint','/usr/sbin/chroot',image,'/host','/usr/sbin/iptables','-w','5','-t','nat'];
  assert.deepEqual(routeCommands(sha), {check:[...prefix,'-C',...rule],switch:[...prefix,'-I','OUTPUT','1',...rule.slice(1)],rollback:[...prefix,'-D',...rule]});
  assert.throws(() => routeCommands('short'));
});
test('runtime configuration uses same candidate and overrides isolated build API', () => {
  const commands = runtimeCommands({sha,candidate:'/candidate',standaloneWeb:'/candidate/web/.next/standalone/web',envFile:'/private/.env'});
  assert.ok(commands.web.includes('--setenv=TAG_API_ORIGIN=http://127.0.0.1:18194'));
  assert.ok(commands.gateway.includes('--setenv=UI_ORIGIN=http://127.0.0.1:18192'));
  assert.ok(commands.gateway.includes('--property=EnvironmentFile=/private/.env'));
  assert.ok(commands.worker.includes('--setenv=WORKER_METRICS_PORT=18195'));
  for (const args of Object.values(commands)) assert.ok(args.some(x => x.startsWith('--unit=tag-f1-ae9e18e581ec-')));
});
import { persistentPlan } from './f1-rollout-plan.js';
import { mayFallback } from './f1-rollout-frontdoor.js';
test('persistent pool and reviewed admission marker gate route at reboot; rollback never starts old consumer', () => {
  const plan = persistentPlan({opsSha:'b'.repeat(40),opsManifestHash:'c'.repeat(64),sha,candidate:'/candidate',standaloneWeb:'/candidate/web',envFile:'/private/.env'});
  const route = plan.units['tag-f1-ae9e18e581ec-route.service'];
  assert.match(route,/ConditionPathExists=.*admission-reviewed/);
  assert.match(route,/After=.*-worker.service/);
  assert.match(route,/ExecStop=.* stop /);
  assert.match(plan.units['tag-f1-ae9e18e581ec-gateway.service'],/UI_ORIGIN=http:\/\/127.0.0.1:18197/);
  assert.deepEqual(plan.commands.rollbackReader,['systemctl','--user','stop','tag-f1-ae9e18e581ec-route.service']);
  assert.equal(plan.commands.preserveAndMaskOldWorker[1][2],'/dev/null');
});
test('fallback applies only to immutable static GET 404, never API RSC or mutation', () => {
  assert.equal(mayFallback('GET','/_next/static/chunks/old.js',404),true);
  for (const [method,path,status] of [['POST','/_next/static/x',404],['GET','/api/account',404],['GET','/page?_rsc=x',404],['GET','/_next/static/x',200],['GET','/_next/static/%2e%2e/api/private',404],['GET','/_next/static/a%5cb',404]]) assert.equal(mayFallback(method,path,status),false);
});
test('header-aware fallback rejects RSC/router requests including empty and mixed-case headers', () => {
  for (const header of ['rsc','RSC','next-router-state-tree','next-router-prefetch','next-router-segment-prefetch']) assert.equal(mayFallback('GET','/_next/static/x',404,{[header]:''}),false);
  assert.equal(mayFallback('GET','/_next/static/x',404,{cookie:'private',authorization:'Bearer private'}),true);
});
import http from 'node:http';
import { createFrontdoor } from './f1-rollout-frontdoor.js';
test('isolated mock fallback preserves new response and strips old upstream credentials', async t => {
  const observed = [];
  const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
  const close = server => new Promise(resolve => {server.close(resolve);server.closeAllConnections();});
  const old = http.createServer((req,res)=> {observed.push({url:req.url,headers:req.headers});res.end('old chunk');});
  const next = http.createServer((req,res)=> {if(req.url === '/_next/static/new.js')res.end('new chunk');else {res.statusCode=404;res.end('new missing');}});
  const oldPort = await listen(old), newPort = await listen(next);
  const front = createFrontdoor({newPort,oldPort});const frontPort = await listen(front);
  t.after(async()=>{await close(front);await close(next);await close(old);});
  const get = (path,headers={})=>fetch(`http://127.0.0.1:${frontPort}${path}`,{headers});
  assert.equal(await (await get('/_next/static/new.js')).text(),'new chunk');
  assert.equal(await (await get('/_next/static/old.js',{cookie:'secret',authorization:'Bearer secret'})).text(),'old chunk');
  assert.equal(observed.length,1);assert.equal(observed[0].headers.cookie,undefined);assert.equal(observed[0].headers.authorization,undefined);
  assert.equal((await get('/api/private')).status,404);
  assert.equal((await get('/_next/static/old.js',{RSC:'1'})).status,404);
  assert.equal(observed.length,1);
});
import { applyRoute, expectedWorkerPolicy } from './f1-rollout-route.js';
import { snapshotPlan } from './f1-rollout-plan.js';
import { stripHopHeaders } from './f1-rollout-frontdoor.js';
test('route rejects HTTP failures, redirects, policy mismatch, and iptables errors without inserting', async () => {
  for (const status of [401,404,302,500]) {
    const calls=[];
    await assert.rejects(applyRoute('start',sha,{fetchFn:async()=>({status}),run:args=>{calls.push(args);return 1;}}));assert.equal(calls.length,0);
  }
  const okFetch=async(url,options)=>{assert.equal(options.redirect,'error');return {status:200,json:async()=>({status:'ok',legacyOwnershipPolicy:expectedWorkerPolicy})};};
  const calls=[];await assert.rejects(applyRoute('start',sha,{fetchFn:okFetch,run:args=>{calls.push(args);return 2;}}));assert.equal(calls.length,1);
  await assert.rejects(applyRoute('start',sha,{fetchFn:async()=>{throw Error('redirect or transport');},run:()=>{throw Error('must not run');}}));
  await assert.rejects(applyRoute('start',sha,{fetchFn:async()=>({status:200,json:async()=>({status:'ok',legacyOwnershipPolicy:'unsafe'})}),run:()=>{throw Error('must not run');}}));
  const stop=[];await applyRoute('stop',sha,{run:args=>{stop.push(args);return 0;},fetchFn:()=>{throw Error('stop must not fetch');}});assert.deepEqual(stop,[routeCommands(sha).check,routeCommands(sha).rollback]);
});
test('ops snapshot pins exact full ops commit and boot verification, separately from application commit', () => {
  const opsSha='b'.repeat(40);const snapshot=snapshotPlan(opsSha,path=>Buffer.from('blob:'+path));
  const plan=persistentPlan({sha,opsSha,opsManifestHash:snapshot.manifestHash,candidate:'/candidate',standaloneWeb:'/candidate/web',envFile:'/private/.env'});
  assert.ok(snapshot.commands.archive.includes(opsSha));assert.equal(snapshot.commands.createExclusive[0],'mkdir');
  assert.match(plan.units['tag-f1-ae9e18e581ec-route.service'],/ExecStartPre=\/usr\/bin\/python3/);
  assert.ok(plan.units['tag-f1-ae9e18e581ec-route.service'].includes(snapshot.manifestHash));
  const gateway=plan.units['tag-f1-ae9e18e581ec-gateway.service'];assert.match(gateway,/ExecStart=\/usr\/bin\/env .*PORT=18194.*UI_ORIGIN=http:\/\/127.0.0.1:18197/);
  assert.notEqual(plan.opsDirectory,plan.evidenceDirectory);
});
test('hop headers and connection nominated fields stripped; HSTS/cache preserved', () => {
  assert.deepEqual(stripHopHeaders({Connection:'keep-alive, X-private','X-private':'secret','Keep-Alive':'5','Transfer-Encoding':'chunked','Strict-Transport-Security':'max-age=1','Cache-Control':'no-store'}),{'Strict-Transport-Security':'max-age=1','Cache-Control':'no-store'});
});
test('aborted incoming stream closes proxy without uncaught errors', async t => {
  const next=http.createServer((req,res)=>{req.on('error',()=>{});req.on('aborted',()=>{});});
  await new Promise(resolve=>next.listen(0,'127.0.0.1',resolve));
  const front=createFrontdoor({newPort:next.address().port,oldPort:next.address().port});
  await new Promise(resolve=>front.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{for(const server of [front,next]){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}});
  await new Promise(resolve=>{const req=http.request({host:'127.0.0.1',port:front.address().port,method:'POST',path:'/api/upload',headers:{'content-length':'9999'}});req.on('error',resolve);req.on('close',resolve);req.write('partial');setTimeout(()=>req.destroy(),10);});
});
import { validateExecutingOps } from './f1-rollout-plan.js';
test('executing canonical modules must match selected immutable ops commit', () => {
  const snapshot=snapshotPlan('b'.repeat(40),path=>Buffer.from('canonical:'+path));
  assert.equal(validateExecutingOps(snapshot,'/mock',path=>Buffer.from('canonical:'+path.slice('/mock/'.length))),true);
  assert.throws(()=>validateExecutingOps(snapshot,'/mock',()=>Buffer.from('newer module')),/differs from selected ops commit/);
});
test('unit staging uses exclusive writable evidence and never read-only ops snapshot', () => {
  const plan=persistentPlan({sha,opsSha:'b'.repeat(40),opsManifestHash:'c'.repeat(64),candidate:'/candidate',standaloneWeb:'/candidate/web',envFile:'/private/.env'});
  assert.deepEqual(plan.commands.createUnitStageExclusive,['mkdir','-m','700',plan.evidenceDirectory+'/units']);
  for(const args of plan.commands.stageUnitFiles){assert.equal(args[1],'-m');assert.equal(args[2],'600');assert.ok(args[3].startsWith(plan.evidenceDirectory+'/units/'));assert.ok(!args[3].startsWith(plan.opsDirectory+'/'));}
});

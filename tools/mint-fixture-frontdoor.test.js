import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {validateConfig,requestPlan,createHandler,batchHeader,bodyCap,candidateCsp} from './mint-fixture-frontdoor.js';
const now=100000;const config=(actor='anonymous',allowMutations=false)=>({bindIp:'100.108.108.109',port:18196,nextOrigin:'http://127.0.0.1:18195',apiOrigin:'http://127.0.0.1:18131',actor,allowMutations,batchSecret:'a'.repeat(64),expiresAt:now+60000});
const request=(url='/',method='GET',extra={})=>({url,method,headers:{host:'100.108.108.109:18196',...extra}});
test('pinned Tailscale bind/upstreams and fresh batch required',()=>{validateConfig(config(),now);for(const patch of [{bindIp:'127.0.0.1'},{bindIp:'100.1.1.1'},{apiOrigin:'https://tag.observe.tw'},{port:1},{actor:'new-user'},{expiresAt:now},{expiresAt:now+1800001},{allowMutations:true}])assert.throws(()=>validateConfig({...config(),...patch},now));});
test('public Next assets and API/me same origin; external credentials stripped and fixture selected server-side',()=>{
 assert.equal(requestPlan(config(),request('/_next/static/test.js'),now).origin,config().nextOrigin);
 for(const path of ['/api/status','/api/v1/tag/x','/auth/me'])assert.equal(requestPlan(config(),request(path),now).origin,config().apiOrigin);
 const p=requestPlan(config('admin'),request('/auth/me','GET',{[batchHeader]:'a'.repeat(64),cookie:'real',authorization:'real','x-api-key':'real','x-service-token':'real','x-f1-fixture-actor':'reader','x-forwarded-for':'real',forwarded:'real',connection:'x-private','x-private':'drop',dnt:'1'}),now);
 assert.equal(p.headers['x-f1-fixture-actor'],'admin');for(const name of ['cookie','authorization','x-api-key','x-service-token','x-forwarded-for','forwarded',batchHeader,'x-private'])assert.equal(p.headers[name],undefined);assert.equal(p.headers.dnt,'1');
 assert.throws(()=>requestPlan(config('admin'),request('/'),now));assert.throws(()=>requestPlan(config('admin'),request('/','GET',{[batchHeader]:'b'.repeat(64)}),now));
});
test('status HTML stays on Next while its JSON data request stays on the isolated API',()=>{
 for(const method of ['GET','HEAD']){
  assert.equal(requestPlan(config(),request('/api/status/',method),now).origin,config().nextOrigin);
  assert.equal(requestPlan(config(),request('/api/status',method),now).origin,config().apiOrigin);
 }
 assert.throws(()=>requestPlan(config(),request('/api/unknown/'),now));
 assert.throws(()=>requestPlan(config(),request('/api/status/','POST'),now));
});
test('reject foreign authority/URL/traversal and real auth/jobs/users',()=>{for(const path of ['http://foreign/x','//foreign/x','/%2e%2e/x','/a/../x','/a%2fb','/%252e%252e/x','/x\\y','/auth/google','/auth/logout','/auth/admin/users','/auth/admin/jobs','/auth/me/prefs','/auth/pictures/jobs/1'])assert.throws(()=>requestPlan(config(),request(path),now),path);assert.throws(()=>requestPlan(config(),request('/','GET',{host:'foreign'}),now));});
test('mutations opt-in narrow methods/routes actor+origin+batch; admin review is PUT not POST',()=>{
 const h={[batchHeader]:'a'.repeat(64),origin:'http://100.108.108.109:18196'};
 for(const path of ['/auth/tags/x/relations','/auth/pictures/x/upload'])assert.equal(requestPlan(config('reader',true),request(path,'POST',h),now).mutation,true);
 assert.equal(requestPlan(config('admin',true),request('/auth/admin/tag-submissions/22','PUT',h),now).mutation,true);
 for(const [c,path,method,headers]of [[config('reader',false),'/auth/tags/x/relations','POST',h],[config('reader',true),'/auth/admin/tag-submissions/22','PUT',h],[config('admin',true),'/auth/admin/tag-submissions/22','POST',h],[config('reader',true),'/auth/tags/x/relations','POST',{...h,origin:'http://foreign'}],[config('reader',true),'/auth/tags/x/relations?x=1','POST',h],[config('admin',true),'/auth/pictures/x/vote','PUT',h]])assert.throws(()=>requestPlan(c,request(path,method,headers),now));
});
function fakeResponse(){const r=new EventEmitter();r.headersSent=false;r.write=()=>true;r.writeHead=(code,headers)=>{r.status=code;r.headers=headers;r.headersSent=true;};r.end=()=>{r.ended=true;r.emit('close');};r.destroy=()=>{r.destroyed=true;r.emit('close');};return r;}
test('mock handler rejects oversized body before connecting, strips SetCookie, no-store and blocks redirect',async()=>{
 let calls=0;let options;const upstream=(url,opts,callback)=>{calls++;options=opts;const u=new EventEmitter();u.destroy=()=>{};u.end=()=>{const incoming=Readable.from(['ok']);incoming.statusCode=200;incoming.headers={'set-cookie':'real','cache-control':'public'};callback(incoming);};return u;};
 const r=Readable.from([]);Object.assign(r,request('/api/status'));const response=fakeResponse();await createHandler(config(),{now:()=>now,requestUpstream:upstream})(r,response);assert.equal(calls,1);assert.equal(response.headers['set-cookie'],undefined);assert.equal(response.headers['cache-control'],'private, no-store');
 const big=Readable.from([]);Object.assign(big,request('/','GET',{'content-length':String(bodyCap+1)}));const denied=fakeResponse();await createHandler(config(),{now:()=>now,requestUpstream:upstream})(big,denied);assert.equal(denied.status,413);assert.equal(calls,1);
 const expired=Readable.from([]);Object.assign(expired,request('/'));const e=fakeResponse();let time=now;const handler=createHandler(config(),{now:()=>time,requestUpstream:upstream});time+=61000;await handler(expired,e);assert.equal(e.status,403);assert.equal(calls,1);
 const redirect=Readable.from([]);Object.assign(redirect,request('/'));const rr=fakeResponse();await createHandler(config(),{now:()=>now,requestUpstream:(url,opts,cb)=>{const u=new EventEmitter();u.destroy=()=>{};u.end=()=>{const i=Readable.from([]);i.statusCode=302;i.headers={location:'https://foreign/'};cb(i);};return u;}})(redirect,rr);assert.equal(rr.status,502);
});
function mockedExchange(c=config('reader',true)) {
 const state={calls:0,cancels:0,destroys:0,payload:null};const pending=new Set();
 const deps={now:()=>now,schedule:()=>{const token={unref(){}};pending.add(token);return token;},cancel:token=>{if(pending.delete(token))state.cancels++;},requestUpstream:(url,options,cb)=>{state.calls++;state.url=url;state.options=options;const upstream=new EventEmitter();upstream.destroy=()=>{state.destroys++;};upstream.end=payload=>{state.payload=payload;state.callback=cb;};state.upstream=upstream;return upstream;}};
 const handler=createHandler(c,deps);return {state,deps,pending,handler};
}
function mutationRequest(chunks){const r=Readable.from(chunks);Object.assign(r,request('/auth/tags/x/relations','POST',{[batchHeader]:'a'.repeat(64),origin:'http://100.108.108.109:18196','content-type':'application/json'}));return r;}
test('real handler mock forwards opt-in fixture mutation body with credentials stripped',async()=>{
 const f=mockedExchange();const r=mutationRequest([Buffer.from('{"reason":"fixture"}')]);const resp=fakeResponse();await f.handler(r,resp);
 assert.equal(f.state.url,'http://127.0.0.1:18131/auth/tags/x/relations');assert.equal(f.state.options.method,'POST');assert.equal(f.state.options.headers['x-f1-fixture-actor'],'reader');assert.equal(f.state.options.headers[batchHeader],undefined);assert.equal(f.state.payload.toString(),'{"reason":"fixture"}');
 const incoming=new EventEmitter();incoming.headers={connection:'x-hop, cache-control','x-hop':'drop','cache-control':'public','set-cookie':'real','content-security-policy':"default-src *"};incoming.statusCode=200;incoming.destroy=()=>{f.state.incomingDestroyed=true;};incoming.pipe=()=>{};
 f.state.callback(incoming);assert.equal(resp.headers['x-hop'],undefined);assert.equal(resp.headers['cache-control'],'private, no-store');assert.equal(resp.headers['set-cookie'],undefined);assert.equal(resp.headers['content-security-policy'],candidateCsp);assert.ok(!candidateCsp.includes('https:'));assert.ok(candidateCsp.includes("connect-src 'self'"));
 incoming.emit('aborted');assert.ok(resp.destroyed);assert.ok(f.state.incomingDestroyed);assert.equal(f.pending.size,0);
});
test('body chunk cap/read-only body/log failure fail before upstream and cancel timer',async()=>{
 for(const mode of ['chunkcap','readbody','logfailure','asynclog']){
  const f=mockedExchange();if(mode==='logfailure')f.deps.log=()=>{throw Error('audit disk failed');};if(mode==='asynclog')f.deps.log=async()=>{throw Error('async audit failed');};const handler=createHandler(config('reader',true),f.deps);
  const r=mode==='chunkcap'?mutationRequest([Buffer.alloc(bodyCap),Buffer.from('x')]):mutationRequest([Buffer.from('x')]);if(mode==='readbody')Object.assign(r,request('/','GET',{[batchHeader]:'a'.repeat(64)}));
  const resp=fakeResponse();await handler(r,resp);assert.equal(f.state.calls,0);assert.equal(resp.status,mode==='chunkcap'?413:mode==='readbody'?400:403);assert.equal(f.pending.size,0);
 }
});
test('expiry during body and aborted request never connect upstream',async()=>{
 const f=mockedExchange();let time=now;f.deps.now=()=>time;const handler=createHandler(config('reader',true),f.deps);
 const r=mutationRequest((async function*(){yield Buffer.from('first');time+=61000;yield Buffer.from('last');})());const resp=fakeResponse();await handler(r,resp);assert.equal(resp.status,403);assert.equal(f.state.calls,0);assert.equal(f.pending.size,0);
});
test('upstream error/response error and client close destroy connections and clear deadline',async()=>{
 for(const mode of ['upstream','incoming','client']){
  const f=mockedExchange();const resp=fakeResponse();await f.handler(mutationRequest([]),resp);
  if(mode==='upstream'){f.state.upstream.emit('error',Error('upstream failed'));assert.equal(resp.status,502);}
  if(mode==='incoming'){const incoming=new EventEmitter();incoming.statusCode=200;incoming.headers={};incoming.destroy=()=>{};incoming.pipe=()=>{};f.state.callback(incoming);incoming.emit('error',Error('stream failure'));assert.ok(resp.destroyed);}
  if(mode==='client')resp.emit('close');
  assert.ok(f.state.destroys>=1);assert.equal(f.pending.size,0);
 }
});
test('aborted upload stops before upstream and clears body deadline',async()=>{
 const f=mockedExchange();const resp=fakeResponse();let r;
 r=mutationRequest((async function*(){yield Buffer.from('first');r.emit('aborted');yield Buffer.from('last');})());
 await f.handler(r,resp);assert.ok(resp.destroyed);assert.equal(f.state.calls,0);assert.equal(f.pending.size,0);
});
test('optimizer admits only canonical reviewed local static and denies server-side external egress before upstream',async()=>{
 const optimizer=value=>'/_next/image?'+new URLSearchParams({url:value,w:'256',q:'75'});
 for(const image of ['/favicons/people.png','/favicons/people.png?v=abc_12','/pwa/icon-192.png'])assert.equal(requestPlan(config(),request(optimizer(image)),now).origin,config().nextOrigin);
 const blocked=['https://www.googletagmanager.com/gtm.js','https://www.google-analytics.com/x','http://foreign/x','//foreign/x','http://127.0.0.1:18131/auth/me','http://169.254.169.254/x','%68ttps://foreign/x','/favicons/%2e%2e/x.png','/favicons/%252e%252e/x.png','/favicons/../people.png','/auth/pictures/x/candidates/1','/api/v1/tags/x/pictures/1/image','/pwa/icon-192.png?v=x','/favicons/people.png?url=https://foreign','/favicons/people.png?v=x&v=y'];
 for(const image of blocked){const f=mockedExchange(config());const r=Readable.from([]);Object.assign(r,request(optimizer(image)));const response=fakeResponse();await f.handler(r,response);assert.equal(response.status,403,image);assert.equal(f.state.calls,0);}
 for(const query of ['url=/favicons/people.png&url=https://foreign&w=256&q=75','url=/favicons/people.png&w=256&q=75&x=x','url=/favicons/people.png&w=9999&q=75','url=/favicons/people.png&w=256&w=256&q=75'])assert.throws(()=>requestPlan(config(),request('/_next/image?'+query),now));
 assert.throws(()=>requestPlan(config(),request('/_next/%69mage?url=/favicons/people.png&w=256&q=75'),now));
});

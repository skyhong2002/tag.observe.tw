// Opt-in fixture frontdoor. Importing this module opens no listener.
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const candidateCsp = "default-src 'self'; base-uri 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'; form-action 'self'";
export const batchHeader = 'x-f1-fixture-batch';
export const bodyCap = 8 * 1024 ** 2; // Existing isolated bootstrap cap; image route itself allows 15 MiB.
export const fixtureActors = Object.freeze({ anonymous: null, reader: 701, other: 702, admin: 703 });
const hop = ['connection','proxy-connection','keep-alive','te','trailer','transfer-encoding','upgrade','proxy-authorization','proxy-authenticate'];
export function validateConfig(c, now = Date.now()) {
 if (!c || isIP(c.bindIp) !== 4 || !/^100\./.test(c.bindIp) || Number(c.bindIp.split('.')[1]) < 64 || Number(c.bindIp.split('.')[1]) > 127 || !Object.hasOwn(fixtureActors,c.actor)) throw Error('Explicit Mint Tailscale IPv4 and fixed fixture actor required');
 if (c.port !== 18196 || c.nextOrigin !== 'http://127.0.0.1:18195' || c.apiOrigin !== 'http://127.0.0.1:18131' || typeof c.allowMutations !== 'boolean') throw Error('Only pinned candidate frontdoor/upstreams permitted');
 if (!Number.isFinite(c.expiresAt) || c.expiresAt <= now || c.expiresAt-now > 30*60*1000) throw Error('Fresh batch lifetime <=30 minutes required');
 if (c.actor !== 'anonymous' && (typeof c.batchSecret !== 'string' || !/^[a-f0-9]{64}$/.test(c.batchSecret))) throw Error('Private nonanonymous batch secret required');
 if (c.allowMutations && c.actor === 'anonymous') throw Error('Anonymous mutations forbidden');
 return c;
}
export function mutationRoute(path, method, actor) {
 if(method==='POST')return /^\/auth\/tags\/[^/]+\/relations$/.test(path)||/^\/auth\/pictures\/[^/]+\/upload$/.test(path);
 return actor==='admin'&&method==='PUT'&&/^\/auth\/admin\/tag-submissions\/[1-9]\d*$/.test(path);
}
function apiRead(path) {
 return /^\/api\/v1(?:\/|$)/.test(path)||path==='/api/status'||path==='/auth/me'||/^\/auth\/pictures\/[^/]+(?:\/candidates\/[1-9]\d*)?$/.test(path)&&!/^\/auth\/pictures\/jobs(?:\/|$)/.test(path)||/^\/auth\/admin\/tag-submissions(?:\/[1-9]\d*\/image)?$/.test(path)||/^\/auth\/admin\/tags\/[^/]+\/articles$/.test(path)||/^\/auth\/admin\/(?:tag-relations|tag-groups|tag-visuals)(?:\/[^/]+(?:\/(?:image|candidates\/[1-9]\d*))?)?$/.test(path);
}
export function admitOptimizer(url) {
 const params=url.searchParams;
 if ([...params.keys()].some(key=>!['url','w','q'].includes(key)) || ['url','w','q'].some(key=>params.getAll(key).length!==1)) throw Error('Canonical optimizer query required');
 const value=params.get('url');
 if (!value || !value.startsWith('/') || value.startsWith('//') || /[%\\#\x00-\x20\x7f]/.test(value)) throw Error('Only canonical reviewed local optimizer image permitted');
 const image=new URL(value,'http://fixture.invalid');
 const favicon=/^\/favicons\/[a-zA-Z0-9_-]+\.png$/.test(image.pathname);
 const knownStatic=['/pwa/icon-192.png','/pwa/icon-512.png','/pwa/maskable-192.png','/pwa/maskable-512.png'].includes(image.pathname);
 if (image.pathname!==value.split('?')[0] || (!favicon&&!knownStatic)) throw Error('Unreviewed optimizer image path');
 if(image.search && (!favicon || image.searchParams.getAll('v').length!==1 || [...image.searchParams.keys()].some(key=>key!=='v') || !/^[a-zA-Z0-9_-]{1,64}$/.test(image.searchParams.get('v')))) throw Error('Unreviewed local image query');
 if(!/^[1-9]\d{0,3}$/.test(params.get('w'))||Number(params.get('w'))>3840||!/^[1-9]\d{0,2}$/.test(params.get('q'))||Number(params.get('q'))>100) throw Error('Invalid optimizer resource bound');
 return value;
}
export function requestPlan(c, request, now=Date.now()) {
 validateConfig(c,now); const origin=`http://${c.bindIp}:18196`;
 if(request.headers.host!==`${c.bindIp}:18196`||typeof request.url!=='string'||!request.url.startsWith('/')||request.url.startsWith('//')||/[\\\x00-\x20\x7f#]/.test(request.url))throw Error('Invalid candidate authority/path');
 const rawPath=request.url.split('?')[0];let decoded;try{decoded=decodeURIComponent(rawPath);}catch{throw Error('Invalid path encoding');}
 if(decoded.includes('\\')||decoded.includes('%')||/[\x00-\x20\x7f]/.test(decoded)||decoded.split('/').some(s=>s==='.'||s==='..')||decoded.includes('//'))throw Error('Encoded traversal/separator rejected');
 // Reject encoded slash: route parameters must be one real segment.
 if(/%2f|%5c/i.test(rawPath))throw Error('Encoded separator rejected');
 const url=new URL(request.url,origin);const path=url.pathname.replace(/\/$/,'')||'/';const method=request.method;
 if(decoded.replace(/\/$/,'')==='/_next/image'){if(rawPath!==decoded)throw Error('Encoded optimizer route forbidden');admitOptimizer(url);}
 if(c.actor!=='anonymous'){
  const supplied=request.headers[batchHeader];const left=Buffer.from(typeof supplied==='string'?supplied:'');const right=Buffer.from(c.batchSecret);
  if(left.length!==right.length||!timingSafeEqual(left,right))throw Error('Batch authorization required');
 }
 const readonly=['GET','HEAD'].includes(method);const auth=path.startsWith('/auth/');
 const mutation=!readonly&&c.allowMutations&&c.actor!=='anonymous'&&request.headers.origin===origin&&!url.search&&mutationRoute(path,method,c.actor);
 if(!readonly&&!mutation)throw Error('Method/fixture mutation not enabled');
 if(auth&&!apiRead(path)&&!mutation)throw Error('Auth route not allowed');
 // The trailing slash is the Next status page; its data request has no slash.
 const statusPage=readonly&&url.pathname==='/api/status/';
 const api=!statusPage&&(apiRead(path)||mutation);
 if(path.startsWith('/api/')&&!api&&!statusPage)throw Error('Unknown API path');
 const forwardedNames=new Set(['accept','accept-language','accept-encoding','user-agent','content-type','origin','referer','dnt','sec-gpc','range','if-none-match','if-modified-since','rsc','next-router-state-tree','next-router-prefetch','next-url']);
 const headers={};for(const [name,value]of Object.entries(request.headers)){
  const key=name.toLowerCase();if(!forwardedNames.has(key)||hop.includes(key)||['host','cookie','authorization','x-api-key','x-service-token','x-f1-fixture-actor',batchHeader,'forwarded','via','content-length'].includes(key)||key.startsWith('x-forwarded-')||key.startsWith('cf-')||key.startsWith('proxy-')||key.includes('api-token')||key.includes('service-token'))continue;
  headers[key]=value;
 }
 for(const token of String(request.headers.connection||'').split(','))delete headers[token.trim().toLowerCase()];
 headers.host=new URL(api?c.apiOrigin:c.nextOrigin).host;
 if(api)headers['x-f1-fixture-actor']=c.actor;
 return {origin:api?c.apiOrigin:c.nextOrigin,path:url.pathname+url.search,method:api&&method==='HEAD'?'GET':method,headers,mutation,head:method==='HEAD'};
}
export function createHandler(c,{requestUpstream=http.request,now=Date.now,log=()=>{},schedule=setTimeout,cancel=clearTimeout}={}) {
 validateConfig(c,now());return async(request,response)=>{
  let upstream,incoming,timer;let closed=false;
  const cleanup=()=>{cancel(timer);timer=undefined;upstream?.destroy();incoming?.destroy();};
  const deny=code=>{if(closed)return;closed=true;cleanup();request.resume();if(!response.headersSent){response.writeHead(code,{'cache-control':'private, no-store','content-security-policy':candidateCsp});response.end();}else response.destroy();};
  response.once('close',()=>{closed=true;cleanup();});
  request.once('aborted',()=>{closed=true;cleanup();response.destroy();});
  try {
   const plan=requestPlan(c,request,now());const declared=request.headers['content-length'];
   if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>bodyCap))return deny(413);
   const chunks=[];let bytes=0;
   // Bound upload including slow clients; no upstream connection before payload authorization/cap.
   timer=schedule(()=>{closed=true;cleanup();request.destroy();response.destroy();},10000);timer.unref?.();
   for await(const chunk of request){bytes+=chunk.length;if(bytes>bodyCap)return deny(413);chunks.push(chunk);}
   if(closed)return;
   if(!plan.mutation&&bytes)return deny(400);
   requestPlan(c,request,now()); // Recheck expiration after receiving body.
   const logged=log({event:'admitted',method:request.method,scope:plan.origin===c.apiOrigin?'fixture-api':'candidate-next',actor:c.actor,bytes});
   if(logged&&typeof logged.then==='function'){Promise.resolve(logged).catch(()=>{});throw Error('Synchronous audit writer required');}
   upstream=requestUpstream(plan.origin+plan.path,{method:plan.method,headers:{...plan.headers,'content-length':bytes}},received=>{
    incoming=received;
    incoming.once('aborted',()=>{closed=true;cleanup();response.destroy();});
    incoming.once('error',()=>{closed=true;cleanup();response.destroy();});
    try {
     if(closed){incoming.destroy();return;}
     const headers={...incoming.headers};
     for(const token of String(incoming.headers.connection||'').split(','))delete headers[token.trim().toLowerCase()];
     for(const name of [...hop,'set-cookie','location','access-control-allow-origin','access-control-allow-credentials'])delete headers[name];
     headers['cache-control']='private, no-store';headers['content-security-policy']=candidateCsp;
     // Redirect targets are admitted only within the exact candidate origin.
     if(incoming.headers.location){let target;try{target=new URL(incoming.headers.location,`http://${c.bindIp}:18196`);}catch{return deny(502);}if(target.origin!==`http://${c.bindIp}:18196`)return deny(502);headers.location=target.pathname+target.search;}
     response.writeHead(incoming.statusCode,headers);if(plan.head){incoming.resume();response.end();}else incoming.pipe(response);
    }catch{deny(502);}
   });
   upstream.on('error',()=>deny(502));
   upstream.end(Buffer.concat(chunks));
  }catch{deny(403);}
 };
}
export async function startFrontdoor(c,dependencies={}) {
 validateConfig(c);const server=(dependencies.http||http).createServer(createHandler(c,dependencies));
 server.on('connect',(request,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'));
 server.on('upgrade',(request,socket)=>socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'));
 server.headersTimeout=10000;server.requestTimeout=10000;server.timeout=10000;
 await new Promise((done,fail)=>{server.once('error',fail);server.listen(18196,c.bindIp,done);});return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2];if(!file)throw Error('Usage: node tools/mint-fixture-frontdoor.js PRIVATE_CONFIG_JSON');
 const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o077)||stat.size>65536)throw Error('Private owned config required');
 const c=JSON.parse(readFileSync(file,'utf8'));startFrontdoor(c).then(server=>{for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());}).catch(()=>{console.error('Fixture frontdoor failed');process.exitCode=1;});
}

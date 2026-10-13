// Anonymous SM isolated fixture API: no production relay, real login or queue.
import{types}from'node:util';
import http from'node:http';import * as fs from'node:fs';import{createRequire}from'node:module';import{join,resolve}from'node:path';import{pathToFileURL}from'node:url';
import{runtime,pins,dbPath,privateBytes,sha,validateInput,verifyControl,ticks}from'./core.mjs';
export function validateDatabase(c){if(!c||Object.keys(c).some(k=>!['user','password','host','port','database'].includes(k))||!['127.0.0.1','localhost'].includes(c.host)||Number(c.port)!==18306||c.database!=='tag_f1_semantic_test'||typeof c.user!=='string'||!c.user||typeof c.password!=='string')throw Error('Existing isolated fixture SQL configuration required');return c;}
export function validateActors(rows){if(rows.length!==3||rows.map(r=>Number(r.id)).sort((a,b)=>a-b).join(',')!=='701,702,703')throw Error('Existing fixture actors701/702/703 required');return true;}
export function publicPath(path,method){return ['GET','HEAD'].includes(method)&&(/^\/api\/v1(?:\/|$)/.test(path)||path==='/api/status'||path==='/auth/me');}
export function assertSelect(sqlOrOptions){
 const sql=typeof sqlOrOptions==='string'?sqlOrOptions:sqlOrOptions?.sql;
 if(typeof sql!=='string'||!/^\s*SELECT\b/i.test(sql)||sqlOrOptions?.multipleStatements===true||/[;\0]|\/\*|\*\/|--|#|:=|\b(?:INTO|OUTFILE|DUMPFILE|FOR|LOCK|PROCEDURE|SLEEP|BENCHMARK|GET_LOCK|RELEASE_LOCK|LOAD_FILE)\b/i.test(sql))throw Error('Only single isolated SELECT is admitted');return sql;
}
export function guardReadOnlyPool(pool,{onFailure=()=>{}}={}){
 const guarded=new WeakSet();
 const wrap=target=>{
  if(!target||typeof target!=='object'||guarded.has(target))return target;guarded.add(target);
  for(const name of ['query','execute'])if(typeof target[name]==='function'){const original=target[name];target[name]=function(...args){try{assertSelect(args[0]);const callback=typeof args.at(-1)==='function'?args.at(-1):null;if(callback)args[args.length-1]=function(error,...rest){if(error)onFailure();return callback(error,...rest);};const value=original.apply(this,args);return types.isPromise(value)?value.catch(error=>{onFailure();throw error;}):value;}catch(error){onFailure();throw error;}};}
  if(typeof target.getConnection==='function'){const original=target.getConnection;target.getConnection=function(...args){
   if(typeof args.at(-1)==='function'){const callback=args.pop();return original.apply(this,[...args,(error,connection)=>{if(error)return callback(error);let guardedConnection;try{guardedConnection=wrap(connection);}catch(failure){return callback(failure);}return callback(null,guardedConnection);}]);}
   return Promise.resolve(original.apply(this,args)).then(wrap);
  };}
  if(typeof target.promise==='function'){const original=target.promise;target.promise=function(...args){return wrap(original.apply(this,args));};}
  for(const name of ['prepare','unprepare','beginTransaction','commit','rollback','changeUser'])if(typeof target[name]==='function')target[name]=()=>{onFailure();throw Error('Isolated non-SELECT operation forbidden');};
  // mysql2 promise wrappers expose underlying callback clients; guard both surfaces in place.
  if(target.pool)wrap(target.pool);if(target.connection)wrap(target.connection);return target;
 };return wrap(pool);
}
export function deliverReadonly(result,{response,failed,head=false}) {
 if(failed()){response.writeHead(503,{'content-type':'application/json','cache-control':'private, no-store'});response.end(JSON.stringify({error:'readonly-fixture-unavailable'}));return;}
 const out={...result.headers,'cache-control':'private, no-store','x-f1-data-scope':'sm-real-isolated-fixture-anonymous'};
 for(const k of ['set-cookie','connection','transfer-encoding','content-length'])delete out[k];
 response.writeHead(result.statusCode,out);response.end(head?undefined:result.rawPayload);
}
export async function startFixture(q,job,{importModule=u=>import(u),requireModule=createRequire(join(runtime,'package.json')),httpModule=http}={}){
 const raw=privateBytes(dbPath);if(sha(raw)!==q.dbConfigSha256)throw Error('Pinned existing private DB configuration differs');const c=validateDatabase(JSON.parse(raw));
 const manifestBytes=privateBytes(join(runtime,'mint-artifact.json'),16*1024**2);if(sha(manifestBytes)!==pins.manifest)throw Error('Immutable APP manifest differs');
 // Imports are physical APP677 files inside the independently whole-hashed runtime.
 const {buildApp}=await importModule(pathToFileURL(join(runtime,'app/src/app.js')).href);const {createDb}=await importModule(pathToFileURL(join(runtime,'app/src/db/client.ts')).href);
 // Resolve dependency before listener creation; it must already exist in this runtime.
 requireModule.resolve('mysql2/promise');
 const db=createDb(`mysql://${encodeURIComponent(c.user)}:${encodeURIComponent(c.password)}@127.0.0.1:18306/tag_f1_semantic_test`,{poolSize:2});let sqlFailed=false;guardReadOnlyPool(db.pool,{onFailure:()=>{sqlFailed=true;}});let app,server;let closing;
 const close=()=>closing??=(async()=>{if(server?.listening){server.closeAllConnections?.();await new Promise(done=>server.close(done));}if(app)await app.close();await db.close();})();
 try{
  const [[actual]]=await db.pool.query('SELECT DATABASE() AS databaseName, VERSION() AS serverVersion, @@port AS serverPort');if(actual.databaseName!=='tag_f1_semantic_test'||!Number.isInteger(Number(actual.serverPort))||Number(actual.serverPort)<1||Number(actual.serverPort)>65535||!/^11\.4\..*MariaDB/.test(actual.serverVersion))throw Error('Actual isolated MariaDB11.4 identity required');
  // Record the actual server-side port; only the client URL selects admitted localhost18306.
  const [rows]=await db.pool.query('SELECT id FROM users ORDER BY id');validateActors(rows);
  const [[categories]]=await db.pool.query('SELECT COUNT(*) AS categoryCount FROM media_category_defs');if(!Number.isInteger(Number(categories.categoryCount))||Number(categories.categoryCount)<1)throw Error('Existing fixture categories required; seed forbidden');
  const forbidden=async()=>{throw Error('Anonymous fixture mutation disabled');};const loginStore={upsertUser:forbidden,createSession:forbidden,deleteSession:forbidden,listUsers:forbidden,setAdmin:forbidden,sessionUser:async()=>null};
  const disabledQueue=()=>({add:async()=>{throw Error('Isolated worker disabled; no image workflow pass');},getJob:async()=>null,getJobs:async()=>[]});
  app=await buildApp({uiOrigin:'http://127.0.0.1:18199',login:{clientId:'isolated-fixture',clientSecret:'isolated-fixture',origin:'http://127.0.0.1:18199',admins:new Set()}},{db:db.db,loginStore,jobQueue:disabledQueue});await app.ready();if(sqlFailed)throw Error('Readonly fixture SQL startup failed; no fallback admitted');
  server=httpModule.createServer(async(req,res)=>{const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store'});res.end(JSON.stringify(value));};try{
   if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//'))return send(403,{error:'fixture-only'});
   if(sqlFailed)return send(503,{error:'readonly-fixture-unavailable'});
   if(Date.now()>=q.expiresAtMs)return send(503,{error:'session-expired'});
   const url=new URL(req.url,'http://127.0.0.1:18197');if(req.url==='/internal/sm-fixture-readiness'&&req.method==='GET')return send(200,{scope:'sm-real-isolated-fixture-anonymous',appSha:pins.app,buildId:pins.build,inventorySha256:pins.inventory,actors:[701,702,703],databaseName:actual.databaseName,serverVersion:actual.serverVersion,serverPort:Number(actual.serverPort),apiOrigin:'http://127.0.0.1:18197',productionFallback:false,queueEnabled:false});
   if(!publicPath(url.pathname,req.method))return send(403,{error:'anonymous-readonly'});
   if(req.headers['content-length']&&req.headers['content-length']!=='0')return send(400,{error:'no-body'});for await(const chunk of req)if(chunk.length)return send(400,{error:'no-body'});
   const headers={};for(const k of ['accept','accept-language','range','if-none-match','if-modified-since','dnt','sec-gpc'])if(typeof req.headers[k]==='string')headers[k]=req.headers[k];
   const result=await app.inject({method:req.method==='HEAD'?'GET':req.method,url:req.url,headers});deliverReadonly(result,{response:res,failed:()=>sqlFailed,head:req.method==='HEAD'});
  }catch{if(!res.headersSent)send(503,{error:'fixture-unavailable'});else res.destroy();}});
  server.headersTimeout=10000;server.requestTimeout=10000;server.timeout=10000;server.on('connect',(_req,socket)=>socket.destroy());server.on('upgrade',(_req,socket)=>socket.destroy());
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(18197,'127.0.0.1',done);});
  fs.writeFileSync(join(job,'api-runtime.json'),JSON.stringify({appSha:pins.app,physicalAppModuleSha256:sha(fs.readFileSync(join(runtime,'app/src/app.js'))),databaseName:actual.databaseName,serverVersion:actual.serverVersion,serverPort:Number(actual.serverPort),actors:[701,702,703],pid:process.pid,startTicks:ticks(process.pid),productionFallback:false,queueEnabled:false})+'\n',{flag:'wx',mode:0o600});return {close};
 }catch(error){await close();throw error;}
}
export async function main(argv=process.argv.slice(2)){if(argv.length!==3)throw Error('Private admitted input/hash/job required');const [p,hash,job]=argv,bytes=privateBytes(p);if(sha(bytes)!==hash)throw Error('Input differs');const q=validateInput(JSON.parse(bytes));verifyControl(q);const api=await startFixture(q,job);let ended=false;const stop=async()=>{if(ended)return;ended=true;await api.close();process.exitCode=0;};process.once('SIGTERM',()=>stop().catch(()=>{process.exitCode=1;}));process.once('SIGINT',()=>stop().catch(()=>{process.exitCode=1;}));}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{process.stderr.write('Isolated anonymous API failed; private evidence retained.\n');process.exitCode=1;});

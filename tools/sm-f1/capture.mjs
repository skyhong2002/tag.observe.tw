// Explicit, SM-local candidate capture. Importing this module starts nothing.
import * as fs from 'node:fs';
import { getPriority } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { startProxy, ORIGIN } from './proxy.cjs';
import { observeSM, requireGate, processIdentity, localResources } from './probe.mjs';
import { ownershipRegistry, stopProfile } from '../mint-capture/browser-owner.mjs';
import { progressiveScroll, redactHar } from '../mint-capture/evidence.mjs';
import { evidenceTasks } from '../mint-capture/evidence-lifecycle.mjs';
import { inventory } from '../mint-f1-artifact.js';
import {assertLock} from '../sm-local-candidate/core.mjs';
export const PINS = Object.freeze({ app: '677a0c793eeda0c4d850c81ac574c95508d08e0a',
  build: 'PmjYScQDDoJKBr43SLkhd', inventory: 'f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7',
  manifest: '76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0' });
export const ROUTES = ['/', '/tag/柯文哲/', '/tag/柯文哲/picture/', '/ranking/'];
const ROOT = '/home/deck/tag-analysis-private/f1-release';
const RUNTIME = ROOT + '/mint-native-target-c70425b0/runtime';
const TOOLROOT = RUNTIME + '/node_modules';
const BROWSER = '/home/deck/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const BROWSER_SHA = '8c599d43aec53f2460a31ae2f4af6bd863f8258b34ff519564bc5d4726bfaa1e';
const MiB = 1024 ** 2, sha = x => createHash('sha256').update(x).digest('hex');
export function privateBytes(path, max = MiB) {
  const s = fs.lstatSync(path);
  if (!s.isFile() || s.isSymbolicLink() || s.uid !== process.getuid() || s.mode & 0o077 || s.size > max || fs.realpathSync(path)!==resolve(path)) throw Error('Private owner file required');
  return fs.readFileSync(path);
}
export function validateInput(q, now = Date.now()) {
  if (q.schema !== 'sm-f1-capture-input-v1' || q.reviewed !== true || q.executionPermission !== true || q.globalSlotAcknowledged !== true ||
      !/^[a-f0-9]{40}$/.test(q.controlOpsSha || '') || !/^[a-f0-9]{64}$/.test(q.startedReceiptSha256 || '') ||
      !Number.isFinite(q.expiresAtMs) || q.expiresAtMs <= now || q.expiresAtMs - now > 540000 ||
      q.actor !== 'anonymous' || q.origin !== ORIGIN || JSON.stringify(q.routes) !== JSON.stringify(ROUTES) ||
      !/^sm-batch-(?!000)[0-9]{3}$/.test(q.sessionId || '') ||
      q.job !== ROOT + '/sm-capture-' + q.sessionId ||
      q.startedReceiptPath !== ROOT + '/mint-native-target-c70425b0/local-candidate-' + q.sessionId + '/candidate-started.json' ||
      !Number.isInteger(q.additionalBuilds) || q.additionalBuilds < 0 || q.additionalBuilds > 1 ||
      !Number.isInteger(q.additionalBrowsers) || q.additionalBrowsers < 0 || q.additionalBrowsers > 1)
    throw Error('Separate exact local capture admission required');
  return q;
}
export function requireCandidate(q) {
  const b = privateBytes(q.startedReceiptPath);
  if (sha(b) !== q.startedReceiptSha256) throw Error('Actual candidate receipt changed');
  const r = JSON.parse(b);
  if (r.schema !== 'sm-f1-candidate-started-v1' || r.actor !== 'anonymous' || r.productionDatabase !== false ||
      r.appSha !== PINS.app || r.buildId !== PINS.build || r.inventorySha256 !== PINS.inventory || r.manifestSha256 !== PINS.manifest ||
      r.origin !== ORIGIN || r.controlOpsSha !== q.controlOpsSha || r.sessionId !== q.sessionId ||
      r.database?.host !== '127.0.0.1' || r.database?.port !== 18306 || r.database?.name !== 'tag_f1_semantic_test' ||
      !/^[a-f0-9]{64}$/.test(r.inputSha256 || '') || !Number.isFinite(r.plannedStopAtMs) || q.expiresAtMs + 60000 > r.plannedStopAtMs || !Array.isArray(r.children) || r.children.length !== 3)
    throw Error('Actual same-artifact local fixture identity required');
  for (const x of [r.owner, ...r.children]) {
    const actual = processIdentity(x.pid);
    if (actual.uid !== process.getuid() || actual.startTicks !== String(x.startTicks) || ['Z', 'X', 'T', 't'].includes(actual.state)) throw Error('Own candidate identity absent, paused or reused');
  }
  for (const [name, port] of [['api',18197],['next',18198],['frontdoor',18199]]) {
    const rows = r.children.filter(c => c.name === name);
    if (rows.length !== 1 || rows[0].host !== '127.0.0.1' || rows[0].port !== port) throw Error('Exact own candidate endpoints');
    assertSocketOwner(rows[0]);
  }
  const launch=JSON.parse(privateBytes(join(dirname(q.startedReceiptPath),'owner-launch.json')));
  const parent=processIdentity(launch.parentPid),holder=processIdentity(launch.lockPid);
  if(launch.inputSha256!==r.inputSha256||launch.controlOpsSha!==q.controlOpsSha||parent.uid!==process.getuid()||parent.startTicks!==String(launch.parentStartTicks)||holder.uid!==process.getuid()||holder.startTicks!==String(launch.lockStartTicks)||processIdentity(r.owner.pid).ppid!==parent.pid||['Z','X','T','t'].includes(parent.state)||['Z','X','T','t'].includes(holder.state)||sha(fs.readFileSync('/proc/'+parent.pid+'/cmdline'))!==launch.parentCmdlineSha256)throw Error('Actual candidate parent/kernel binding required');
  assertLock(holder.pid);
  return r;
}
export function ownStopRequest(r,now=Date.now()) {
  if(r.schema!=='sm-f1-candidate-started-v1'||!/^sm-batch-(?!000)[0-9]{3}$/.test(r.sessionId||'')||!/^[a-f0-9]{64}$/.test(r.inputSha256||'')||!Number.isInteger(r.owner?.pid)||!/^[0-9]+$/.test(String(r.owner.startTicks)))throw Error('Actual bound session stop only');
  return {schema:'sm-f1-candidate-stop-v1',inputSha256:r.inputSha256,sessionId:r.sessionId,ownerPid:r.owner.pid,ownerStartTicks:r.owner.startTicks,requestedAtMs:now};
}
export function assertSocketOwner(child) {
  const links=fs.readdirSync('/proc/'+child.pid+'/fd').map(n=>{try{return fs.readlinkSync('/proc/'+child.pid+'/fd/'+n);}catch(e){if(['ENOENT','ESRCH'].includes(e.code))return '';throw e;}});
  const exact='0100007F:'+child.port.toString(16).toUpperCase();
  if(!fs.readFileSync('/proc/net/tcp','utf8').split('\n').some(line=>{const f=line.trim().split(/\s+/);return f[1]===exact&&f[3]==='0A'&&Number(f[7])===process.getuid()&&links.includes('socket:['+f[9]+']');}))throw Error('Actual candidate socket ownership required');
}
export function googleURL(value) {
  try {const h=new URL(value).hostname;return /(^|\.)(google-analytics\.com|analytics\.google\.com|googletagmanager\.com)$/.test(h);}catch{return false;}
}
export function networkCounts(har,rows) {
  if(!Array.isArray(har?.log?.entries)||!har.log.entries.length||har.log.entries.length>5000||!rows.some(r=>r.event==='request')||!rows.some(r=>r.event==='response'))throw Error('Actual bounded network records required');
  return {harGoogleRequests:har.log.entries.filter(r=>googleURL(r.request?.url)).length,
    recordedGoogleRequests:rows.filter(r=>r.event==='request'&&googleURL(r.url)).length,
    blockedGoogleRequests:rows.filter(r=>r.event==='blocked'&&googleURL(r.url)).length};
}
export function waitWatchdog(child,readReady,ms=3000) {
  return new Promise((ok,fail)=>{
    let done=false,poll,timer;
    const finish=(error)=>{if(done)return;done=true;clearInterval(poll);clearTimeout(timer);child.removeListener('error',onError);error?fail(error):ok();};
    const onError=error=>finish(error);
    child.once('error',onError);
    poll=setInterval(()=>{if(child.exitCode!==null||child.signalCode!==null){finish(Error('Watchdog startup failed'));return;}try{if(readReady())finish();}catch(e){if(e.code!=='ENOENT')finish(e);}},50);
    timer=setTimeout(()=>finish(Error('Watchdog readiness timeout')),ms);
  });
}
export function validateBrowserLease(lease,{inputSha256,parent,now=Date.now()}) {
  if(lease?.schema!=='sm-f1-browser-lease-v1'||lease.inputSha256!==inputSha256||lease.parentPid!==parent.pid||lease.parentStartTicks!==parent.startTicks||!Number.isFinite(lease.observedAtMs)||lease.observedAtMs>now||now-lease.observedAtMs>30000)throw Error('Fresh exact browser lease required');
  if(!Number.isFinite(lease.sample?.startedAtMs)||lease.sample.startedAtMs>now||now-lease.sample.startedAtMs>30000)throw Error('Original browser health age rejected');return lease;
}
export async function bounded(task, ms=5000) {
  let timer;
  try { return await Promise.race([task, new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bounded local cleanup timeout')),ms);})]); }
  finally {clearTimeout(timer);}
}
export function bytesIn(path) {
  let total = 0;
  for (const entry of fs.readdirSync(path, { withFileTypes: true })) {
    const p = join(path, entry.name);
    if (entry.isDirectory()) total += bytesIn(p);
    else if (entry.isFile()) total += fs.statSync(p).size;
    else if (entry.isSymbolicLink() && p.includes('/profile/')) total += Buffer.byteLength(fs.readlinkSync(p));
    else throw Error('Unexpected evidence entry');
  }
  return total;
}
function verifyWhole() {
  if (sha(JSON.stringify(inventory(RUNTIME))) !== PINS.inventory || sha(fs.readFileSync(RUNTIME + '/mint-artifact.json')) !== PINS.manifest)
    throw Error('Same artifact bytes changed');
}
export function installedToolProof() {
  const guard=fs.lstatSync(ROOT);if(!guard.isDirectory()||guard.isSymbolicLink()||guard.uid!==process.getuid()||guard.mode&0o077||fs.realpathSync(ROOT)!==ROOT)throw Error('Private immutable tool ancestor required');
  const entries = []; let bytes = 0;
  for (const pkg of ['playwright', 'playwright-core']) {
    const root = TOOLROOT + '/' + pkg;
    if(fs.realpathSync(root)!==root||!fs.lstatSync(root).isDirectory())throw Error('Canonical tool root');
    if (JSON.parse(fs.readFileSync(root + '/package.json')).version !== '1.63.0') throw Error('Installed Playwright version');
    const walk = rel => { for (const name of fs.readdirSync(join(root,rel)).sort()) {
      const p = join(root,rel,name), s = fs.lstatSync(p);
      if (s.isSymbolicLink() || s.uid !== process.getuid() || s.mode & 0o002 || fs.realpathSync(p) !== resolve(p)) throw Error('Canonical installed tool code');
      if (s.isDirectory()) walk(join(rel,name));
      else if (s.isFile()) { bytes += s.size; if (bytes > 64*MiB) throw Error('Tool proof budget'); entries.push({ path: pkg+'/'+join(rel,name), bytes:s.size, sha256:sha(fs.readFileSync(p)) }); }
      else throw Error('Unsupported tool code');
    }}; walk('');
  }
  if (sha(fs.readFileSync(BROWSER)) !== BROWSER_SHA) throw Error('Browser binary pin');
  return { packages:['playwright@1.63.0','playwright-core@1.63.0'], bytes, sha256:sha(JSON.stringify(entries)), browserSha256:BROWSER_SHA };
}
function verifyControl(q) {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const git = args => { const r = spawnSync('/usr/bin/git',['-C',repo,...args],{encoding:'utf8',timeout:5000,maxBuffer:MiB}); if(r.status!==0)throw Error('Control Git identity'); return r.stdout.trim(); };
  if (git(['rev-parse','HEAD']) !== q.controlOpsSha || git(['status','--porcelain','--untracked-files=all'])) throw Error('Exact clean committed local control');
  for (const [p,d] of Object.entries(q.sourceHashes ?? {})) {
    if (!/^tools\/[a-zA-Z0-9_./-]+\.(?:mjs|cjs|js)$/.test(p) || p.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(d)) throw Error('Control source pin');
    const r = spawnSync('/usr/bin/git',['-C',repo,'show',q.controlOpsSha+':'+p],{timeout:5000,maxBuffer:MiB});
    if(r.status!==0 || sha(r.stdout)!==d || sha(fs.readFileSync(join(repo,p)))!==d)throw Error('Control module changed');
  }
  for (const p of ['tools/sm-f1/capture.mjs','tools/sm-f1/probe.mjs','tools/sm-f1/proxy.cjs','tools/mint-capture/browser-owner.mjs','tools/mint-capture/evidence.mjs','tools/mint-capture/evidence-lifecycle.mjs','tools/mint-f1-artifact.js','tools/shared-host-baseline.cjs','tools/homepage-median-probe.mjs','tools/sm-local-candidate/core.mjs','tools/native-elf-proof.js','tools/mint-f1-candidate-plan.js'])
    if(!q.sourceHashes?.[p])throw Error('Missing executable source pin');
}
export async function capture(inputPath, expectedInputSha) {
  const raw = privateBytes(inputPath), q = validateInput(JSON.parse(raw));
  if (sha(raw) !== expectedInputSha || fs.readFileSync('/etc/machine-id','utf8').trim() !== '302c2528bd464ad0953cf5fa743b6171' || process.platform !== 'linux') throw Error('Exact SM input/host');
  if(getPriority(0)!==19||!/^idle(?:\s|$)/.test(spawnSync('/usr/bin/ionice',['-p',String(process.pid)],{encoding:'utf8',timeout:3000,maxBuffer:128}).stdout?.trim()||''))throw Error('Entire capture requires nice19/ionice3');
  verifyControl(q); requireCandidate(q); verifyWhole(); const tool = installedToolProof();
  fs.mkdirSync(q.job,{mode:0o700});
  const log = (file,x) => { if(bytesIn(q.job)>88*MiB)throw Error('Evidence reserve exceeded'); fs.appendFileSync(join(q.job,file),JSON.stringify({utc:new Date().toISOString(),...x})+'\n',{mode:0o600}); };
  const profile=join(q.job,'profile'); fs.mkdirSync(join(profile,'Default'),{recursive:true,mode:0o700});
  fs.writeFileSync(join(profile,'Default','Preferences'),JSON.stringify({enable_do_not_track:true}),{flag:'wx',mode:0o600});
  const registry=ownershipRegistry(profile), errors=[],shots=[]; let proxy,context,watchdog,fatal,monitor,checking,health,sampling,closingContext,network,candidate;
  const closeContext=()=>closingContext??=(context?bounded(context.close()):Promise.resolve());
  const stop = error => { fatal ??= error; if(context)closeContext().catch(e=>errors.push(e)); };
  const emit=(file,x)=>{try{log(file,x);}catch(e){stop(e);throw e;}};
  const tasks=evidenceTasks(stop);
  const refresh=()=> sampling??=(observeSM(x=>log('gates.raw.jsonl',x)).then(s=>{health=s;}).finally(()=>{sampling=null;}));
  const check=async(starting=false)=>{
    if(fatal||Date.now()>=q.expiresAtMs)throw fatal||Error('Capture deadline');
    if(watchdog&&(watchdog.exitCode!==null||watchdog.signalCode!==null))throw Error('Own browser watchdog exited');
    candidate=requireCandidate(q);
    if(!health||Date.now()-health.startedAtMs>15000)await refresh();
    const sample={...health,...localResources()};
    log('gates.raw.jsonl',{type:'local-checkpoint',...sample});
    requireGate(sample,{starting,additionalBuilds:q.additionalBuilds,additionalBrowsers:q.additionalBrowsers});
    if(bytesIn(q.job)>88*MiB)throw Error('Evidence budget');
    const lease={schema:'sm-f1-browser-lease-v1',inputSha256:expectedInputSha,parentPid:process.pid,parentStartTicks:parent.startTicks,observedAtMs:Date.now(),sample};
    const tmp=join(q.job,'lease.pending.json');fs.writeFileSync(tmp,JSON.stringify(lease),{flag:'wx',mode:0o600});fs.renameSync(tmp,join(q.job,'lease.json'));
  };
  const timeout=setTimeout(()=>stop(Error('Capture deadline')),Math.max(1,q.expiresAtMs-Date.now()));
  const parent=processIdentity(process.pid);
  try {
    await check(true);
    // Independent watchdog exists before Chromium. It can only stop this new profile.
    const wd=join(q.job,'watchdog.json');
    fs.writeFileSync(wd,JSON.stringify({schema:'sm-capture-watchdog-v1',sessionId:q.sessionId,job:q.job,inputPath:resolve(inputPath),inputSha256:expectedInputSha,profile,parent:{pid:parent.pid,startTicks:parent.startTicks},expiresAtMs:q.expiresAtMs}),{flag:'wx',mode:0o600});
    watchdog=spawn(process.execPath,[fileURLToPath(import.meta.url),'--watchdog',wd],{stdio:'ignore',env:{PATH:'/home/deck/.local/bin:/usr/bin:/bin',HOME:'/nonexistent',LANG:'C'}});
    watchdog.on('error',stop);
    await waitWatchdog(watchdog,()=>{
      const r=JSON.parse(privateBytes(join(q.job,'watchdog-ready.json'))),actual=processIdentity(watchdog.pid);
      if(r.pid!==watchdog.pid||r.startTicks!==actual.startTicks||r.inputSha256!==expectedInputSha)throw Error('Watchdog identity');return true;
    });
    proxy=await startProxy(x=>log('proxy.raw.jsonl',x));
    const { chromium }=await import(pathToFileURL(TOOLROOT+'/playwright/index.mjs').href);
    context=await chromium.launchPersistentContext(profile,{headless:true,env:{PATH:'/usr/bin:/bin',HOME:profile,LANG:'C',TZ:'UTC',DNT:'1'},deviceScaleFactor:1,executablePath:BROWSER,proxy:{server:proxy.address,bypass:'<-loopback>'},serviceWorkers:'block',
      extraHTTPHeaders:{DNT:'1'},args:['--disable-gpu','--disable-dev-shm-usage','--proxy-bypass-list=<-loopback>','--disable-background-networking','--disable-sync','--no-first-run','--disable-default-apps','--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],recordHar:{path:join(q.job,'network.har'),mode:'minimal',content:'omit'}});
    registry.snapshot();
    const roots=registry.records.filter(r=>!r.args.some(a=>a.startsWith('--type=')));
    if(roots.length!==1||roots[0].nice!==19)throw Error('One actual low-priority Chromium root required');
    const io=spawnSync('/usr/bin/ionice',['-p',String(roots[0].pid)],{encoding:'utf8',timeout:1000,maxBuffer:128,env:{PATH:'/usr/bin:/bin',LANG:'C'}});
    if(io.status!==0||!/^idle(?:\s|$)/.test(io.stdout?.trim()||''))throw Error('Actual Chromium idle I/O required');
    log('browser-owner.jsonl',{records:registry.records,ioClass:'idle'});
    await context.route('**/*',route=>{
      const req=route.request(),u=new URL(req.url());
      if(u.origin!==ORIGIN||!['GET','HEAD'].includes(req.method())){emit('requests.raw.jsonl',{event:'blocked',url:req.url(),method:req.method()});return route.abort();}
      return route.continue();
    });
    context.on('request',r=>tasks.add(()=>emit('requests.raw.jsonl',{event:'request',url:r.url(),method:r.method()})));
    context.on('requestfailed',r=>tasks.add(()=>emit('requests.raw.jsonl',{event:'failed',url:r.url(),error:r.failure()?.errorText})));
    context.on('response',r=>tasks.add(async()=>{log('requests.raw.jsonl',{event:'response',url:r.url(),status:r.status()});if(r.status()>=500)throw Error('Candidate HTTP5xx');}));
    monitor=setInterval(()=>{try{registry.snapshot();}catch(e){stop(e);}if(!checking)checking=check().catch(stop).finally(()=>{checking=null;});},15000);
    for(const path of ROUTES)for(const viewport of [{width:1280,height:800},{width:390,height:844}])for(const colorScheme of ['light','dark']){
      await check();await context.clearCookies();
      const page=await context.newPage();await page.setViewportSize(viewport);await page.emulateMedia({colorScheme});
      const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:30000});
      await page.evaluate(()=>document.fonts.ready);const lazy=await progressiveScroll(page);await tasks.drain();
      const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
      if(size.height>16000||size.width*size.height>12000000)throw Error('Full-page pixel budget');
      const state=await page.evaluate(()=>({url:location.href,DNT:navigator.doNotTrack,GPC:{present:'globalPrivacyControl'in navigator,value:navigator.globalPrivacyControl??null},webdriver:navigator.webdriver,title:document.title,
        viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,dataLayerCommands:Array.isArray(window.dataLayer)?window.dataLayer.length:null}));
      if(state.DNT!=='1'||fatal||proxy.failed)throw fatal||Error('Native DNT or proxy gate');
      if(state.viewport.width!==viewport.width||new URL(state.url).origin!==ORIGIN)throw Error('Viewport or origin differs');
      const png=await page.screenshot({fullPage:true,timeout:15000}),file='shot-'+String(shots.length+1).padStart(2,'0')+'.png';
      if(png.length>8*MiB||bytesIn(q.job)+png.length>88*MiB)throw Error('PNG reserve');
      fs.writeFileSync(join(q.job,file),png,{flag:'wx',mode:0o600});
      shots.push({path,viewport,colorScheme,file,sha256:sha(png),bytes:png.length,utc:new Date().toISOString(),status:response?.status(),state,lazy,review:'pending'});
      await page.close();await check();
    }
    await tasks.drain();
  } catch(e) {fatal??=e;} finally {
    clearTimeout(timeout);clearInterval(monitor);if(checking)await checking;
    try{registry.snapshot();}catch(e){errors.push(e);}
    if(context)try{await closeContext();}catch(e){errors.push(e);}
    try{await bounded(tasks.drain());}catch(e){errors.push(e);}
    try{await stopProfile(profile,{records:registry.records});}catch(e){errors.push(e);}
    if(proxy)try{await bounded(proxy.close());}catch(e){errors.push(e);}
    if(watchdog && watchdog.exitCode===null){
      watchdog.kill('SIGTERM');
      try{await bounded(new Promise(resolve=>{if(watchdog.exitCode!==null)resolve();else watchdog.once('close',resolve);}));}catch(e){errors.push(e);if(watchdog.exitCode===null){watchdog.kill('SIGKILL');try{await bounded(new Promise(ok=>watchdog.once('close',ok)),2000);}catch(x){errors.push(x);}}}
    }
    if(candidate)try{
      const live=processIdentity(candidate.owner.pid);if(live.startTicks!==String(candidate.owner.startTicks)||live.uid!==process.getuid())throw Error('Candidate stop owner changed');
      fs.writeFileSync(join(dirname(q.startedReceiptPath),'own-stop-request.json'),JSON.stringify(ownStopRequest(candidate))+'\n',{flag:'wx',mode:0o600});
    }catch(e){errors.push(e);}
    try{verifyWhole();verifyControl(q);if(JSON.stringify(installedToolProof())!==JSON.stringify(tool))throw Error('Installed tool changed');}catch(e){errors.push(e);}
    try{await observeSM(x=>log('gates.raw.jsonl',{phase:'after-browser-cleanup',...x}));}catch(e){errors.push(e);}
    const har=join(q.job,'network.har');
    if(fs.existsSync(har))try{
      fs.chmodSync(har,0o600);if(fs.statSync(har).size>88*MiB)throw Error('HAR too large');
      // Keep original private HAR bytes; sanitized copy is a separate artifact.
      const sanitized=JSON.stringify(redactHar(JSON.parse(privateBytes(har,88*MiB))));
      if(bytesIn(q.job)+Buffer.byteLength(sanitized)>95*MiB)throw Error('Redacted HAR reserve');
      fs.writeFileSync(join(q.job,'network.redacted.har'),sanitized,{flag:'wx',mode:0o600});
    }catch(e){errors.push(e);}
    if(!fs.existsSync(har)||!proxy||proxy.failed||proxy.stats.admitted<1||proxy.stats.googleOutgoing!==0)errors.push(Error('Actual HAR/proxy evidence missing'));
    try{
      const h=JSON.parse(privateBytes(har,88*MiB));
      if(!h.log?.entries?.length||h.log.entries.length>5000)throw Error('Actual HAR entries absent/budget');
      const requestRows=privateBytes(join(q.job,'requests.raw.jsonl'),16*MiB).toString().trim().split('\n').map(JSON.parse);
      network=networkCounts(h,requestRows);
      const proxyRows=privateBytes(join(q.job,'proxy.raw.jsonl'),16*MiB).toString().trim().split('\n').map(JSON.parse);
      if(proxyRows.filter(x=>x.event==='admitted').length!==proxy.stats.admitted||proxyRows.filter(x=>x.event==='denied').length!==proxy.stats.denied)throw Error('Proxy counters disagree with raw');
    }catch(e){errors.push(e);}
    const manifest={schema:'sm-f1-capture-manifest-v1',utc:new Date().toISOString(),status:!fatal&&!errors.length&&shots.length===16?'captured-pending-review':'partial',
      appSha:PINS.app,buildId:PINS.build,inventorySha256:PINS.inventory,manifestSha256:PINS.manifest,controlOpsSha:q.controlOpsSha,inputSha256:expectedInputSha,toolProof:tool,
      origin:ORIGIN,actor:'anonymous',sessionId:q.sessionId,shots,network,networkArtifacts:['network.har','network.redacted.har','requests.raw.jsonl','proxy.raw.jsonl'].filter(n=>fs.existsSync(join(q.job,n))).map(n=>({path:join(q.job,n),sha256:sha(fs.readFileSync(join(q.job,n))),bytes:fs.statSync(join(q.job,n)).size})),proxyStats:proxy?.stats,zeroGoogleOutgoing:proxy?.stats.googleOutgoing===0,
      errors:[fatal,...errors].filter(Boolean).map(e=>String(e.message).slice(0,256)),uiReview:'pending independent image review',deployEligible:false};
    if(bytesIn(q.job)+Buffer.byteLength(JSON.stringify(manifest,null,2))+4096>96*MiB){manifest.status='partial';errors.push(Error('Final evidence reserve'));manifest.errors.push('Final evidence reserve');}
    fs.writeFileSync(join(q.job,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
    if(bytesIn(q.job)>96*MiB)throw Error('Final batch exceeds96MiB; retained, not accepted');
    if(fatal||errors.length)throw fatal||errors[0];
  }
}
export async function watchdogLifecycle({step,stop,record=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  let failure,cleanup;
  try{while(await step())await sleep(1000);}catch(e){failure=e;}
  finally{try{await stop();}catch(e){cleanup=e;}try{record({event:'watchdog-finished',failed:!!failure,cleanupFailed:!!cleanup});}catch(e){cleanup??=e;}}
  if(failure||cleanup)throw new AggregateError([failure,cleanup].filter(Boolean),'Owned watchdog lifecycle failed');
}
async function watchdog(path){
  const q=JSON.parse(privateBytes(path));
  if(q.schema!=='sm-capture-watchdog-v1'||!/^sm-batch-(?!000)[0-9]{3}$/.test(q.sessionId||'')||q.job!==ROOT+'/sm-capture-'+q.sessionId||q.profile!==q.job+'/profile'||path!==q.job+'/watchdog.json'||!/^[a-f0-9]{64}$/.test(q.inputSha256||'')||!Number.isFinite(q.expiresAtMs)||q.expiresAtMs<=Date.now()||q.expiresAtMs-Date.now()>540000)throw Error('Own new profile only');
  const me=processIdentity(process.pid),parent=processIdentity(q.parent.pid);if(parent.pid!==process.ppid||parent.uid!==process.getuid()||parent.startTicks!==q.parent.startTicks)throw Error('Own capture parent required');
  const registry=ownershipRegistry(q.profile);let admitted,ready=false,signalled=false;
  const record=row=>fs.appendFileSync(join(q.job,'watchdog.raw.jsonl'),JSON.stringify({utc:new Date().toISOString(),...row})+'\n',{mode:0o600});
  const signal=()=>{signalled=true;};process.on('SIGTERM',signal);process.on('SIGINT',signal);
  try{await watchdogLifecycle({
    step:async()=>{
      const input=privateBytes(q.inputPath);if(sha(input)!==q.inputSha256)throw Error('Watchdog input changed');
      if(!admitted){admitted=validateInput(JSON.parse(input));if(admitted.sessionId!==q.sessionId||admitted.job!==q.job)throw Error('Watchdog input namespace differs');}
      registry.snapshot();
      const p=processIdentity(q.parent.pid);
      if(signalled||p.uid!==process.getuid()||p.startTicks!==String(q.parent.startTicks)||['Z','X','T','t'].includes(p.state)||Date.now()>=q.expiresAtMs){record({event:'own-watchdog-stop',reason:'parent-signal-identity-state-or-deadline'});return false;}
      const lease=JSON.parse(privateBytes(join(q.job,'lease.json')));
      validateBrowserLease(lease,{inputSha256:q.inputSha256,parent:q.parent});requireCandidate(admitted);
      requireGate({...lease.sample,...localResources()},{additionalBuilds:admitted.additionalBuilds,additionalBrowsers:admitted.additionalBrowsers});
      if(!ready){fs.writeFileSync(join(q.job,'watchdog-ready.json'),JSON.stringify({pid:me.pid,startTicks:me.startTicks,inputSha256:q.inputSha256}),{flag:'wx',mode:0o600});ready=true;}
      return true;
    },stop:()=>stopProfile(q.profile,{records:registry.records}),record
  });}finally{process.removeListener('SIGTERM',signal);process.removeListener('SIGINT',signal);}
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [mode,path,hash]=process.argv.slice(2);
  if(mode==='--watchdog')watchdog(path).catch(()=>{process.exitCode=1;});
  else if(mode==='--execute')capture(path,hash).catch(()=>{console.error('Local capture failed; private original evidence retained.');process.exitCode=1;});
  else console.log(JSON.stringify({mode:'plan-only',executionPermission:false}));
}

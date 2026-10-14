import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const plan=new URL('../docs/deploy/d1LV/',import.meta.url);
const old='0dd38b629621e27ccb40260a27b27cf2d7202519';
const app='aff5c0289c4863fedb37368b4942884ccc068d77';
const build='d1LVsC3sk6p04uOyWUx5T';
const releaseName=`${app}-${build}-simple-002`;
const script=fs.readFileSync(new URL('deploy.sh',plan),'utf8');
const rollback=fs.readFileSync(new URL('rollback.sh',plan),'utf8');
function write(p,text,mode=0o600){fs.mkdirSync(path.dirname(p),{recursive:true,mode:0o700});fs.writeFileSync(p,text,{mode});}
function scenario({failUrl='',failRestart=false,failProbe=0,failCurl=false,failCleanup=false,failWorkerStop=false,slowWarmReady=false,retainedUnits=false,mismatchedUnit=false,failGit=false,lateGitFailure=false}={}){
  // Tiny fresh fixture files retained; no host services/ports/network/DB are used.
  const root=fs.mkdtempSync(path.join(tmpdir(),'tag-simple-deploy-test-'));
  const home=root+'/home/deck',bin=root+'/bin',control=home+'/Projects/tag-sm-f1-release';
  const units=home+'/.config/systemd/user',base=home+'/.local/share/tag-analysis';
  const source=home+'/tag-analysis-private/f1-release/deployable-d1LV-cache-free-001';
  const backup=home+'/tag-analysis-private/f1-release/deploy-backup-d1LV-simple-002';
  const release=base+'/releases/'+releaseName,log=root+'/commands.log';
  for(const name of fs.readdirSync(plan)){
    const file=new URL(name,plan);if(!fs.statSync(file).isFile())continue;
    write(control+'/docs/deploy/d1LV/'+name,fs.readFileSync(file,'utf8').replaceAll('/home/deck/',home+'/'));
  }
  write(source+'/COMMIT',app+'\n');write(source+'/web/.next/BUILD_ID',build+'\n');
  write(source+'/web/.next/standalone/web/.next/static/new.js','new bytes');
  write(source+'/web/.next/standalone/web/.next/static/shared.js','new shared bytes');
  write(base+'/releases/'+old+'/web/.next/standalone/web/.next/static/old.js','old bytes');
  write(base+'/releases/'+old+'/web/.next/standalone/web/.next/static/shared.js','old shared bytes');
  fs.symlinkSync(base+'/releases/'+old,base+'/current');
  write(base+'/deploy.lock','');
  for(const service of ['tag-analysis','tag-web','tag-worker'])write(units+'/'+service+'.service','original '+service+' unit');
  write(units+'/tag-analysis.service.d/nearline.conf','original nonsecret nearline reference');
  write(units+'/tag-analysis.service.d/vocabulary.conf','original nonsecret volume reference');
  const approved='b448432b5554df6c042d654d31a88cc2eea35ee7';
  for(const name of ['tag-f1-api-d1lv','tag-f1-web-d1lv']){
    const blob=spawnSync('git',['show',approved+':docs/deploy/d1LV/'+name+'.service'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
    assert.equal(blob.status,0,blob.stderr);
    const content=blob.stdout.replaceAll('/home/deck/',home+'/');
    write(root+'/approved/'+name+'.service',content);
    if(retainedUnits)write(units+'/'+name+'.service',mismatchedUnit&&name==='tag-f1-api-d1lv'?content+'\n# unexpected modification\n':content);
  }
  if(retainedUnits){
    write(units+'/tag-f1-api-d1lv.service.d/nearline.conf','original nonsecret nearline reference');
    write(units+'/tag-f1-api-d1lv.service.d/vocabulary.conf','original nonsecret volume reference');
    write(base+'/releases/'+app+'-'+build+'-simple-001/retained','original001 release');
    write(home+'/tag-analysis-private/f1-release/deploy-backup-d1LV-simple-001/retained','original001 backup');
  }
  write(bin+'/git',String.raw`#!/usr/bin/python3
import sys,os,pathlib
expected='b448432b5554df6c042d654d31a88cc2eea35ee7:docs/deploy/d1LV/'
if len(sys.argv)!=5 or sys.argv[3]!='show' or not sys.argv[4].startswith(expected):sys.exit(1)
name=sys.argv[4][len(expected):]
if name not in ['tag-f1-api-d1lv.service','tag-f1-web-d1lv.service']:sys.exit(1)
if os.environ.get('FAIL_GIT')=='1':sys.exit(1)
sys.stdout.write((pathlib.Path(os.environ['MOCK_ROOT'])/'approved'/name).read_text())
if os.environ.get('LATE_GIT_FAILURE')=='1':sys.exit(1)
`,0o700);
  write(bin+'/nice','#!/bin/bash\nshift 2\nexec "$@"\n',0o700);
  write(bin+'/ionice','#!/bin/bash\nshift\nexec "$@"\n',0o700);
  write(bin+'/flock','#!/bin/bash\nexit 0\n',0o700);
  write(bin+'/systemctl',String.raw`#!/usr/bin/python3
import os,sys,pathlib
args=sys.argv[1:];p=pathlib.Path(os.environ['MOCK_ROOT'])
with open(os.environ['MOCK_LOG'],'a') as f:f.write('systemctl '+' '.join(args)+'\n')
if 'is-enabled' in args and 'tag-backup.timer' in args:print('disabled');sys.exit(1)
if 'stop' in args and 'tag-worker.service' in args and os.environ.get('FAIL_WORKER_STOP')=='1':sys.exit(1)
if 'disable' in args and '--now' in args and os.environ.get('FAIL_CLEANUP')=='1':sys.exit(1)
if 'restart' in args and 'tag-analysis.service' in args:
 f=p/'restart-count';n=int(f.read_text())+1 if f.exists() else 1;f.write_text(str(n))
 if os.environ.get('FAIL_RESTART')=='1' and n==1:sys.exit(1)
if 'show' in args:print('WorkingDirectory=mock-isolated-release')
sys.exit(0)
`,0o700);
  write(bin+'/rsync',String.raw`#!/usr/bin/python3
import sys,os,shutil,pathlib
src=pathlib.Path(sys.argv[-2]);dst=pathlib.Path(sys.argv[-1]);ignore='--ignore-existing' in sys.argv
with open(os.environ['MOCK_LOG'],'a') as f:f.write('rsync '+' '.join(sys.argv[1:])+'\n')
for p in src.rglob('*'):
 out=dst/p.relative_to(src)
 if p.is_dir():out.mkdir(parents=True,exist_ok=True)
 elif not(ignore and out.exists()):out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
`,0o700);
  write(bin+'/curl',String.raw`#!/usr/bin/python3
import sys,os,pathlib
args=sys.argv[1:];url=args[-1]
with open(os.environ['MOCK_LOG'],'a') as f:f.write('curl '+url+'\n')
with open(os.environ['MOCK_ROOT']+'/curl-options.log','a') as f:f.write(url+' '+args[args.index('--max-time')+1]+'\n')
p=pathlib.Path(os.environ['MOCK_ROOT'])/'http-failure-triggered'
failed=url==os.environ.get('FAIL_URL') and not p.exists()
if failed:p.write_text('one-shot new-origin failure')
code='500' if failed else '200'
if failed and os.environ.get('FAIL_CURL')=='1':print('000',end='');sys.exit(28)
for flag,body in [('-D','HTTP/1.1 '+code+'\r\nCache-Control: no-store\r\n\r\n'),('-o','public mock body')]:
 if flag in args:
  p=args[args.index(flag)+1]
  if p!='/dev/null':pathlib.Path(p).write_text(body)
elapsed='3.0' if os.environ.get('SLOW_WARM_READY')=='1' and args[args.index('--max-time')+1]=='2' else '0.1'
print(code+'\t'+elapsed if '%{time_total}' in args[args.index('-w')+1] else code,end='')
`,0o700);
  write(home+'/.local/bin/node',String.raw`#!/usr/bin/python3
import os,sys,pathlib
sys.stdin.read();p=pathlib.Path(os.environ['MOCK_ROOT'])
with open(os.environ['MOCK_LOG'],'a') as f:f.write('node '+' '.join(sys.argv[1:])+'\n')
if sys.argv[-1].endswith(('before-copy','before-worker','before-cutover')):
 f=p/'probe-count';n=int(f.read_text())+1 if f.exists() else 1;f.write_text(str(n))
 pathlib.Path(sys.argv[-1]+'.json').write_text('{"mock":true}\n')
 pathlib.Path(sys.argv[-1]+'.raw.jsonl').write_text('{"mock":true}\n')
 if int(os.environ.get('FAIL_PROBE','0'))==n:sys.exit(1)
sys.exit(0)
`,0o700);
  const result=spawnSync('/usr/bin/bash',[control+'/docs/deploy/d1LV/deploy.sh'],{
    env:{PATH:bin+':/usr/bin:/bin',HOME:home,MOCK_ROOT:root,MOCK_LOG:log,FAIL_URL:failUrl,FAIL_RESTART:failRestart?'1':'0',FAIL_PROBE:String(failProbe),FAIL_CURL:failCurl?'1':'0',FAIL_CLEANUP:failCleanup?'1':'0',FAIL_WORKER_STOP:failWorkerStop?'1':'0',SLOW_WARM_READY:slowWarmReady?'1':'0',FAIL_GIT:failGit?'1':'0',LATE_GIT_FAILURE:lateGitFailure?'1':'0'},encoding:'utf8',timeout:15000});
  return {root,units,source,backup,release,base,result,commands:fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n'):[]};
}

test('persistent drop-ins pin new gateway/worker; legacy current/web remain untouched',()=>{
  const g=fs.readFileSync(new URL('gateway-d1lv.conf',plan),'utf8');
  const w=fs.readFileSync(new URL('worker-d1lv.conf',plan),'utf8');
  const web=fs.readFileSync(new URL('tag-f1-web-d1lv.service',plan),'utf8');
  assert.ok(g.includes(releaseName));assert.ok(w.includes(releaseName));
  assert.match(g,/PORT=18130 UI_ORIGIN=http:\/\/127\.0\.0\.1:18232/);
  assert.match(g,/ExecStart=\nExecStart=/);assert.match(w,/TimeoutStopSec=300/);
  assert.match(web,/TAG_API_ORIGIN=http:\/\/127\.0\.0\.1:18230/);
  assert.doesNotMatch(script+rollback,/\bsudo\b|\bnft\b|\brm\b|--delete|\bnpm\b|next build/);
});

test('happy path backs up first, preserves assets, restarts only gateway once, then checks six routes',()=>{
  const s=scenario();assert.equal(s.result.status,0,s.result.stderr);
  const c=s.commands;assert.equal(c.filter(x=>x==='systemctl --user restart tag-analysis.service').length,1);
  assert.ok(!c.some(x=>/systemctl .*\b(?:stop|restart|disable).*\btag-web\.service\b/.test(x)));
  assert.equal(fs.readFileSync(s.backup+'/tag-web.service','utf8'),'original tag-web unit');
  assert.equal(fs.readlinkSync(s.base+'/current'),s.base+'/releases/'+old);
  assert.equal(fs.readFileSync(s.release+'/web/.next/standalone/web/.next/static/shared.js','utf8'),'new shared bytes');
  assert.equal(fs.readFileSync(s.release+'/web/.next/standalone/web/.next/static/old.js','utf8'),'old bytes');
  const firstRestart=c.indexOf('systemctl --user restart tag-analysis.service');
  assert.ok(c.indexOf('systemctl --user stop tag-worker.service')<firstRestart);
  assert.ok(c.indexOf('systemctl --user start tag-worker.service')<firstRestart);
  const checks=c.slice(firstRestart).filter(x=>x.startsWith('curl ')&&!x.endsWith('/api/v1/openapi.json'));
  assert.equal(checks.length,6);assert.ok(checks.slice(3).every(x=>x.startsWith('curl https://tag.observe.tw/')));
  assert.ok(fs.existsSync(s.backup+'/restart-to-first-200-upper-bound.ns'));
  assert.ok(fs.readFileSync(s.units+'/tag-analysis.service.d/zz-f1-d1lv.conf','utf8').includes(releaseName));
});

for(const failUrl of ['http://127.0.0.1:18130/','http://127.0.0.1:18130/tag/%E6%9F%AF%E6%96%87%E5%93%B2/','http://127.0.0.1:18130/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations','https://tag.observe.tw/','https://tag.observe.tw/tag/%E6%9F%AF%E6%96%87%E5%93%B2/','https://tag.observe.tw/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations']){
  test('post-switch HTTP500 triggers immediate rollback: '+failUrl,()=>{
    const s=scenario({failUrl});assert.notEqual(s.result.status,0);
    assert.equal(s.commands.filter(x=>x==='systemctl --user restart tag-analysis.service').length,2);
    const restored=fs.readFileSync(s.units+'/tag-analysis.service.d/zz-f1-d1lv.conf','utf8');
    assert.ok(restored.includes(old));assert.ok(restored.includes('UI_ORIGIN=http://127.0.0.1:18132'));
    assert.ok(fs.existsSync(s.backup+'/rollback-ready.utc'));
    assert.ok(fs.readFileSync(s.units+'/tag-worker.service.d/zz-f1-d1lv.conf','utf8').includes(releaseName));
    assert.ok(!s.commands.some(x=>/systemctl .*\b(?:stop|restart|disable).*\btag-web\.service\b/.test(x)));
    assert.ok(fs.existsSync(s.release));assert.ok(fs.existsSync(s.backup));
  });
}

test('curl timeout28 after switch rolls back immediately without acceptance retries',()=>{
  const s=scenario({failUrl:'https://tag.observe.tw/',failCurl:true});assert.notEqual(s.result.status,0);
  assert.equal(s.commands.filter(x=>x==='systemctl --user restart tag-analysis.service').length,2);
  assert.equal(s.commands.filter(x=>x==='curl https://tag.observe.tw/').length,1);
  assert.ok(fs.existsSync(s.backup+'/rollback-ready.utc'));
});

test('gateway restart failure also restores persistent old override',()=>{
  const s=scenario({failRestart:true});assert.notEqual(s.result.status,0);
  assert.equal(s.commands.filter(x=>x==='systemctl --user restart tag-analysis.service').length,2);
  assert.ok(fs.readFileSync(s.units+'/tag-analysis.service.d/zz-f1-d1lv.conf','utf8').includes(old));
});

test('failed production-data prewarm never switches gateway or stops legacy worker',()=>{
  const s=scenario({failUrl:'http://127.0.0.1:18230/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations'});
  assert.notEqual(s.result.status,0);assert.ok(!s.commands.includes('systemctl --user restart tag-analysis.service'));
  assert.ok(!s.commands.includes('systemctl --user stop tag-worker.service'));
  assert.ok(s.commands.includes('systemctl --user disable --now tag-f1-web-d1lv.service tag-f1-api-d1lv.service'));
});

test('initial gate failure refuses copy and leaves services unchanged',()=>{
  const s=scenario({failProbe:1});assert.notEqual(s.result.status,0);
  assert.ok(!fs.existsSync(s.release));assert.ok(!s.commands.some(x=>x.startsWith('rsync ')));
  assert.ok(!s.commands.some(x=>/systemctl .*\b(?:start|stop|restart|enable|disable)\b/.test(x)));
});

test('pre-cutover gate failure leaves old gateway/version and retained F1 worker',()=>{
  const s=scenario({failProbe:3});assert.notEqual(s.result.status,0);
  assert.ok(!s.commands.includes('systemctl --user restart tag-analysis.service'));
  assert.ok(!fs.existsSync(s.units+'/tag-analysis.service.d/zz-f1-d1lv.conf'));
  assert.ok(fs.readFileSync(s.units+'/tag-worker.service.d/zz-f1-d1lv.conf','utf8').includes(releaseName));
});

test('cleanup failure is recorded as failed/unconfirmed, not swallowed',()=>{
  const s=scenario({failUrl:'http://127.0.0.1:18230/api/v1/tags/%E6%9F%AF%E6%96%87%E5%93%B2/relations',failCleanup:true});
  assert.equal(s.result.status,2);assert.match(s.result.stderr,/cleanup failed\/unconfirmed/);
  assert.ok(!s.commands.includes('systemctl --user restart tag-analysis.service'));
});

test('partially failed old-worker stop attempts recovery before returning failure',()=>{
  const s=scenario({failWorkerStop:true});assert.notEqual(s.result.status,0);
  assert.ok(s.commands.indexOf('systemctl --user start tag-worker.service')>s.commands.indexOf('systemctl --user stop tag-worker.service'));
  assert.ok(!s.commands.includes('systemctl --user restart tag-analysis.service'));
  assert.ok(!fs.existsSync(s.units+'/tag-worker.service.d/zz-f1-d1lv.conf'));
});


test('serial API warming uses private 120s only; hot full home must be <=2s; six public checks keep20s',()=>{
  const s=scenario();assert.equal(s.result.status,0,s.result.stderr);
  const opts=fs.readFileSync(s.root+'/curl-options.log','utf8').trim().split('\n');
  for(const row of opts.filter(x=>x.endsWith(' 120')))assert.match(row,/^http:\/\/127\.0\.0\.1:1823[02]\//);
  assert.ok(opts.includes('http://127.0.0.1:18232/ 2'));
  for(const row of opts.filter(x=>/^https:|^http:\/\/127\.0\.0\.1:18130\//.test(x)&&!x.includes('/openapi.json ')))assert.ok(row.endsWith(' 20'),row);
  const firstHome=s.commands.indexOf('curl http://127.0.0.1:18232/');
  for(const path of ['/api/v1/media-stats','/api/v1/topics?limit=120&kind=topic','/api/v1/journalists?hours=48&threshold=0.65&limit=6','/api/v1/ranking?category=news&order=score&limit=16&trend=1'])assert.ok(s.commands.indexOf('curl http://127.0.0.1:18230'+path)<firstHome);
});

test('warm API HTTP500 aborts before worker or gateway changes',()=>{
  const s=scenario({failUrl:'http://127.0.0.1:18230/api/v1/topics?limit=120&kind=topic'});
  assert.notEqual(s.result.status,0);assert.ok(!s.commands.includes('systemctl --user stop tag-worker.service'));assert.ok(!s.commands.includes('systemctl --user restart tag-analysis.service'));
});

test('hot homepage exceeding2s aborts even when HTTP200',()=>{
  const s=scenario({slowWarmReady:true});assert.notEqual(s.result.status,0);
  assert.ok(!s.commands.includes('systemctl --user stop tag-worker.service'));assert.ok(!s.commands.includes('systemctl --user restart tag-analysis.service'));
  assert.ok(s.commands.includes('systemctl --user disable --now tag-f1-web-d1lv.service tag-f1-api-d1lv.service'));
});


test('private API120s timeout aborts before public cutover',()=>{
  const s=scenario({failUrl:'http://127.0.0.1:18230/api/v1/media-stats',failCurl:true});
  assert.notEqual(s.result.status,0);assert.ok(!s.commands.includes('systemctl --user restart tag-analysis.service'));
  assert.ok(!s.commands.includes('systemctl --user stop tag-worker.service'));
});


test('retained approved001 units are compared, backed up and updated to002; old release/backup remain',()=>{
  const s=scenario({retainedUnits:true});assert.equal(s.result.status,0,s.result.stderr);
  for(const name of ['tag-f1-api-d1lv','tag-f1-web-d1lv']){
    assert.match(fs.readFileSync(s.backup+'/'+name+'.service','utf8'),/-simple-001/);
    assert.match(fs.readFileSync(s.units+'/'+name+'.service','utf8'),/-simple-002/);
  }
  assert.equal(fs.readFileSync(s.backup+'/tag-f1-api-d1lv.service.d/nearline.conf','utf8'),'original nonsecret nearline reference');
  assert.equal(fs.readFileSync(s.base+'/releases/'+app+'-'+build+'-simple-001/retained','utf8'),'original001 release');
  assert.equal(fs.readFileSync(s.backup.replace('-simple-002','-simple-001')+'/retained','utf8'),'original001 backup');
});

test('unexpected retained unit content stops before backup/copy/service changes',()=>{
  const s=scenario({retainedUnits:true,mismatchedUnit:true});assert.notEqual(s.result.status,0);
  assert.ok(!fs.existsSync(s.backup));assert.ok(!fs.existsSync(s.release));
  assert.ok(!s.commands.some(x=>x.startsWith('rsync ')||/^systemctl .* (start|stop|restart|enable|disable) /.test(x)));
});


for(const options of [{failGit:true},{lateGitFailure:true}]){
  test('retained-unit check refuses Git failure even with matching output: '+JSON.stringify(options),()=>{
    const s=scenario({retainedUnits:true,...options});assert.notEqual(s.result.status,0);
    assert.ok(!fs.existsSync(s.backup));assert.ok(!fs.existsSync(s.release));
    assert.ok(!s.commands.some(x=>x.startsWith('rsync ')||/^systemctl .* (start|stop|restart|enable|disable) /.test(x)));
  });
}

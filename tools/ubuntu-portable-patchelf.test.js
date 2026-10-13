import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parsePatchelfIndex, verifyUbuntuPatchelfMetadata, preparePortablePatchelf, patchelfPin, validateUbuntuSignatureStatus, signedReleasePayload} from './ubuntu-portable-patchelf.js';
const sha = b => createHash('sha256').update(b).digest('hex');
function packet(changes = {}) {
 const fields = {Package:'patchelf',Version:patchelfPin.version,Architecture:'amd64',Size:String(patchelfPin.bytes),Filename:patchelfPin.filename,SHA256:patchelfPin.sha256,...changes};
 return Buffer.from(Object.entries(fields).map(([k,v])=>k+': '+v).join('\n')+'\n\n');
}
const release = bytes => Buffer.from('Origin: Ubuntu\nCodename: noble\nSHA256:\n '+sha(bytes)+' '+bytes.length+' universe/binary-amd64/Packages\n-----BEGIN PGP SIGNATURE-----\nmock parser fixture only\n');
test('unsigned parser checks exact package digest and reviewed pin without claiming signature trust', () => {
 const p=packet();const result=parsePatchelfIndex(release(p),p);
 assert.equal(result.package.sha256,patchelfPin.sha256);assert.equal(result.signatureVerified,undefined);
 assert.equal(result.packagesSha256,sha(p));
 assert.throws(()=>parsePatchelfIndex(release(p),Buffer.concat([p,Buffer.from('changed')])),/digest/);
});
test('matching index hashes cannot authorize wrong versions, architectures, paths, sizes or archive hashes', () => {
 for(const changes of [{Version:'0.19'},{Architecture:'arm64'},{Filename:'../evil.deb'},{Size:'500000000'},{SHA256:'a'.repeat(64)}]) {
  const p=packet(changes);assert.throws(()=>parsePatchelfIndex(release(p),p),/reviewed pin/);
 }
});
test('wrong release, missing index and duplicate package entries fail closed', () => {
 const p=packet();
 for(const bad of [release(p).toString().replace('Ubuntu','Other'),release(p).toString().replace('noble','other'),release(p).toString().replace('universe/binary-amd64/Packages','main/binary-amd64/Packages')])assert.throws(()=>parsePatchelfIndex(Buffer.from(bad),p));
 const duplicate=Buffer.concat([p,p]);assert.throws(()=>parsePatchelfIndex(release(duplicate),duplicate),/Unique/);
});
test('non-root, writable, symlinked and incorrect public keyrings stop before gpg execution', () => {
 for(const change of [{uid:1000},{mode:0o100666},{isSymbolicLink:()=>true},{size:2*1024**2},{}]) {
  let called=0;
  assert.throws(()=>verifyUbuntuPatchelfMetadata({io:{lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,uid:0,mode:0o100644,size:4,...change}),readFileSync:()=>Buffer.from('fake')},run:()=>{called++;return '';}}));
  assert.equal(called,0);
 }
});
test('missing guard or failed initial guard performs no download, extraction or filesystem change', async () => {
 let writes=0;let reads=0;let commands=0;
 const deps={io:{mkdirSync:()=>writes++},metadata:()=>{reads++;return{};},run:()=>commands++,runtime:{platform:'linux',arch:'x64'}};
 await assert.rejects(preparePortablePatchelf('/private/new',deps),/Guarded/);
 await assert.rejects(preparePortablePatchelf('/private/new',{...deps,assertGuard:()=>{throw Error('gate stopped');}}),/gate stopped/);
 assert.equal(writes+reads+commands,0);
});
test('bad downloaded bytes remain retained and never reach extraction or final provenance', async () => {
 const writes=[];const commands=[];let checks=0;
 await assert.rejects(preparePortablePatchelf('/private/new',{assertGuard:()=>checks++,metadata:()=>({mock:true}),runtime:{platform:'linux',arch:'x64'},io:{mkdirSync:(p)=>writes.push(p),writeFileSync:(p,b,o)=>{assert.equal(o.flag,'wx');assert.equal(o.mode,0o600);writes.push(p);},lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:patchelfPin.bytes}),readFileSync:()=>Buffer.alloc(0)},run:(bin,args)=>{commands.push({bin,args});return '';}}),/digest mismatch/);
 assert.equal(checks,3);assert.equal(commands.length,1);assert.equal(commands[0].bin,'/usr/bin/curl');assert.ok(!commands[0].args.includes('--location'));
 assert.ok(commands[0].args.includes('--max-filesize'));assert.ok(commands[0].args.includes(String(patchelfPin.bytes)));
 assert.ok(!writes.some(p=>p.endsWith('provenance.json')||p.endsWith('/root')));
});
test('unsigned, wrong-signer and explicit signature failures cannot pass status validation',()=>{
 const valid='[GNUPG:] VALIDSIG F6ECB3762474EDA9D21B7022871920D1991BC93C date';
 validateUbuntuSignatureStatus(valid);
 for(const status of ['',valid.replace('F6ECB','BAD00'),valid+'\n[GNUPG:] BADSIG failed',valid+'\n[GNUPG:] NO_PUBKEY missing'])assert.throws(()=>validateUbuntuSignatureStatus(status),/signature/);
});
test('only the single clearsigned payload is parsed; unsigned prefix, suffix and nested blocks are rejected',()=>{
 const text='-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA512\n\nOrigin: Ubuntu\n- - escaped\n-----BEGIN PGP SIGNATURE-----\nmock armor only\n-----END PGP SIGNATURE-----\n';
 assert.equal(signedReleasePayload(Buffer.from(text)).toString(),'Origin: Ubuntu\n- escaped\n');
 for(const bad of ['unsigned\n'+text,text+'unsigned\n',text.replace('Origin: Ubuntu','-----BEGIN PGP SIGNED MESSAGE-----'),text.replace('mock armor only','-----BEGIN PGP SIGNATURE-----')])assert.throws(()=>signedReleasePayload(Buffer.from(bad)),/clearsigned/);
});
function prepareFixture(){
 const files=new Map();const writes=[];const commands=[];let checks=0;
 const deps={runtime:{platform:'linux',arch:'x64'},assertGuard:()=>checks++,metadata:async()=>({mockSignedMetadata:true}),digest:b=>b.length===patchelfPin.bytes?patchelfPin.sha256:sha(b),
  io:{mkdirSync:p=>writes.push(p),writeFileSync:(p,b,o)=>{assert.equal(o.flag,'wx');assert.equal(o.mode,0o600);files.set(p,b);writes.push(p);},readFileSync:p=>files.get(p),realpathSync:p=>p,lstatSync:p=>({isFile:()=>true,isSymbolicLink:()=>false,size:files.get(p)?.length})},
  run:(bin,args)=>{commands.push({bin,args});if(bin==='/usr/bin/curl')files.set(args[args.indexOf('--output')+1],Buffer.alloc(patchelfPin.bytes));
   if(bin==='/usr/bin/dpkg-deb')files.set(args[2]+'/usr/bin/patchelf',Buffer.from('mock tool'));
   if(bin==='/usr/bin/readelf')return args[0]==='--file-header'?'Class: ELF64\nMachine: Advanced Micro Devices X86-64':args[0]==='--version-info'?'Version needs section .gnu.version_r:\nName: GLIBC_2.38':'Dynamic section:\n(NEEDED) [libc.so.6]';
   if(args[0]==='--version')return 'patchelf 0.18.0';return '';}};
 return{deps,files,writes,commands,get checks(){return checks;}};
}
test('complete memory-only preparation preserves pin, guards, tool requirements and private provenance',async()=>{
 const f=prepareFixture();const r=await preparePortablePatchelf('/private/new',f.deps);
 assert.equal(r.version,'0.18.0');assert.equal(r.requirements.maxRequired,'2.38');assert.ok(f.checks>=6);
 assert.ok(f.files.has('/private/new/provenance.json'));assert.ok(!f.commands.some(c=>c.bin.includes('apt-get')));
});
test('metadata or any later guard failure cannot publish a successful tool receipt',async()=>{
 for(let failing=2;failing<=6;failing++){
  const f=prepareFixture();let n=0;f.deps.assertGuard=()=>{if(++n===failing)throw Error('gate stopped');};
  await assert.rejects(preparePortablePatchelf('/private/new',f.deps),/gate stopped/);
  assert.ok(!f.files.has('/private/new/provenance.json'));if(failing===2)assert.equal(f.writes.length,0);
 }
 const f=prepareFixture();f.deps.metadata=async()=>{throw Error('signature failed');};
 await assert.rejects(preparePortablePatchelf('/private/new',f.deps),/signature failed/);assert.equal(f.writes.length,0);
});
test('oversized or symlink archive is rejected before reading or extraction',async()=>{
 for(const stat of [{isFile:()=>true,isSymbolicLink:()=>false,size:patchelfPin.bytes+1},{isFile:()=>true,isSymbolicLink:()=>true,size:patchelfPin.bytes}]){
  const f=prepareFixture();f.deps.io.lstatSync=()=>stat;f.deps.io.readFileSync=()=>{throw Error('must not read');};
  await assert.rejects(preparePortablePatchelf('/private/new',f.deps),/Bounded/);assert.ok(!f.commands.some(c=>c.bin==='/usr/bin/dpkg-deb'));
 }
});

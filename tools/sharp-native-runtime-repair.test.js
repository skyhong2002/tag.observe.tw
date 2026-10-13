import { initialAppSha } from './mint-f1-candidate-plan.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repairSharpRuntime, validateRepairPlan, assertOnlyRpathChanged, bindingPaths, originalRpath, preSha, repairedRpath, buildId, hash, extractTextBytes, snapshotElf } from './sharp-native-runtime-repair.js';
const snapshot = () => ({ tag: 'RPATH', runpath: null, rpath: originalRpath.join(':'), arch: 'x64', needed: ['libvips-cpp.so.8.18.7'], soname: [], versions: ['GLIBC_2.17','GLIBCXX_3.4'], symbols: ['symbol@GLIBCXX_3.4'], textDigest: 'text', rawReadelfSha256: 'raw' });
function fixture() {
 const source = '/artifact.original.runtime', destination = '/artifact.original.native-runtime';
 const bytes = new Map(bindingPaths.map(p => [`${source}/${p}`, 'binding-before'])); bytes.set(source+'/manifest.json', JSON.stringify({ buildId, commit: initialAppSha })); bytes.set('/trusted/patchelf', 'tool');
 const original = [...bindingPaths, 'manifest.json'].map(path => ({ path, type: 'file', mode: 0o600, sha256: path === 'manifest.json' ? hash(bytes.get(source+'/'+path)) : preSha }));
 const io = { readFileSync: p => { if (!bytes.has(p)) throw Error('missing '+p); return bytes.get(p); }, realpathSync: p => p, lstatSync: p => ({ isDirectory: () => !p.endsWith('.so.8.18.7'), isSymbolicLink: () => false, isFile: () => p.endsWith('.so.8.18.7') }), mkdirSync: p => { if (bytes.has(p)) throw Error('exists'); bytes.set(p, 'directory'); }, copyFileSync: (a,b) => { if (bytes.has(b)) throw Error('exists'); bytes.set(b,bytes.get(a)); }, chmodSync: () => {}, readdirSync: () => ['libvips-cpp.so.8.18.7'], writeFileSync: (p,b,o) => { if (o.flag === 'wx' && bytes.has(p)) throw Error('exists'); bytes.set(p,b); } };
 const digest = b => b === 'binding-before' ? preSha : hash(b);
 const deps = { io, hash: digest, inventory: root => root === source ? structuredClone(original) : [...original.map(e => ({ ...e, sha256: digest(bytes.get(root+'/'+e.path)) })), ...(bytes.has(root+'/sharp-native-repair.json') ? [{ path:'sharp-native-repair.json', type:'file', sha256:hash(bytes.get(root+'/sharp-native-repair.json')) }] : [])], assertLock: () => {}, assertKernel: () => {}, currentGuard: () => {}, verifyOriginal: () => {}, providePatchelf: () => ({ path:'/trusted/patchelf', sha256:hash('tool'), version:'0.18.0', provenance:{ signedUbuntuChain:true } }), verifyToolProof: () => {}, run: (bin,args) => { if (args[0] === '--version') return 'patchelf 0.18.0'; bytes.set(args.at(-1),'patched'); return ''; }, snapshot: p => ({ ...snapshot(), ...(bytes.get(p) === 'patched' ? { rpath:repairedRpath } : {}) }), createManifest: () => ({ inventorySha256:'new' }), collectElfProof: () => ({ status:'inspected' }), verifyElfProof: () => {} };
 return { source,destination,bytes,original,deps,input:{ source,destination,originalInventorySha256:hash(JSON.stringify(original)),identity:{ appSha:initialAppSha } } };
}
test('mock derivation changes only fixed bindings/manifest/receipt; original untouched, no eligible green', () => { const f=fixture(); const before=[...f.bytes.entries()].filter(([p]) => p.startsWith(f.source)); const r=repairSharpRuntime(f.input,f.deps); assert.equal(r.deployEligible,false); assert.equal(r.receipt.repairs.length,3); assert.equal(r.nativeStatus,'pending-new-target-smoke'); assert.deepEqual([...f.bytes.entries()].filter(([p]) => p.startsWith(f.source)),before); assert.equal(f.bytes.has(f.destination+'/mint-artifact.json'),false); assert.equal(r.manifestPublished,false); assert.throws(() => repairSharpRuntime(f.input,f.deps), /exists/); });
test('unknown hash/tool bytes/tool version/layout and evidence rejected', () => { for(const change of [f=>{f.original[0].sha256='f'.repeat(64);f.input.originalInventorySha256=hash(JSON.stringify(f.original));}, f=>{f.deps.providePatchelf=()=>({path:'/trusted/patchelf',sha256:'f'.repeat(64),version:'0.18.0',provenance:{}});}, f=>{f.deps.providePatchelf=()=>({path:'/trusted/patchelf',sha256:hash('tool'),version:'0.17.2',provenance:{}});}, f=>{f.deps.verifyToolProof=undefined;}]) { const f=fixture();change(f);assert.throws(()=>repairSharpRuntime(f.input,f.deps));assert.equal(f.bytes.has(f.destination),false); }
 assert.throws(()=>validateRepairPlan({...fixture().input,bindingPaths:[...bindingPaths.slice(0,2),'unknown.node']})); });
test('tag/version/symbol/text mutations cannot hide behind repaired RPATH', () => { const b=snapshot(), a={...b,rpath:repairedRpath}; assertOnlyRpathChanged(b,a); for(const delta of [{tag:'RUNPATH'},{runpath:'x'},{versions:['changed']},{symbols:['changed']},{textDigest:'changed'},{needed:[]}]) assert.throws(()=>assertOnlyRpathChanged(b,{...a,...delta})); });
test('escaping library, lost lock and tool failure retain partial tree without final inventory', () => { for(const change of [f=>{f.deps.io.realpathSync=p=>p.includes('sharp-libvips')?'/foreign':p;}, f=>{let n=0;f.deps.assertLock=()=>{if(++n===5)throw Error('lost lock');};}, f=>{f.deps.run=(bin,args)=>{if(args[0]==='--version')return 'patchelf 0.18.0';throw Error('tool failed');};}, f=>{f.deps.snapshot=()=>({...snapshot(),tag:'RUNPATH'});}]) {const f=fixture();change(f);assert.throws(()=>repairSharpRuntime(f.input,f.deps));assert.ok(f.bytes.has(f.destination));assert.equal(f.bytes.has(f.destination+'/mint-artifact.json'),false);assert.equal(f.bytes.get(f.source+'/'+bindingPaths[0]),'binding-before');} });
test('final gate/original comparison failure cannot publish pending artifact manifest', () => {
 for (const change of [f=>{f.deps.currentGuard=({phase})=>{if(phase==='return-pending')throw Error('late gate');};},f=>{let n=0;f.deps.verifyOriginal=()=>{if(++n===2)f.original[0]={...f.original[0],sha256:'changed'};};}]) {
  const f=fixture();change(f);assert.throws(()=>repairSharpRuntime(f.input,f.deps));assert.equal(f.bytes.has(f.destination+'/mint-artifact.json'),false);
 }
});
test('all mandatory verifiers reject thenables instead of silently passing', () => {
 for (const callback of ['assertLock','assertKernel','currentGuard','verifyOriginal','verifyToolProof']) {
  const f=fixture();f.deps[callback]=async()=>{throw Error('async rejection');};
  assert.throws(()=>repairSharpRuntime(f.input,f.deps),/thenable/);assert.equal(f.bytes.has(f.destination+'/mint-artifact.json'),false);
 }
});
test('trusted arrays immutable, fixed APP identity and actual changed binding required', () => {
 assert.ok(Object.isFrozen(bindingPaths));assert.ok(Object.isFrozen(originalRpath));assert.throws(()=>bindingPaths.push('evil'));
 const bad=fixture();bad.input.identity.appSha='b'.repeat(40);assert.throws(()=>repairSharpRuntime(bad.input,bad.deps),/Pinned APP/);
 const f=fixture();f.deps.hash=b=>b==='patched'?preSha:b==='binding-before'?preSha:hash(b);
 assert.throws(()=>repairSharpRuntime(f.input,f.deps),/must change/);assert.equal(f.bytes.has(f.destination+'/mint-artifact.json'),false);
});

test('lease expiring during either final hash cannot return prepared or publish', () => {
 for (const expiry of ['verifyOriginal', 'scan']) {
  const f=fixture();let expired=false;let verified=0;let scanned=0;
  f.deps.assertLock=()=>{if(expired)throw Error('expired final lease');};
  f.deps.verifyOriginal=()=>{if(++verified===2 && expiry==='verifyOriginal')expired=true;};
  const scan=f.deps.inventory;
  f.deps.inventory=root=>{const result=scan(root);if(root===f.source && ++scanned===3 && expiry==='scan')expired=true;return result;};
  assert.throws(()=>repairSharpRuntime(f.input,f.deps),/expired final lease/);
  assert.equal(f.bytes.has(f.destination+'/mint-artifact.json'),false);
 }
});

test('GNU readelf fixed 35-character hex field never consumes ASCII', () => {
 const full='  0x00012820 554889e5 41554154 4c8d65d0 534889fb UH..AUATL.e.SH..';
 const tail='  0x00012830 '+'aabbccdd eeff'.padEnd(35)+' deadbeef cafe';
 assert.equal(extractTextBytes(full),'554889e5415541544c8d65d0534889fb');
 assert.equal(extractTextBytes(tail),'aabbccddeeff');
 assert.equal(extractTextBytes('  0x00012820 '+'deadbeef cafebabe 01020304 aabbccdd'+' deadbeef'),'deadbeefcafebabe01020304aabbccdd');
 for(const raw of ['', '  0x01 aabbccdd ascii', '  0x01 '+'aabbccdd f'.padEnd(35)+' ascii','  0x01 '+'aabb ccdd'.padEnd(35)+' ascii',full.replace(' UH','UH')]) assert.throws(()=>extractTextBytes(raw));
 assert.notEqual(hash(extractTextBytes(full)),hash(extractTextBytes(full.replace('554889e5','554889e4'))));
});
test('new attempt requires explicit reviewed same-parent suffix', () => {
 const f=fixture(); const destination=f.destination+'-r2';
 assert.throws(()=>validateRepairPlan({...f.input,destination}));
 assert.equal(validateRepairPlan({...f.input,destination,reviewedAttemptSuffix:'-r2'}).destination,destination);
 for(const suffix of ['-r1','-r3','-r10','-other','/x','-r02']) assert.throws(()=>validateRepairPlan({...f.input,destination:f.destination+suffix,reviewedAttemptSuffix:suffix}));
 assert.throws(()=>validateRepairPlan({...f.input,destination:'/other/file.native-runtime-r2',reviewedAttemptSuffix:'-r2'}));
});
test('snapshotElf consumes real readelf row format and detects before/after text change', () => {
 const full='  0x00012820 554889e5 41554154 4c8d65d0 534889fb UH..AUATL.e.SH..';
 const reader=(rpath,text)=>(bin,args)=>({
  '--file-header':'  Class: ELF64\n  Machine: Advanced Micro Devices X86-64',
  '--dynamic':`Dynamic section\n  0x000000000000000f (RPATH) Library rpath: [${rpath}]\n  0x1 (NEEDED) [libvips-cpp.so.8.18.7]`,
  '--version-info':'Version needs section\n  0x0010: Name: GLIBC_2.17 Flags: none Version: 2',
  '--dyn-syms':'  1: 0000000000000000 0 FUNC GLOBAL DEFAULT UND memcpy@GLIBC_2.17 (2)',
  '--hex-dump=.text':`Hex dump of section '.text':\n${text}\n`
 }[args[0]]);
 const before=snapshotElf('/mock',reader(originalRpath.join(':'),full));
 const after=snapshotElf('/mock',reader(repairedRpath,full));assertOnlyRpathChanged(before,after);
 const changed=snapshotElf('/mock',reader(repairedRpath,full.replace('554889e5','554889e4')));
 assert.throws(()=>assertOnlyRpathChanged(before,changed),/textDigest/);
});

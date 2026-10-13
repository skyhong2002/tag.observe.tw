// Prepare-only Node24/glibc target derivation; importing opens no resources.
import * as fs from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { initialAppSha } from './mint-f1-candidate-plan.js';
import { inventory, createArtifactManifest } from './mint-f1-artifact.js';
import { collectElfProof, verifyElfProof } from './native-elf-proof.js';
export const pinnedInventory = '5bfc700a09b63d8144f77df8aa6e65f36f783c9d2296b0643de6979b5eb9c714';
export const pinnedBuildId = 'PmjYScQDDoJKBr43SLkhd';
export const packageRoot = 'node_modules/@msgpackr-extract/msgpackr-extract-linux-x64';
export const packageVersion = '3.0.4';
export const removedNames = Object.freeze(['node.abi115.glibc.node','node.abi115.musl.node','node.napi.musl.node']);
export const retainedName = 'node.napi.glibc.node';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function sync(fn, ...args) { const value = fn(...args); if (value === false) throw Error('Verifier explicitly rejected operation'); if (value && typeof value.then === 'function') { Promise.resolve(value).catch(()=>{}); throw Error('Synchronous verifier required'); } return value; }
export function validateMsgpackrSelection(entries,lock,pkg) {
 if(lock.packages?.[packageRoot]?.version!==packageVersion||pkg.name!=='@msgpackr-extract/msgpackr-extract-linux-x64'||pkg.version!==packageVersion||JSON.stringify(pkg.os)!=='["linux"]'||JSON.stringify(pkg.cpu)!=='["x64"]')throw Error('Pinned msgpackr package/lock/platform mismatch');
 const allowed=[...removedNames,retainedName,'package.json','index.js','README.md'].sort();
 const actual=entries.filter(e=>e.path.startsWith(packageRoot+'/')).map(e=>e.path.slice(packageRoot.length+1)).sort();
 if(JSON.stringify(actual)!==JSON.stringify(allowed)||entries.filter(e=>e.path.startsWith(packageRoot+'/')).some(e=>e.type!=='file'))throw Error('Unknown msgpackr four-binding package layout');
 const excluded=removedNames.map(name=>{const file=entries.find(e=>e.path===packageRoot+'/'+name);if(file.binaryKind!=='elf'||!file.sha256)throw Error('Invalid exact excluded ELF');return {...file,reason:name.startsWith('node.abi115')?'ABI115 not selected by Node24 ABI137 loader':'musl not selected by glibc target loader'};});
 if(entries.find(e=>e.path===packageRoot+'/'+retainedName)?.binaryKind!=='elf')throw Error('Required NAPI glibc ELF missing');
 return excluded;
}
export function planTargetRuntime(input, io = fs, scan = root => inventory(root, io)) {
 const source=resolve(input.source), destination=resolve(input.destination);
 if(!source.endsWith('.native-runtime-r2')||destination!==source+'.target-runtime'||dirname(source)!==dirname(destination))throw Error('Exclusive same-parent fixed target-runtime derivative required');
 if(input.identity?.appSha!==initialAppSha||input.identity.arch!=='x64'||input.identity.nodeModulesAbi!=='137'||!/^glibc-/.test(input.identity.smAbi?.libc||''))throw Error('Pinned APP/Node24 ABI137 x64 glibc target required');
 if(!io.lstatSync(source).isDirectory()||io.lstatSync(source).isSymbolicLink()||io.realpathSync(source)!==source||io.realpathSync(dirname(source))!==dirname(source))throw Error('Canonical original runtime required');
 const entries=scan(source);if(digest(JSON.stringify(entries))!==pinnedInventory)throw Error('Pinned original runtime inventory mismatch');
 const rootManifest=JSON.parse(io.readFileSync(join(source,'manifest.json'),'utf8'));
 if(rootManifest.commit!==initialAppSha||rootManifest.buildId!==pinnedBuildId||io.readFileSync(join(source,'COMMIT'),'utf8').trim()!==initialAppSha||io.readFileSync(join(source,'web/.next/BUILD_ID'),'utf8').trim()!==pinnedBuildId)throw Error('Original APP/BUILD identity mismatch');
 const lock=JSON.parse(io.readFileSync(join(source,'package-lock.json'),'utf8'));const pkg=JSON.parse(io.readFileSync(join(source,packageRoot,'package.json'),'utf8'));
 const excluded=validateMsgpackrSelection(entries,lock,pkg);
 return {source,destination,entries,rootManifest,excluded};
}
export function prepareMsgpackrTargetRuntime(input, dependencies = {}) {
 const io=dependencies.io||fs, scan=dependencies.inventory||(root=>inventory(root,io));
 const required=['verifyOriginal','assertLock','assertKernel','currentGuard'];for(const name of required)if(typeof dependencies[name]!=='function')throw Error('Mandatory synchronous verifier: '+name);
 const gate=phase=>{sync(dependencies.assertLock,phase);sync(dependencies.assertKernel,phase);sync(dependencies.currentGuard,{phase,estimatedAdditionalGiB:4});};
 gate('preflight');sync(dependencies.verifyOriginal,resolve(input.source),input.identity);
 const plan=(dependencies.plan||planTargetRuntime)(input,io,scan);const originalSnapshot=JSON.stringify(plan.entries);
 gate('create-exclusive');io.mkdirSync(plan.destination,{mode:0o700});const exclusions=new Set(plan.excluded.map(e=>e.path));
 for(const entry of plan.entries){if(exclusions.has(entry.path))continue;gate('copy');const from=join(plan.source,entry.path),to=join(plan.destination,entry.path);
  if(entry.type==='directory')io.mkdirSync(to,{mode:entry.mode});
  else if(entry.type==='file'){if(digest(io.readFileSync(from))!==entry.sha256)throw Error('Original bytes changed during copy');io.copyFileSync(from,to,1);io.chmodSync(to,entry.mode);if(digest(io.readFileSync(to))!==entry.sha256)throw Error('Target copied bytes differ');}
  else if(entry.type==='symlink'){if(io.readlinkSync(from)!==entry.target)throw Error('Original symlink changed');io.symlinkSync(entry.target,to);}
  else throw Error('Unknown original inventory type');
 }
 gate('root-manifest');
 const rebased={...plan.rootManifest,nativeStatus:'pending-new-target-loader',deployEligible:false,ui:'not reviewed'};
 for(const name of ['standaloneWeb','appSource','appData']){const old=plan.rootManifest[name];if(typeof old!=='string'||!isAbsolute(old))throw Error('Required absolute root manifest path');const path=relative(plan.source,old);if(!path||path==='..'||path.startsWith('../')||isAbsolute(path))throw Error('Original root manifest path escapes');rebased[name]=join(plan.destination,path);}
 io.writeFileSync(join(plan.destination,'manifest.json'),JSON.stringify(rebased,null,2)+'\n',{mode:0o600});
 const receipt={schema:'msgpackr-target-selection-v1',source:plan.source,destination:plan.destination,appSha:initialAppSha,buildId:pinnedBuildId,originalInventorySha256:pinnedInventory,packageVersion,excluded:plan.excluded,retained:packageRoot+'/'+retainedName,status:'pending-new-target-loader',deployEligible:false};
 io.writeFileSync(join(plan.destination,'msgpackr-target-selection.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
 gate('derived-inventory');const derived=scan(plan.destination);const allowed=new Set(['manifest.json','msgpackr-target-selection.json']);
 const expected=plan.entries.filter(e=>!exclusions.has(e.path)&&!allowed.has(e.path));const actual=derived.filter(e=>!allowed.has(e.path));
 if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Unexpected retained files/modes/symlinks difference');
 if(JSON.stringify(scan(plan.source))!==originalSnapshot)throw Error('Original runtime changed');
 gate('strict-whole-elf');const artifact=(dependencies.createManifest||((root,identity)=>createArtifactManifest(root,identity,io)))(plan.destination,input.identity);
 const elf=(dependencies.collectElfProof||((root,manifest)=>collectElfProof(root,manifest,undefined,io)))(plan.destination,artifact);
 sync(dependencies.verifyElfProof||verifyElfProof,artifact,elf);
 sync(dependencies.verifyOriginal,plan.source,input.identity);if(JSON.stringify(scan(plan.source))!==originalSnapshot)throw Error('Original changed during final verification');
 gate('prepared-return');return {root:plan.destination,receipt,artifact,elf,manifestPublished:false,deployEligible:false,nativeStatus:'pending-new-target-loader',ui:'not reviewed'};
}

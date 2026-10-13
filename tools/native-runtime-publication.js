// The sole pending-inventory publisher. Never grants native/UI/deploy approval.
import assert from 'node:assert/strict';
import { lstatSync, writeFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { createArtifactManifest } from './mint-f1-artifact.js';
import { verifyElfProof } from './native-elf-proof.js';
function synchronous(fn) {
  const result = fn();
  if (result && typeof result.then === 'function') {
    Promise.resolve(result).catch(() => {});
    throw Error('Synchronous final verifier required');
  }
  if (result === false) throw Error('Final verifier rejected publication');
}
export async function publishPendingNativeRuntime({ root, workerExitCode, result, expected, identity,
  checkFreshGates, checkInput, checkKernel }, {
  createManifest = createArtifactManifest, verifyProof = verifyElfProof,
  io = { lstatSync, writeFileSync },
} = {}) {
  if (!isAbsolute(root || '') || workerExitCode !== 0 || !result || result.manifestPublished !== false
    || result.deployEligible !== false || !expected || ![checkFreshGates, checkInput, checkKernel].every(fn => typeof fn === 'function')) throw Error('Completed worker and explicit final verifiers required');
  for (const key of ['appSha', 'opsSha', 'buildId', 'driverSha256', 'inputSha256']) {
    assert.ok(typeof expected[key] === 'string' && expected[key]); assert.equal(result[key], expected[key]);
  }
  assert.equal(result.runtimeRoot, root);
  const actual = createManifest(root, identity);
  assert.deepEqual(actual, result.artifact);
  for (const key of ['appSha', 'opsSha', 'buildId']) assert.equal(actual[key], expected[key]);
  assert.equal(actual.inventorySha256, result.artifactInventorySha256);
  assert.equal(actual.deployEligible, false);
  synchronous(() => verifyProof(actual, result.nativeElfProof));
  const path = join(root, 'mint-artifact.json');
  try { io.lstatSync(path); throw Error('Pending inventory already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (await checkFreshGates() !== 'run') throw Error('Fresh final gates rejected publication');
  synchronous(checkInput);
  synchronous(checkKernel);
  // No required validation follows this unique exclusive write.
  io.writeFileSync(path, JSON.stringify({ ...actual, nativeElfProof: result.nativeElfProof }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return { artifactInventorySha256: actual.inventorySha256, buildId: actual.buildId,
    nativeStatus: 'pending actual Mint and SM loader', deployEligible: false };
}

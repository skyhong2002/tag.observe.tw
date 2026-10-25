import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishPendingNativeRuntime } from './native-runtime-publication.js';

function fixture() {
  const events = [];
  const writes = [];
  const expected = { appSha: 'app', opsSha: 'ops', buildId: 'build', driverSha256: 'driver', inputSha256: 'input' };
  const artifact = { appSha: 'app', opsSha: 'ops', buildId: 'build', inventorySha256: 'inventory', deployEligible: false };
  const input = {
    root: '/private/native-runtime',
    workerExitCode: 0,
    expected,
    identity: {},
    result: {
      ...expected,
      runtimeRoot: '/private/native-runtime',
      artifactInventorySha256: 'inventory',
      artifact,
      nativeElfProof: {},
      manifestPublished: false,
      deployEligible: false,
    },
    checkFreshGates: async () => {
      events.push('gates');
      return 'run';
    },
    checkInput: () => events.push('input'),
    checkKernel: () => events.push('kernel'),
  };
  const deps = {
    createManifest: () => {
      events.push('hash');
      return artifact;
    },
    verifyProof: () => events.push('elf'),
    io: {
      lstatSync: () => {
        const e = Error('missing');
        e.code = 'ENOENT';
        throw e;
      },
      writeFileSync: (p, b, o) => {
        events.push('write');
        writes.push({ p, b, o });
      },
    },
  };
  return { input, deps, events, writes };
}
test('sole publisher performs fresh gates after long hash and writes once with private exclusive mode', async () => {
  const f = fixture();
  const r = await publishPendingNativeRuntime(f.input, f.deps);
  assert.deepEqual(f.events, ['hash', 'elf', 'gates', 'input', 'kernel', 'write']);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0].o, { mode: 0o600, flag: 'wx' });
  assert.equal(r.deployEligible, false);
});
test('worker failure, changed input/result, differing inventory, missing ELF proof and failed final gates never call writer', async () => {
  const changes = [
    (f) => (f.input.workerExitCode = 1),
    (f) => (f.input.result.inputSha256 = 'changed'),
    (f) => (f.deps.createManifest = () => ({ changed: true })),
    (f) =>
      (f.deps.verifyProof = () => {
        throw Error('missing ELF');
      }),
    (f) =>
      (f.input.checkFreshGates = async () => {
        throw Error('API unavailable');
      }),
    (f) => (f.input.checkFreshGates = async () => 'pause'),
    (f) =>
      (f.input.checkInput = () => {
        throw Error('input modified');
      }),
    (f) =>
      (f.input.checkKernel = () => {
        throw Error('kernel inode replaced');
      }),
  ];
  for (const change of changes) {
    const f = fixture();
    change(f);
    await assert.rejects(publishPendingNativeRuntime(f.input, f.deps));
    assert.equal(f.writes.length, 0);
  }
});
test('existing or inaccessible pending inventory and asynchronous final verifier are rejected', async () => {
  for (const change of [
    (f) => (f.deps.io.lstatSync = () => ({})),
    (f) =>
      (f.deps.io.lstatSync = () => {
        const e = Error('denied');
        e.code = 'EACCES';
        throw e;
      }),
    (f) => (f.input.checkKernel = async () => {}),
    (f) => (f.input.checkInput = () => false),
  ]) {
    const f = fixture();
    change(f);
    await assert.rejects(publishPendingNativeRuntime(f.input, f.deps));
    assert.equal(f.writes.length, 0);
  }
});
test('false or asynchronous ELF verifiers cannot publish even when they resolve or reject later', async () => {
  for (const verifier of [
    () => false,
    async () => true,
    async () => {
      throw Error('late ELF rejection');
    },
  ]) {
    const f = fixture();
    f.deps.verifyProof = verifier;
    await assert.rejects(publishPendingNativeRuntime(f.input, f.deps));
    assert.equal(f.writes.length, 0);
  }
});

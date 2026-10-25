import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combineGates, validateExecutionInput } from './mint-f1-execution.js';
import { createRelayPayload, probeSmRelay, readRelay, relayAuthorization, relayGate, validateRelayReceipt } from './mint-f1-sm-relay.js';

const now = Date.now();
const receipt = () => ({
  schema: 'mint-f1-sm-relay-v1',
  transportMode: 'sm-origin-relay',
  reviewed: true,
  authorization: relayAuthorization,
  reviewReceiptId: 'root-review',
  slotReceiptId: 'tag-next-slot',
  globalBuildSlot: true,
  channel: 'existing-owner-ssh',
  channelReceiptId: 'existing-alias-review',
  smMachineId: 'sm-id',
  mintMachineId: 'mint-id',
  expiresAt: new Date(now + 60000).toISOString(),
  relayPath: '/private/sm-gate.json',
});
const sample = () => ({
  observedHost: 'SM',
  machineId: 'sm-id',
  measuredFromMachineId: 'sm-id',
  startedAtMs: now - 100,
  finishedAtMs: now - 10,
  load1: 2,
  homeAvailableBytes: 45 * 1024 ** 3,
  localSmBuildCount: 0,
  sites: ['https://tag.observe.tw/', 'https://blog.observe.tw/', 'https://youtube.observe.tw/'].map((url) => ({
    url,
    status: 200,
    exitCode: 0,
    total: 0.2,
    ttfb: 0.1,
  })),
});
function fixture() {
  const config = receipt();
  const packet = createRelayPayload(sample(), config, 'actual-sm-measurement-receipt', { now, io: { readFileSync: () => 'sm-id\n' } });
  const io = {
    readFileSync: (path) => (path === '/etc/machine-id' ? 'mint-id\n' : JSON.stringify(packet)),
    lstatSync: (path) => ({
      uid: 1000,
      mode: path === '/private' ? 0o40700 : 0o100600,
      size: 1000,
      isFile: () => path !== '/private',
      isDirectory: () => path === '/private',
      isSymbolicLink: () => false,
    }),
  };
  return { config, packet, io };
}
test('SM source producer and Mint receiver preserve actual measurement identity and trusted channel scope', () => {
  const f = fixture();
  const result = readRelay(f.config, { io: f.io, uid: 1000, now });
  assert.equal(result.observedHost, 'SM');
  assert.equal(result.measuredFromMachineId, 'sm-id');
  assert.equal(result.transport, 'sm-origin-relay');
  assert.equal(result.sourceReceipt, 'actual-sm-measurement-receipt');
  assert.match(result.authenticatedBy, /not a signature/);
  assert.equal(relayGate(result, f.config, { starting: true, estimatedUsageGiB: 5 }, now), 'run');
  assert.equal(
    combineGates(
      result,
      { mintLoad1: 2, mintAvailableBytes: 45 * 1024 ** 3, localMintBuildCount: 0 },
      { smReceipt: f.config, estimateGiB: 5 },
      { starting: true, estimatedUsageGiB: 5 },
    ),
    'run',
  );
  assert.throws(() => createRelayPayload(sample(), f.config, 'source', { now, io: { readFileSync: () => 'mint-id' } }), /SM producer/);
});
test('Root authorization, private ownership, fresh source and integrity cannot be replaced by cached/local success', async () => {
  for (const delta of [
    { authorization: 'generic-relay' },
    { reviewed: 'yes' },
    { channel: 'new-key' },
    { globalBuildSlot: false },
    { transportMode: 'fallback' },
  ])
    assert.throws(() => validateRelayReceipt({ ...receipt(), ...delta }, now));
  const stale = fixture();
  stale.packet.sample.startedAtMs = now - 30001;
  assert.ok((await probeSmRelay({ receipt: stale.config, io: stale.io, uid: 1000, now })).probeError);
  const modified = fixture();
  modified.packet.sample.load1 = 0;
  assert.throws(() => readRelay(modified.config, { io: modified.io, uid: 1000, now }), /integrity/);
  const privateFile = fixture();
  const stat = privateFile.io.lstatSync;
  privateFile.io.lstatSync = (path) => ({ ...stat(path), mode: 0o100644 });
  assert.ok((await probeSmRelay({ receipt: privateFile.config, io: privateFile.io, uid: 1000, now })).probeError);
  const noFile = fixture();
  noFile.io.readFileSync = () => {
    throw new Error('credential-not-real');
  };
  const result = await probeSmRelay({ receipt: noFile.config, io: noFile.io, uid: 1000, now });
  assert.equal(result.probeError, 'SM-origin relay unavailable or stale');
  assert.equal(relayGate(result, noFile.config, {}, now), 'pause');
});
test('relay does not accept Mint metrics, nonnumeric metrics, competing SM builds or secret cargo', () => {
  for (const delta of [
    { measuredFromMachineId: 'mint-id' },
    { observedHost: 'Mint' },
    { load1: '2' },
    { homeAvailableBytes: null },
    { localSmBuildCount: 1 },
    { GOOGLE_API_KEY: 'not-real' },
  ])
    assert.throws(() => createRelayPayload({ ...sample(), ...delta }, receipt(), 'source', { now, io: { readFileSync: () => 'sm-id' } }));
  const f = fixture();
  const result = readRelay(f.config, { io: f.io, uid: 1000, now });
  result.sites[1].total = 6.18;
  assert.equal(relayGate(result, f.config, {}, now), 'pause');
  assert.equal(relayGate({ ...result, startedAtMs: now - 30001 }, f.config, {}, now), 'pause');
});

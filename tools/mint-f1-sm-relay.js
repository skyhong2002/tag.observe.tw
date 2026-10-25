// Explicit Root-authorized existing-owner SSH file relay. No SSH execution,
// credentials, new keys, probes or local-Mint metric fallback.

import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { buildDecision } from './guard-next-build.js';
import { validateSample } from './mint-f1-sm-adapter.js';
export const relayAuthorization = 'root-2026-10-13-sm-origin-relay';
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const digest = (sample) => createHash('sha256').update(JSON.stringify(sample)).digest('hex');
export function validateRelayReceipt(receipt, now = Date.now()) {
  if (
    !receipt ||
    receipt.schema !== 'mint-f1-sm-relay-v1' ||
    receipt.transportMode !== 'sm-origin-relay' ||
    receipt.authorization !== relayAuthorization ||
    receipt.reviewed !== true ||
    receipt.globalBuildSlot !== true ||
    receipt.channel !== 'existing-owner-ssh' ||
    !nonempty(receipt.channelReceiptId) ||
    !nonempty(receipt.reviewReceiptId) ||
    !nonempty(receipt.slotReceiptId) ||
    !nonempty(receipt.smMachineId) ||
    !nonempty(receipt.mintMachineId) ||
    receipt.smMachineId === receipt.mintMachineId ||
    !isAbsolute(receipt.relayPath || '') ||
    /[%$\s\x00-\x1f\x7f]/.test(receipt.relayPath) ||
    !Number.isFinite(Date.parse(receipt.expiresAt)) ||
    Date.parse(receipt.expiresAt) <= now
  )
    throw new Error('Reviewed specific Root-authorized existing-channel relay receipt required');
  return true;
}
function boundedMetricShape(sample) {
  const keys = [
    'observedHost',
    'machineId',
    'measuredFromMachineId',
    'startedAtMs',
    'finishedAtMs',
    'load1',
    'homeAvailableBytes',
    'localSmBuildCount',
    'sites',
    'startedAt',
    'finishedAt',
    'ageMs',
  ];
  if (
    !sample ||
    Object.keys(sample).some((key) => !keys.includes(key)) ||
    !Array.isArray(sample.sites) ||
    sample.sites.some((site) => !site || Object.keys(site).some((key) => !['url', 'status', 'ttfb', 'total', 'exitCode'].includes(key)))
  )
    throw new Error('Only bounded public SM metric fields may be relayed');
}
export function createRelayPayload(sample, receipt, sourceReceiptId, { io = { readFileSync }, now = Date.now() } = {}) {
  validateRelayReceipt(receipt, now);
  if (!nonempty(sourceReceiptId) || io.readFileSync('/etc/machine-id', 'utf8').trim() !== receipt.smMachineId)
    throw new Error('Actual SM producer identity and measurement receipt required');
  boundedMetricShape(sample);
  validateSample(sample, receipt, now, validateRelayReceipt);
  return {
    schema: 'mint-f1-sm-origin-relay-sample-v1',
    transport: 'sm-origin-relay',
    channel: 'existing-owner-ssh',
    channelReceiptId: receipt.channelReceiptId,
    sourceReceiptId,
    sourceMachineId: receipt.smMachineId,
    contentSha256: digest(sample),
    sample,
  };
}
export function readRelay(receipt, { io = { readFileSync, lstatSync }, uid = process.getuid(), now = Date.now() } = {}) {
  validateRelayReceipt(receipt, now);
  if (io.readFileSync('/etc/machine-id', 'utf8').trim() !== receipt.mintMachineId)
    throw new Error('Actual Mint receiver identity required');
  const metadata = io.lstatSync(receipt.relayPath);
  const parent = io.lstatSync(dirname(receipt.relayPath));
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink?.() ||
    metadata.uid !== uid ||
    metadata.mode & 0o077 ||
    metadata.size > 65536 ||
    !parent.isDirectory() ||
    parent.isSymbolicLink?.() ||
    parent.uid !== uid ||
    parent.mode & 0o077
  )
    throw new Error('Private current-owner regular relay file and directory required');
  const packet = JSON.parse(io.readFileSync(receipt.relayPath, 'utf8'));
  if (
    packet.schema !== 'mint-f1-sm-origin-relay-sample-v1' ||
    packet.transport !== 'sm-origin-relay' ||
    packet.channel !== 'existing-owner-ssh' ||
    packet.channelReceiptId !== receipt.channelReceiptId ||
    packet.sourceMachineId !== receipt.smMachineId ||
    !nonempty(packet.sourceReceiptId) ||
    packet.contentSha256 !== digest(packet.sample)
  )
    throw new Error('SM-origin existing-channel source/integrity receipt mismatch');
  boundedMetricShape(packet.sample);
  const sample = validateSample(packet.sample, receipt, now, validateRelayReceipt);
  return {
    ...sample,
    transport: 'sm-origin-relay',
    sourceReceipt: packet.sourceReceiptId,
    channelReceiptId: receipt.channelReceiptId,
    relayContentSha256: packet.contentSha256,
    authenticatedBy: 'existing-owner-ssh/private-owner-file boundary; hash is not a signature',
  };
}
export async function probeSmRelay(options) {
  try {
    return readRelay(options.receipt, options);
  } catch {
    return { observedHost: 'SM', transport: 'sm-origin-relay', sites: [], probeError: 'SM-origin relay unavailable or stale' };
  }
}
export function relayGate(sample, receipt, options = {}, now = Date.now()) {
  try {
    if (
      !sample ||
      sample.probeError ||
      sample.transport !== 'sm-origin-relay' ||
      !nonempty(sample.sourceReceipt) ||
      sample.channelReceiptId !== receipt.channelReceiptId
    )
      return 'pause';
    const verified = validateSample(sample, receipt, now, validateRelayReceipt);
    return buildDecision(verified, options.paused === true, options);
  } catch {
    return 'pause';
  }
}

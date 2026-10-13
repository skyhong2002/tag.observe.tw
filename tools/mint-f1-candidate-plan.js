// Reviewable plan only. No subprocess, network, build, capture or deployment.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildDecision, siteBudgetsSeconds } from './guard-next-build.js';

export const initialAppSha = '677a0c793eeda0c4d850c81ac574c95508d08e0a';
const fullSha = /^[a-f0-9]{40}$/;
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
export function validateMintIdentity(identity) {
  if (!identity || identity.role !== 'Mint' || identity.hostname === 'skyhong-SM'
    || identity.platform !== 'linux' || !['x64', 'arm64'].includes(identity.arch)
    || !Number.isInteger(identity.cpus) || identity.cpus < 2
    || !/^24\./.test(identity.nodeVersion || '') || identity.npmPathVerified !== true
    || identity.operatorVerified !== true || !nonempty(identity.machineId) || !nonempty(identity.hostname)) {
    throw new Error('Operator-verified Mint Linux/CPU/Node24/npm PATH identity required; SM execution forbidden');
  }
  return identity;
}
export function validatePlanInput(input) {
  if (!fullSha.test(input.appSha || '') || !fullSha.test(input.opsSha || '')) throw new Error('Separate exact full APP_SHA and OPS_SHA required');
  if (input.appSha !== initialAppSha) throw new Error('This handoff pins the initial APP_SHA');
  validateMintIdentity(input.mint);
  if (!input.sm || !nonempty(input.sm.machineId) || input.sm.machineId === input.mint.machineId || input.sm.platform !== 'linux'
    || input.sm.arch !== input.mint.arch || !input.sm.nodeModulesAbi || !input.sm.libc
    || input.sm.nodeModulesAbi !== input.mint.nodeModulesAbi || input.sm.libc !== input.mint.libc) {
    throw new Error('Distinct SM identity and matching Linux architecture/native Node ABI/libc required');
  }
  const api = new URL(input.apiOrigin);
  if (api.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(api.hostname)
    || !api.port || api.username || api.password || api.pathname !== '/' || api.search || api.hash
    || input.apiIsolationVerified !== true || input.apiUsesProductionDatabase !== false) {
    throw new Error('Operator-verified Mint loopback isolated API/database required');
  }
  if (input.mintGlobalSlotHandoff !== true || input.freshOriginMainFetchVerified !== true
    || input.originMainAncestorVerified !== true || input.sourceCleanVerified !== true
    || input.newCandidateDirectoryVerified !== true) throw new Error('Mint global build slot, fresh fetch, ancestry, clean source and new directory evidence required');
  return input;
}
// Adapter input is deliberately explicit: Mint's local load/disk cannot stand in
// for SM's remote measurements. No SSH target or credentials are inferred here.
export function smDecision(sample, identities, options = {}) {
  if (!identities || !nonempty(identities.sm?.machineId) || !nonempty(identities.mint?.machineId)
    || !sample || !nonempty(sample.machineId) || !nonempty(sample.measuredFromMachineId) || sample.observedHost !== 'SM' || sample.machineId !== identities.sm.machineId
    || sample.measuredFromMachineId !== identities.sm.machineId
    || !Number.isFinite(sample.ageMs) || sample.ageMs < 0 || sample.ageMs > 30000) return 'pause';
  return buildDecision(sample, options.paused === true, options);
}
export function createPlan(input) {
  validatePlanInput(input);
  return {
    status: 'plan-only', appSha: input.appSha, opsSha: input.opsSha,
    executionBlocked: 'Pending independently reviewed remote SM measurement adapter, Mint host-wide lock and execution runner; evidence does not enable execution',
    steps: [
      'On Mint verify actual machine identity, Linux CPU, Node24/npm PATH and SM deployment ABI; obtain formal single global build slot handoff',
      'git fetch origin; verify exact APP_SHA exists and origin/main is its ancestor; verify source checkout fully clean including untracked files',
      'Create exclusive new candidate directory; git archive APP_SHA sources only; never copy checkout node_modules or .env',
      'Install lockfile-pinned dependencies on Mint using npm ci with ignore-scripts; separately review required native dependency installation before build',
      'Run isolated Mint API backed only by isolated Mint data; verify TAG_API_ORIGIN loopback port and database isolation',
      'Use independently reviewed host-wide Mint lock and monitored process group: ionice -c 3 nice -n 19; Next cpus=2/staticGenerationMaxConcurrency=1',
      'Before and during build collect fresh SM /home disk, load and three homepage end-to-end measurements through explicit audited remote adapter; fail closed when unavailable',
      'Reuse reviewed stage packaging: standalone plus .next/static and public; retain app/src and app/data; do not deploy',
      'Record APP_SHA, OPS_SHA, BUILD_ID, root/web lockfile SHA256, platform/arch/Node/native ABI/libc, source archive and full artifact tree SHA256 manifest; validate native binaries on compatible Linux',
      'Transfer identical checksummed candidate for independent review before any separate deployment authorization',
    ],
    gates: { host: 'SM', startAvailableGiB: 40, stopBelowGiB: 30, stopLoadAbove: 12, resumeLoadBelow: 10, resumeAvailableGiB: 40, siteBudgetsSeconds },
    pending: ['Audited remote SM adapter with freshness and host identity', 'Mint host-wide single build lock and guarded execution wiring', 'Actual Mint/SM identity and ABI checks', 'Isolated API/database readiness', 'Native dependency installation review', 'Artifact verification and independent candidate review'],
  };
}
export function main(argv = process.argv.slice(2)) {
  if (argv[0] === '--execute') throw new Error('Execution disabled: remote SM adapter and Mint runner pending; no build permitted');
  if (argv.length !== 2 || argv[0] !== '--plan') throw new Error('Usage: node tools/mint-f1-candidate-plan.js --plan OPERATOR_INPUT_JSON (no execution)');
  console.log(JSON.stringify(createPlan(JSON.parse(readFileSync(resolve(argv[1]), 'utf8'))), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

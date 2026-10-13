// Candidate preparation only: no migration, worker, browser, or deployment.
import { spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {gateMeasurement} from './homepage-median-probe.mjs';
import { guardedBuild, probeServices, siteBudgetsSeconds, siteBaselinesSeconds, baselineMeasurement } from './guard-next-build.js';

export const lockPath = '/home/deck/.local/share/tag-analysis/deploy.lock';
export function validateOptions(options) {
  if (!options.evidence || !options.candidate || !Number.isFinite(options.estimate) || options.estimate <= 0) throw new Error('Evidence, new candidate directory and positive estimated GiB are required');
  const api = new URL(options.api);
  if (api.protocol !== 'http:' || api.username || api.password || api.pathname !== '/' || api.search || api.hash || !api.port || ['tag.observe.tw', 'blog.observe.tw', 'youtube.observe.tw'].includes(api.hostname)) throw new Error('TAG_API_ORIGIN must explicitly identify an isolated HTTP candidate API with a port');
  return options;
}
export function validateEvidence(evidence, metadata, uid = process.getuid()) {
  if (!metadata.isFile() || metadata.uid !== uid || (metadata.mode & 0o077)) throw new Error('Handoff evidence must be a private regular file owned by the current user');
  if (evidence.owner !== 'tag' || evidence.sourceMessage !== '2026-10-13 explicit relative gates; single global build slot confirmed for tag' || evidence.globalBuildSlotConfirmed !== true || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(evidence.authorizedAt) || !Number.isFinite(Date.parse(evidence.authorizedAt))) throw new Error('Explicit current global-slot handoff evidence is required');
  // Format validation cannot authenticate a user message; the operator must
  // supply the actual authorization. This tool never creates evidence.
}
export function competingBuilds(proc = '/proc', read = readFileSync, list = readdirSync) {
  const found = [];
  for (const pid of list(proc).filter((entry) => /^\d+$/.test(entry))) {
    try {
      const args = read(join(proc, pid, 'cmdline'), 'utf8').split('\0').filter(Boolean);
      if (args.some((arg) => /(?:^|\/)next(?:\.js)?$/.test(arg)) && args.includes('build') || args.some((arg) => /(?:^|\/)(?:docker|buildctl|buildkitd)$/.test(arg)) && args.some((arg) => ['build', 'buildx', 'buildkitd'].includes(arg) || /buildkitd$/.test(arg))) found.push({ pid, args });
    } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
  }
  return found;
}
export function stagePlan(repo, candidate, sha) {
  return [
    ['git', ['archive', '--format=tar', `--output=${join(candidate, 'source.tar')}`, sha, 'app/src', 'app/data', 'tools/vocabulary-export.ts', 'package.json', 'package-lock.json', 'web'], repo],
    ['tar', ['-xf', join(candidate, 'source.tar'), '-C', candidate], repo],
    ['npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], candidate],
    ['npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], join(candidate, 'web')],
    [process.execPath, [join(candidate, 'web/node_modules/next/dist/bin/next'), 'build'], join(candidate, 'web')],
  ];
}
function command(command, args, cwd, log, env = process.env) {
  const fd = log ? openSync(log, 'a', 0o600) : undefined;
  try {
    const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', stdio: fd === undefined ? ['ignore', 'pipe', 'pipe'] : ['ignore', fd, fd] });
    if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.stderr ?? result.status}`);
    return result.stdout?.trim();
  } finally { if (fd !== undefined) closeSync(fd); }
}
export function runStage(options, sha, run = command, io = { mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, appendFileSync }, scan = competingBuilds) {
  const log = join(options.candidate, 'stage.log');
  try {
    if (scan().length >= 1) throw new Error('Another Next/Docker build is running');
    for (const [bin, args, cwd] of stagePlan(options.repo, options.candidate, sha)) {
      if (args.at(-1) === 'build' && scan().length >= 1) throw new Error('No local build slot available before Next start');
      run(bin, args, cwd, log, { ...process.env, TAG_API_ORIGIN: options.api, NEXT_TELEMETRY_DISABLED: '1' });
    }
    const web = join(options.candidate, 'web');
    const standaloneRoot = join(web, '.next/standalone');
    const servers = [standaloneRoot, join(standaloneRoot, 'web')].filter((directory) => io.existsSync(join(directory, 'server.js')));
    if (servers.length !== 1) throw new Error('Expected exactly one flat/nested standalone web server');
    const standalone = servers[0];
    io.mkdirSync(join(standalone, '.next'), { recursive: true });
    io.cpSync(join(web, '.next/static'), join(standalone, '.next/static'), { recursive: true, errorOnExist: true, force: false });
    if (io.existsSync(join(web, 'public'))) io.cpSync(join(web, 'public'), join(standalone, 'public'), { recursive: true, errorOnExist: true, force: false });
    const buildId = io.readFileSync(join(web, '.next/BUILD_ID'), 'utf8').trim();
    io.writeFileSync(join(options.candidate, 'COMMIT'), `${sha}\n`, { flag: 'wx', mode: 0o600 });
    io.writeFileSync(join(options.candidate, 'manifest.json'), `${JSON.stringify({ status: 'prepared', ui: 'not reviewed', commit: sha, buildId, standaloneWeb: standalone, appSource: join(options.candidate, 'app/src'), appData: join(options.candidate, 'app/data'), apiOrigin: options.api, utc: new Date().toISOString() }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  } catch (error) { io.appendFileSync(log, `ERROR ${error.stack}\n`, { mode: 0o600 }); throw error; }
}
export async function main(argv = process.argv.slice(2)) {
  const [mode, evidence, candidate, estimate, api, sha] = argv;
  if (!['--prepare', '--locked', '--stage'].includes(mode)) throw new Error('Usage: node tools/prepare-f1-candidate.js --prepare PRIVATE_HANDOFF_JSON NEW_CANDIDATE_DIR ESTIMATED_GIB HTTP_CANDIDATE_API_ORIGIN');
  const options = validateOptions({ evidence: resolve(evidence || ''), candidate: resolve(candidate || ''), estimate: Number(estimate), api: api || process.env.TAG_API_ORIGIN, repo: resolve(dirname(new URL(import.meta.url).pathname), '..') });
  if (!evidence || !candidate) throw new Error('Evidence and candidate paths are required');
  if (realpathSync(options.repo) === '/home/deck/Projects/tag.analysis.tw') throw new Error('Use an isolated checkout, never the shared checkout');
  const evidencePath = realpathSync(options.evidence);
  validateEvidence(JSON.parse(readFileSync(evidencePath, 'utf8')), statSync(evidencePath));
  if (mode === '--stage') { if (!/^[a-f0-9]{40}$/.test(sha || '') || process.env.TAG_CANDIDATE_LOCKED !== '1') throw new Error('Stage requires locked runner'); return runStage(options, sha); }
  if (mode === '--prepare') {
    // Tag's lock and human handoff are not an atomic host-wide build lock.
    const result = spawnSync('flock', ['-n', lockPath, process.execPath, resolve(process.argv[1]), '--locked', options.evidence, options.candidate, String(options.estimate), options.api], { stdio: 'inherit', env: { ...process.env, TAG_CANDIDATE_LOCKED: '1' } });
    if (result.error || result.status !== 0) throw new Error(`Tag lock/runner failed (${result.error?.message ?? result.status})`);
    return;
  }
  if (process.env.TAG_CANDIDATE_LOCKED !== '1') throw new Error('Locked runner required');
  command('git', ['fetch', 'origin'], options.repo);
  const commit = command('git', ['rev-parse', 'HEAD'], options.repo);
  command('git', ['merge-base', '--is-ancestor', 'origin/main', commit], options.repo);
  if (command('git', ['status', '--porcelain', '--untracked-files=no'], options.repo)) throw new Error('Tracked checkout must be clean');
  if (competingBuilds().length >= 1) throw new Error('Another Next/Docker build is running');
  mkdirSync(options.candidate, { mode: 0o700 }); // Exclusive: existing artifacts are never overwritten or removed.
  const log = join(options.candidate, 'guard.jsonl');
  let started = false;
  const record = (entry) => {
    if (entry.event === 'started') started = true;
    appendFileSync(log, `${JSON.stringify({ utc: new Date().toISOString(), ...entry })}\n`, { mode: 0o600 });
  };
  record({ event: 'configuration', policy: 'single-global-build-relative-homepage', commit, estimatedUsageGiB: options.estimate, siteBudgetsSeconds, siteBaselinesSeconds, baselineMeasurement, gateMeasurement, startAvailableGiB: 40, stopAvailableBelowGiB: 30, globalSlotConfirmedBy: JSON.parse(readFileSync(evidencePath, 'utf8')).sourceMessage, remoteYtCoordination: 'manual; remote builds cannot be inferred from local /proc' });
  const code = await guardedBuild({ command: process.execPath, args: [resolve(process.argv[1]), '--stage', options.evidence, options.candidate, String(options.estimate), options.api, commit], cwd: options.repo, record, estimatedUsageGiB: options.estimate, probe: async () => { const sample = await probeServices({record:entry=>record({event:'probe-trial',...entry})}); if (competingBuilds().length > (started ? 1 : 0)) sample.probeError = 'Local build concurrency exceeds one'; return sample; } });
  if (code !== 0) { record({ event: 'error', exitCode: code }); throw new Error(`Candidate preparation failed (${code}); artifacts retained`); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

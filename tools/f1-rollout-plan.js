// Pure command planner. Never executes deployment, builds, migrations or cleanup.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import baseline from './shared-host-baseline.cjs';
export const image = 'sha256:9d3b7cdc11c490a3e2a6193b71adc184eb38c7a996c654503b5394ca71c595bb';
export function routeCommands(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Full SHA required');
  const rule = ['OUTPUT', '-p', 'tcp', '-d', '127.0.0.1/32', '--dport', '18130', '-m', 'comment', '--comment', `tag-f1-${sha}`, '-j', 'REDIRECT', '--to-ports', '18194'];
  const prefix = ['docker', 'run', '--rm', '--pull=never', '--user', '0:0', '--network', 'host', '--cap-add', 'NET_ADMIN', '--cap-add', 'SYS_CHROOT', '--mount', 'type=bind,src=/,dst=/host,readonly', '--entrypoint', '/usr/sbin/chroot', image, '/host', '/usr/sbin/iptables', '-w', '5', '-t', 'nat'];
  return { check: [...prefix, '-C', ...rule], switch: [...prefix, '-I', rule[0], '1', ...rule.slice(1)], rollback: [...prefix, '-D', ...rule] };
}
export function runtimeCommands({ sha, candidate, standaloneWeb, envFile }) {
  if (!/^[a-f0-9]{40}$/.test(sha) || ![candidate, standaloneWeb, envFile].every(x => typeof x === 'string' && x.startsWith('/') && !/[\r\n]/.test(x))) throw new Error('Full SHA and absolute paths required');
  const unit = `tag-f1-${sha.slice(0, 12)}`;
  const base = ['systemd-run', '--user', '--property=Restart=on-failure', '--property=NoNewPrivileges=yes', '--property=PrivateTmp=yes', '--setenv=NODE_ENV=production'];
  return {
    web: [...base, `--unit=${unit}-web`, `--working-directory=${standaloneWeb}`, '--setenv=PORT=18192', '--setenv=HOSTNAME=127.0.0.1', '--setenv=TAG_API_ORIGIN=http://127.0.0.1:18194', '/home/deck/.local/bin/node', 'server.js'],
    gateway: [...base, `--unit=${unit}-gateway`, `--working-directory=${candidate}`, `--property=EnvironmentFile=${envFile}`, '--setenv=PORT=18194', '--setenv=UI_ORIGIN=http://127.0.0.1:18192', '--setenv=TAG_NEARLINE_API_ORIGIN=http://127.0.0.1:18135', '--setenv=TAG_NEARLINE_TOKEN_FILE=/home/deck/.config/tag-nearline-operations/token', '--setenv=TAG_VOCABULARY_EXPORT_DIR=/home/deck/tag-analysis-private/vocabulary', '/home/deck/.local/bin/node', 'app/src/server.js'],
    // Worker execution additionally requires operator-confirmed old-consumer drain.
    worker: [...base, `--unit=${unit}-worker`, `--working-directory=${candidate}`, `--property=EnvironmentFile=${envFile}`, '--property=TimeoutStopSec=50', '--setenv=PATH=/home/deck/.local/bin:/usr/local/bin:/usr/bin:/bin', '--setenv=WORKER_METRICS_PORT=18195', '--setenv=RANKING_INTERVAL_MINUTES=10', '/home/deck/.local/bin/node', 'app/src/worker.ts'],
  };
}
export function validBuildOrigin(value) {
  try { const u = new URL(value); return u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) && Boolean(u.port) && u.pathname === '/' && !u.username && !u.password && !u.search && !u.hash && !['18130', '18132'].includes(u.port); } catch { return false; }
}
export function main(args = process.argv.slice(2)) {
  const [candidateArg, sha, envArg] = args;
  if (!candidateArg || !envArg) throw new Error('Usage: node tools/f1-rollout-plan.js EXISTING_CANDIDATE FULL_SHA EXISTING_ENV_FILE');
  const candidate = realpathSync(resolve(candidateArg));
  const manifest = JSON.parse(readFileSync(join(candidate, 'manifest.json'), 'utf8'));
  if (manifest.commit !== sha || readFileSync(join(candidate, 'COMMIT'), 'utf8').trim() !== sha || !validBuildOrigin(manifest.apiOrigin)) throw new Error('Candidate SHA/API origin mismatch');
  const standaloneWeb = realpathSync(manifest.standaloneWeb);
  if (!standaloneWeb.startsWith(candidate + '/') || !existsSync(join(standaloneWeb, 'server.js')) || readFileSync(join(candidate, 'web/.next/BUILD_ID'), 'utf8').trim() !== manifest.buildId) throw new Error('Candidate standalone/build identity mismatch');
  const envFile = realpathSync(resolve(envArg));
  console.log(JSON.stringify({ mode: 'plan-only', gates: { ...baseline, globalBuildLimit: 1, globalBrowserLimit: 2, load1Limit: 12, startAvailableGiB: 40, stopAvailableBelowGiB: 30 }, sha, candidate, buildId: manifest.buildId, buildApiOrigin: manifest.apiOrigin, runtimeApiOrigin: 'http://127.0.0.1:18194', requiredGates: ['independent source and actual candidate UI review', 'private runtime/config backup and verified existing 0038 backup', 'old worker drained; new pending-image policy worker verified before public admission', 'old pool healthy and retained; exact-rule rollback ready'], runtime: runtimeCommands({ sha, candidate, standaloneWeb, envFile }), route: routeCommands(sha) }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

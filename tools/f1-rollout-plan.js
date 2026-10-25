// Pure command planner. Never executes deployment, builds, migrations or cleanup.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import baseline from './shared-host-baseline.cjs';
export const image = 'sha256:9d3b7cdc11c490a3e2a6193b71adc184eb38c7a996c654503b5394ca71c595bb';
export function routeCommands(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Full SHA required');
  const rule = [
    'OUTPUT',
    '-p',
    'tcp',
    '-d',
    '127.0.0.1/32',
    '--dport',
    '18130',
    '-m',
    'comment',
    '--comment',
    `tag-f1-${sha}`,
    '-j',
    'REDIRECT',
    '--to-ports',
    '18194',
  ];
  const prefix = [
    'docker',
    'run',
    '--rm',
    '--pull=never',
    '--user',
    '0:0',
    '--network',
    'host',
    '--cap-add',
    'NET_ADMIN',
    '--cap-add',
    'SYS_CHROOT',
    '--mount',
    'type=bind,src=/,dst=/host,readonly',
    '--entrypoint',
    '/usr/sbin/chroot',
    image,
    '/host',
    '/usr/sbin/iptables',
    '-w',
    '5',
    '-t',
    'nat',
  ];
  return {
    check: [...prefix, '-C', ...rule],
    switch: [...prefix, '-I', rule[0], '1', ...rule.slice(1)],
    rollback: [...prefix, '-D', ...rule],
  };
}
export function runtimeCommands({ sha, candidate, standaloneWeb, envFile }) {
  if (
    !/^[a-f0-9]{40}$/.test(sha) ||
    ![candidate, standaloneWeb, envFile].every((x) => typeof x === 'string' && x.startsWith('/') && !/[\r\n]/.test(x))
  )
    throw new Error('Full SHA and absolute paths required');
  const unit = `tag-f1-${sha.slice(0, 12)}`;
  const base = [
    'systemd-run',
    '--user',
    '--property=Restart=on-failure',
    '--property=NoNewPrivileges=yes',
    '--property=PrivateTmp=yes',
    '--setenv=NODE_ENV=production',
  ];
  const commands = {
    web: [
      ...base,
      `--unit=${unit}-web`,
      `--working-directory=${standaloneWeb}`,
      '--setenv=PORT=18192',
      '--setenv=HOSTNAME=127.0.0.1',
      '--setenv=TAG_API_ORIGIN=http://127.0.0.1:18194',
      '/home/deck/.local/bin/node',
      'server.js',
    ],
    gateway: [
      ...base,
      `--unit=${unit}-gateway`,
      `--working-directory=${candidate}`,
      `--property=EnvironmentFile=${envFile}`,
      '--setenv=PORT=18194',
      '--setenv=UI_ORIGIN=http://127.0.0.1:18192',
      '--setenv=TAG_NEARLINE_API_ORIGIN=http://127.0.0.1:18135',
      '--setenv=TAG_NEARLINE_TOKEN_FILE=/home/deck/.config/tag-nearline-operations/token',
      '--setenv=TAG_VOCABULARY_EXPORT_DIR=/home/deck/tag-analysis-private/vocabulary',
      '/home/deck/.local/bin/node',
      'app/src/server.js',
    ],
    // Worker execution additionally requires operator-confirmed old-consumer drain.
    worker: [
      ...base,
      `--unit=${unit}-worker`,
      `--working-directory=${candidate}`,
      `--property=EnvironmentFile=${envFile}`,
      '--property=TimeoutStopSec=50',
      '--setenv=PATH=/home/deck/.local/bin:/usr/local/bin:/usr/bin:/bin',
      '--setenv=WORKER_METRICS_PORT=18195',
      '--setenv=RANKING_INTERVAL_MINUTES=10',
      '/home/deck/.local/bin/node',
      'app/src/worker.ts',
    ],
  };
  for (const args of Object.values(commands)) {
    const at = args.indexOf('/home/deck/.local/bin/node');
    args.splice(at, 0, '/usr/bin/env', ...args.filter((x) => x.startsWith('--setenv=')).map((x) => x.slice(9)));
  }
  return commands;
}
export function validBuildOrigin(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) &&
      Boolean(u.port) &&
      u.pathname === '/' &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      !['18130', '18132'].includes(u.port)
    );
  } catch {
    return false;
  }
}
export function main(args = process.argv.slice(2)) {
  const [candidateArg, sha, envArg, opsSha] = args;
  if (!candidateArg || !envArg || !opsSha)
    throw new Error('Usage: node tools/f1-rollout-plan.js EXISTING_CANDIDATE FULL_SHA EXISTING_ENV_FILE FULL_OPS_SHA');
  const candidate = realpathSync(resolve(candidateArg));
  const manifest = JSON.parse(readFileSync(join(candidate, 'manifest.json'), 'utf8'));
  if (manifest.commit !== sha || readFileSync(join(candidate, 'COMMIT'), 'utf8').trim() !== sha || !validBuildOrigin(manifest.apiOrigin))
    throw new Error('Candidate SHA/API origin mismatch');
  const standaloneWeb = realpathSync(manifest.standaloneWeb);
  if (
    !standaloneWeb.startsWith(candidate + '/') ||
    !existsSync(join(standaloneWeb, 'server.js')) ||
    readFileSync(join(candidate, 'web/.next/BUILD_ID'), 'utf8').trim() !== manifest.buildId
  )
    throw new Error('Candidate standalone/build identity mismatch');
  const envFile = realpathSync(resolve(envArg));
  const snapshot = snapshotPlan(opsSha);
  validateExecutingOps(snapshot, resolve(new URL('..', import.meta.url).pathname));
  console.log(
    JSON.stringify(
      {
        mode: 'plan-only',
        gates: {
          ...baseline,
          globalBuildLimit: 1,
          globalBrowserLimit: 2,
          load1Limit: 12,
          startAvailableGiB: 40,
          stopAvailableBelowGiB: 30,
        },
        sha,
        candidate,
        buildId: manifest.buildId,
        buildApiOrigin: manifest.apiOrigin,
        runtimeApiOrigin: 'http://127.0.0.1:18194',
        requiredGates: [
          'independent source and actual candidate UI review',
          'private runtime/config backup and verified existing 0038 backup',
          'old worker drained; new pending-image policy worker verified before public admission',
          'old pool healthy and retained; exact-rule rollback ready',
        ],
        snapshot,
        persistent: persistentPlan({ sha, candidate, standaloneWeb, envFile, opsSha, opsManifestHash: snapshot.manifestHash }),
        runtime: runtimeCommands({ sha, candidate, standaloneWeb, envFile }),
        route: routeCommands(sha),
      },
      null,
      2,
    ),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

export function persistentPlan(options) {
  const runtime = runtimeCommands(options); // Reuse validated paths and settings.
  const unit = `tag-f1-${options.sha.slice(0, 12)}`;
  if (!/^[a-f0-9]{40}$/.test(options.opsSha || '') || !/^[a-f0-9]{64}$/.test(options.opsManifestHash || ''))
    throw Error('Pinned ops commit and manifest hash required');
  const ops = '/home/deck/.local/share/tag-analysis/f1-ops/' + options.opsSha;
  const evidence = '/home/deck/tag-analysis-private/f1-runtime/' + options.sha + '-' + options.opsSha;
  const q = (value) => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%') + '"';
  function service(kind, extra = []) {
    const args = runtime[kind];
    const cwd = args.find((x) => x.startsWith('--working-directory=')).slice(20);
    const env = args.filter((x) => x.startsWith('--setenv=')).map((x) => `Environment=${q(x.slice(9))}`);
    const overrides = args.filter((x) => x.startsWith('--setenv=')).map((x) => x.slice(9));
    const lines = [
      '[Unit]',
      `Description=F1 ${kind} ${options.sha}`,
      'After=network-online.target',
      '[Service]',
      'Type=simple',
      `WorkingDirectory=${q(cwd)}`,
      ...env,
    ];
    if (kind !== 'web') lines.push(`EnvironmentFile=${q(options.envFile)}`);
    const exec = kind === 'web' ? ['server.js'] : [`app/src/${kind === 'worker' ? 'worker.ts' : 'server.js'}`];
    lines.push(
      `ExecStart=/usr/bin/env ${overrides.map(q).join(' ')} /home/deck/.local/bin/node ${exec.map(q).join(' ')}`,
      'Restart=on-failure',
      'RestartSec=5',
      'NoNewPrivileges=yes',
      'PrivateTmp=yes',
    );
    if (kind === 'worker') lines.push('TimeoutStopSec=50');
    lines.push(...extra, '[Install]', 'WantedBy=default.target');
    return lines.join('\n') + '\n';
  }
  const units = {
    [`${unit}-web.service`]: service('web'),
    [`${unit}-worker.service`]: service('worker'),
    [`${unit}-gateway.service`]: service('gateway').replaceAll('http://127.0.0.1:18192', 'http://127.0.0.1:18197'),
    [`${unit}-frontdoor.service`]: `[Unit]\nDescription=F1 immutable static fallback\nAfter=${unit}-web.service\n[Service]\nExecStart=/home/deck/.local/bin/node ${q(ops + '/tools/f1-rollout-frontdoor.js')}\nRestart=on-failure\nNoNewPrivileges=yes\n[Install]\nWantedBy=default.target\n`,
    [`${unit}-route.service`]: `[Unit]\nDescription=F1 exact local route\nRequires=${unit}-gateway.service ${unit}-web.service ${unit}-frontdoor.service ${unit}-worker.service\nAfter=${unit}-gateway.service ${unit}-web.service ${unit}-frontdoor.service ${unit}-worker.service\nConditionPathExists=${evidence}/admission-reviewed\n[Service]\nType=oneshot\nRemainAfterExit=yes\nExecStart=/home/deck/.local/bin/node ${q(ops + '/tools/f1-rollout-route.js')} start ${options.sha}\nExecStop=/home/deck/.local/bin/node ${q(ops + '/tools/f1-rollout-route.js')} stop ${options.sha}\n[Install]\nWantedBy=default.target\n`,
  };
  const verifyCode = `import hashlib,json,pathlib; p=pathlib.Path(${JSON.stringify(ops)}); b=(p/'manifest.json').read_bytes(); assert hashlib.sha256(b).hexdigest()==${JSON.stringify(options.opsManifestHash)}; m=json.loads(b); assert m['opsSha']==${JSON.stringify(options.opsSha)}; assert all(hashlib.sha256((p/k).read_bytes()).hexdigest()==v for k,v in m['files'].items())`;
  for (const name of Object.keys(units))
    if (name.endsWith('-frontdoor.service') || name.endsWith('-route.service'))
      units[name] = units[name].replace('[Service]\n', `[Service]\nExecStartPre=/usr/bin/python3 -c ${q(verifyCode)}\n`);
  return {
    units,
    evidenceDirectory: evidence,
    opsDirectory: ops,
    installOrder: [
      'private backups including original unit file/drop-ins/enablement/env/current/iptables + verified 0038 backup',
      'disable old worker boot activation; drain active=0 exit=0; replace old worker unit with /dev/null mask after backing up original file',
      'copy reviewed small ops modules and centralized baseline module into private opsDirectory; install listed unit contents without replacing original gateway/web',
      'daemon-reload; enable and start new pool; independent identity/privacy/worker/UI/static tests',
      'create private admission-reviewed marker only after all gates pass; enable and start route unit',
    ],
    commands: {
      createEvidenceExclusive: ['mkdir', '-m', '700', evidence],
      createUnitStageExclusive: ['mkdir', '-m', '700', evidence + '/units'],
      stageUnitFiles: Object.keys(units).map((name) => [
        'install',
        '-m',
        '600',
        evidence + '/units/' + name,
        '/home/deck/.config/systemd/user/' + name,
      ]),
      backupOldWorkerFile: [
        'cp',
        '--preserve=all',
        '/home/deck/.config/systemd/user/tag-worker.service',
        evidence + '/backup/tag-worker.service',
      ],
      preserveAndMaskOldWorker: [
        ['mv', '/home/deck/.config/systemd/user/tag-worker.service', evidence + '/backup/tag-worker.original-unit'],
        ['ln', '-s', '/dev/null', '/home/deck/.config/systemd/user/tag-worker.service'],
      ],
      disableOldWorker: ['systemctl', '--user', 'disable', 'tag-worker.service'],
      daemonReload: ['systemctl', '--user', 'daemon-reload'],
      enablePool: ['systemctl', '--user', 'enable', ...Object.keys(units).filter((x) => !x.endsWith('-route.service'))],
      startRoute: ['systemctl', '--user', 'enable', '--now', `${unit}-route.service`],
      rollbackReader: ['systemctl', '--user', 'stop', `${unit}-route.service`],
    },
    rollbackConsumer:
      'Never unmask/start old worker while pending avatar jobs exist. Keep new pending-policy worker running, or explicitly pause it.',
  };
}

export function snapshotPlan(
  opsSha,
  readBlob = (path) => {
    const result = spawnSync('git', ['show', `${opsSha}:${path}`], { encoding: null });
    if (result.error || result.status !== 0) throw Error('Ops modules must exist in the exact committed ops SHA');
    return result.stdout;
  },
) {
  if (!/^[a-f0-9]{40}$/.test(opsSha || '')) throw Error('Full ops SHA required');
  const paths = [
    'package.json',
    'tools/f1-rollout-plan.js',
    'tools/f1-rollout-route.js',
    'tools/f1-rollout-frontdoor.js',
    'tools/shared-host-baseline.cjs',
  ];
  const files = Object.fromEntries(paths.map((path) => [path, createHash('sha256').update(readBlob(path)).digest('hex')]));
  const manifest = JSON.stringify({ opsSha, files }) + '\n';
  const directory = '/home/deck/.local/share/tag-analysis/f1-ops/' + opsSha;
  return {
    directory,
    manifest,
    manifestHash: createHash('sha256').update(manifest).digest('hex'),
    commands: {
      createExclusive: ['mkdir', '-m', '700', directory],
      archive: ['git', 'archive', '--format=tar', `--output=${directory}/source.tar`, opsSha, ...paths],
      extract: ['tar', '-xf', directory + '/source.tar', '-C', directory],
      freezeFiles: ['chmod', '-R', 'a-w', directory],
    },
    requirements: [
      'mkdir must fail if directory exists; never reuse/overwrite snapshot',
      'write manifest exactly with exclusive wx mode0600 before freeze; verify all module hashes',
      'separate writable private evidence/backup path; reviewed admission marker created before freeze',
      'unit contents pin full opsSHA and manifest hash; app SHA remains separate',
    ],
  };
}

export function validateExecutingOps(snapshot, repo, read = readFileSync) {
  const manifest = JSON.parse(snapshot.manifest);
  for (const [path, expected] of Object.entries(manifest.files)) {
    const actual = createHash('sha256')
      .update(read(join(repo, path)))
      .digest('hex');
    if (actual !== expected) throw Error(`Executing ops source differs from selected ops commit: ${path}`);
  }
  return true;
}

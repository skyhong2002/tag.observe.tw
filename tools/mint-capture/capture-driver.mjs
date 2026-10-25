// Future Mint-only owner execution. Importing does not launch/probe anything.
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ownershipRegistry, stopProfile } from './browser-owner.mjs';
import { admitRequest, hash, MiB, origin, pins, shots, validatedAttemptSuffix, validateGate, validateInput } from './capture-policy.mjs';
import { verifyControl } from './control-source.mjs';
import { candidateResponse, progressiveScroll, redactHar, redactHeaders } from './evidence.mjs';
import { evidenceTasks, requireCaptureEvidence, validateNetworkEvidence } from './evidence-lifecycle.mjs';
import { observedTools, playwrightTree } from './tool-proof.mjs';

const root = dirname(fileURLToPath(import.meta.url));
function sourceBytes(path, max = 1048576) {
  const s = fs.lstatSync(path);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.uid !== process.getuid() ||
    s.mode & 0o022 ||
    s.size > max ||
    fs.realpathSync(path) !== resolve(path)
  )
    throw Error('Canonical owner source required');
  return fs.readFileSync(path);
}
function privateBytes(path, max = 65536) {
  const st = fs.lstatSync(path);
  if (!st.isFile() || st.isSymbolicLink() || st.uid !== process.getuid() || st.mode & 0o077 || st.size > max)
    throw Error('Owned private bounded input/adapter required');
  return fs.readFileSync(path);
}
export function bytesIn(path, io = fs, base = path) {
  let total = 0;
  for (const entry of io.readdirSync(path, { withFileTypes: true })) {
    const p = join(path, entry.name);
    try {
      if (entry.isDirectory()) total += bytesIn(p, io, base);
      else if (entry.isFile()) total += io.lstatSync(p).size;
      else if (entry.isSymbolicLink() && p.startsWith(join(base, 'profile') + '/')) total += Buffer.byteLength(io.readlinkSync(p));
      else throw Error('Unsupported capture evidence entry');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  return total;
}

function kernel(input) {
  if (fs.readFileSync('/etc/machine-id', 'utf8').trim() !== 'f80413057e6d4a179e248e5f8c08cac6' || process.platform !== 'linux')
    throw Error('Mint-only capture runtime required');
  const lock = fs.lstatSync('/run/lock/mint-global-build.lock');
  if (!lock.isFile() || lock.isSymbolicLink() || String(lock.dev) !== input.mintLockDev || String(lock.ino) !== input.mintLockInode)
    throw Error('Specific external Mint lock identity differs');
  const stat = fs
    .readFileSync('/proc/' + input.mintLockPid + '/stat', 'utf8')
    .split(')')
    .slice(1)
    .join(')')
    .trim()
    .split(/\s+/);
  if (
    ['Z', 'X'].includes(stat[0]) ||
    stat[19] !== input.mintLockStartTicks ||
    hash(fs.readFileSync('/proc/' + input.mintLockPid + '/cmdline')) !== input.mintLockCmdlineSha256
  )
    throw Error('External Mint holder changed');
  const dev = BigInt(lock.dev),
    major = Number(((dev >> 8n) & 0xfffn) | ((dev >> 32n) & 0xfffff000n)),
    minor = Number((dev & 0xffn) | ((dev >> 12n) & 0xffffff00n));
  if (
    !fs
      .readFileSync('/proc/locks', 'utf8')
      .split('\n')
      .some((line) => {
        const f = line.trim().split(/\s+/),
          d = (f[5] || '').split(':');
        return (
          f[1] === 'FLOCK' &&
          f[3] === 'WRITE' &&
          Number(f[4]) === input.mintLockPid &&
          parseInt(d[0], 16) === major &&
          parseInt(d[1], 16) === minor &&
          d[2] === input.mintLockInode
        );
      })
  )
    throw Error('No actual WRITE FLOCK for capture owner');
}
export async function runCapture(inputPath, expectedInputSha, job) {
  const inputBytes = privateBytes(inputPath);
  if (hash(inputBytes) !== expectedInputSha) throw Error('Reviewed exact capture input differs');
  const input = validateInput(JSON.parse(inputBytes));
  const expectedJob =
    '/var/lib/observe-worker/tag/candidate-sm-c70425b0-' +
    input.newCandidateSessionId +
    validatedAttemptSuffix(input.attemptSuffix) +
    '/capture';
  if (resolve(job) !== expectedJob || fs.realpathSync(dirname(job)) !== dirname(job))
    throw Error('Exact exclusive batch capture directory');
  if (input.adapterPath !== join(root, 'runtime-adapter.mjs')) throw Error('Fixed production capture adapter');
  verifyControl(resolve(root, '../..'), input.controlOpsSha, input.controlSourceHashes);
  for (const [field, value] of Object.entries(observedTools))
    if (input[field] !== value) throw Error('Exact observed tool path/hash required: ' + field);
  if (process.version !== 'v24.15.0') throw Error('Pinned Node24.15.0 required');
  if (JSON.parse(sourceBytes(input.playwrightPackagePath)).version !== '1.63.0') throw Error('Pinned Playwright1.63.0 required');
  if (
    hash(sourceBytes(fileURLToPath(import.meta.url))) !== input.driverSha256 ||
    hash(sourceBytes(join(root, 'capture-policy.mjs'))) !== input.policySha256 ||
    hash(sourceBytes(join(root, 'candidate-capture-proxy.cjs'))) !== input.proxySha256
  )
    throw Error('Source/proxy pins differ');
  if (
    hash(sourceBytes(input.adapterPath)) !== input.adapterSha256 ||
    hash(sourceBytes(join(root, 'watchdog.mjs'))) !== input.watchdogSha256 ||
    hash(sourceBytes(join(root, 'browser-owner.mjs'))) !== input.browserOwnerSha256 ||
    hash(fs.readFileSync(input.playwrightEntry)) !== input.playwrightEntrySha256 ||
    hash(fs.readFileSync(input.browserExecutable)) !== input.browserSha256
  )
    throw Error('Reviewed guard/Playwright/browser source bytes differ');
  const installedTools = playwrightTree('/home/sky/observe-worker/browser-tools/node_modules');
  if (installedTools.sha256 !== input.playwrightTreeSha256) throw Error('Actual full installed Playwright code proof differs');
  const adapter = await import(pathToFileURL(input.adapterPath).href);
  for (const name of ['actualCaptureSample', 'assertCandidateImmutable', 'registerOwnedBrowser', 'assertOwnedBrowser', 'stopOwnedBrowser'])
    if (typeof adapter[name] !== 'function') throw Error('Real reviewed owner adapter incomplete: ' + name);
  kernel(input);
  const initialSample = await adapter.actualCaptureSample(input, expectedInputSha);
  validateGate(initialSample, input, expectedInputSha, { starting: true });
  const before = await adapter.assertCandidateImmutable(input, 'before-capture');
  if (
    before?.verified !== true ||
    before.inventorySha256 !== pins.inventory ||
    before.manifestSha256 !== pins.manifest ||
    before.newCandidateSessionId !== input.newCandidateSessionId
  )
    throw Error('No actual pre-capture whole artifact proof');
  fs.mkdirSync(job, { mode: 0o700 });
  let measuredBytes = 0,
    unmeasuredLogBytes = 0;
  const log = (name, value) => {
    const row = JSON.stringify({ utc: new Date().toISOString(), ...value }) + '\n',
      size = Buffer.byteLength(row);
    if (measuredBytes + unmeasuredLogBytes + size > 88 * MiB) throw Error('Stop at88MiB for final flush');
    fs.appendFileSync(join(job, name), row, { mode: 0o600 });
    unmeasuredLogBytes += size;
  };
  const check = async (starting = false) => {
    if (proxy?.failed) throw Error('Proxy evidence writer failed');
    if (ownedBrowser) ownedBrowser.ownedRecords = registry.snapshot([ownedBrowser]);
    validateInput(input);
    kernel(input);
    if (hash(privateBytes(inputPath)) !== expectedInputSha || hash(sourceBytes(input.adapterPath)) !== input.adapterSha256)
      throw Error('Capture input/guard adapter changed');
    const s = await adapter.actualCaptureSample(input, expectedInputSha);
    measuredBytes = bytesIn(job);
    unmeasuredLogBytes = 0;
    validateGate(s, input, expectedInputSha, { starting, bytes: measuredBytes });
    log('actual-gates.jsonl', s);
    const tmp = join(job, 'browser-lease.pending.json');
    fs.writeFileSync(
      tmp,
      JSON.stringify({ captureParentPid: process.pid, profile: join(job, 'profile'), decision: 'run', observedAtMs: Date.now() }) + '\n',
      { mode: 0o600 },
    );
    fs.renameSync(tmp, join(job, 'browser-lease.json'));
    return s;
  };
  const { createCandidateCaptureProxy } = await import(pathToFileURL(join(root, 'candidate-capture-proxy.cjs')).href);
  let proxy, context, ownedBrowser, monitor, deadline, watchdog;
  let checking = false;
  let requests = 0;
  let routeBlocked = 0;
  const records = [];
  const profile = join(job, 'profile'),
    watchLease = join(job, 'browser-lease.json');
  let fatal = null,
    completed = false,
    monitorTask;
  const pages = [],
    cleanupErrors = [];
  const registry = ownershipRegistry(profile);
  const tasks = evidenceTasks((error) => {
    fatal ??= error;
  });
  try {
    proxy = await createCandidateCaptureProxy(origin, { log: (e) => log('prelaunch-proxy.jsonl', e) });
    fs.mkdirSync(join(profile, 'Default'), { recursive: true, mode: 0o700 });
    fs.writeFileSync(join(profile, 'Default/Preferences'), JSON.stringify({ enable_do_not_track: true }), { flag: 'wx', mode: 0o600 });
    await check(true);
    const wdConfig = join(job, 'watchdog-config.json');
    fs.writeFileSync(
      wdConfig,
      JSON.stringify({
        profile,
        leasePath: watchLease,
        deadlineMs: input.expiresAtMs,
        parentPid: process.pid,
        input,
        inputSha256: expectedInputSha,
        adapterPath: input.adapterPath,
        adapterSha256: input.adapterSha256,
        logPath: join(job, 'browser-watchdog.jsonl'),
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    watchdog = spawn(process.execPath, [join(root, 'watchdog.mjs'), wdConfig], {
      detached: true,
      env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', LANG: 'C' },
      stdio: 'ignore',
    });
    watchdog.on('error', () => {
      fatal = Error('Browser watchdog launch failed');
    });
    watchdog.on('exit', (code) => {
      if (!completed) fatal ??= Error('Browser watchdog exited before completion');
    });
    monitor = setInterval(() => {
      if (checking || fatal) return;
      checking = true;
      monitorTask = check()
        .catch((error) => {
          fatal = error;
          void stopProfile(profile, { records: registry.records }).catch((e) => cleanupErrors.push(e));
        })
        .finally(() => {
          checking = false;
        });
    }, 1000);
    const { chromium } = await import(pathToFileURL(input.playwrightEntry).href);
    // All transport protection exists BEFORE launch; no navigator/UA/analytics overrides.
    context = await chromium.launchPersistentContext(profile, {
      executablePath: input.browserExecutable,
      headless: true,
      env: { PATH: '/usr/bin:/bin', HOME: profile, LANG: 'C', TZ: 'UTC', DNT: '1' },
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
      extraHTTPHeaders: { DNT: '1' },
      proxy: { server: proxy.address, bypass: '<-loopback>' },
      recordHar: { path: join(job, 'network.har'), mode: 'full', content: 'omit' },
      args: [
        '--disable-background-networking',
        '--disable-sync',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-quic',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      ],
    });
    ownedBrowser = await adapter.registerOwnedBrowser(context, profile, input);
    if (
      !Number.isInteger(ownedBrowser?.pid) ||
      ownedBrowser.pid <= 0 ||
      !Number.isInteger(ownedBrowser.processGroup) ||
      ownedBrowser.processGroup <= 0 ||
      ownedBrowser.profile !== profile ||
      !/^\d+$/.test(ownedBrowser.startTicks || '')
    )
      throw Error('Actual own Chromium kernel registry required');
    if ((await adapter.assertOwnedBrowser(ownedBrowser, input)) !== true) throw Error('Own Chromium ownership not verified');
    ownedBrowser.ownedRecords = registry.snapshot([ownedBrowser]);
    log('browser-owner.jsonl', {
      pid: ownedBrowser.pid,
      processGroup: ownedBrowser.processGroup,
      startTicks: ownedBrowser.startTicks,
      profile: ownedBrowser.profile,
      uid: ownedBrowser.uid,
      nice: ownedBrowser.nice,
      ioClass: ownedBrowser.ioClass,
    });
    const stop = async (error) => {
      if (fatal) return;
      fatal = error;
      try {
        await adapter.stopOwnedBrowser(ownedBrowser, input);
      } catch (cleanupError) {
        fatal.cleanupError = String(cleanupError.message).slice(0, 256);
      }
      await context.close().catch((e) => {
        cleanupErrors.push(e);
      });
    };
    deadline = setTimeout(
      () => tasks.add(() => stop(Error('Capture admission deadline reached'))),
      Math.max(1, input.expiresAtMs - Date.now()),
    );

    context.on('request', (request) => {
      try {
        if (++requests > 5000) throw Error('Network request cap reached');
        log('requests.raw.jsonl', {
          event: 'request',
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          headers: redactHeaders(request.headers()),
          headersRedacted: true,
        });
      } catch (error) {
        tasks.add(() => stop(error));
      }
    });
    context.on('response', (response) => {
      tasks.add(async () => {
        try {
          await candidateResponse(response, { origin, record: (e) => log('requests.raw.jsonl', e), stop });
        } catch (error) {
          await stop(error);
          throw error;
        }
      });
    });
    context.on('requestfailed', (request) => {
      try {
        log('requests.raw.jsonl', { event: 'failed', url: request.url(), method: request.method(), error: request.failure() });
      } catch (error) {
        tasks.add(() => stop(error));
      }
    });
    await context.route('**/*', (route) => {
      if (admitRequest(route.request().url(), route.request().method())) return route.continue();
      routeBlocked++;
      return route.abort('blockedbyclient');
    });
    for (const [index, shot] of shots(input).entries()) {
      if (fatal) throw fatal;
      await check();
      if ((await adapter.assertOwnedBrowser(ownedBrowser, input)) !== true) throw Error('Own Chromium ownership lost');
      const page = await context.newPage();
      pages.push(page);
      const errors = [];
      page.on('pageerror', () => {
        if (errors.length < 200) errors.push({ kind: 'pageerror', message: 'page error; original values omitted' });
      });
      page.on('console', (e) => {
        if (e.type() === 'error' && errors.length < 200)
          errors.push({ kind: 'console', message: 'console error; original values omitted' });
      });
      await page.setViewportSize(shot.viewport);
      await page.emulateMedia({ colorScheme: shot.colorScheme });
      const navigation = await page.goto(origin + shot.path, { waitUntil: 'networkidle', timeout: 12000 });
      await check();
      const lazy = await progressiveScroll(page);
      const state = await page.evaluate(() => ({
        url: location.href,
        viewport: { width: innerWidth, height: innerHeight },
        DNT: navigator.doNotTrack,
        GPC: {
          present: 'globalPrivacyControl' in navigator,
          type: typeof navigator.globalPrivacyControl,
          value: navigator.globalPrivacyControl ?? null,
        },
        webdriver: navigator.webdriver,
        userAgent: navigator.userAgent,
        gaFlags: Object.fromEntries(
          Object.keys(window)
            .filter((key) => key.startsWith('ga-disable-'))
            .map((key) => [key, window[key]]),
        ),
        commands: Array.isArray(window.dataLayer) ? window.dataLayer.length : null,
        analytics: window.__tagAnalytics
          ? { configured: window.__tagAnalytics.configured, loaded: window.__tagAnalytics.loaded, optedOut: window.__tagAnalytics.optedOut }
          : null,
        footer: { present: !!document.querySelector('footer'), textLength: document.querySelector('footer')?.textContent?.length ?? 0 },
        documentHeight: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      log('states.raw.jsonl', { ...shot, index, state, pins, errors, lazy });
      if (state.documentHeight > 16000) throw Error('Full-page height budget exceeded');
      if (state.DNT !== '1') throw Error('Actual native DNT preference did not take effect');
      const png = await page.screenshot({ fullPage: true });
      if (png.length > 12 * MiB || bytesIn(job) + png.length > 88 * MiB) throw Error('PNG/batch reserve exceeded');
      fs.writeFileSync(join(job, 'shot-' + index + '.png'), png, { flag: 'wx', mode: 0o600 });
      records.push({
        ...shot,
        index,
        ledgerId: input.ledgerIds?.[shot.path] ?? null,
        requestedUrl: origin + shot.path,
        finalUrl: page.url(),
        httpStatus: navigation?.status() ?? null,
        contentType: navigation?.headers()?.['content-type'] ?? null,
        redirected: page.url() !== new URL(origin + shot.path).href,
        routeScope: input.routeScopes?.[shot.path] ?? 'anonymous readonly UI only',
        file: 'shot-' + index + '.png',
        sha256: hash(png),
        bytes: png.length,
        state,
        errors,
        lazy,
        status: [403, 404].includes(navigation?.status())
          ? 'missing-or-restricted'
          : errors.length || !lazy.loaded
            ? 'pending'
            : 'captured-pending-independent-review',
      });
      await page.close();
      await check();
    }
    await tasks.drain();
    if (fatal || proxy.failed) throw fatal || Error('Proxy failed');
    completed = true;
  } catch (error) {
    fatal ??= error;
    throw error;
  } finally {
    clearInterval(monitor);
    clearTimeout(deadline);
    if (monitorTask) await monitorTask;
    if (ownedBrowser)
      try {
        ownedBrowser.ownedRecords = registry.snapshot([ownedBrowser]);
      } catch (error) {
        cleanupErrors.push(error);
        fatal ??= error;
      }
    for (const page of pages) await page.close().catch((e) => cleanupErrors.push(e));
    if (context)
      await context.close().catch((e) => {
        cleanupErrors.push(e);
      });
    try {
      await tasks.drain();
    } catch (error) {
      fatal ??= error;
    }
    try {
      await stopProfile(profile, { records: registry.records });
    } catch (error) {
      cleanupErrors.push(error);
      fatal ??= error;
    }
    if (watchdog && watchdog.pid && watchdog.exitCode === null) {
      await new Promise((done) => {
        const timer = setTimeout(() => {
          if (watchdog.exitCode === null) watchdog.kill('SIGKILL');
          done();
        }, 1000);
        watchdog.once('close', () => {
          clearTimeout(timer);
          done();
        });
        watchdog.kill('SIGTERM');
      });
    }
    if (proxy)
      try {
        await proxy.close();
      } catch (error) {
        cleanupErrors.push(error);
        fatal ??= error;
      }
    const after = await adapter.assertCandidateImmutable(input, 'after-capture');
    if (
      after?.verified !== true ||
      after.inventorySha256 !== pins.inventory ||
      after.manifestSha256 !== pins.manifest ||
      after.newCandidateSessionId !== input.newCandidateSessionId
    )
      throw Error('No actual post-capture whole artifact proof');
    const bytes = bytesIn(job);
    if (fs.existsSync(join(job, 'network.har'))) {
      fs.chmodSync(join(job, 'network.har'), 0o600);
      const hs = fs.statSync(join(job, 'network.har'));
      if (hs.size > 88 * MiB) throw Error('HAR budget exceeded');
      const har = redactHar(JSON.parse(fs.readFileSync(join(job, 'network.har'))));
      fs.writeFileSync(join(job, 'network.har'), JSON.stringify(har), { mode: 0o600 });
    }
    const networkFiles = [
      'requests.raw.jsonl',
      'network.har',
      'prelaunch-proxy.jsonl',
      'browser-owner.jsonl',
      'browser-watchdog.jsonl',
    ].filter((n) => fs.existsSync(join(job, n)));
    try {
      requireCaptureEvidence({ proxy, files: networkFiles, cleanupErrors });
      validateNetworkEvidence({
        files: networkFiles,
        stats: proxy.stats,
        read: (name) => {
          const path = join(job, name),
            st = fs.lstatSync(path);
          if (!st.isFile() || st.isSymbolicLink() || st.uid !== process.getuid() || st.mode & 0o077 || st.size > 88 * MiB)
            throw Error('Private bounded regular evidence required');
          return fs.readFileSync(path);
        },
      });
    } catch (error) {
      fatal ??= error;
    }
    const manifest = {
      schema: 'mint-anonymous-capture-manifest-v1',
      status: completed && !fatal ? 'captured-evidence-pending-review' : 'partial',
      appSha: pins.app,
      artifactOpsSha: pins.ops,
      controlOpsSha: input.controlOpsSha,
      controlSourceSha256: hash(JSON.stringify(input.controlSourceHashes)),
      controlSourceHashes: input.controlSourceHashes,
      buildId: pins.build,
      inventorySha256: pins.inventory,
      inputSha256: expectedInputSha,
      sessionId: input.newCandidateSessionId,
      attemptSuffix: validatedAttemptSuffix(input.attemptSuffix),
      ledgerSha256: input.ledgerSha256,
      shots: records,
      installedToolCodeProof: { sha256: installedTools.sha256, bytes: installedTools.bytes, packages: installedTools.packages },
      network: networkFiles.map((file) => ({
        file,
        sha256: hash(fs.readFileSync(join(job, file))),
        bytes: fs.statSync(join(job, file)).size,
      })),
      browserOwnership: ownedBrowser
        ? {
            pid: ownedBrowser.pid,
            processGroup: ownedBrowser.processGroup,
            startTicks: ownedBrowser.startTicks,
            profile: ownedBrowser.profile,
            nice: ownedBrowser.nice,
            ioClass: ownedBrowser.ioClass,
          }
        : null,
      requests,
      proxyStats: proxy?.stats ? { ...proxy.stats } : null,
      zeroGoogleOutgoing: proxy?.stats?.googleOutgoing === 0,
      blockedRequests: routeBlocked + (proxy?.stats?.blocked ?? 0),
      transportScope: 'only exact candidate origin via prelaunch proxy; raw records retained',
      uiReview: 'pending independent image/network review',
      deployEligible: false,
    };
    if (bytesIn(job) + Buffer.byteLength(JSON.stringify(manifest, null, 2)) + 8192 > 96 * MiB) {
      fatal ??= Error('Final evidence budget exceeded');
      manifest.status = 'partial';
    }
    fs.writeFileSync(join(job, 'capture-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    const finalBytes = bytesIn(job) + 4096;
    fs.writeFileSync(
      join(job, 'final-size.json'),
      JSON.stringify({
        measuredBeforeFinalRecordBytes: bytesIn(job),
        reservedFinalRecordBytes: 4096,
        finalCeilingBytes: finalBytes,
        budgetBytes: 96 * MiB,
        complete: completed && !fatal && finalBytes <= 96 * MiB,
        error: fatal ? String(fatal.message).slice(0, 256) : null,
        uiReview: 'pending independent image review',
        deployEligible: false,
      }) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    if (fatal) throw fatal;
    if (bytesIn(job) > 96 * MiB || finalBytes > 96 * MiB) throw Error('Final batch exceeds96MiB; retained, not complete');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, sha, job] = process.argv.slice(2);
  runCapture(input, sha, job).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

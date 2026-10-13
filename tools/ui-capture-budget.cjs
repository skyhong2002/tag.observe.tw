// Capture policy after the user's explicit 2026-10-13 unfreeze.
// The 40/30 GiB disk limits are conservative tool policy aligned with builds;
// they are not disk thresholds specified by the user's capture gate.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const MiB = 1024 ** 2;
const FLOOR = 30 * 1024 ** 3;
const START_FLOOR = 40 * 1024 ** 3;
const SERVICE_URLS = ['https://tag.observe.tw/', 'https://blog.observe.tw/', 'https://youtube.observe.tw/'];
const MAX_BATCH = 100 * MiB;
const fail = (message) => Object.assign(new Error(message), { code: 'CAPTURE_BUDGET_STOP' });

function estimateCaptureBytes(screenshots) {
  if (!Number.isInteger(screenshots) || screenshots < 1 || screenshots > 16) {
    throw fail('Declare 1–16 planned screenshots; split larger reviews into small batches.');
  }
  return 32 * MiB + screenshots * 4 * MiB; // Profile/network/log reserve + conservative PNG estimate.
}

function checkServiceSample(sample, nowMs = Date.now()) {
  const finished = typeof sample?.finishedAt === 'string' ? Date.parse(sample.finishedAt) : NaN;
  if (!Number.isFinite(nowMs) || !Number.isFinite(finished) || finished > nowMs || nowMs - finished > 30_000 || sample.probeError)
    throw fail('Cannot verify fresh service health from recorded probes.');
  if (!Array.isArray(sample.sites)) throw fail('Missing recorded service probes.');
  for (const url of SERVICE_URLS) {
    const matches = sample.sites.filter((site) => site?.url === url);
    const site = matches[0];
    if (matches.length !== 1 || site.exitCode !== 0 || site.probeError ||
        !Number.isInteger(site.status) || site.status < 200 || site.status >= 400 ||
        !Number.isFinite(site.total) || site.total < 0 || site.total > 2)
      throw fail(`Capture paused: cannot verify healthy service ${url}`);
  }
}

function checkCaptureBudget({ freeBytes, load1, plannedBytes, batchBytes = 0, beforeLaunch = false, serviceSample, nowMs }) {
  checkServiceSample(serviceSample, nowMs);
  if (!Number.isFinite(load1) || load1 < 0 || load1 > 12) throw fail('All captures paused: load exceeds 12 or is invalid.');
  if (!Number.isFinite(plannedBytes) || plannedBytes < 0 || plannedBytes > MAX_BATCH) throw fail('Batch exceeds capture budget.');
  if (!Number.isFinite(batchBytes) || batchBytes < 0 || batchBytes > MAX_BATCH - 8 * MiB) throw fail('Stop capture and reserve space for final network/log flush.');
  const reserve = beforeLaunch ? plannedBytes : 8 * MiB;
  if (!Number.isFinite(freeBytes) || (beforeLaunch && freeBytes < START_FLOOR) || freeBytes - reserve < FLOOR)
    throw fail('Capture would approach the conservative disk floor; use offline review.');
}

function directoryBytes(directory) {
  let size = 0;
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) size += directoryBytes(file);
    else if (item.isFile()) size += fs.statSync(file).size;
  }
  return size;
}

function createCaptureBudget(directory, screenshots, getServiceSample) {
  if (typeof getServiceSample !== 'function') throw fail('Supply a synchronous callback for the latest recorded service sample.');
  const plannedBytes = estimateCaptureBytes(screenshots);
  let captured = 0;
  const check = (beforeLaunch = false, pendingBytes = 0) => {
    try {
      const disk = fs.statfsSync(directory);
      const sample = {
        utc: new Date().toISOString(),
        freeBytes: disk.bavail * disk.bsize - pendingBytes,
        load1: os.loadavg()[0],
        plannedBytes,
        batchBytes: directoryBytes(directory) + pendingBytes,
        beforeLaunch,
        captured,
        serviceSample: getServiceSample(),
      };
      fs.appendFileSync(path.join(directory, 'capture-budget.jsonl'), `${JSON.stringify(sample)}\n`);
      checkCaptureBudget(sample);
    } catch (error) {
      if (error.code === 'CAPTURE_BUDGET_STOP') throw error;
      throw Object.assign(fail(`Cannot verify capture resources: ${error.message}`), { cause: error });
    }
  };
  check(true);
  return {
    check,
    async screenshot(page, options) {
      if (captured >= screenshots) throw fail('Planned screenshot count reached; split remaining evidence into another budgeted batch.');
      check();
      if (options.fullPage) {
        const pixels = await page.evaluate(() => document.documentElement.scrollWidth * document.documentElement.scrollHeight);
        if (pixels > 8_000_000) throw fail('Long full-page image exceeds capture budget; use viewport segments.');
      }
      const result = await page.screenshot({ ...options, path: undefined });
      if (result.length > 4 * MiB) throw fail('PNG exceeds its 4 MiB estimate; split the capture before saving.');
      check(false, result.length);
      try {
        fs.writeFileSync(options.path, result, { flag: 'wx' });
      } catch (error) {
        throw Object.assign(fail(`Cannot safely save capture: ${error.message}`), { cause: error });
      }
      captured++;
      check();
      return result;
    },
  };
}

module.exports = { estimateCaptureBytes, checkServiceSample, checkCaptureBudget, createCaptureBudget };

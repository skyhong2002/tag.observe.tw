// Temporary conservative capture policy while backup cleanup is frozen.
// Removing this policy requires the coordinator's explicit unfreeze notice.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const MiB = 1024 ** 2;
const FLOOR = 113 * 1024 ** 3; // Leave 1.5 GiB above the backup deletion threshold.
const MAX_BATCH = 100 * MiB;
const fail = (message) => Object.assign(new Error(message), { code: 'CAPTURE_BUDGET_STOP' });

function estimateCaptureBytes(screenshots) {
  if (!Number.isInteger(screenshots) || screenshots < 1 || screenshots > 16) {
    throw fail('Declare 1–16 planned screenshots; split larger reviews into small batches.');
  }
  return 32 * MiB + screenshots * 4 * MiB; // Profile/network/log reserve + conservative PNG estimate.
}

function checkCaptureBudget({ freeBytes, load1, plannedBytes, batchBytes = 0, beforeLaunch = false }) {
  if (!Number.isFinite(load1) || load1 > 12) throw fail('All captures paused: load exceeds 12.');
  if (!Number.isFinite(plannedBytes) || plannedBytes > MAX_BATCH) throw fail('Batch exceeds freeze budget.');
  if (batchBytes > MAX_BATCH - 8 * MiB) throw fail('Stop capture and reserve space for final network/log flush.');
  const reserve = beforeLaunch ? plannedBytes : 8 * MiB;
  if (!Number.isFinite(freeBytes) || freeBytes - reserve < FLOOR)
    throw fail('Capture would approach backup retention floor; use offline review.');
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

function createCaptureBudget(directory, screenshots) {
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

module.exports = { estimateCaptureBytes, checkCaptureBudget, createCaptureBudget };

// Dynamic import entry retains import/plan/launch failures before reporting a generic summary.
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hash } from './capture-policy.mjs';
import { diagnosedTask, errorRecord } from './diagnostic.mjs';

const mode = process.argv[2];
if (!['--execute', '--worker'].includes(mode))
  console.log(
    JSON.stringify({
      mode: 'plan-only',
      reviewed: false,
      executionPermission: false,
      globalSlotAcknowledged: false,
      deployEligible: false,
    }),
  );
else {
  const args = process.argv.slice(3),
    diagnostic = mode === '--worker' ? args[5] : args[3];
  const digestFile = (path) => {
    try {
      return hash(fs.readFileSync(path));
    } catch {
      return null;
    }
  };
  diagnosedTask(
    async () => {
      const controller = await import('./controller.mjs');
      if (mode === '--execute') await controller.runBatch(args[0], args[1], args[2]);
      else await controller.worker(args[0], args[1], args[2], Number(args[3]), Number(args[4]));
    },
    {
      path: diagnostic,
      metadata: {
        sourceSha256: digestFile(fileURLToPath(import.meta.url)),
        controllerSha256: digestFile(fileURLToPath(new URL('./controller.mjs', import.meta.url))),
        inputSha256: digestFile(args[0]),
        planSha256: digestFile(args[1]),
      },
    },
  ).catch((error) => {
    if (!error.diagnosticSaved)
      process.stderr.write(JSON.stringify(errorRecord(error, { diagnosticWriteError: error.diagnosticWriteError || null })) + '\n');
    console.error('Candidate/capture failed; original cause retained in owner-private diagnostic');
    process.exitCode = 1;
  });
}

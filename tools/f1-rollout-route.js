// Runtime execution is restricted to the reviewed persistent route unit.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { routeCommands } from './f1-rollout-plan.js';
export const expectedWorkerPolicy = 'own-indexed-v2';
export async function applyRoute(action, sha, {run = runCommand, fetchFn = fetch} = {}) {
  if (!['start','stop'].includes(action)) throw Error('start/stop and full SHA required');
  const commands = routeCommands(sha);
  if (action === 'start') {
    for (const port of [18192,18194,18197,18195]) {
      const response = await fetchFn(`http://127.0.0.1:${port}${port === 18195 ? '/health' : '/'}`, {redirect:'error',signal:AbortSignal.timeout(5000)});
      if (response.status !== 200) throw Error(`Unhealthy candidate port ${port}`);
      if (port === 18195) { const body = await response.json(); if (body.status !== 'ok' || body.legacyOwnershipPolicy !== expectedWorkerPolicy) throw Error('Worker policy mismatch'); }
    }
    const check = run(commands.check);
    if (check === 1) { if (run(commands.switch) !== 0) throw Error('Route insertion failed'); }
    else if (check !== 0) throw Error('Route check failed');
  } else {
    const check = run(commands.check);
    if (check === 0) { if (run(commands.rollback) !== 0) throw Error('Route deletion failed'); }
    else if (check !== 1) throw Error('Route check failed');
  }
}
function runCommand(argv) { const [bin,...args] = argv; const r = spawnSync(bin,args,{stdio:'inherit'}); if (r.error || r.signal || r.status === null) throw Error('Route command transport error'); return r.status; }
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) applyRoute(...process.argv.slice(2)).catch(error => {console.error(error.message);process.exitCode=1;});

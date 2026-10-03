import { Worker } from 'node:worker_threads';
import type { buildGraph, ContentRow, computeSimilarity } from './compute.ts';

type Result = ReturnType<typeof computeSimilarity> & ReturnType<typeof buildGraph>;
let tail: Promise<unknown> = Promise.resolve();
let pending = 0;

// One calculation at a time, outside Fastify's event loop. Terminating the
// worker releases its temporary index, rather than retaining it in API memory.
export function computeSimilarityAsync(rows: ContentRow[], threshold: number, focus?: number[]): Promise<Result> {
  if (pending >= 8) return Promise.reject(Object.assign(new Error('Similarity is busy; retry shortly'), { statusCode: 503 }));
  pending++;
  const job = tail.then(
    () =>
      new Promise<Result>((resolve, reject) => {
        const worker = new Worker(new URL('./compute-worker.ts', import.meta.url), {
          workerData: { rows, threshold, ...(focus ? { focus } : {}) },
          execArgv: process.execArgv.filter((arg) => !arg.startsWith('--input-type')),
          resourceLimits: { maxOldGenerationSizeMb: 1536 },
        });
        let settled = false;
        const finish = (error: Error | null, result?: Result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          void worker.terminate().finally(() => (error ? reject(error) : resolve(result!)));
        };
        const timer = setTimeout(() => finish(new Error('Similarity calculation timed out')), 25_000);
        worker.once('message', (result: Result) => finish(null, result));
        worker.once('error', (error) => finish(error instanceof Error ? error : new Error(String(error))));
        worker.once('exit', (code) => {
          if (!settled) finish(new Error(`Similarity worker exited before returning a result (${code})`));
        });
      }),
  );
  tail = job.catch(() => {});
  return job.finally(() => {
    pending--;
  });
}

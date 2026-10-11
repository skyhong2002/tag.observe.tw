import { fork } from 'node:child_process';
import type { runTagAvatarsJob } from './tag-avatars-run.ts';

// Imports nothing that loads the image models: the worker only forks
// tag-avatars-child.ts, which runs tag-avatars-run.ts and exits.

/**
 * The worker's entry: runs the job in a child process (tag-avatars-child.ts)
 * so its memory is returned when it ends; `signal` (worker shutdown) asks the
 * child to stop after the current tag.
 */
export function runTagAvatarsInChild({ signal, rising = false }: { signal?: AbortSignal; rising?: boolean } = {}) {
  return new Promise<Awaited<ReturnType<typeof runTagAvatarsJob>>>((resolve, reject) => {
    const child = fork(new URL('./tag-avatars-child.ts', import.meta.url), rising ? ['rising'] : [], { stdio: 'inherit' });
    let reply: { result?: Awaited<ReturnType<typeof runTagAvatarsJob>>; error?: string } = {};
    const stop = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', stop, { once: true });
    child.on('message', (m) => {
      reply = m as typeof reply;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      signal?.removeEventListener('abort', stop);
      if (reply.result) resolve(reply.result);
      else reject(Error(reply.error ?? `tag-avatars child exited with ${code}`));
    });
  });
}

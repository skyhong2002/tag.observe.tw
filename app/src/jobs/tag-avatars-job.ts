import { fork } from 'node:child_process';
import type { addPhoto } from '../avatars/run.ts';
import type { runTagAvatarsJob } from './tag-avatars-run.ts';

// Imports nothing that loads the image models: the worker only forks
// tag-avatars-child.ts, which runs tag-avatars-run.ts and exits.

type Photo = { tag: string; image: string; email: string; userId?: number };

/**
 * The worker's entry: runs the job in a child process (tag-avatars-child.ts)
 * so its memory is returned when it ends; `signal` (worker shutdown) asks the
 * child to stop after the current tag. With `photo`, the child sketches that
 * one admin-uploaded photo (base64) instead.
 */
export function runTagAvatarsInChild(opts?: {
  signal?: AbortSignal;
  rising?: boolean;
}): Promise<Awaited<ReturnType<typeof runTagAvatarsJob>>>;
export function runTagAvatarsInChild(opts: { signal?: AbortSignal; photo: Photo }): Promise<Awaited<ReturnType<typeof addPhoto>>>;
export function runTagAvatarsInChild({ signal, rising = false, photo }: { signal?: AbortSignal; rising?: boolean; photo?: Photo } = {}) {
  return new Promise<unknown>((resolve, reject) => {
    const args = photo ? ['photo'] : rising ? ['rising'] : [];
    const child = fork(new URL('./tag-avatars-child.ts', import.meta.url), args, { stdio: 'inherit' });
    if (photo) child.send(photo);
    let reply: { result?: unknown; error?: string } = {};
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

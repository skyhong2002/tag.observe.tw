import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Connection } from 'mysql2/promise';
import { afterEach, expect, it } from 'vitest';
import { runVocabulary } from '../src/vocabulary/runner.ts';

const dirs: string[] = [];
const holders: DatabaseSync[] = [];
async function setup() {
  const d = await mkdtemp(join(tmpdir(), 'vocab-lock-'));
  dirs.push(d);
  return d;
}
function holdWriterLock(directory: string) {
  const held = new DatabaseSync(join(directory, 'runner-lock.sqlite'));
  held.exec('CREATE TABLE IF NOT EXISTS lock(id INTEGER PRIMARY KEY); BEGIN IMMEDIATE');
  holders.push(held);
  return held;
}
// Any source query proves the runner got past the writer lock.
const reached = new Error('source-reached');
const db = new Proxy({}, { get: () => () => Promise.reject(reached) }) as unknown as Connection;
afterEach(async () => {
  for (const h of holders.splice(0)) if (h.isOpen) h.close();
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});

it('still reports busy immediately when another run holds the writer lock and no wait is requested', async () => {
  const d = await setup();
  holdWriterLock(d);
  const start = Date.now();
  await expect(runVocabulary(db, { directory: d, mode: 'fast' })).resolves.toEqual({ status: 'busy' });
  expect(Date.now() - start).toBeLessThan(1000);
});

it('waits for an overlapping run to release the writer lock instead of exiting busy', async () => {
  const d = await setup();
  const held = holdWriterLock(d);
  setTimeout(() => held.close(), 200);
  await expect(runVocabulary(db, { directory: d, mode: 'reconcile', lockWaitMs: 5000 })).rejects.toBe(reached);
});

it('stops waiting when the run is aborted', async () => {
  const d = await setup();
  holdWriterLock(d);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 200);
  const start = Date.now();
  await expect(runVocabulary(db, { directory: d, mode: 'reconcile', lockWaitMs: 60000, signal: controller.signal })).resolves.toEqual({
    status: 'busy',
  });
  expect(Date.now() - start).toBeLessThan(5000);
});

it('reports busy after the bounded wait expires', async () => {
  const d = await setup();
  holdWriterLock(d);
  const start = Date.now();
  await expect(runVocabulary(db, { directory: d, mode: 'reconcile', lockWaitMs: 300 })).resolves.toEqual({ status: 'busy' });
  expect(Date.now() - start).toBeGreaterThanOrEqual(250);
});

it('does not report a corrupt lock database as busy', async () => {
  const d = await setup();
  await writeFile(join(d, 'runner-lock.sqlite'), 'not a sqlite database, padded past the header size '.repeat(4));
  await expect(runVocabulary(db, { directory: d, mode: 'reconcile', lockWaitMs: 100 })).rejects.toMatchObject({ errcode: 26 });
});

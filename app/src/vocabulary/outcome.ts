import { randomBytes } from 'node:crypto';
import { open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export type VocabularyMode = 'fast' | 'daily' | 'reconcile';
export interface VocabularyOutcome {
  schema: 'tag-vocabulary-outcome-v1';
  mode: VocabularyMode;
  /** published = finished a generation; paused/busy = exit 0/75 without finishing; failed = exit 1. */
  status: 'published' | 'paused' | 'busy' | 'failed';
  reason: string | null;
  finishedAt: string;
  elapsedMs: number | null;
  pendingTags: number | null;
  lastFullReconcileAt: string | null;
}

const text = (v: unknown) => (typeof v === 'string' ? v : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Bounded, non-sensitive summary of one run: no SQL, URLs, error messages or tag labels. */
export function vocabularyOutcome(mode: VocabularyMode, result: Record<string, unknown> | 'failed', now = new Date()): VocabularyOutcome {
  const r = result === 'failed' ? {} : result;
  const status =
    result === 'failed' ? 'failed' : r.status === 'published' || r.status === 'paused' || r.status === 'busy' ? r.status : 'failed';
  return {
    schema: 'tag-vocabulary-outcome-v1',
    mode,
    status,
    reason: status === 'paused' ? text(r.reason) : null,
    finishedAt: now.toISOString(),
    elapsedMs: num(r.elapsedMs),
    pendingTags: num(r.pendingTags),
    lastFullReconcileAt: text(r.lastFullReconcileAt),
  };
}

/** Atomically replace outcome-<mode>.json (0600) so monitoring can tell completed runs from paused or busy ones. */
export async function writeVocabularyOutcome(directory: string, outcome: VocabularyOutcome) {
  const target = join(directory, `outcome-${outcome.mode}.json`);
  const temporary = `${target}.${randomBytes(6).toString('hex')}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(`${JSON.stringify(outcome)}\n`);
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(temporary, target);
  } catch (e) {
    await unlink(temporary).catch(() => {});
    throw e;
  }
}

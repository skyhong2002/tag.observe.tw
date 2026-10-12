import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { PAGE_SIZE, VocabularySnapshots, vocabularyTerm } from '../app/src/vocabulary/snapshots.ts';
import { inspectVocabularySource, readVocabularySource, withVocabularySource } from '../app/src/vocabulary/source.ts';

const execute = process.argv.includes('--execute');
if (process.argv.slice(2).some((arg) => arg !== '--execute')) throw Error('Only --execute is supported.');
if (execute && (process.env.TAG_VOCABULARY_EXPORT_ENABLED !== 'true' || !process.env.TAG_VOCABULARY_EXPORT_DIR))
  throw Error('Vocabulary export is not explicitly enabled.');
const started = performance.now();
const home: Array<{ phase: string; status: number | null; ttfbMs: number | null }> = [];
async function sampleHome(phase: string) {
  const at = performance.now();
  try {
    const response = await fetch('https://tag.observe.tw/', { signal: AbortSignal.timeout(5000), redirect: 'error' });
    home.push({ phase, status: response.status, ttfbMs: Math.round(performance.now() - at) });
    await response.body?.cancel();
  } catch {
    home.push({ phase, status: null, ttfbMs: null });
  }
}
await sampleHome('before');
const stop = new AbortController();
const monitor = (async () => {
  while (!stop.signal.aborted) {
    await sampleHome('during');
    try {
      await delay(2000, undefined, { signal: stop.signal });
    } catch {
      break;
    }
  }
})();
try {
  const result = await withVocabularySource(async (db) => {
    const inspection = await inspectVocabularySource(db);
    if (inspection.indexedLabelsCapped) {
      process.exitCode = 2;
      return {
        status: 'blocked-capacity',
        inspection,
        termCount: null,
        pages: null,
        fileBytes: null,
        reason:
          'Indexed labels already exceed the producer/consumer capacity; review a scalable export and coordinate consumers before publication.',
      };
    }
    let queryMs = 0;
    const load = async () => {
      const at = performance.now();
      const rows = await readVocabularySource(db);
      queryMs = Math.round(performance.now() - at);
      return rows;
    };
    if (execute) {
      const manifest = await new VocabularySnapshots(process.env.TAG_VOCABULARY_EXPORT_DIR!).publish(load);
      return { status: 'published', inspection, queryMs, manifest };
    }
    const terms = (await load()).map(vocabularyTerm);
    // Measure encoded page payloads without writing or changing the current pointer.
    let fileBytes = 0;
    for (let i = 0; i < terms.length; i += PAGE_SIZE) fileBytes += Buffer.byteLength(JSON.stringify(terms.slice(i, i + PAGE_SIZE)) + '\n');
    return {
      status: 'preview',
      inspection,
      queryMs,
      termCount: terms.length,
      pages: Math.ceil(terms.length / PAGE_SIZE),
      termsPageBytes: fileBytes,
      noiseCount: terms.filter((t) => t.noise).length,
      noEqualCount: terms.filter((t) => t.noEqual).length,
    };
  });
  console.log(JSON.stringify({ mode: execute ? 'execute' : 'preview', ...result, elapsedMs: Math.round(performance.now() - started) }));
} catch {
  console.error(JSON.stringify({ status: 'failed', reason: 'Vocabulary source unavailable or invalid; current retained.' }));
  process.exitCode = 1;
} finally {
  stop.abort();
  await monitor;
  await sampleHome('after');
  console.log(JSON.stringify({ homeTtfb: home }));
}

import { probeHome, runVocabulary } from '../app/src/vocabulary/runner.ts';
import { aggregateRange, upperTag, withVocabularySource } from '../app/src/vocabulary/source.ts';

process.umask(0o077);
const execute = process.argv.includes('--execute');
if (process.argv.slice(2).some((arg) => !['--execute', '--fast', '--reconcile'].includes(arg)))
  throw Error('Only --execute, --fast and --reconcile are supported.');
if (execute && (process.env.TAG_VOCABULARY_EXPORT_ENABLED !== 'true' || !process.env.TAG_VOCABULARY_EXPORT_DIR))
  throw Error('Vocabulary export is not enabled.');
const signal = AbortSignal.any(
  ['SIGINT', 'SIGTERM'].map((event) => {
    const c = new AbortController();
    process.once(event, () => c.abort());
    return c.signal;
  }),
);
try {
  await withVocabularySource(async (db) => {
    if (!execute) {
      const before = await probeHome();
      if (before.status !== 200 || before.ttfbMs > 1000) {
        console.log(JSON.stringify({ mode: 'preview', status: 'paused', before }));
        return;
      }
      const start = performance.now();
      const during = probeHome();
      const upper = await upperTag(db, null, 500);
      const rows = upper === undefined ? [] : await aggregateRange(db, null, upper);
      console.log(
        JSON.stringify({
          mode: 'preview',
          status: 'bounded-sample',
          rows: rows.length,
          queryMs: Math.round(performance.now() - start),
          before,
          during: await during,
          after: await probeHome(),
          writes: false,
          complete: false,
        }),
      );
      return;
    }
    const result = await runVocabulary(db, {
      directory: process.env.TAG_VOCABULARY_EXPORT_DIR!,
      signal,
      mode: process.argv.includes('--fast') ? 'fast' : process.argv.includes('--reconcile') ? 'reconcile' : 'daily',
      maxDurationMs: process.env.TAG_VOCABULARY_MAX_DURATION_MS ? Number(process.env.TAG_VOCABULARY_MAX_DURATION_MS) : undefined,
      log: (value) => console.log(JSON.stringify(value)),
    });
    if (result.status === 'busy') {
      console.log(JSON.stringify(result));
      process.exitCode = 75;
    }
  });
} catch (error) {
  console.error(
    JSON.stringify({
      status: 'failed',
      reason: 'Vocabulary operation failed; checkpoint and current snapshot retained.',
      code: (error as { code?: string }).code,
      errno: (error as { errno?: number }).errno,
      message: (error as Error).message,
    }),
  );
  process.exitCode = 1;
}

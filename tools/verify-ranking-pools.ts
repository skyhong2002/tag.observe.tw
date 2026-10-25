// Anonymous GET-only receipt: run against the prepared backend, then public
// origin with the same exact cutoff. No GA/browser/DB/authentication is used.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { entryLine, type PoolEntry } from '../app/src/ranking-pools/core.ts';

const [origin, output, cutoff] = process.argv.slice(2);
if (!origin || !output || !cutoff) throw Error('usage: origin output-dir exact-UTC-cutoff');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const until = new Date(cutoff).toISOString();
const day = new Date(Date.parse(until) + 8 * 3600_000).toISOString().slice(0, 10);
const today = Date.parse(day + 'T00:00:00Z') - 8 * 3600_000;
const reports = [];
async function get(url: string) {
  const started = new Date().toISOString();
  const r = await fetch(url, { headers: { DNT: '1' }, signal: AbortSignal.timeout(40_000) });
  if (r.status !== 200) throw Error('API status ' + r.status + ' at ' + url);
  return {
    body: await r.json(),
    started,
    ended: new Date().toISOString(),
    status: r.status,
    headers: Object.fromEntries(['cache-control', 'content-encoding', 'strict-transport-security'].map((x) => [x, r.headers.get(x)])),
  };
}
for (const [name, start] of [
  ['today', today],
  ['seven-days', today - 6 * 86400_000],
] as const) {
  const parameters = new URLSearchParams({ category: 'news', since: new Date(start).toISOString(), until, gate: 'early', order: 'score' });
  const manifest = await get(origin + '/api/v1/ranking-pools?' + parameters);
  const m = manifest.body;
  if (!m.available || m.truncated || m.window.since !== new Date(start).toISOString() || m.window.until !== until)
    throw Error('manifest is not a complete requested window');
  const entries: PoolEntry[] = [];
  const hash = createHash('sha256');
  let cursor: string | null = null;
  const pages = [];
  do {
    const r = await get(origin + '/api/v1/ranking-pools/' + m.snapshotId + '?limit=500' + (cursor ? '&cursor=' + cursor : ''));
    if (r.body.snapshotId !== m.snapshotId || r.body.checksum.value !== m.checksum.value) throw Error('generation mismatch');
    for (const entry of r.body.entries) {
      if (
        entry.rank !== entries.length + 1 ||
        entry.articleCount !== Object.values(entry.media as Record<string, number>).reduce((n, c) => n + c, 0)
      )
        throw Error('rank/count mismatch');
      entries.push(entry);
      hash.update(entryLine(entry));
    }
    pages.push({ ...r, body: { ...r.body, entries: undefined } });
    cursor = r.body.nextCursor;
    if (pages.length > m.totalPages + 1) throw Error('pagination did not terminate');
  } while (cursor);
  if (entries.length !== m.eligibleTotal || hash.digest('hex') !== m.checksum.value) throw Error('complete checksum/count mismatch');
  const report = {
    name,
    manifest,
    pages,
    checksumVerified: true,
    total: entries.length,
    examples: Object.fromEntries(
      ['賴清德', '川普', 'AI', '投資', '柯文哲'].map((tag) => [tag, entries.find((e) => e.tag === tag) ?? null]),
    ),
  };
  fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(output, name + '-top40.json'), JSON.stringify(entries.slice(0, 40), null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  reports.push({
    name,
    snapshotId: m.snapshotId,
    eligibleTotal: m.eligibleTotal,
    checksum: m.checksum.value,
    elapsedMs: m.sourceCoverage.elapsedMs,
    pages: pages.length,
  });
}
fs.writeFileSync(
  path.join(output, 'summary.json'),
  JSON.stringify({ utc: new Date().toISOString(), origin, cutoff: until, reports }, null, 2) + '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(JSON.stringify(reports));

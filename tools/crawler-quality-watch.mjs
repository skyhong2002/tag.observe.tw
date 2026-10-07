// Read-only, finite sampling run. Evidence is not an automatic correctness verdict.
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const output = resolve(process.env.QUALITY_OUTPUT || 'artifacts/crawler-quality-20261007');
await mkdir(output, { recursive: true });
const statePath = `${output}/state.json`;
let state;
try {
  state = JSON.parse(await readFile(statePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const start = new Date();
  state = {
    start: start.toISOString(),
    end: new Date(+start + 86400000).toISOString(),
    cursor: new Date(+start - 3600000).toISOString(),
    rounds: [],
    seen: [],
  };
  await writeFile(statePath, JSON.stringify(state, null, 2));
}
if (state.completed) {
  console.log('Observation complete', state.end);
  process.exit(0);
}
const until = new Date(Math.min(Date.now(), +new Date(state.end)));
const release = await realpath('/home/deck/.local/share/tag-analysis/current');
const moduleAt = (path) => import(pathToFileURL(`${release}/app/src/${path}`).href);
const [{ createDb }, { extractArticle }, { extractAttributions }, { sourceByMedia }, { fetchText }] = await Promise.all([
  moduleAt('db/client.ts'),
  moduleAt('crawl/article.ts'),
  moduleAt('similarity/attribution.ts'),
  moduleAt('crawl/registry.ts'),
  moduleAt('crawl/fetch.ts'),
]);
const { pool, close } = createDb(undefined, { poolSize: 1 });
const round = {
  from: state.cursor,
  until: until.toISOString(),
  release,
  started: new Date().toISOString(),
  populations: {},
  samples: [],
  errors: [],
};
const roundDir = `${output}/${until.toISOString().replace(/[:.]/g, '-')}`;
await mkdir(roundDir, { recursive: true });
const json = (value) => (typeof value === 'string' ? JSON.parse(value) : value);
const hash = (value) => createHash('sha256').update(value).digest('hex');
try {
  // Acquisition time defines the population, even for archive stories or bad
  // future publication dates. A server-side budget bounds this read-only scan.
  const [rows] = await pool.execute(
    `SET STATEMENT max_statement_time=30 FOR SELECT id,media,content_fetched_at FROM articles
    WHERE source='own' AND content_fetched_at >= ? AND content_fetched_at < ? ORDER BY media,id`,
    [new Date(state.cursor), until],
  );
  const seen = new Set(state.seen);
  const groups = Map.groupBy(
    rows.filter((row) => !seen.has(row.id)),
    (row) => row.media,
  );
  const chosen = [];
  for (const [media, group] of groups) {
    round.populations[media] = group.length;
    for (let offset = 0; offset < group.length; offset += 100) {
      chosen.push(
        ...group
          .slice(offset, offset + 100)
          .sort((a, b) => hash(`${state.start}:${a.id}`).localeCompare(hash(`${state.start}:${b.id}`)))
          .slice(0, 2),
      );
    }
  }
  round.population = Object.values(round.populations).reduce((sum, count) => sum + count, 0);
  await writeFile(`${roundDir}/selection.json`, JSON.stringify({ ...round, selected: chosen }, null, 2));
  // Sequential fetches plus a per-request delay avoid competing with the crawler.
  for (const chosenRow of chosen) {
    const [records] = await pool.execute(
      `SELECT id,media,url,title,published_at,crawled_at,content_fetched_at,
      creator,authors,tags,canonical,image,description,summary,summary_source,body,body_status,body_source,attributions FROM articles WHERE id=?`,
      [chosenRow.id],
    );
    const stored = records[0];
    if (!stored) continue;
    for (const key of ['authors', 'tags', 'attributions']) stored[key] = json(stored[key]);
    const evidence = { stored, release, checked: new Date().toISOString(), flags: [], review: 'pending' };
    try {
      const spec = sourceByMedia(stored.media);
      const response = await fetchText(stored.url, { timeout: 15000, retries: 0, userAgent: spec?.article.userAgent });
      evidence.http = { status: response.status, url: response.url, contentType: response.contentType };
      await writeFile(`${roundDir}/${stored.id}.html.gz`, gzipSync(response.body));
      evidence.htmlSha256 = hash(response.body);
      if (response.status !== 200) evidence.flags.push(`http-${response.status}`);
      else {
        const parsed = extractArticle(response.body, response.url, spec?.article ?? {});
        const citations = extractAttributions(parsed.body ?? '', stored.media, parsed.provider);
        evidence.parsed = { ...parsed, attributions: citations };
        if (JSON.stringify(stored.authors ?? []) !== JSON.stringify(parsed.authors)) evidence.flags.push('authors-differ');
        if ((stored.summary ?? null) !== parsed.summary || (stored.summary_source ?? null) !== parsed.summarySource)
          evidence.flags.push('summary-differs');
        if (parsed.bodyStatus !== 'ok') evidence.flags.push(`body-${parsed.bodyStatus}`);
        if (!parsed.authors.length) evidence.flags.push('no-author-credit');
        if (!parsed.publishedAt) evidence.flags.push('no-parsed-publication');
        if (+new Date(stored.published_at) > +until + 3600000) evidence.flags.push('stored-future-publication');
        if (parsed.publishedAt && +parsed.publishedAt > +until + 3600000) evidence.flags.push('parsed-future-publication');
        const keys = (items) =>
          (items ?? [])
            .map((item) => item.media)
            .sort()
            .join(',');
        if (keys(stored.attributions) !== keys(citations)) evidence.flags.push('citations-differ');
        if (parsed.publishedAt && Math.abs(+new Date(stored.published_at) - +parsed.publishedAt) > 3600000)
          evidence.flags.push('date-diff-over-1h');
        if (parsed.authors.some((name) => /網頁設計|版權所有|https?:|lumiere|^admin$/i.test(name)))
          evidence.flags.push('suspicious-author');
        if (
          (parsed.body ?? '').length &&
          Math.abs((stored.body ?? '').length - parsed.body.length) > Math.max(200, parsed.body.length * 0.3)
        )
          evidence.flags.push('body-length-diff');
      }
    } catch (error) {
      evidence.error = error.message;
      evidence.flags.push('fetch-or-parse-error');
    }
    await writeFile(`${roundDir}/${stored.id}.json`, JSON.stringify(evidence, null, 2));
    round.samples.push({ id: stored.id, media: stored.media, flags: evidence.flags, file: `${roundDir}/${stored.id}.json` });
    console.log(JSON.stringify(round.samples.at(-1)));
    await new Promise((r) => setTimeout(r, 750));
  }
  // Only advance the cursor after every selected sample has a durable record.
  state.seen = [...new Set([...seen, ...rows.map((row) => row.id)])];
  state.cursor = until.toISOString();
  round.finished = new Date().toISOString();
  await writeFile(`${roundDir}/round.json`, JSON.stringify(round, null, 2));
  state.rounds.push({
    from: round.from,
    until: round.until,
    file: `${roundDir}/round.json`,
    samples: round.samples.length,
    population: round.population,
  });
  if (+until >= +new Date(state.end)) state.completed = true;
  await writeFile(`${statePath}.tmp`, JSON.stringify(state, null, 2));
  const { rename } = await import('node:fs/promises');
  await rename(`${statePath}.tmp`, statePath);
  console.log(
    JSON.stringify({
      round: roundDir,
      samples: round.samples.length,
      population: round.population,
      end: state.end,
      completed: !!state.completed,
    }),
  );
} finally {
  await close();
}

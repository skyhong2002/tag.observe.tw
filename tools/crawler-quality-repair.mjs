// Apply a reviewed, bounded metadata plan. No discovery or guessed corrections.
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { createDb } from '../app/src/db/client.ts';
import { syndicationMedia } from '../app/src/jobs/similarity-job.ts';
import { normalizeAttributions } from '../app/src/similarity/attribution.ts';
import { taipeiDay } from '../app/src/v1/event-archive.ts';

const columns = [
  'id',
  'media',
  'source',
  'url',
  'published_at',
  'title',
  'body',
  'body_status',
  'body_source',
  'content_fetched_at',
  'tags',
  'attributions',
];
const mutable = new Set(['title', 'body', 'body_status', 'body_source', 'tags', 'attributions']);
const jsonColumns = new Set(['tags', 'attributions']);
const plain = (value) => JSON.parse(JSON.stringify(value));

export function validatePlan(plan) {
  if (!Array.isArray(plan.rows) || !plan.rows.length || plan.rows.length > 100) throw Error('plan needs 1–100 reviewed rows');
  const ids = new Set();
  for (const row of plan.rows) {
    const before = row.before;
    if (!before || !Number.isSafeInteger(before.id) || before.id < 1 || ids.has(before.id)) throw Error('invalid/duplicate article ID');
    ids.add(before.id);
    if (!isDeepStrictEqual(Object.keys(before).sort(), [...columns].sort())) throw Error('incomplete original snapshot');
    if (before.source !== 'own' || !before.body || !['ok', 'short'].includes(before.body_status))
      throw Error('unavailable or expired original');
    if (!row.evidence || typeof row.evidence !== 'string') throw Error('review evidence required');
    const update = row.update;
    if (!update || !Object.keys(update).length || Object.keys(update).some((key) => !mutable.has(key)))
      throw Error('unapproved update field');
    if (
      'tags' in update &&
      (!Array.isArray(update.tags) || update.tags.some((tag) => typeof tag !== 'string' || !before.tags.includes(tag)))
    )
      throw Error('tag repair can only remove existing tags');
    if ('title' in update && (typeof update.title !== 'string' || !update.title.trim() || update.title.length > 512))
      throw Error('invalid title');
    if ('body' in update) {
      if (
        typeof update.body !== 'string' ||
        update.body.trim().length < 200 ||
        update.body_status !== 'ok' ||
        typeof update.body_source !== 'string'
      )
        throw Error('body repair requires verified complete text and provenance');
    } else if ('body_status' in update || 'body_source' in update) throw Error('body metadata requires body repair');
    if (
      'attributions' in update &&
      (!Array.isArray(update.attributions) ||
        update.attributions.some(
          (a) =>
            a?.kind !== 'explicit' ||
            ['media', 'name', 'country', 'countryCode', 'evidence'].some((key) => typeof a[key] !== 'string' || !a[key]),
        ))
    )
      throw Error('invalid citation');
  }
  return plan.rows;
}

/** @param {any} plan
 * @param {{apply?: boolean, backup?: string}} options */
export async function repairPlan(plan, { apply = false, backup } = {}) {
  const rows = validatePlan(plan);
  if (apply && !backup) throw Error('--apply requires durable --backup');
  const { pool, close } = createDb();
  const conn = await pool.getConnection();
  let locked = false;
  const results = [];
  try {
    if (apply) {
      const [lock] = await conn.query("SELECT GET_LOCK('similarity-index', 0) AS ok");
      if (Number(lock[0]?.ok) !== 1) throw Error('similarity index busy; retry later without restarting worker');
      locked = true;
    }
    for (const item of rows) {
      const id = item.before.id;
      await conn.beginTransaction();
      try {
        const [found] = await conn.query(`SELECT * FROM articles WHERE id=?${apply ? ' FOR UPDATE' : ''}`, [id]);
        if (!found.length || !isDeepStrictEqual(plain(Object.fromEntries(columns.map((key) => [key, found[0][key]]))), item.before))
          throw Error(`article ${id} changed since review; re-review before applying`);
        const [sketches] = await conn.query('SELECT * FROM article_sketches WHERE article_id=?', [id]);
        const [pairs] = await conn.query('SELECT * FROM similarity_pairs WHERE a_id=? OR b_id=?', [id, id]);
        const [citations] = await conn.query('SELECT * FROM article_citations WHERE article_id=?', [id]);
        const [tags] = await conn.query('SELECT * FROM article_tags WHERE article_id=?', [id]);
        const bodyChanged = 'body' in item.update;
        if (bodyChanged && pairs.length) throw Error(`article ${id} has similarity pairs; needs separately reviewed pair repair`);
        if (apply) {
          appendFileSync(
            backup,
            JSON.stringify({ savedAt: new Date(), before: found[0], update: item.update, sketches, pairs, citations, tags }) + '\n',
            { mode: 0o600, flush: true },
          );
          const entries = Object.entries(item.update);
          const sets = entries.map(([key]) => `${key}=?`);
          if (bodyChanged) sets.push('similarity_at=NULL');
          await conn.query(`UPDATE articles SET ${sets.join(',')} WHERE id=?`, [
            ...entries.map(([key, value]) => (jsonColumns.has(key) ? JSON.stringify(value) : value)),
            id,
          ]);
          if ('tags' in item.update) {
            for (const tag of item.before.tags.filter((tag) => !item.update.tags.includes(tag)))
              await conn.query('DELETE FROM article_tags WHERE article_id=? AND tag=?', [id, tag.trim()]);
          }
          if (bodyChanged) await conn.query('DELETE FROM article_sketches WHERE article_id=?', [id]);
          if ('attributions' in item.update || bodyChanged) {
            await conn.query('DELETE FROM article_citations WHERE article_id=?', [id]);
            if (!syndicationMedia.has(item.before.media)) {
              const cited = new Set();
              for (const attribution of normalizeAttributions(
                item.update.attributions ?? item.before.attributions ?? [],
                item.before.media,
              )) {
                const source = attribution.media.slice(0, 255);
                if (source === item.before.media || cited.has(source)) continue;
                cited.add(source);
                const published = new Date(item.before.published_at);
                await conn.query('INSERT INTO article_citations (article_id,source,media,published_at,day) VALUES (?,?,?,?,?)', [
                  id,
                  source,
                  item.before.media,
                  published,
                  taipeiDay(published),
                ]);
              }
            }
          }
          await conn.commit();
        } else await conn.rollback();
        results.push({ id, applied: apply, fields: Object.keys(item.update), removedSketches: bodyChanged ? sketches.length : 0 });
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    }
    return results;
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK('similarity-index')");
    conn.release();
    await close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: { plan: { type: 'string' }, apply: { type: 'boolean', default: false }, backup: { type: 'string' } },
  });
  if (!values.plan) throw Error('--plan is required; dry-run by default');
  console.log(JSON.stringify(await repairPlan(JSON.parse(readFileSync(values.plan, 'utf8')), values), null, 2));
}

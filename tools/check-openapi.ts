// Calls every documented endpoint's example (plus a few extra cases) and
// checks the JSON against the response schema in app/src/v1/openapi.ts.
//   node --env-file=.env tools/check-openapi.ts            in-process app on TAG_DB_URL (read-only queries)
//   node tools/check-openapi.ts https://tag.observe.tw     a running site

import { buildOpenApi, ENDPOINTS, examplePath } from '../app/src/v1/openapi.ts';
import type { Schema } from '../web/src/lib/openapi-fields.mts';

type Op = { get: { responses: { '200': { content: { 'application/json': { schema: Schema } } } } } };
const spec = buildOpenApi();
const schemas = spec.components.schemas as Record<string, Schema>;

const resolve = (s: Schema): Schema => (s.$ref ? resolve(schemas[s.$ref.split('/').pop() as string]) : s);
// allOf of object schemas → one object schema, so "undocumented field" sees all parts.
function flatten(s: Schema): Schema {
  const r = resolve(s);
  if (!r.allOf) return r;
  const parts = r.allOf.map(flatten);
  return {
    type: 'object',
    properties: Object.assign({}, ...parts.map((x: Schema) => x.properties)),
    required: parts.flatMap((x: Schema) => x.required ?? []),
  };
}

function check(value: unknown, s0: Schema, path: string, errors: string[]) {
  const s = flatten(s0);
  if (s.oneOf) {
    const results = s.oneOf.map((v: Schema) => {
      const e: string[] = [];
      check(value, v, path, e);
      return e;
    });
    if (!results.some((e: string[]) => e.length === 0)) errors.push(...results.sort((a: string[], b: string[]) => a.length - b.length)[0]);
    return;
  }
  if (s.type) {
    const types = [s.type].flat();
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
    const ok = types.includes(actual) || (actual === 'integer' && types.includes('number'));
    if (!ok) return errors.push(`${path}: expected ${types.join('|')}, got ${actual}`);
    if (value === null) return;
  }
  if (s.enum && !s.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (s.format === 'date-time' && (typeof value !== 'string' || Number.isNaN(Date.parse(value))))
    errors.push(`${path}: not a date-time: ${value}`);
  if (Array.isArray(value)) {
    if (s.prefixItems) for (const [i, p] of (s.prefixItems as Schema[]).entries()) check(value[i], p, `${path}[${i}]`, errors);
    else if (s.items) for (const [i, v] of value.slice(0, 50).entries()) check(v, s.items, `${path}[${i}]`, errors);
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of s.required ?? []) if (!(k in o)) errors.push(`${path}.${k}: missing`);
    for (const [k, v] of Object.entries(o)) {
      if (s.properties?.[k]) check(v, s.properties[k], `${path}.${k}`, errors);
      else if (s.additionalProperties) check(v, s.additionalProperties, `${path}.${k}`, errors);
      else if (s.properties) errors.push(`${path}.${k}: undocumented field`);
    }
  }
}

const base = process.argv[2];
let close = async () => {};
let get: (url: string) => Promise<{ status: number; body: unknown }>;
if (base) {
  get = async (url) => {
    const r = await fetch(base + url);
    return { status: r.status, body: await r.json() };
  };
} else {
  const { buildApp } = await import('../app/src/app.js');
  const app = await buildApp({ uiOrigin: 'http://127.0.0.1:9', tagDbUrl: process.env.TAG_DB_URL, rateLimit: false });
  close = () => app.close();
  get = async (url) => {
    const r = await app.inject(url);
    return { status: r.statusCode, body: r.json() };
  };
}

const cases: Array<[string, string]> = ENDPOINTS.map((e) => [e.path, examplePath(e)]);
// Real ids for the event endpoints, plus the other shape of /topics.
const events = (await get('/api/v1/events?limit=1')).body as { events: Array<{ threadId: number }> };
const id = events.events[0]?.threadId;
if (id)
  for (const sub of ['', '/series', '/coverage']) cases.push([`/api/v1/events/threads/{id}${sub}`, `/api/v1/events/threads/${id}${sub}`]);
cases.push(['/api/v1/topics', '/api/v1/topics?media=pts&limit=5']);
cases.push(['/api/v1/articles', '/api/v1/articles?category=blue&limit=5']);
cases.push(['/api/v1/articles', '/api/v1/articles?tag=%E8%B3%B4%E6%B8%85%E5%BE%B7&hours=168&limit=3']);
cases.push(['/api/v1/ranking', '/api/v1/ranking?order=score&limit=5']);

let failed = 0;
for (const [path, url] of cases) {
  const { status, body } = await get(url);
  const errors: string[] = [];
  if (status !== 200) errors.push(`status ${status}: ${JSON.stringify(body).slice(0, 200)}`);
  else {
    const op = (spec.paths as Record<string, Op>)[path].get;
    check(body, op.responses['200'].content['application/json'].schema, '$', errors);
  }
  const uniq = [...new Set(errors)];
  console.log(`${uniq.length ? 'FAIL' : 'ok  '} ${url}${uniq.length ? `\n  ${uniq.slice(0, 10).join('\n  ')}` : ''}`);
  if (uniq.length) failed++;
}
// Paging: the second page continues strictly after the first.
const p1 = (await get('/api/v1/articles?limit=3&hours=6')).body as { nextCursor: string | null; articles: Array<{ id: number }> };
if (p1.nextCursor) {
  const p2 = (await get(`/api/v1/articles?limit=3&hours=6&cursor=${p1.nextCursor}`)).body as { articles: Array<{ id: number }> };
  const overlap = p2.articles.filter((a) => p1.articles.some((b) => b.id === a.id));
  console.log(
    `${overlap.length ? 'FAIL' : 'ok  '} articles cursor paging (${p1.articles.length}+${p2.articles.length}, overlap ${overlap.length})`,
  );
  if (overlap.length) failed++;
}
await close();
process.exit(failed ? 1 : 0);

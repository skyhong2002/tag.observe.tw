// Snapshot API and front door for design-review captures. Nothing here touches
// a database, a worker or a production service.
//
//   node fixture-api.mjs --snapshot DIR --api-port 18560 --front-port 18561 --next http://127.0.0.1:18562 [--record]
//
// API port (the Next server's TAG_API_ORIGIN) and front port (the browser)
// answer /api/* and /auth/* from the snapshot; the front port proxies every
// other path to the Next server, the way the production gateway does.
//
// --record: a snapshot miss is fetched once from the public API
// (https://tag.observe.tw), one request at a time and at most one every
// 1.3 s (the public limit is 60 a minute), then saved. Without it a miss is a
// 404, listed at GET /__fixture/misses. Only GET is recorded or replayed.
//
// GET /__fixture?data=normal|empty|error|loading&session=out|in switches the
// state for every following request; GET /__fixture/stats lists counts.
//   empty   every array in a response is emptied and every count zeroed,
//           except the outlet list, categories and visuals the site frame needs
//   error   every /api/* answers 500 (500 is not retried by web/src/lib/api.ts)
//   loading every /api/* waits 25 s first
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return pairs;
  }, []),
);
const SNAPSHOT = args.snapshot;
const RECORD = !!args.record;
const UPSTREAM = 'https://tag.observe.tw';
const NEXT = new URL(args.next ?? 'http://127.0.0.1:18562');
mkdirSync(join(SNAPSHOT, 'bodies'), { recursive: true });
const indexFile = join(SNAPSHOT, 'index.json');
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {};
const reader = existsSync(join(SNAPSHOT, 'reader.json')) ? JSON.parse(readFileSync(join(SNAPSHOT, 'reader.json'), 'utf8')) : {};
const state = { data: 'normal', session: 'out' };
// snapshot-aliases.json: keys missing from the recording, answered from other recorded bodies (see its _note).
const aliasFile = new URL('./snapshot-aliases.json', import.meta.url);
let aliasMap;
const aliases = () => (aliasMap ??= new Map(
  Object.entries(existsSync(aliasFile) ? JSON.parse(readFileSync(aliasFile, 'utf8')) : {})
    .filter(([key]) => key.startsWith('/'))
    .map(([key, rule]) => [keyOf(key), { ...rule, from: keyOf(rule.from), facetsFrom: rule.facetsFrom && keyOf(rule.facetsFrom) }]),
));
function fromAlias(key) {
  const rule = aliases().get(key);
  if (!rule || !index[rule.from]) return null;
  let body = JSON.parse(readFileSync(fileOf(rule.from), 'utf8'));
  if (rule.facetsFrom && index[rule.facetsFrom]) body.facets = JSON.parse(readFileSync(fileOf(rule.facetsFrom), 'utf8')).facets;
  // An article search with no match: no rows, no cursor, every facet zero.
  if (rule.empty) body = { ...body, count: 0, articles: [], nextCursor: null, facets: { total: 0, camps: { blue: 0, green: 0, other: 0 }, media: [] } };
  return { status: 200, type: 'application/json', body: Buffer.from(JSON.stringify(body)) };
}
const counts = new Map();
const misses = new Set();
const KEEP_IN_EMPTY = /^\/api\/v1\/(media|categories|tag-avatars|tag-visuals|tags\/[^/]+\/(visual|avatar|person))$/;

const keyOf = (url) => {
  const u = new URL(url, 'http://x');
  const params = [...u.searchParams].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  // Next's own cache-busting and the capture's tracking params never reach the API key.
  const q = new URLSearchParams(params.filter(([k]) => k !== '_rsc')).toString();
  return u.pathname.replace(/\/$/, '') + (q ? `?${q}` : '');
};
const fileOf = (key) => join(SNAPSHOT, 'bodies', createHash('sha256').update(key).digest('hex').slice(0, 24));

let chain = Promise.resolve();
let lastUpstream = 0;
function record(key) {
  const run = chain.then(async () => {
    const wait = lastUpstream + 1300 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastUpstream = Date.now();
    const response = await fetch(UPSTREAM + key, { headers: { 'user-agent': 'design-review-snapshot/1 (one-time read)', accept: 'application/json' } });
    const body = Buffer.from(await response.arrayBuffer());
    const entry = { status: response.status, type: response.headers.get('content-type') ?? 'application/json', at: new Date().toISOString() };
    writeFileSync(fileOf(key), body);
    index[key] = entry;
    writeFileSync(indexFile, JSON.stringify(index, null, 1));
    console.log('recorded', entry.status, key);
    return { ...entry, body };
  });
  chain = run.catch(() => {});
  return run;
}

function emptied(value, key) {
  if (Array.isArray(value)) return [];
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'number' && /count|total|articles|media$|matched/i.test(k)) out[k] = 0;
      else if (v && typeof v === 'object' && !Array.isArray(v) && /^(media|byMedia|counts|outlets|series)$/.test(k)) out[k] = {};
      else out[k] = emptied(v, key);
    }
    return out;
  }
  return value;
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function readerRoute(path, res) {
  const signedIn = state.session === 'in';
  if (path === '/auth/me') return send(res, 200, { enabled: true, user: signedIn ? reader.user : null });
  if (!signedIn) return send(res, 401, { error: '請先登入' });
  const name = path.replace(/^\/auth\/me\//, '').replace(/\/$/, '');
  if (state.data === 'empty' && reader[name] !== undefined && ['follows', 'saves', 'feed', 'suggestions'].includes(name)) return send(res, 200, emptied(reader[name]));
  if (reader[name] !== undefined) return send(res, 200, reader[name]);
  return send(res, 404, { error: 'not in fixture' });
}

async function apiRoute(req, res) {
  const key = keyOf(req.url);
  counts.set(key, (counts.get(key) ?? 0) + 1);
  const path = key.split('?')[0];
  if (path.startsWith('/auth/')) return readerRoute(path, res);
  if (req.method !== 'GET') return send(res, 405, { error: 'read-only fixture' });
  if (state.data === 'error') return send(res, 500, { error: 'Internal Server Error' });
  if (state.data === 'loading') await new Promise((r) => setTimeout(r, 25000));
  let entry = (index[key] && { ...index[key], body: readFileSync(fileOf(key)) }) || fromAlias(key);
  if (!entry) {
    if (!RECORD) {
      misses.add(key);
      appendFileSync(join(SNAPSHOT, 'misses.log'), `${new Date().toISOString()} ${key}\n`);
      return send(res, 404, { error: 'not in snapshot', key });
    }
    entry = await record(key).catch((error) => ({ status: 502, type: 'application/json', body: JSON.stringify({ error: String(error) }) }));
  }
  if (state.data === 'empty' && entry.status === 200 && entry.type.includes('json') && !KEEP_IN_EMPTY.test(path)) {
    return send(res, 200, emptied(JSON.parse(entry.body.toString('utf8')), key));
  }
  return send(res, entry.status, entry.body, entry.type);
}

function control(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__fixture') {
    for (const k of ['data', 'session']) if (u.searchParams.has(k)) state[k] = u.searchParams.get(k);
    return send(res, 200, state);
  }
  if (u.pathname === '/__fixture/stats') return send(res, 200, { state, counts: Object.fromEntries(counts) });
  if (u.pathname === '/__fixture/misses') return send(res, 200, [...misses]);
  if (u.pathname === '/__fixture/reset') {
    counts.clear();
    misses.clear();
    return send(res, 200, { ok: true });
  }
  return false;
}



createServer((req, res) => {
  if (req.url.startsWith('/__fixture')) return control(req, res);
  apiRoute(req, res).catch((e) => send(res, 500, { error: String(e) }));
}).listen(Number(args['api-port'] ?? 18560), '127.0.0.1');

createServer((req, res) => {
  const path = req.url.split('?')[0];
  if (path.startsWith('/__fixture')) return control(req, res);
  // /api/v1/... and /auth/... as the gateway routes them; Next's own pages
  // under /api/ (/api/ and /api/status/, with the trailing slash) stay with Next.
  if (path.startsWith('/auth/') || /^\/api\/v1\/./.test(path) || path === '/api/status') {
    return apiRoute(req, res).catch((e) => send(res, 500, { error: String(e) }));
  }
  const upstream = httpRequest(
    { host: NEXT.hostname, port: NEXT.port, method: req.method, path: req.url, headers: { ...req.headers, host: `${NEXT.hostname}:${NEXT.port}` } },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on('error', (e) => send(res, 502, { error: String(e) }));
  req.pipe(upstream);
}).listen(Number(args['front-port'] ?? 18561), args.host ?? '127.0.0.1');

console.log(`fixture api :${args['api-port'] ?? 18560} front :${args['front-port'] ?? 18561} -> ${NEXT.href} ${RECORD ? 'RECORD' : 'replay'} (${Object.keys(index).length} keys)`);

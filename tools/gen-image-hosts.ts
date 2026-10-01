// Builds web/src/lib/image-hosts.json: the only hosts the Next image optimizer
// may fetch from (otherwise /_next/image is an open proxy for any public URL).
// Sources: image URLs we actually store (articles, topics) + media favicons
// + each topic outlet's fallback cover.
// Media-owned hosts are allowed by registrable domain (**.setn.com); shared CDNs
// are allowed by exact host only, and googleapis by observed bucket path.
import { readFile, writeFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { TOPIC_RULES } from '../app/src/crawl/topics.ts';
import { createDb } from '../app/src/db/client.ts';

const TWO_LEVEL = new Set(['com.tw', 'org.tw', 'net.tw', 'gov.tw', 'edu.tw', 'idv.tw', 'co.uk', 'com.hk', 'co.jp', 'com.cn', 'com.sg']);
const SHARED = [
  'cloudfront.net',
  'googleapis.com',
  'wp.com',
  'staticflickr.com',
  'flickr.com',
  'hearstapps.com',
  'youtube.com',
  'ytimg.com',
  'w.org',
  'loom-app.com',
  'inkmaginecms.com',
  'googleusercontent.com',
  'amazonaws.com',
  'imgur.com',
  'fbcdn.net',
  'azureedge.net',
  'facebook.com',
  // Anyone can publish a subdomain here.
  'pages.dev',
  'ghost.io',
];
// Path-style object stores: any bucket shares the host, so allow host + bucket.
const PATH_STYLE = (host: string) => host === 'storage.googleapis.com' || /^s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host);
export function registrable(host: string): string {
  const parts = host.toLowerCase().split('.');
  const last2 = parts.slice(-2).join('.');
  return parts.length > 2 && TWO_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
}

const { db, close } = createDb();
try {
  const [rows] = (await db.execute(
    sql`SELECT image FROM articles WHERE image LIKE 'http%' UNION SELECT image FROM topics WHERE image LIKE 'http%'`,
  )) as unknown as [Array<{ image: string }>];
  const favicons = Object.values(
    JSON.parse(await readFile('app/data/favicon-catalog.json', 'utf8')) as Record<string, { icon: string | null }>,
  )
    .map((v) => v.icon)
    .filter((u): u is string => !!u)
    .map((u) => u.replace(/^http:\/\//, 'https://'));
  const https = new Set<string>(),
    http = new Set<string>(),
    buckets = new Set<string>(); // buckets: 'host/bucket'
  for (const raw of [...rows.map((r) => r.image), ...favicons, ...TOPIC_RULES.map((r) => r.fallbackImage)]) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) continue;
    const reg = registrable(u.hostname);
    const shared = SHARED.includes(reg);
    if (PATH_STYLE(u.hostname)) {
      const b = u.pathname.split('/')[1];
      if (b) buckets.add(`${u.hostname}/${b}`);
      continue;
    }
    const target = u.protocol === 'http:' ? http : https;
    if (shared) target.add(u.hostname);
    else {
      target.add(reg);
      target.add('**.' + reg);
    }
  }
  const out = { generatedAt: new Date().toISOString(), https: [...https].sort(), http: [...http].sort(), pathBuckets: [...buckets].sort() };
  await writeFile('web/src/lib/image-hosts.json', JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ https: out.https.length, http: out.http.length, buckets: out.pathBuckets.length }));
} finally {
  await close();
}

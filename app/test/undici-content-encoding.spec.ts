import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));

// undici 7.18.0-7.30.0 and 8.0.0-8.12.1 fetch() reject a response with more
// than five content codings but leave its body stream without an error
// listener; an early close then throws on that stream and kills the process
// even though the caller caught the rejection (GHSA-xjj6-f33q-929c). The
// crawler fetches outside sites with the root undici 8, and @fastify/reply-from
// and cheerio each bundle their own undici 7, so check every copy that loads here.
const copies: [string, number[]][] = [
  ['node_modules/undici', [8, 12, 2]],
  ['node_modules/@fastify/reply-from/node_modules/undici', [7, 30, 1]],
  ['node_modules/cheerio/node_modules/undici', [7, 30, 1]],
];

const survivor = `
const { createServer } = require('node:http');
const { fetch } = require(process.argv[1]);
const server = createServer((req, res) => {
  res.socket.end('HTTP/1.1 200 OK\\r\\nContent-Encoding: gzip, gzip, gzip, gzip, gzip, gzip\\r\\nContent-Length: 100\\r\\n\\r\\n');
}).listen(0, '127.0.0.1', async () => {
  const error = await fetch('http://127.0.0.1:' + server.address().port + '/').then((r) => r.arrayBuffer(), (e) => e);
  setTimeout(() => { server.close(); console.log('alive ' + (error.cause?.message ?? error.message)); }, 300);
});
`;

it.each(copies)('%s survives a response with too many content codings', (path, floor) => {
  const [major, minor, patch] = lock.packages[path].version.split('.').map(Number);
  const patched = major !== floor[0] || minor > floor[1] || (minor === floor[1] && patch >= floor[2]);
  expect(patched, `${path} ${lock.packages[path].version}`).toBe(true);
  const output = execFileSync(process.execPath, ['-e', survivor, new URL(path, root).pathname], { encoding: 'utf8' });
  expect(output).toMatch(/^alive too many content-encodings/);
});

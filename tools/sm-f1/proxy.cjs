// Pre-launch gate: the only possible upstream is this exact anonymous candidate.
const http = require('node:http');
const ORIGIN = 'http://127.0.0.1:18199';
function admittedTarget(url, method) {
  let u; try { u = new URL(url); } catch { return null; }
  return u.origin === ORIGIN && !u.username && !u.password && !u.hash &&
    ['GET','HEAD'].includes(method) && /^http:\/\/127\.0\.0\.1:18199(?:\/|$)/.test(url) ? u : null;
}
function stripHop(headers) {
  const out = {...headers};
  for(const token of String(out.connection || '').split(',')) delete out[token.trim().toLowerCase()];
  for(const k of ['connection','proxy-connection','content-length','transfer-encoding','upgrade','keep-alive','te','trailer','proxy-authorization','proxy-authenticate']) delete out[k];
  return out;
}
async function startProxy(log) {
  const sockets = new Set(), upstreams = new Set();
  const stats = { admitted: 0, denied: 0, googleOutgoing: 0 };
  let failed = false, closing;
  const stop = () => { for (const s of [...sockets, ...upstreams]) s.destroy(); };
  const emit = value => { try { log(value); return true; } catch { failed = true; stop(); return false; } };
  const server = http.createServer((req, res) => {
    const u = admittedTarget(req.url, req.method);
    if (failed) { req.socket.destroy(); return; }
    if (!u) {
      stats.denied++; if (!emit({ event: 'denied', method: req.method })) return;
      req.resume(); res.writeHead(403, { connection: 'close' }); res.end(); return;
    }
    const headers = { ...stripHop(req.headers), host: '127.0.0.1:18199', dnt: '1' };
    for (const name of Object.keys(headers)) if (/cookie|authorization|token|api[-_]key|fixture[-_]actor/i.test(name)) delete headers[name];
    stats.admitted++; if (!emit({ event: 'admitted', method: req.method })) return;
    const up = http.request(u, { method: req.method, headers }, incoming => {
      if (!emit({ event: 'response', status: incoming.statusCode })) { incoming.destroy(); return; }
      const out = stripHop(incoming.headers); delete out['set-cookie'];
      res.writeHead(incoming.statusCode, out); incoming.pipe(res); incoming.on('error', () => res.destroy());
    });
    upstreams.add(up); up.once('close', () => upstreams.delete(up));
    const timer = setTimeout(() => up.destroy(), 10000);
    res.once('close', () => { clearTimeout(timer); up.destroy(); });
    up.on('error', () => { emit({ event: 'upstream-failed' }); if (!res.headersSent) res.writeHead(502); res.end(); });
    req.resume(); up.end();
  });
  for (const event of ['connect', 'upgrade']) server.on(event, (req, socket) => {
    stats.denied++; if (!emit({ event: 'denied', method: event })) return;
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  });
  server.on('connection', s => { sockets.add(s); s.setTimeout(10000, () => s.destroy()); s.once('close', () => sockets.delete(s)); });
  server.headersTimeout = 10000; server.requestTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { stats, get failed() { return failed; }, address: 'http://127.0.0.1:' + server.address().port,
    close() { if (!closing) { stop(); closing = new Promise((ok, fail) => server.close(e => e ? fail(e) : ok())); } return closing; } };
}
module.exports = { startProxy, ORIGIN, admittedTarget, stripHop };

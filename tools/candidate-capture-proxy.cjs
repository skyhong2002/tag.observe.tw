// Optional pre-launch HTTP gate for a single local candidate origin.
const http = require('node:http');

async function createCandidateCaptureProxy(candidateOrigin, { log = () => {}, timeoutMs = 10_000 } = {}) {
  const candidate = new URL(candidateOrigin);
  if (
    candidate.protocol !== 'http:' ||
    candidate.username ||
    candidate.password ||
    candidate.pathname !== '/' ||
    candidate.search ||
    candidate.hash ||
    candidateOrigin !== candidate.origin
  )
    throw new Error('Supply exactly one canonical HTTP candidate origin.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid proxy timeout.');
  const sockets = new Set();
  const upstreams = new Set();
  let failed = false;
  let closed = false;
  let closing;
  const stopConnections = () => {
    for (const upstream of upstreams) upstream.destroy();
    for (const socket of sockets) socket.destroy();
  };
  const record = (event, method, status) => {
    if (failed || closed) return false;
    // Do not include request paths, headers, cookies, credentials, or foreign URLs.
    try {
      log({ event, method: ['GET', 'HEAD', 'CONNECT'].includes(method) ? method : 'OTHER', status });
      return true;
    } catch {
      failed = true;
      stopConnections();
      return false;
    }
  };
  const server = http.createServer((request, response) => {
    const deny = (status = 403) => {
      if (!record('denied', request.method, status)) {
        request.socket.destroy();
        return;
      }
      request.resume();
      response.writeHead(status, { connection: 'close' });
      response.end();
    };
    if (failed || closed) {
      request.socket.destroy();
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) return deny();
    let target;
    try {
      target = new URL(request.url);
      const authority = /^http:\/\/([^/?#]+)(?:[/?#]|$)/.exec(request.url)?.[1];
      if (authority !== candidate.host) return deny();
      if (target.origin !== candidate.origin || target.protocol !== 'http:' || target.username || target.password || target.hash)
        return deny();
    } catch {
      return deny();
    }
    const headers = { ...request.headers };
    for (const token of String(headers.connection || '').split(',')) delete headers[token.trim().toLowerCase()];
    for (const name of [
      'connection',
      'proxy-connection',
      'proxy-authorization',
      'proxy-authenticate',
      'keep-alive',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
      'content-length',
    ])
      delete headers[name];
    headers.host = candidate.host;
    if (!record('admitted', request.method, 0)) return;
    const upstream = http.request(target, { method: request.method, headers }, (incoming) => {
      const outgoing = { ...incoming.headers };
      for (const token of String(outgoing.connection || '').split(',')) delete outgoing[token.trim().toLowerCase()];
      for (const name of [
        'connection',
        'proxy-connection',
        'proxy-authenticate',
        'keep-alive',
        'te',
        'trailer',
        'transfer-encoding',
        'upgrade',
      ])
        delete outgoing[name];
      if (!record('forwarded', request.method, incoming.statusCode)) {
        incoming.destroy();
        return;
      }
      response.writeHead(incoming.statusCode, outgoing);
      incoming.pipe(response);
      incoming.on('error', () => response.destroy());
    });
    upstreams.add(upstream);
    upstream.on('close', () => upstreams.delete(upstream));
    // Bound the entire exchange, including streaming bodies; no response buffering.
    const timer = setTimeout(() => upstream.destroy(new Error('Proxy timeout')), timeoutMs);
    timer.unref();
    response.on('close', () => {
      clearTimeout(timer);
      upstream.destroy();
    });
    upstream.on('error', () => {
      if (!record('failed', request.method, 502)) return;
      if (!response.headersSent) response.writeHead(502, { connection: 'close' });
      response.end();
    });
    request.resume();
    upstream.end();
  });
  server.on('connect', (request, socket) => {
    if (!record('denied', 'CONNECT', 403)) {
      socket.destroy();
      return;
    }
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  });
  server.on('upgrade', (request, socket) => {
    if (!record('denied', request.method, 403)) {
      socket.destroy();
      return;
    }
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  });
  server.on('connection', (socket) => {
    if (failed || closed) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.setTimeout(timeoutMs, () => socket.destroy());
    socket.on('close', () => sockets.delete(socket));
  });
  server.headersTimeout = Math.min(timeoutMs, 60_000);
  server.requestTimeout = timeoutMs;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    address: `http://127.0.0.1:${server.address().port}`,
    get failed() {
      return failed;
    },
    get closed() {
      return closed;
    },
    close() {
      if (closing) return closing;
      closed = true;
      stopConnections();
      closing = new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      return closing;
    },
  };
}

module.exports = { createCandidateCaptureProxy };

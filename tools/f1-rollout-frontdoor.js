// Deployment wrapper: reviewed separately from immutable application artifacts.
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
export function mayFallback(method, rawUrl, status, headers = {}) {
  if (Object.keys(headers).some(key => ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch'].includes(key.toLowerCase()))) return false;
  if (method !== 'GET' || status !== 404 || !rawUrl.startsWith('/_next/static/')) return false;
  try { const url = new URL(rawUrl, 'http://local'); const pathname = decodeURIComponent(url.pathname); return !url.searchParams.has('_rsc') && pathname.startsWith('/_next/static/') && !pathname.split('/').some(part => part === '..') && !/[\\\u0000]/.test(pathname); } catch { return false; }
}
export function stripHopHeaders(headers) {
  const blocked = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
  for (const [key,value] of Object.entries(headers)) if (key.toLowerCase() === 'connection') for (const token of String(value).split(',')) blocked.add(token.trim().toLowerCase());
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !blocked.has(key.toLowerCase())));
}
export function createFrontdoor({ newPort = 18192, oldPort = 18132 } = {}) {
  return http.createServer((req, res) => {
    let upstream, responseStream;
    let failed = false;
    const fail = () => { if (failed) return; failed = true; upstream?.destroy(); responseStream?.destroy(); if (!res.headersSent) { res.writeHead(502); res.end(); } else res.destroy(); };
    req.on('error', fail); req.on('aborted', fail);
    const send = (port, fallback = false) => {
      // Old pool receives only a cookie/auth-free immutable GET, never API/RSC.
      const headers = fallback ? {host:`127.0.0.1:${oldPort}`,accept:'*/*'} : {...stripHopHeaders(req.headers),host:`127.0.0.1:${newPort}`};
      upstream = http.request({hostname:'127.0.0.1',port,path:req.url,method:req.method,headers}, response => {
        responseStream = response; response.on('error', fail); response.on('aborted', fail);
        if (!fallback && mayFallback(req.method, req.url, response.statusCode, req.headers)) { response.resume(); send(oldPort, true); return; }
        res.writeHead(response.statusCode, stripHopHeaders(response.headers)); response.pipe(res);
      });
      upstream.setTimeout(30000, () => upstream.destroy()); upstream.on('error', fail);
      if (fallback) upstream.end(); else req.pipe(upstream);
    };
    res.on('close', () => upstream?.destroy()); send(newPort);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) createFrontdoor().listen(18197, '127.0.0.1');

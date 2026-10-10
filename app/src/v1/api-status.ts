import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';

type Availability = 'ok' | 'unavailable';
interface Endpoint {
  path: string;
  method?: string;
  summary: string;
}

// Bounded metadata request only. No retrieval job, download or database write.
export async function nearlineAvailability(): Promise<Availability> {
  const origin = process.env.TAG_NEARLINE_API_ORIGIN;
  const tokenFile = process.env.TAG_NEARLINE_TOKEN_FILE;
  if (!origin || !tokenFile) return 'unavailable';
  try {
    const token = (await readFile(tokenFile, 'utf8')).trim();
    const response = await fetch(new URL('/status', origin), {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
      redirect: 'error',
    });
    // Discard internal index/status data: only HTTP availability is public.
    await response.body?.cancel();
    return response.ok ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]!,
  );

export function registerApiStatus(app: FastifyInstance, catalog: Endpoint[], checkNearline = nearlineAvailability) {
  app.get('/api/status', async (request, reply) => {
    reply.header('cache-control', 'no-store').header('vary', 'Accept');
    const nearline = await checkNearline();
    const endpoints = catalog.map(({ path, method, summary }) => ({ path, method: method ?? 'GET', description: summary }));
    const body = {
      status: nearline === 'ok' ? 'ok' : 'degraded',
      scope: 'api_availability',
      description: 'API 服務回應狀態與端點用途；個別資料查詢或取回作業的結果請參閱各端點。',
      services: [
        { name: 'API', status: 'ok', description: '提供新聞、關鍵字、事件與媒體資料。' },
        { name: 'Nearline', status: nearline, description: '查詢封存資料、提交取回作業及讀取結果。' },
      ],
      endpoints,
    };
    if (!request.headers.accept?.includes('text/html')) return body;
    const label = (status: string) => (status === 'ok' ? '正常' : '無法使用');
    return reply.type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>API 狀態 · 新文易數</title><style>
body{font:16px/1.6 system-ui,sans-serif;max-width:1080px;margin:40px auto;padding:0 20px;color:#222}
a{color:#1765aa}table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}
code{overflow-wrap:anywhere}.services{display:flex;gap:24px;flex-wrap:wrap}.services p{border:1px solid #ddd;border-radius:8px;padding:16px}
@media(prefers-color-scheme:dark){body{background:#171717;color:#eee}a{color:#8dc4ff}th,td,.services p{border-color:#444}}
</style><h1>API 狀態</h1><p>${escapeHtml(body.description)}</p>
<div class="services">${body.services.map((s) => `<p><strong>${s.name}：${label(s.status)}</strong><br>${escapeHtml(s.description)}</p>`).join('')}</div>
<p><a href="/api/">API 文件</a> · <a href="/api/v1/openapi.json">OpenAPI</a> · <a href="/api/status">重新整理狀態</a></p>
<h2>端點用途</h2><table><thead><tr><th>方法</th><th>端點</th><th>用途</th></tr></thead><tbody>
${endpoints.map((e) => `<tr><td>${escapeHtml(e.method)}</td><td><code>${escapeHtml(e.path)}</code></td><td>${escapeHtml(e.description)}</td></tr>`).join('')}
</tbody></table></html>`);
  });
}

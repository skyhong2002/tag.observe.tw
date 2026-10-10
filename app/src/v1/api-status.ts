import { readFile } from 'node:fs/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export type StatusPageRenderer = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

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

export function registerApiStatus(
  app: FastifyInstance,
  catalog: Endpoint[],
  checkNearline = nearlineAvailability,
  renderPage?: StatusPageRenderer,
) {
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    // Next renders the browser page inside the shared site layout. Its server
    // fetch explicitly requests JSON, so only that request probes Nearline.
    if (renderPage && (request.headers.accept?.includes('text/html') || request.headers.rsc === '1')) {
      return renderPage(request, reply);
    }
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
    return body;
  };
  const onSend = async (_request: FastifyRequest, reply: FastifyReply) => {
    // Retain Next's navigation-related Vary headers along with negotiation.
    const vary = new Set(
      String(reply.getHeader('vary') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    vary.add('Accept');
    vary.add('RSC');
    reply.header('cache-control', 'no-store').header('vary', [...vary].join(', '));
  };
  app.get('/api/status', { onSend }, handler);
  // The site uses trailing slashes; API callers can use either spelling.
  app.route({ method: 'GET', url: '/api/status/', onSend, handler });
}

// Runs once when the Next.js server starts (see node_modules/next/dist/docs,
// file-conventions/instrumentation). Records request diagnostics for #36.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { subscribe } = await import('node:diagnostics_channel');
  const { RequestLog } = await import('./lib/request-log.mts');
  const requests = new RequestLog();
  type Start = {
    request: { url?: string };
    response: { statusCode: number; writableFinished: boolean; once(event: 'close', listener: () => void): unknown };
  };
  subscribe('http.server.request.start', (message) => {
    const { request, response } = message as Start;
    const url = request.url ?? '/';
    requests.start(request, url);
    // 'close' also fires when the client gives up first; count those as 499.
    response.once('close', () => requests.finish(request, url, response.writableFinished ? response.statusCode : 499));
  });
  setInterval(() => requests.flush(), 60_000).unref();
}

// One chat completion against the shared ai-gateway (OpenAI-compatible,
// TAG_AI_BASE_URL): 429 and 5xx retried with backoff, the reply's content
// and the model that actually answered returned.

export type AiConfig = { baseUrl: string; apiKey: string; model: string };

export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig | null {
  const baseUrl = env.TAG_AI_BASE_URL?.replace(/\/+$/, '');
  const apiKey = env.TAG_AI_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, model: env.TAG_AI_MODEL || 'sky-fast' };
}

export async function chatCompletion(
  config: AiConfig,
  body: Record<string, unknown>,
  {
    fetchImpl = fetch as typeof fetch,
    timeoutMs = 180_000,
    attempts = 4,
    signal,
  }: { fetchImpl?: typeof fetch; timeoutMs?: number; attempts?: number; signal?: AbortSignal } = {},
): Promise<{ content: string; model: string; finishReason: string | null }> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.model, ...body }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
    const busy = res.status === 429 || res.status >= 500;
    if (busy && attempt < attempts) {
      await res.body?.cancel();
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }
    if (!res.ok) throw Error(`ai-gateway: HTTP ${res.status}`);
    const reply = (await res.json()) as { model?: string; choices?: { finish_reason?: string; message?: { content?: string } }[] };
    return {
      content: reply.choices?.[0]?.message?.content ?? '',
      model: reply.model ?? config.model,
      finishReason: reply.choices?.[0]?.finish_reason ?? null,
    };
  }
}

import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/client.ts';
import { externalResults, publicDomain, submitExternal } from './external.ts';

// The Similarweb request API for other observe services on this machine
// (docs/similarweb-requests.md). Never public: only a direct loopback
// connection (no cf-connecting-ip, which Cloudflare always sets, and no
// forwarding headers) with a service token is answered; everything else gets
// a plain 404, so the routes do not show from outside. Tokens come from the
// environment (TAG_SIMILARWEB_TOKEN_<REQUESTER>), never from Git.

const PREFIX = '/internal/similarweb';
const FORWARDED = ['cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip', 'forwarded', 'tailscale-user-login'];
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Requester → token, from TAG_SIMILARWEB_TOKEN_BLOG etc.; tokens shorter than 32 characters are ignored. */
export function serviceTokens(env: Record<string, string | undefined> = process.env) {
  const out = new Map<string, Buffer>();
  for (const [key, value] of Object.entries(env)) {
    const m = /^TAG_SIMILARWEB_TOKEN_([A-Z0-9]{1,16})$/.exec(key);
    if (m && value && value.length >= 32) out.set(m[1].toLowerCase(), Buffer.from(value));
  }
  return out;
}

/** The requester a request authenticates as, or null. */
export function requesterOf(request: FastifyRequest, tokens: Map<string, Buffer>) {
  if (!LOOPBACK.has(request.socket.remoteAddress ?? '')) return null;
  if (FORWARDED.some((h) => request.headers[h] !== undefined)) return null;
  const auth = request.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const given = Buffer.from(auth.slice(7));
  for (const [requester, token] of tokens) if (given.length === token.length && timingSafeEqual(given, token)) return requester;
  return null;
}

export function registerExternalTraffic(app: FastifyInstance, db: Db, { tokens = serviceTokens() }: { tokens?: Map<string, Buffer> } = {}) {
  const auth = (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('cache-control', 'no-store');
    const requester = tokens.size ? requesterOf(request, tokens) : null;
    if (!requester) reply.code(404).send({ error: 'not found' });
    return requester;
  };

  // { domain, kind: 'traffic' | 'similar_sites' } → queued (202) or already known (200).
  app.post<{ Body: { domain?: unknown; kind?: unknown } }>(`${PREFIX}/requests`, async (request, reply) => {
    const requester = auth(request, reply);
    if (!requester) return reply;
    const r = await submitExternal(db, requester, request.body?.domain, request.body?.kind ?? 'similar_sites');
    if ('error' in r) return reply.code(r.error === 'daily_limit' ? 429 : 400).send({ error: r.error });
    return reply.code(r.created ? 202 : 200).send(r);
  });

  // ?domain= → that domain's results for this requester.
  app.get<{ Querystring: { domain?: string } }>(`${PREFIX}/results`, async (request, reply) => {
    const requester = auth(request, reply);
    if (!requester) return reply;
    const domain = publicDomain(request.query.domain);
    if (!domain) return reply.code(400).send({ error: 'invalid_domain' });
    const result = await externalResults(db, requester, domain);
    if (!result.requests.length) return reply.code(404).send({ error: 'not_requested', domain });
    return result;
  });
}

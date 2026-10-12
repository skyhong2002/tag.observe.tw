import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

// The other observe services (youtube.observe.tw, blog.observe.tw) sync from
// the public API in the background and would hit the 60/min per-IP limit.
// They identify themselves in one of two ways and then share a high budget of
// their own (docs/service-clients.md):
//
// 1. `x-service-token: <token>`; the environment holds only its SHA-256:
//    TAG_SERVICE_TOKENS="youtube:<sha256 hex>,blog:<sha256 hex>".
// 2. The client IP in TAG_TRUSTED_CLIENT_IPS="blog=217.142.232.200". The IP is
//    cf-connecting-ip, which is only trustworthy because the gateway listens
//    on 127.0.0.1 and public traffic reaches it only through cloudflared,
//    which overwrites the header. If the gateway ever listens on a public
//    address, anyone could claim a trusted IP: drop this list then.

export const SERVICE_TOKEN_HEADER = 'x-service-token';
/** Per service, per minute. */
export const SERVICE_MAX_PER_MINUTE = 6000;
/** All services together, per minute: a guard against a runaway sync loop. */
export const SERVICE_TOTAL_MAX_PER_MINUTE = 9000;

export type ServiceClient = { service: string; via: 'token' | 'ip' };

const NAME = /^[a-z0-9-]{1,32}$/;
const sha256 = (value: string) => createHash('sha256').update(value).digest();

export function serviceClients(
  env: Record<string, string | undefined> = process.env,
  {
    now = Date.now,
    perServiceMax = SERVICE_MAX_PER_MINUTE,
    totalMax = SERVICE_TOTAL_MAX_PER_MINUTE,
  }: { now?: () => number; perServiceMax?: number; totalMax?: number } = {},
) {
  const hashes: Array<[string, Buffer]> = [];
  for (const entry of (env.TAG_SERVICE_TOKENS ?? '').split(',')) {
    const [name, hex] = entry.trim().split(':');
    if (NAME.test(name ?? '') && /^[0-9a-f]{64}$/i.test(hex ?? '')) hashes.push([name, Buffer.from(hex, 'hex')]);
  }
  const ips = new Map<string, string>();
  for (const entry of (env.TAG_TRUSTED_CLIENT_IPS ?? '').split(',')) {
    const [name, ip] = entry.trim().split('=');
    if (NAME.test(name ?? '') && ip?.trim()) ips.set(ip.trim().toLowerCase(), name);
  }

  let window = 0;
  let used = 0;
  const noted = new Map<string, number>();
  const minute = () => Math.floor(now() / 60_000);

  return {
    perServiceMax,
    names: [...new Set([...hashes.map(([name]) => name), ...ips.values()])],
    /** The service a request comes from; `null` for everyone else, `false` for a token that matches nothing. */
    identify(request: FastifyRequest): ServiceClient | null | false {
      const token = request.headers[SERVICE_TOKEN_HEADER];
      if (typeof token === 'string' && token) {
        const given = sha256(token);
        let found: string | null = null;
        for (const [name, hash] of hashes) if (timingSafeEqual(given, hash)) found ??= name;
        return found ? { service: found, via: 'token' } : false;
      }
      const ip = request.headers['cf-connecting-ip'];
      const service = typeof ip === 'string' ? ips.get(ip.trim().toLowerCase()) : undefined;
      return service ? { service, via: 'ip' } : null;
    },
    /** Counts one service request (already within its own budget) against the shared cap; false once it is spent this minute. */
    take() {
      if (window !== minute()) {
        window = minute();
        used = 0;
      }
      return ++used <= totalMax;
    },
    /** True the first time `key` is noted in a minute, so a runaway loop logs once a minute, not per request. */
    firstThisMinute(key: string) {
      if (noted.get(key) === minute()) return false;
      noted.set(key, minute());
      return true;
    },
  };
}

export type ServiceClients = ReturnType<typeof serviceClients>;

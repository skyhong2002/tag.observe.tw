import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { hashToken } from '../auth/google-login.ts';
import type { Db } from '../db/client.ts';
import { userApiKeys } from '../db/schema.ts';

// Personal API keys (docs/api.md). The public API needs no key; a key sent in
// the x-api-key header moves the caller from the shared per-IP budget to its
// own, larger one. Only SHA-256 hashes are stored, and lookups are cached so
// the rate limiter does not hit the database on every request.

export const API_KEY_HEADER = 'x-api-key';
export const API_MAX_PER_MINUTE = 60;
export const API_KEY_MAX_PER_MINUTE = 1000;
export const API_KEYS_PER_USER = 3;
const PREFIX = 'tag_';
const CACHE_MS = 60_000;
const CACHE_MAX = 2000;
const TOUCH_MS = 10 * 60_000;

export const newApiKey = () => PREFIX + randomBytes(24).toString('base64url');
export const looksLikeKey = (value: unknown): value is string =>
  typeof value === 'string' && value.length === PREFIX.length + 32 && value.startsWith(PREFIX) && /^[\w-]+$/.test(value);

export type ApiKeyLookup = { identify(request: FastifyRequest): Promise<number | null>; forget(hash: string): void };

/** Resolves a request's x-api-key to the key's id, or null for none, unknown or revoked keys. */
export function apiKeyLookup(db: Db, now = Date.now): ApiKeyLookup {
  const cache = new Map<string, { id: number | null; until: number }>();
  const touched = new Map<number, number>();
  return {
    async identify(request) {
      const value = request.headers[API_KEY_HEADER];
      if (!looksLikeKey(value)) return null;
      const hash = hashToken(value);
      let hit = cache.get(hash);
      if (!hit || hit.until < now()) {
        const [row] = await db
          .select({ id: userApiKeys.id })
          .from(userApiKeys)
          .where(and(eq(userApiKeys.keyHash, hash), isNull(userApiKeys.revokedAt)));
        if (cache.size >= CACHE_MAX) cache.clear();
        hit = { id: row?.id ?? null, until: now() + CACHE_MS };
        cache.set(hash, hit);
      }
      const id = hit.id;
      if (id !== null && (touched.get(id) ?? 0) < now() - TOUCH_MS) {
        touched.set(id, now());
        db.update(userApiKeys)
          .set({ lastUsedAt: new Date(now()) })
          .where(eq(userApiKeys.id, id))
          .catch((err) => request.log.warn({ err }, 'api key last_used_at update failed'));
      }
      return id;
    },
    forget(hash) {
      cache.delete(hash);
    },
  };
}

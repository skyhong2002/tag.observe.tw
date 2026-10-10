import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// Google sign-in for readers and admins (docs/login.md). The gateway owns the
// whole flow, so the Next.js app only reads /auth/me from the browser and
// stays cacheable. Admins are the verified emails in TAG_ADMIN_EMAILS;
// everyone else who signs in is a reader.

export type Role = 'admin' | 'reader';
export type LoginConfig = { clientId: string; clientSecret: string; origin: string; admins: Set<string> };
export type GoogleIdentity = { sub: string; email: string; name: string | null; picture: string | null };
export type StoredUser = GoogleIdentity & { id: number; createdAt: Date; lastLoginAt: Date };
export type SessionUser = { id: number; email: string; name: string | null; picture: string | null; role: Role };

export interface LoginStore {
  upsertUser(identity: GoogleIdentity, at: Date): Promise<number>;
  createSession(tokenHash: string, userId: number, expiresAt: Date): Promise<void>;
  sessionUser(tokenHash: string, at: Date): Promise<(GoogleIdentity & { id: number }) | null>;
  deleteSession(tokenHash: string): Promise<void>;
  listUsers(): Promise<StoredUser[]>;
}

/** Exchanges an authorization code for the ID token's claims. */
export type CodeExchange = (code: string, verifier: string) => Promise<Record<string, unknown>>;

export const SESSION_COOKIE = 'tag_session';
const FLOW_COOKIE = 'tag_oauth';
const SESSION_DAYS = 30;
const FLOW_SECONDS = 600;

export function loginConfig(env: NodeJS.ProcessEnv = process.env): LoginConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId && !clientSecret) return null;
  if (!clientId || !clientSecret) throw Error('Google login needs both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  const origin = new URL(env.TAG_PUBLIC_ORIGIN || 'https://tag.observe.tw');
  if (!['http:', 'https:'].includes(origin.protocol)) throw Error('TAG_PUBLIC_ORIGIN must be http(s)');
  const admins = new Set(
    (env.TAG_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  return { clientId, clientSecret, origin: origin.origin, admins };
}

const token = () => randomBytes(32).toString('base64url');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

export function readCookie(request: FastifyRequest, name: string) {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

/** Only same-site paths survive the round trip, so the login can't be used as an open redirect. */
export function safeNext(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value.startsWith('/auth/') || value.length > 512 || /[\u0000-\u001f]/.test(value)) return '/';
  return value;
}

function googleExchange(config: LoginConfig, fetcher: typeof fetch = fetch): CodeExchange {
  return async (code, verifier) => {
    const response = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: verifier,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${config.origin}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw Error(`token endpoint ${response.status}`);
    const { id_token: idToken } = (await response.json()) as { id_token?: string };
    if (typeof idToken !== 'string') throw Error('no id_token');
    // The token came straight from Google's token endpoint over TLS, which
    // OpenID Connect Core 3.1.3.7 accepts in place of checking its signature.
    return JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
  };
}

/** Checks the ID token claims; returns null when anything is off. */
export function verifiedIdentity(
  claims: Record<string, unknown>,
  config: LoginConfig,
  nonce: string,
  now = Date.now(),
): GoogleIdentity | null {
  const { iss, aud, azp, exp, sub, email, email_verified: verified, name, picture } = claims;
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(String(iss))) return null;
  if (aud !== config.clientId || (azp !== undefined && azp !== config.clientId)) return null;
  if (typeof exp !== 'number' || exp * 1000 <= now || claims.nonce !== nonce) return null;
  if (typeof sub !== 'string' || !sub || sub.length > 64) return null;
  if (verified !== true || typeof email !== 'string' || !email || email.length > 255) return null;
  return {
    sub,
    email: email.toLowerCase(),
    name: typeof name === 'string' && name ? name.slice(0, 255) : null,
    picture: typeof picture === 'string' && picture.startsWith('https://') && picture.length <= 512 ? picture : null,
  };
}

export type LoginOptions = { exchange?: CodeExchange; now?: () => number };

export function registerLogin(app: FastifyInstance, store: LoginStore | null, config: LoginConfig | null, options: LoginOptions = {}) {
  const now = options.now ?? Date.now;
  const enabled = Boolean(store && config);
  const secure = config?.origin.startsWith('https:') ? '; Secure' : '';
  const cookie = (name: string, value: string, maxAge: number) =>
    `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
  const roleOf = (email: string): Role => (config?.admins.has(email) ? 'admin' : 'reader');

  async function currentUser(request: FastifyRequest): Promise<SessionUser | null> {
    const value = readCookie(request, SESSION_COOKIE);
    if (!store || !value || value.length > 64) return null;
    const user = await store.sessionUser(hashToken(value), new Date(now()));
    return user && { id: user.id, email: user.email, name: user.name, picture: user.picture, role: roleOf(user.email) };
  }
  // Future admin endpoints call this first: it answers 401/403 itself and
  // returns null, or returns the signed-in admin.
  async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    reply.header('cache-control', 'no-store');
    const user = await currentUser(request);
    if (user?.role === 'admin') return user;
    reply.code(user ? 403 : 401).send({ error: user ? 'admins only' : 'sign in first' });
    return null;
  }

  app.get('/auth/me', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return { enabled, user: await currentUser(request) };
  });

  if (!store || !config) return { currentUser, requireAdmin };
  const exchange = options.exchange ?? googleExchange(config);
  const callback = `${config.origin}/auth/google/callback`;
  const fail = (reply: FastifyReply, reason: string) => reply.redirect(`/login/?error=${reason}`, 303);

  app.get<{ Querystring: { next?: string } }>('/auth/google', async (request, reply) => {
    const state = token();
    const nonce = token();
    const verifier = token();
    const flow = Buffer.from(JSON.stringify({ state, nonce, verifier, next: safeNext(request.query.next) })).toString('base64url');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callback,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return reply
      .header('cache-control', 'no-store')
      .header('set-cookie', cookie(FLOW_COOKIE, flow, FLOW_SECONDS))
      .redirect(url.toString(), 302);
  });

  app.get<{ Querystring: { state?: string; code?: string; error?: string } }>('/auth/google/callback', async (request, reply) => {
    reply.header('cache-control', 'no-store').header('set-cookie', cookie(FLOW_COOKIE, '', 0));
    let flow: { state?: string; nonce?: string; verifier?: string; next?: string } = {};
    try {
      flow = JSON.parse(Buffer.from(readCookie(request, FLOW_COOKIE) ?? '', 'base64url').toString('utf8'));
    } catch {}
    const { state, code, error } = request.query;
    if (!flow.state || !flow.nonce || !flow.verifier || state !== flow.state) return fail(reply, 'state');
    if (error) return fail(reply, 'cancelled');
    if (!code || code.length > 2048) return fail(reply, 'invalid');
    let identity: GoogleIdentity | null;
    try {
      identity = verifiedIdentity(await exchange(code, flow.verifier), config, flow.nonce, now());
    } catch (err) {
      // Never log the code, tokens or the client secret.
      request.log.warn({ err: (err as Error).message }, 'google login exchange failed');
      return fail(reply, 'failed');
    }
    if (!identity) return fail(reply, 'invalid');
    const at = new Date(now());
    const userId = await store.upsertUser(identity, at);
    const session = token();
    await store.createSession(hashToken(session), userId, new Date(at.getTime() + SESSION_DAYS * 86_400_000));
    return reply
      .header('set-cookie', [cookie(FLOW_COOKIE, '', 0), cookie(SESSION_COOKIE, session, SESSION_DAYS * 86_400)])
      .redirect(safeNext(flow.next), 303);
  });

  app.post('/auth/logout', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    if (request.headers.origin !== config.origin) return reply.code(403).send({ error: 'same-origin requests only' });
    const value = readCookie(request, SESSION_COOKIE);
    if (value && value.length <= 64) await store.deleteSession(hashToken(value));
    return reply.header('set-cookie', cookie(SESSION_COOKIE, '', 0)).redirect('/', 303);
  });

  app.get('/auth/users', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const users = await store.listUsers();
    return {
      users: users.map((user) => ({
        email: user.email,
        name: user.name,
        role: roleOf(user.email),
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt.toISOString(),
      })),
    };
  });

  return { currentUser, requireAdmin };
}

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { type LoginConfig, type LoginStore, loginConfig, registerLogin, type StoredUser, safeNext } from '../src/auth/google-login.ts';

const config: LoginConfig = {
  clientId: 'client.apps.googleusercontent.com',
  clientSecret: 'secret',
  origin: 'https://tag.observe.tw',
  admins: new Set(['admin@example.com']),
};

function memoryStore() {
  const users: StoredUser[] = [];
  const sessions = new Map<string, { userId: number; expiresAt: Date }>();
  const store: LoginStore = {
    async upsertUser(identity, at) {
      const found = users.find((user) => user.sub === identity.sub);
      if (found) return Object.assign(found, identity, { lastLoginAt: at }).id;
      users.push({ ...identity, id: users.length + 1, createdAt: at, lastLoginAt: at });
      return users.length;
    },
    async createSession(hash, userId, expiresAt) {
      sessions.set(hash, { userId, expiresAt });
    },
    async sessionUser(hash, at) {
      const session = sessions.get(hash);
      return session && session.expiresAt > at ? (users.find((user) => user.id === session.userId) ?? null) : null;
    },
    async deleteSession(hash) {
      sessions.delete(hash);
    },
    async listUsers() {
      return users;
    },
  };
  return { store, users, sessions };
}

async function setup(claims: Partial<Record<string, unknown>> = {}) {
  const memory = memoryStore();
  const app = Fastify();
  let lastNonce = '';
  registerLogin(app, memory.store, config, {
    exchange: async (code, verifier) => {
      expect(code).toBe('the-code');
      expect(verifier).toMatch(/^[\w-]{43}$/);
      return {
        iss: 'https://accounts.google.com',
        aud: config.clientId,
        exp: Date.now() / 1000 + 300,
        sub: '1234',
        email: 'Admin@Example.com',
        email_verified: true,
        name: '管理員',
        nonce: lastNonce,
        ...claims,
      };
    },
  });
  await app.ready();
  // Runs the redirect to Google and back; returns the callback response.
  async function signIn(next = '/media/') {
    const start = await app.inject({ url: `/auth/google?next=${encodeURIComponent(next)}` });
    expect(start.statusCode).toBe(302);
    const google = new URL(String(start.headers.location));
    expect(google.origin).toBe('https://accounts.google.com');
    expect(google.searchParams.get('redirect_uri')).toBe('https://tag.observe.tw/auth/google/callback');
    expect(google.searchParams.get('code_challenge_method')).toBe('S256');
    lastNonce = String(google.searchParams.get('nonce'));
    const flow = String(start.headers['set-cookie']).split(';')[0];
    return app.inject({ url: `/auth/google/callback?state=${google.searchParams.get('state')}&code=the-code`, headers: { cookie: flow } });
  }
  const sessionCookie = (response: { headers: Record<string, unknown> }) =>
    ([response.headers['set-cookie']].flat() as string[]).find((c) => c.startsWith('tag_session='))?.split(';')[0] ?? '';
  return { app, memory, signIn, sessionCookie };
}

describe('google login', () => {
  it('signs a user in, reports the role and signs out', async () => {
    const { app, memory, signIn, sessionCookie } = await setup();
    const callback = await signIn('/media/cna/');
    expect(callback.statusCode).toBe(303);
    expect(callback.headers.location).toBe('/media/cna/');
    const cookie = sessionCookie(callback);
    expect(cookie).toMatch(/^tag_session=[\w-]{43}$/);
    expect(String(callback.headers['set-cookie'])).toContain('HttpOnly; SameSite=Lax; Secure');
    // Only the hash of the cookie is stored.
    expect([...memory.sessions.keys()][0]).toMatch(/^[0-9a-f]{64}$/);
    expect(memory.sessions.has(cookie.split('=')[1])).toBe(false);

    const me = await app.inject({ url: '/auth/me', headers: { cookie } });
    expect(me.headers['cache-control']).toBe('no-store');
    expect(me.json()).toEqual({
      enabled: true,
      user: { id: 1, email: 'admin@example.com', name: '管理員', picture: null, role: 'admin' },
    });
    const list = await app.inject({ url: '/auth/users', headers: { cookie } });
    expect(list.json().users).toMatchObject([{ email: 'admin@example.com', role: 'admin' }]);

    expect((await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } })).statusCode).toBe(403);
    const out = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie, origin: 'https://tag.observe.tw' } });
    expect(out.statusCode).toBe(303);
    expect(memory.sessions.size).toBe(0);
    expect((await app.inject({ url: '/auth/me', headers: { cookie } })).json().user).toBeNull();
  });

  it('gives other accounts the reader role and keeps them out of admin endpoints', async () => {
    const { app, signIn, sessionCookie } = await setup({ sub: '99', email: 'reader@example.com' });
    const cookie = sessionCookie(await signIn());
    expect((await app.inject({ url: '/auth/me', headers: { cookie } })).json().user.role).toBe('reader');
    expect((await app.inject({ url: '/auth/users', headers: { cookie } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/auth/users' })).statusCode).toBe(401);
  });

  it('rejects a mismatched state, unverified email, foreign audience or replayed nonce', async () => {
    const { app } = await setup();
    const bad = await app.inject({ url: '/auth/google/callback?state=x&code=the-code' });
    expect(bad.headers.location).toBe('/login/?error=state');
    for (const claims of [{ email_verified: false }, { aud: 'someone-else' }, { nonce: 'old' }, { exp: 1 }]) {
      const { signIn, memory } = await setup(claims);
      const response = await signIn();
      expect(response.headers.location).toBe('/login/?error=invalid');
      expect(memory.sessions.size).toBe(0);
    }
  });

  it('is off without credentials but still answers /auth/me', async () => {
    const app = Fastify();
    registerLogin(app, null, null);
    expect((await app.inject({ url: '/auth/me' })).json()).toEqual({ enabled: false, user: null });
    expect((await app.inject({ url: '/auth/google' })).statusCode).toBe(404);
  });
});

describe('login helpers', () => {
  it('keeps the post-login redirect on this site', () => {
    expect(safeNext('/tag/%E5%B7%9D%E6%99%AE/?x=1')).toBe('/tag/%E5%B7%9D%E6%99%AE/?x=1');
    for (const value of ['https://evil.example/', '//evil.example/', '/\\evil.example', '/auth/logout', 'media', undefined]) {
      expect(safeNext(value)).toBe('/');
    }
  });

  it('reads the config from the environment', () => {
    expect(loginConfig({})).toBeNull();
    expect(() => loginConfig({ GOOGLE_CLIENT_ID: 'x' })).toThrow();
    const parsed = loginConfig({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y', TAG_ADMIN_EMAILS: ' A@b.com , c@d.com,' });
    expect(parsed?.origin).toBe('https://tag.observe.tw');
    expect([...(parsed?.admins ?? [])]).toEqual(['a@b.com', 'c@d.com']);
  });
});

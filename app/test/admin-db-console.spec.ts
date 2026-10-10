// /admin/db/ (app/src/admin/db-console.ts): only admins reach Adminer, which
// learns who they are from the gateway and nothing else.
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminerCookies } from '../src/admin/db-console.ts';
import { buildApp } from '../src/app.js';
import { hashToken, type LoginStore } from '../src/auth/google-login.ts';

const ORIGIN = 'https://tag.observe.tw';
const SECRET = 's'.repeat(40);
const people: Record<string, { email: string }> = { admin: { email: 'admin@example.com' }, reader: { email: 'reader@example.com' } };
const store: LoginStore = {
  upsertUser: async () => 1,
  createSession: async () => {},
  deleteSession: async () => {},
  listUsers: async () => [],
  sessionUser: async (hash) => {
    const name = Object.keys(people).find((key) => hashToken(key) === hash);
    return name ? { id: 1, sub: name, email: people[name].email, name, picture: null } : null;
  },
};

let adminer: FastifyInstance;
let app: FastifyInstance;
beforeAll(async () => {
  // Stand-in Adminer: echoes what reached it.
  adminer = Fastify();
  adminer.removeAllContentTypeParsers();
  adminer.addContentTypeParser('*', { parseAs: 'string' }, (_request, body, done) => done(null, body));
  adminer.all('/*', async (request, reply) => {
    reply.header('cache-control', 'max-age=3600').header('set-cookie', 'adminer_sid=abc; path=/admin/db/; HttpOnly');
    return { method: request.method, url: request.url, headers: request.headers, body: request.body ?? null };
  });
  const base = await adminer.listen({ host: '127.0.0.1', port: 0 });
  app = await buildApp(
    {
      uiOrigin: 'http://127.0.0.1:9',
      rateLimit: false,
      login: { clientId: 'id', clientSecret: 'secret', origin: ORIGIN, admins: new Set(['admin@example.com']) },
      adminer: { origin: base, secret: SECRET },
    },
    { loginStore: store },
  );
});
afterAll(async () => {
  await app?.close();
  await adminer?.close();
});

const as = (who: string, extra = '') => ({ cookie: `tag_session=${who}${extra}` });

describe('db console', () => {
  it('sends visitors to sign in and turns readers away', async () => {
    const anonymous = await app.inject({ url: '/admin/db/?username=adm_x' });
    expect(anonymous.statusCode).toBe(303);
    expect(anonymous.headers.location).toBe('/auth/google?next=%2Fadmin%2Fdb%2F');
    expect((await app.inject({ method: 'POST', url: '/admin/db/', headers: { origin: ORIGIN } })).statusCode).toBe(401);
    const reader = await app.inject({ url: '/admin/db/', headers: as('reader') });
    expect(reader.statusCode).toBe(403);
    expect(reader.headers['cache-control']).toBe('no-store');
    expect((await app.inject({ url: '/admin/db' })).headers.location).toBe('/admin/db/');
  });

  it('forwards an admin with their identity and only Adminer cookies', async () => {
    const response = await app.inject({
      url: '/admin/db/?server=db&username=adm_admin',
      headers: {
        ...as('admin', '; adminer_sid=abc; _ga=1; adminer_key=k'),
        'x-tag-admin-email': 'someone@else.com',
        'x-tag-adminer-secret': 'guess',
      },
    });
    expect(response.statusCode).toBe(200);
    const seen = response.json();
    expect(seen.url).toBe('/admin/db/?server=db&username=adm_admin');
    expect(seen.headers['x-tag-admin-email']).toBe('admin@example.com');
    expect(seen.headers['x-tag-adminer-secret']).toBe(SECRET);
    expect(seen.headers.cookie).toBe('adminer_sid=abc; adminer_key=k');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toContain('adminer_sid=abc');
  });

  it('passes same-origin form posts through and refuses the rest', async () => {
    const form = 'query=SELECT+1&token=t';
    const headers = { ...as('admin'), 'content-type': 'application/x-www-form-urlencoded' };
    const posted = await app.inject({ method: 'POST', url: '/admin/db/?sql=', headers: { ...headers, origin: ORIGIN }, payload: form });
    expect(posted.statusCode).toBe(200);
    expect(posted.json()).toMatchObject({ method: 'POST', body: form });
    const foreign = await app.inject({
      method: 'POST',
      url: '/admin/db/?sql=',
      headers: { ...headers, origin: 'https://evil.example' },
      payload: form,
    });
    expect(foreign.statusCode).toBe(403);
  });

  it('keeps only adminer_ cookies', () => {
    expect(adminerCookies('tag_session=x; adminer_sid=1')).toBe('adminer_sid=1');
    expect(adminerCookies('tag_session=x')).toBeUndefined();
    expect(adminerCookies(undefined)).toBeUndefined();
  });
});

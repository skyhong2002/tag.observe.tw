import replyFrom from '@fastify/reply-from';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '../auth/google-login.ts';

// /admin/db/ is Adminer (infra/compose.yml) behind the site's Google login
// (docs/login.md). The gateway lets only admins through and tells Adminer who
// they are; infra/adminer/tag-gateway.php then signs them in as their own
// MariaDB account, so the server audit log names the person behind each query.

export type AdminerConfig = { origin: string; secret: string };
type Options = {
  currentUser: (request: FastifyRequest) => Promise<SessionUser | null>;
  origin: string;
  adminer: AdminerConfig;
};

export const ADMIN_EMAIL_HEADER = 'x-tag-admin-email';
export const ADMINER_SECRET_HEADER = 'x-tag-adminer-secret';
const PREFIX = '/admin/db/';

/** Adminer gets its own cookies only; the site session never leaves the gateway. */
export function adminerCookies(header: string | undefined) {
  const kept = (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('adminer_'));
  return kept.length ? kept.join('; ') : undefined;
}

export function registerDbConsole(app: FastifyInstance, { currentUser, origin, adminer }: Options) {
  app.register(async (scope) => {
    // Adminer posts forms and file uploads; stream them through untouched.
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', (_request, payload, done) => done(null, payload));
    await scope.register(replyFrom, { base: adminer.origin, undici: { headersTimeout: 120_000, bodyTimeout: 120_000 } });

    scope.get('/admin/db', async (_request, reply) => reply.header('cache-control', 'no-store').redirect(PREFIX, 301));
    scope.route({
      method: ['GET', 'HEAD', 'POST'],
      url: `${PREFIX}*`,
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        reply.header('cache-control', 'no-store').header('x-tag-outcome', 'db-console');
        const user = await currentUser(request);
        if (!user) {
          if (request.method === 'POST') return reply.code(401).type('text/plain; charset=utf-8').send('sign in first\n');
          return reply.redirect(`/auth/google?next=${encodeURIComponent(request.url.split('?')[0])}`, 303);
        }
        if (user.role !== 'admin') return reply.code(403).type('text/plain; charset=utf-8').send('admins only\n');
        if (request.method === 'POST' && request.headers.origin !== origin)
          return reply.code(403).type('text/plain; charset=utf-8').send('same-origin requests only\n');
        // Adminer's own static files need no audit line.
        if (!/[?&]file=/.test(request.url)) request.log.info({ admin: user.email, method: request.method, url: request.url }, 'db console');
        return reply.from(request.url, {
          rewriteRequestHeaders: (_request, headers) => {
            const forwarded: Record<string, string | string[] | undefined> = {};
            for (const [key, value] of Object.entries(headers)) if (!key.startsWith('x-tag-') && key !== 'cookie') forwarded[key] = value;
            const cookie = adminerCookies(request.headers.cookie);
            if (cookie) forwarded.cookie = cookie;
            forwarded[ADMIN_EMAIL_HEADER] = user.email;
            forwarded[ADMINER_SECRET_HEADER] = adminer.secret;
            return forwarded as typeof headers;
          },
          rewriteHeaders: (headers) => ({ ...headers, 'cache-control': 'no-store' }),
        });
      },
    });
  });
}

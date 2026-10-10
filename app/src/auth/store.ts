import { and, desc, eq, gt, lt } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { userSessions, users } from '../db/schema.ts';
import type { LoginStore } from './google-login.ts';

export function dbLoginStore(db: Db): LoginStore {
  return {
    async upsertUser(identity, at) {
      await db
        .insert(users)
        .values({
          googleSub: identity.sub,
          email: identity.email,
          name: identity.name,
          picture: identity.picture,
          createdAt: at,
          lastLoginAt: at,
        })
        .onDuplicateKeyUpdate({ set: { email: identity.email, name: identity.name, picture: identity.picture, lastLoginAt: at } });
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.googleSub, identity.sub));
      return row.id;
    },
    async createSession(tokenHash, userId, expiresAt) {
      const at = new Date();
      // Sign-ins are rare, so expired sessions are swept here rather than by a job.
      await db.delete(userSessions).where(lt(userSessions.expiresAt, at));
      await db.insert(userSessions).values({ tokenHash, userId, createdAt: at, expiresAt });
    },
    async sessionUser(tokenHash, at) {
      const [row] = await db
        .select({ id: users.id, sub: users.googleSub, email: users.email, name: users.name, picture: users.picture })
        .from(userSessions)
        .innerJoin(users, eq(users.id, userSessions.userId))
        .where(and(eq(userSessions.tokenHash, tokenHash), gt(userSessions.expiresAt, at)));
      return row ?? null;
    },
    async deleteSession(tokenHash) {
      await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
    },
    async listUsers() {
      const rows = await db.select().from(users).orderBy(desc(users.lastLoginAt)).limit(500);
      return rows.map((row) => ({ ...row, sub: row.googleSub }));
    },
  };
}

import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.ts';

export type Db = MySql2Database<typeof schema>;

export function parseDbUrl(url: string | undefined) {
  if (!url) throw Error('TAG_DB_URL is required (mysql://user:pass@host:port/db)');
  const u = new URL(url);
  if (u.protocol !== 'mysql:') throw Error('TAG_DB_URL must use mysql://');
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
  };
}

export function createDb(url = process.env.TAG_DB_URL, { poolSize = 4 } = {}) {
  const pool = mysql.createPool({
    ...parseDbUrl(url),
    charset: 'utf8mb4',
    connectionLimit: poolSize,
    waitForConnections: true,
    queueLimit: 64,
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: false,
    connectTimeout: 5000,
  });
  const db = drizzle(pool, { schema, mode: 'default' });
  return { db, pool, close: () => pool.end() };
}

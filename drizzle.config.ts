import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'mysql',
  schema: './app/src/db/schema.ts',
  out: './app/src/db/migrations',
  dbCredentials: { url: process.env.TAG_DB_URL ?? '' },
});

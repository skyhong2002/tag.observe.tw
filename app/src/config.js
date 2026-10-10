import { loginConfig } from './auth/google-login.ts';

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 18130);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
  if (!env.TAG_DB_URL) throw new Error('TAG_DB_URL is required');
  const uiOrigin = new URL(env.UI_ORIGIN || 'http://127.0.0.1:18132');
  if (!['http:', 'https:'].includes(uiOrigin.protocol)) throw new Error('UI_ORIGIN must be http(s)');
  return {
    host: '127.0.0.1',
    port,
    tagDbUrl: env.TAG_DB_URL,
    uiOrigin: uiOrigin.origin,
    logLevel: env.LOG_LEVEL || 'info',
    login: loginConfig(env),
  };
}

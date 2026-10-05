// Read-only Google API client for the GA4 Data API and Search Console, signed
// with a service-account key (JWT bearer grant; no SDK dependency).
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/webmasters.readonly'];

export interface GoogleConfig {
  credentialsFile: string;
  propertyId: string;
  siteUrl: string;
}

/** Service-account path, GA4 property and Search Console site from the environment (docs/analytics.md); null when unset. */
export function googleConfigFromEnv(env = process.env): GoogleConfig | null {
  const { GOOGLE_APPLICATION_CREDENTIALS: credentialsFile, GA4_PROPERTY_ID: propertyId, GSC_SITE_URL: siteUrl } = env;
  if (!credentialsFile || !propertyId || !siteUrl) return null;
  if (!/^\d+$/.test(propertyId)) throw Error('GA4_PROPERTY_ID must be numeric');
  return { credentialsFile, propertyId, siteUrl };
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

// biome-ignore lint/suspicious/noExplicitAny: Google's report JSON is read field by field by the callers.
export type GoogleFetch = (url: string, body?: object) => Promise<any>;

export function googleClient(config: GoogleConfig, fetchImpl = fetch): GoogleFetch {
  let token: { value: string; expires: number } | null = null;
  async function accessToken() {
    if (token && token.expires > Date.now() + 60e3) return token.value;
    const key = JSON.parse(await readFile(config.credentialsFile, 'utf8')) as {
      client_email: string;
      private_key: string;
      token_uri?: string;
    };
    const aud = key.token_uri ?? 'https://oauth2.googleapis.com/token';
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
      JSON.stringify({ iss: key.client_email, scope: SCOPES.join(' '), aud, iat: now, exp: now + 3600 }),
    )}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key);
    const response = await fetchImpl(aud, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${base64url(signature)}`,
      }),
      signal: AbortSignal.timeout(30e3),
    });
    // Never log the response body: auth errors can echo the assertion.
    if (!response.ok) throw Error(`Google token HTTP ${response.status}`);
    const json = (await response.json()) as { access_token: string; expires_in: number };
    token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
    return token.value;
  }
  return async (url, body) => {
    const response = await fetchImpl(url, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${await accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60e3),
    });
    if (!response.ok) throw Error(`Google API HTTP ${response.status} for ${url.split('?')[0]}`);
    return response.json();
  };
}

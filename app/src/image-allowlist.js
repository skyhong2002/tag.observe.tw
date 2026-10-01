import hosts from '../../web/src/lib/image-hosts.json' with { type: 'json' };

// Same rules as web/src/lib/images.ts (kept in sync by app/test/image-allowlist.spec.ts).
// Enforced here because Next caps images.remotePatterns at 50 entries and the
// allowlist has ~260; the Next server is loopback-only, so the gateway is the
// single public entry to /_next/image.
const match = (host, pattern) =>
  pattern.startsWith('**.') ? host.endsWith(pattern.slice(2)) && host.length > pattern.length - 2 : host === pattern;
export function isAllowedImage(url) {
  if (!url) return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (
    hosts.pathBuckets.some((b) => {
      const [h, bucket] = b.split('/');
      return host === h && u.pathname.startsWith(`/${bucket}/`);
    })
  )
    return u.protocol === 'https:';
  const list = u.protocol === 'https:' ? hosts.https : u.protocol === 'http:' ? hosts.http : [];
  return list.some((p) => match(host, p));
}

// /_next/image?url=… : local paths (/img/x.png) or allowlisted remote URLs only.
export function imageRequestAllowed(rawUrl) {
  const split = rawUrl.indexOf('?');
  const params = new URLSearchParams(split < 0 ? '' : rawUrl.slice(split + 1));
  const target = params.getAll('url');
  if (target.length !== 1) return false;
  const value = target[0];
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  return isAllowedImage(value);
}

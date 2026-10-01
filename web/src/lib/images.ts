import hosts from './image-hosts.json';

// Mirrors next.config remotePatterns: "**.d" = any subdomain of d, otherwise
// exact host; path-style buckets are "host/bucket". Anything else is not
// optimisable and is not rendered (the optimizer would reject it anyway).
const match = (host: string, pattern: string) =>
  pattern.startsWith('**.') ? host.endsWith(pattern.slice(2)) && host.length > pattern.length - 2 : host === pattern;
export function isAllowedImage(url: string | null | undefined): url is string {
  if (!url) return false;
  let u: URL;
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

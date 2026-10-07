import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.TAG_DEV_ORIGINS?.split(',').filter(Boolean),
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./assets/NotoSansTC-Share.woff'],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: true,
  // Next caps remotePatterns at 50; the ~260-host allowlist
  // (tools/gen-image-hosts.ts) is enforced by the Fastify gateway, the only
  // public path to this loopback-only server (app/src/image-allowlist.js).
  // Next itself still refuses private/loopback targets.
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }, { protocol: 'http', hostname: '**' }], minimumCacheTTL: 3600, formats: ['image/webp'] },
  // Releases are read-only snapshots (scripts/install-service.sh), so ISR must
  // not write regenerated pages back into .next/server: the writes failed with
  // EACCES and every revalidating page stayed at its build-time render. Keep
  // regenerated pages in memory instead (cacheMaxMemorySize, 50 MB default).
  experimental: { isrFlushToDisk: false },
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const origin = process.env.TAG_API_ORIGIN ?? 'http://127.0.0.1:18130';
    return [{ source: '/api/v1/:path*/', destination: `${origin}/api/v1/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;

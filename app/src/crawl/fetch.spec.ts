import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { BlockedUrlError, fetchText, isPublicAddress, resolvePublic } from './fetch.ts';

describe('isPublicAddress', () => {
  it('rejects private, loopback, link-local, CGNAT, multicast and mapped addresses', () => {
    for (const a of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
      '::',
      'fe80::1',
      'fd00::1',
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
    ])
      expect(isPublicAddress(a), a).toBe(false);
  });
  it('accepts public addresses', () => {
    for (const a of ['1.1.1.1', '140.112.8.116', '2606:4700:4700::1111', '::ffff:8.8.8.8']) expect(isPublicAddress(a), a).toBe(true);
    expect(isPublicAddress('not-an-ip')).toBe(false);
  });
});

describe('resolvePublic', () => {
  const lookupTo = (address: string, family = 4) => (async () => [{ address, family }]) as never;
  it('blocks non-http protocols, credentials, internal names and private resolutions', async () => {
    await expect(resolvePublic(new URL('file:///etc/passwd'))).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(resolvePublic(new URL('http://user:pw@example.com/'))).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(resolvePublic(new URL('http://localhost:18130/'))).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(resolvePublic(new URL('http://metadata.internal/'))).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(resolvePublic(new URL('http://[::1]/'))).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(resolvePublic(new URL('http://rebind.example/'), lookupTo('10.0.0.5'))).rejects.toThrow(/non-public 10\.0\.0\.5/);
  });
  it('returns the checked address for public hosts', async () => {
    await expect(resolvePublic(new URL('https://news.example/'), lookupTo('203.0.114.10'))).resolves.toEqual({
      address: '203.0.114.10',
      family: 4,
    });
  });
});

describe('fetchText guard', () => {
  it('refuses to fetch loopback services and does not retry blocked URLs', async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.end('secret');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    try {
      await expect(fetchText(`http://127.0.0.1:${port}/`, { retries: 2 })).rejects.toBeInstanceOf(BlockedUrlError);
      expect(hits).toBe(0);
    } finally {
      server.close();
    }
  });
});

describe('redirect cookies', () => {
  it('sends a cookie only to the host or domain that set it', async () => {
    const { cookieHeader, storeCookies } = await import('./fetch.ts');
    const jar: Parameters<typeof storeCookies>[0] = [];
    storeCookies(jar, 'sn-myalb.bnextmedia.com.tw', ['sso=1; Domain=.bnextmedia.com.tw; Path=/', 'hop=2; Path=/']);
    storeCookies(jar, 'www.shoppingdesign.com.tw', ['sd=3; Path=/', 'evil=4; Domain=example.com']);
    expect(cookieHeader(jar, 'www.bnextmedia.com.tw')).toBe('sso=1');
    expect(cookieHeader(jar, 'sn-myalb.bnextmedia.com.tw')).toBe('sso=1; hop=2');
    // A Domain the host does not belong to falls back to host-only.
    expect(cookieHeader(jar, 'www.shoppingdesign.com.tw')).toBe('sd=3; evil=4');
    expect(cookieHeader(jar, 'example.com')).toBe('');
  });
});

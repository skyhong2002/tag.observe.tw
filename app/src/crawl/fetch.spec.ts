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

describe('address pools', () => {
  it('keeps every checked address and rejects the pool if one is private', async () => {
    const { resolvePublicAll } = await import('./fetch.ts');
    const pool = (async () => [
      { address: '203.0.114.10', family: 4 },
      { address: '203.0.114.11', family: 4 },
    ]) as never;
    await expect(resolvePublicAll(new URL('https://pool.example/'), pool)).resolves.toHaveLength(2);
    const mixed = (async () => [
      { address: '203.0.114.10', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]) as never;
    await expect(resolvePublicAll(new URL('https://pool.example/'), mixed)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('moves past an address that refuses the connection', async () => {
    const { pinnedAgent } = await import('./fetch.ts');
    const { fetch } = await import('undici');
    const server = createServer((_req, res) => res.end('ok'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    const dispatcher = pinnedAgent([
      { address: '127.0.0.2', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    try {
      const res = await fetch(`http://pool.example:${port}/`, { dispatcher });
      expect(await res.text()).toBe('ok');
    } finally {
      await dispatcher.close();
      server.close();
    }
  });

  it('fails over only on connect-phase errors', async () => {
    const { isConnectFailure } = await import('./fetch.ts');
    const failed = (cause: object) => Object.assign(new TypeError('fetch failed'), { cause });
    expect(isConnectFailure(failed({ code: 'UND_ERR_CONNECT_TIMEOUT' }))).toBe(true);
    expect(isConnectFailure(failed({ errors: [{ code: 'ETIMEDOUT' }, { code: 'ECONNREFUSED' }] }))).toBe(true);
    expect(isConnectFailure(failed({ errors: [{ code: 'ETIMEDOUT' }, { code: 'ECONNRESET' }] }))).toBe(false);
    expect(isConnectFailure(failed({ code: 'ECONNRESET' }))).toBe(false);
    expect(isConnectFailure(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))).toBe(false);
  });
});

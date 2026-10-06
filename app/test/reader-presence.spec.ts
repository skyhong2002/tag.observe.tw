import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { READER_KEY, readerId } from '../../web/src/lib/reader-presence.mts';
import { registerReaderPresence } from '../src/v1/reader-presence.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

describe('first-party reader count', () => {
  it('counts quiet readers, deduplicates tabs, expires absence and removes opt-outs', async () => {
    const app = Fastify();
    let now = 0;
    registerReaderPresence(app, () => now);
    const beat = (browser = id, leave = false) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/reader-presence',
        headers: { origin: 'https://tag.observe.tw' },
        payload: { id: browser, leave },
      });
    try {
      expect((await beat()).json().activeReaders).toBe(1);
      expect((await beat()).json().activeReaders).toBe(1);
      expect((await beat(other)).json().activeReaders).toBe(2);
      now = 60_000;
      expect((await beat()).json().activeReaders).toBe(2);
      now = 90_000;
      const response = await app.inject('/api/v1/reader-presence');
      expect(response.json().activeReaders).toBe(1);
      expect(response.headers['cache-control']).toBe('no-store');
      // Keep an unattended board counted well beyond GA's activity window.
      for (let i = 0; i < 65; i++) {
        now += 30_000;
        expect((await beat()).json().activeReaders).toBe(1);
      }
      expect((await beat(id, true)).json().activeReaders).toBe(0);
      await beat();
      now += 90_000;
      expect((await app.inject('/api/v1/reader-presence')).json().activeReaders).toBe(0);
    } finally {
      await app.close();
    }
  });
  it('GET/HEAD do not create readers, and invalid or cross-site reports are rejected', async () => {
    const app = Fastify();
    registerReaderPresence(app);
    try {
      await app.inject({ method: 'HEAD', url: '/api/v1/reader-presence' });
      for (const headers of [
        {},
        { origin: 'https://elsewhere.test' },
        { origin: 'https://tag.observe.tw', 'sec-fetch-site': 'cross-site' },
      ]) {
        expect((await app.inject({ method: 'POST', url: '/api/v1/reader-presence', headers, payload: { id } })).statusCode).toBe(403);
      }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/reader-presence',
            headers: { origin: 'https://tag.observe.tw' },
            payload: { id: 'invalid' },
          })
        ).statusCode,
      ).toBe(400);
      expect((await app.inject('/api/v1/reader-presence')).json().activeReaders).toBe(0);
    } finally {
      await app.close();
    }
  });
});

describe('anonymous browser identity', () => {
  it('shares an id across tabs and rotates it after a day', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    expect(readerId(storage, () => id, 0)).toBe(id);
    expect(readerId(storage, () => other, 30_000)).toBe(id);
    expect(readerId(storage, () => other, 86_400_000)).toBe(other);
    data.set(READER_KEY, '{broken');
    expect(readerId(storage, () => id, 86_400_000)).toBe(id);
  });
  it('does not invent per-tab identities when storage is blocked', () => {
    expect(
      readerId(
        {
          getItem: () => null,
          setItem: () => {
            throw Error('blocked');
          },
        },
        () => id,
      ),
    ).toBeNull();
  });
});

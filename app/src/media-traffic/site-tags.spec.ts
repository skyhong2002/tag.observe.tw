import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  keepMediaTagsFresh,
  mediaTags,
  mediaTagsFetchedAt,
  setMediaTagsForTest,
  tagDomainsByMedia,
  tagsFromResponse,
} from './site-tags.ts';

const service = { url: 'http://127.0.0.1:18150', token: 'x'.repeat(40) };
const item = (tag: string, visible = true) => ({ tag, source: 'editor', visible, agrees: 0, disagrees: 0, adminOverride: null });
const domains = new Map([
  ['ltn', ['news.ltn.com.tw', 'ltn.com.tw']],
  ['udn', ['udn.com']],
  ['nowhere', ['unknown.example']],
]);
const answer = {
  domains: {
    'news.ltn.com.tw': [item('新聞 (Only)')],
    'ltn.com.tw': [item('綠'), item('新聞'), item('內容農場', false)],
    'udn.com': [item('新聞'), item('藍')],
  },
};
const serving = (body: unknown, status = 200) => {
  const calls: Array<{ url: string; body: unknown; auth: string }> = [];
  const request = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string), auth: (init.headers as Record<string, string>).authorization });
    return Response.json(body, { status });
  }) as typeof fetch;
  return { calls, request };
};

afterEach(() => setMediaTagsForTest(null));

describe('tagsFromResponse', () => {
  it('keeps visible tags and drops the political ones', () => {
    expect(tagsFromResponse(answer, new Date('2026-10-24T00:00:00Z')).domains).toEqual({
      'news.ltn.com.tw': ['新聞 (Only)'],
      'ltn.com.tw': ['新聞'],
      'udn.com': ['新聞'],
    });
    expect(() => tagsFromResponse({ error: 'x' }, new Date())).toThrow();
  });
});

describe('keepMediaTagsFresh', () => {
  it('gives each outlet the union of its domains’ tags and saves the snapshot', async () => {
    setMediaTagsForTest(null, domains);
    const file = join(mkdtempSync(join(tmpdir(), 'tag-site-tags-')), 'tags.json');
    const { calls, request } = serving(answer);
    const fresh = keepMediaTagsFresh({ service, file, request });
    await fresh.ready;
    fresh.stop();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:18150/internal/v1/tags');
    expect(calls[0].auth).toBe(`Bearer ${service.token}`);
    expect((calls[0].body as { domains: string[] }).domains.sort()).toEqual([
      'ltn.com.tw',
      'news.ltn.com.tw',
      'udn.com',
      'unknown.example',
    ]);
    expect(mediaTags('ltn')).toEqual(['新聞 (Only)', '新聞']);
    expect(mediaTags('udn')).toEqual(['新聞']);
    expect(mediaTags('nowhere')).toEqual([]);
    expect(JSON.parse(readFileSync(file, 'utf8')).domains['udn.com']).toEqual(['新聞']);
  });

  it('keeps the last good snapshot when traffic.observe.tw fails', async () => {
    setMediaTagsForTest({ fetchedAt: '2026-10-24T00:00:00.000Z', domains: { 'udn.com': ['新聞'] } }, domains);
    const { request } = serving({ error: 'Not Found' }, 404);
    const warned: unknown[] = [];
    const fresh = keepMediaTagsFresh({ service, file: null, request, warn: (err) => warned.push(err) });
    await fresh.ready;
    fresh.stop();
    expect(warned).toHaveLength(1);
    expect(mediaTags('udn')).toEqual(['新聞']);
    expect(mediaTagsFetchedAt()).toBe('2026-10-24T00:00:00.000Z');
  });

  it('starts from the saved file when traffic.observe.tw is down, and shows no tags with neither', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'tag-site-tags-')), 'tags.json');
    const down = (async () => {
      throw Error('connect ECONNREFUSED');
    }) as typeof fetch;
    setMediaTagsForTest(null, domains);
    const empty = keepMediaTagsFresh({ service, file, request: down });
    await empty.ready;
    empty.stop();
    expect(mediaTags('udn')).toEqual([]);
    expect(mediaTagsFetchedAt()).toBeNull();

    writeFileSync(file, JSON.stringify({ fetchedAt: '2026-10-23T00:00:00.000Z', domains: { 'udn.com': ['新聞'] } }));
    const restored = keepMediaTagsFresh({ service, file, request: down });
    await restored.restored;
    expect(mediaTags('udn')).toEqual(['新聞']);
    await restored.ready;
    restored.stop();
    expect(mediaTags('udn')).toEqual(['新聞']);
  });

  it('does nothing without the service settings', async () => {
    setMediaTagsForTest(null, domains);
    const { calls, request } = serving(answer);
    const fresh = keepMediaTagsFresh({ service: null, file: null, request });
    await fresh.ready;
    expect(calls).toHaveLength(0);
    expect(mediaTags('ltn')).toEqual([]);
  });
});

describe('tagDomainsByMedia', () => {
  it('keeps each outlet to its own domains, not the platforms or other outlets it is read from', () => {
    const own = tagDomainsByMedia();
    expect(own.get('reuters')).toEqual(['reuters.com']);
    expect(own.get('travelnews')).toEqual(['fearless.cool']);
    expect(own.get('taiwan')).toEqual(['taiwan.cn']);
    expect(own.get('tristarnews')).toEqual(['tristarnews.com.tw']);
    expect(own.get('taiwandaily')).toEqual(['taiwandaily.net']);
    expect(own.get('enn')).toEqual(['enn.tw']);
    expect(own.get('rwnews')).toEqual(['rwnews.tw']);
    // Platforms keep their own tags; outlets sharing a reviewed domain both keep it.
    expect(own.get('today_line_me')).toEqual(['today.line.me']);
    expect(own.get('yam')).toEqual(['n.yam.com']);
    expect(own.get('ftv')).toEqual(['ftvnews.com.tw']);
    expect(own.get('bbc')).toEqual(['bbc.com']);
    expect(own.get('bbc_global')).toEqual(['bbc.com']);
    expect(own.get('ltn')).toContain('ltn.com.tw');
  });
});

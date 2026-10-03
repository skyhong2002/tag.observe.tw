import { describe, expect, it } from 'vitest';
import { DONGTAIWANG_LISTING_URL, discoverDongtaiwang, parseDongtaiwangListing } from './discovery-dongtaiwang.ts';
import type { FetchResult } from './fetch.ts';

const article = 'http://www.ntdtv.com/gb/2026/10/03/a104138561.html';
const link = (url: string, title = '這是一則原媒體完整新聞標題') => `<a href="${url}">${title}</a>`;
const listing = (body: string) => `<div id="three_two_left"><div class="content_list">${body}</div></div>`;

describe('Dongtaiwang original-publisher discovery', () => {
  it('deduplicates direct article links and keeps portal provenance without inventing publication dates', () => {
    const items = parseDongtaiwangListing(listing(link(`${article}?utm_source=portal#main`) + link(article)));
    expect(items).toEqual([{ url: article, title: '這是一則原媒體完整新聞標題', discoveryUrl: DONGTAIWANG_LISTING_URL }]);
    expect(parseDongtaiwangListing(listing(link('http://www.epochtimes.com/gb/26/10/2/n14862348.htm')))).toHaveLength(1);
  });

  it('rejects proxies, publisher wrapper lists, guides, advertisements and misleading hosts', () => {
    const rejected = [
      'https://dongtaiwang.com/dmirror/https/www.ntdtv.com/gb/2026/10/03/a104138561.html',
      'http://www.epochtimes.com/gb/nf1351518.htm#14862423',
      'http://www.ntdtv.com/gb/dongtaiwang.html?id=104138561',
      'https://dongtaiwang.com/loc/howto.php',
      'https://dongtaiwang.com/loc/video/vhome.php?ytvid=123',
      'http://www.ntdtv.com.evil.test/gb/2026/10/03/a104138561.html',
      'http://user:pass@www.ntdtv.com/gb/2026/10/03/a104138561.html',
      'http://www.ntdtv.com:8080/gb/2026/10/03/a104138561.html',
      'javascript:alert(1)',
    ];
    expect(parseDongtaiwangListing(listing(rejected.map((url) => link(url)).join('')))).toEqual([]);
    expect(
      parseDongtaiwangListing(listing(`<aside>${link(article)}</aside><div class="ad">${link(article)}</div>`) + link(article)),
    ).toEqual([]);
    expect(parseDongtaiwangListing(listing(link(article)), 'https://unreviewed.test/')).toEqual([]);
  });

  it('fetches only the official listing and leaves all publisher requests to the caller', async () => {
    const calls: string[] = [];
    const fetcher = async (url: string): Promise<FetchResult> => {
      calls.push(url);
      return { url, status: 200, body: listing(link(article)), contentType: 'text/html', ms: 1 };
    };
    const result = await discoverDongtaiwang({ fetch: fetcher });
    expect(calls).toEqual([DONGTAIWANG_LISTING_URL]);
    expect(result.items).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.attempted).toBe(1);
  });

  it('does not retry a limited server or accept a redirected foreign page', async () => {
    for (const [status, url] of [
      [429, DONGTAIWANG_LISTING_URL],
      [200, 'https://foreign.test/'],
    ] as const) {
      let calls = 0;
      const result = await discoverDongtaiwang({
        fetch: async () => {
          calls++;
          return { url, status, body: listing(link(article)), contentType: 'text/html', ms: 1 };
        },
      });
      expect(calls).toBe(1);
      expect(result.items).toEqual([]);
      expect(result.errors).toHaveLength(1);
    }
  });
});

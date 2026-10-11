import { describe, expect, it } from 'vitest';
import { countSitemaps, emptyOutput, findNewsSitemaps, mergeDays, onHost, publisherHosts, refreshOutput } from './output.ts';

const newsSitemap = (dates: string[]) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${dates
    .map(
      (date, i) =>
        `<url><loc>https://news.example.com/a/${i}</loc><news:news><news:title>t${i}</news:title><news:publication_date>${date}</news:publication_date></news:news></url>`,
    )
    .join('')}</urlset>`;
const pages = (map: Record<string, string>) => async (url: string) => map[url] ?? null;

describe('media output', () => {
  it('counts the measured host and its subdomains only', () => {
    expect(onHost('www.news.example.com', 'news.example.com')).toBe(true);
    expect(onHost('m.news.example.com', 'news.example.com')).toBe(true);
    expect(onHost('example.com', 'news.example.com')).toBe(false);
    expect(onHost('today.line.me', 'example.com')).toBe(false);
  });
  it('finds news sitemaps in robots.txt, else news children of a listed index, on the same host only', async () => {
    expect(
      await findNewsSitemaps(
        'news.example.com',
        pages({
          'https://news.example.com/robots.txt':
            'Sitemap: https://news.example.com/sitemap.xml\nSitemap: https://news.example.com/news-sitemap.xml\nSitemap: https://other.example/news.xml',
        }),
      ),
    ).toEqual(['https://news.example.com/news-sitemap.xml']);
    expect(
      await findNewsSitemaps(
        'news.example.com',
        pages({
          'https://news.example.com/robots.txt': 'Sitemap: https://news.example.com/sitemap.xml',
          'https://news.example.com/sitemap.xml':
            '<sitemapindex><sitemap><loc>https://news.example.com/sitemap-posts.xml</loc></sitemap><sitemap><loc>https://news.example.com/sitemap-google-news.xml</loc></sitemap></sitemapindex>',
        }),
      ),
    ).toEqual(['https://news.example.com/sitemap-google-news.xml']);
  });
  it('counts articles per Taipei day by publication date and flags a full sitemap', async () => {
    const counted = await countSitemaps(
      ['https://news.example.com/news.xml'],
      pages({
        'https://news.example.com/news.xml': newsSitemap(['2026-10-10T15:59:00Z', '2026-10-10T16:01:00Z', '2026-10-11T09:00:00+08:00']),
      }),
    );
    expect(counted).toEqual({ days: { '2026-10-10': 1, '2026-10-11': 2 }, capped: false, read: 1 });
    const full = await countSitemaps(['s'], pages({ s: newsSitemap(Array(1000).fill('2026-10-10T01:00:00Z')) }));
    expect(full.capped).toBe(true);
  });
  it('stores only yesterday from a fresh read, keeps the larger count and drops old days', () => {
    const now = new Date('2026-10-11T04:00:00Z'); // 12:00 in Taipei
    expect(
      mergeDays({ '2026-10-10': 500, '2026-10-01': 9, '2026-09-01': 1 }, { '2026-10-09': 99, '2026-10-10': 420, '2026-10-11': 50 }, now),
    ).toEqual({ '2026-10-10': 500, '2026-10-01': 9 });
    expect(mergeDays({}, { '2026-10-10': 420 }, now)).toEqual({ '2026-10-10': 420 });
  });
  it('splits our articles by host and keeps previous days when a read fails', async () => {
    const now = new Date('2026-10-11T04:00:00Z');
    const previous = {
      ...emptyOutput(),
      media: [
        {
          media: 'a',
          host: 'news.example.com',
          sitemaps: [],
          days: { '2026-10-09': 7 },
          capped: false,
          articles7d: 0,
          onHost7d: 0,
          checkedAt: '2026-10-10T00:00:00Z',
        },
      ],
    };
    const hosts = new Map([
      [
        'a',
        [
          { host: 'news.example.com', n: 90 },
          { host: 'today.line.me', n: 10 },
        ],
      ],
    ]);
    const failing = async () => {
      throw Error('down');
    };
    const result = await refreshOutput([{ media: 'a', host: 'news.example.com' }], previous, hosts, { get: failing, now });
    // findNewsSitemaps swallows the robots.txt failure: no sitemap, days kept.
    expect(result.media[0]).toMatchObject({ articles7d: 100, onHost7d: 90, days: { '2026-10-09': 7 }, sitemaps: [] });
    expect(result.status).toBe('ok');
  });
  it('measures listed outlets on their article host', () => {
    expect(publisherHosts()).toContainEqual({ media: 'nextapple', host: 'news.nextapple.com' });
  });
});

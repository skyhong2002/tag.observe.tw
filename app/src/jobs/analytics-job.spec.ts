import { describe, expect, it } from 'vitest';
import { pageKind } from '../v1/site-observation.ts';
import { cleanTitle, originalByOutlet, outletsByHost, pageRows, sitePath } from './analytics-job.ts';

describe('analytics page paths', () => {
  it('normalizes encodings, full URLs and missing slashes', () => {
    expect(sitePath('/tag/%E8%94%A1%E8%8B%B1%E6%96%87/')).toBe('/tag/蔡英文/');
    expect(sitePath('https://tag.observe.tw/eve/897/')).toBe('/eve/897/');
    expect(sitePath('/ranking')).toBe('/ranking/');
    expect(sitePath('/feeds/events.xml')).toBe('/feeds/events.xml');
  });
  it('drops other hosts, traversal and search terms', () => {
    expect(sitePath('https://evil.test/eve/1/')).toBeNull();
    expect(sitePath('//evil.test/')).toBeNull();
    expect(sitePath('/tag/%2e%2e/')).toBeNull();
    expect(sitePath('/tag/%E0%A4%A/')).toBeNull();
    expect(sitePath('/search/?q=private')).toBe('/search/');
    expect(sitePath('/search/私人搜尋/')).toBe('/search/');
  });
  it('sums views across encodings, keeps the most-viewed title and never sums users', () => {
    const rows = pageRows([
      { day: '2026-10-05', path: '/tag/%E8%94%A1%E8%8B%B1%E6%96%87/', title: '蔡英文 · 新文易數', views: 3, users: 2 },
      { day: '2026-10-05', path: '/tag/蔡英文/', title: '舊標題 · 新文易數', views: 1, users: 1 },
      { day: '2026-10-05', path: '/search/', title: '搜尋「私人」 · 新文易數', views: 2, users: 1 },
    ]);
    expect(rows).toContainEqual({ day: '2026-10-05', source: 'ga', metric: 'page_views', key: '/tag/蔡英文/', value: 4, label: '蔡英文' });
    expect(rows).toContainEqual({ day: '2026-10-05', source: 'ga', metric: 'page_users', key: '/tag/蔡英文/', value: 2, label: null });
    expect(rows.find((r) => r.key === '/search/' && r.metric === 'page_views')?.label).toBeNull();
  });
  it('drops titles that are HTML markup', () => {
    const rows = pageRows([
      { day: '2026-10-08', path: '/feature/techorange/456568/', title: '<img loading="lazy" src="x.jpg"> · 新文易數', views: 7, users: 5 },
    ]);
    expect(rows.find((r) => r.metric === 'page_views')?.label).toBeNull();
  });
  it('strips the site suffix from titles', () => {
    expect(cleanTitle('蔡英文訪矽谷 · 新文易數')).toBe('蔡英文訪矽谷');
  });
  it('tells content pages from index pages', () => {
    expect(pageKind('/eve/897/')).toBe('event');
    expect(pageKind('/topic/pts/154247/')).toBe('topic');
    expect(pageKind('/media/worldjournal/')).toBe('media');
    expect(pageKind('/media/sources/')).toBe('page');
    expect(pageKind('/topic/')).toBe('page');
    expect(pageKind('/')).toBe('page');
  });
});

describe('original-site clicks by outlet', () => {
  const outletOf = outletsByHost([
    { media: 'setn', host: 'www.setn.com', n: 50 },
    { media: 'yahoo', host: 'tw.news.yahoo.com', n: 80 },
    { media: 'cts', host: 'tw.news.yahoo.com', n: 3 },
  ]);
  it('maps domains, with or without www, to the outlet that uses them most', () => {
    expect(outletOf('setn.com')).toBe('setn');
    expect(outletOf('WWW.SETN.COM')).toBe('setn');
    expect(outletOf('tw.news.yahoo.com')).toBe('yahoo');
    expect(outletOf('github.com')).toBeNull();
  });
  it('sums one outlet across its domains per day and skips unknown domains', () => {
    const row = (day: string, key: string, value: number) => ({ day, source: 'ga', metric: 'original_domain', key, value });
    expect(
      originalByOutlet(
        [
          row('2026-10-05', 'setn.com', 1),
          row('2026-10-05', 'www.setn.com', 2),
          row('2026-10-06', 'setn.com', 1),
          row('2026-10-05', 'github.com', 4),
        ],
        outletOf,
      ),
    ).toEqual([
      { day: '2026-10-05', source: 'ga', metric: 'original_media', key: 'setn', value: 3 },
      { day: '2026-10-06', source: 'ga', metric: 'original_media', key: 'setn', value: 1 },
    ]);
  });
});

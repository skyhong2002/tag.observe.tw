import { describe, expect, it } from 'vitest';
import { pageKind } from '../v1/site-observation.ts';
import { cleanTitle, pageRows, sitePath } from './analytics-job.ts';

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

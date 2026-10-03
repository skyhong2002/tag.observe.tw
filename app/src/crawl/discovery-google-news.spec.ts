import { describe, expect, it, vi } from 'vitest';
import { discoverGoogleNews } from './discovery-google-news.ts';
import type { fetchText } from './fetch.ts';

const rssUrl = 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant';
const first = 'https://news.google.com/rss/articles/opaque-one?oc=5';
const second = 'https://news.google.com/rss/articles/opaque-two?oc=5';
const original = 'https://www.cna.com.tw/news/aopl/202610030026.aspx';
const title = '杜拜航空安檢漏洞受矚 - 中央社 CNA';
const xml = (urls = [first]) =>
  `<rss><channel>${urls.map((url) => `<item><title>${title}</title><link><![CDATA[${url}]]></link><source url="https://www.cna.com.tw">中央社</source><pubDate>Sat, 03 Oct 2026 01:45:00 GMT</pubDate><description>摘要不能當正文</description></item>`).join('')}</channel></rss>`;
const response = (url: string, body: string, status = 200) => ({ url, body, status, contentType: 'text/html', ms: 1 });
const fixture = (html: string, finalUrl = first) =>
  vi.fn<typeof fetchText>(async (url) => response(url === rssUrl ? rssUrl : finalUrl, url === rssUrl ? xml() : html));

describe('Google News publisher discovery', () => {
  it('preserves the Google wrapper as provenance after a normal HTTP redirect', async () => {
    const fetch = fixture('<article>原媒體正文</article>', original);
    const result = await discoverGoogleNews({}, { fetch });
    expect(result.items).toEqual([{ url: original, title, discoveryUrl: first }]);
    expect(result.items[0]).not.toHaveProperty('body');
    expect(result.items[0]).not.toHaveProperty('publishedAt');
    expect(result.attempted).toBe(2);
    expect(fetch).toHaveBeenCalledWith(first, { timeout: 15000, retries: 0 });
  });

  it.each([
    `<meta http-equiv="refresh" content="0; URL='${original}'">`,
    `<link rel="canonical" href="${original}">`,
    `<a href="${original}">${title}</a>`,
  ])('accepts explicit public HTML redirect evidence: %s', async (html) => {
    const result = await discoverGoogleNews({}, { fetch: fixture(html) });
    expect(result.items).toEqual([{ url: original, title, discoveryUrl: first }]);
  });

  it('does not interpret self canonical, publisher home, unrelated links or RSS source as an article', async () => {
    const result = await discoverGoogleNews(
      {},
      {
        fetch: fixture(
          `<link rel="canonical" href="${first}"><a href="https://www.cna.com.tw/">${title}</a><a href="${original}">不相關標題</a>`,
        ),
      },
    );
    expect(result.items).toEqual([]);
    expect(result.errors).toContain(`${first}: unresolved public redirect; no publisher URL`);
  });

  it('rejects ambiguous public destinations', async () => {
    const result = await discoverGoogleNews(
      {},
      {
        fetch: fixture(`<link rel="canonical" href="${original}"><meta http-equiv="refresh" content="0; url=https://other.example/story">`),
      },
    );
    expect(result.items).toEqual([]);
  });

  it('accepts direct RSS article links and older public URL parameters without fetching wrappers', async () => {
    const indirect = `https://news.google.com/news/url?url=${encodeURIComponent(original)}`;
    const fetch = vi.fn<typeof fetchText>(async (url) => response(url, xml([original, indirect])));
    const result = await discoverGoogleNews({}, { fetch });
    expect(result.items).toEqual([{ url: original, title, discoveryUrl: rssUrl }]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    'http://127.0.0.1/a',
    'http://[::1]/a',
    'http://localhost/a',
    'http://api.internal/a',
    'https://user:pass@example.com/a',
    'javascript:alert(1)',
    'https://accounts.google.com/ServiceLogin',
  ])('never returns unsafe or Google-account destinations: %s', async (url) => {
    const result = await discoverGoogleNews({}, { fetch: fixture(`<meta http-equiv="refresh" content="0;url=${url}">`) });
    expect(result.items).toEqual([]);
  });

  it('only reads official listing URLs and does not trust externally redirected feeds', async () => {
    const fetch = vi.fn<typeof fetchText>(async () => response('https://other.example/feed', xml([original])));
    expect((await discoverGoogleNews({ rssUrl: 'https://other.example/feed' }, { fetch })).items).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect((await discoverGoogleNews({}, { fetch })).items).toEqual([]);
  });

  it.each([403, 429])('stops without retry on access restriction %i', async (status) => {
    const fetch = vi.fn<typeof fetchText>(async (url) =>
      response(url, url === rssUrl ? xml([first, second]) : '', url === rssUrl ? 200 : status),
    );
    const browser = vi.fn();
    const result = await discoverGoogleNews({}, { fetch, resolveInBrowser: browser });
    expect(result.items).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(browser).not.toHaveBeenCalled();
    expect(result.errors.join(' ')).toContain('stopped without retry');
  });

  it('accepts an injected normal browser navigation and records the wrapper provenance', async () => {
    const browser = vi.fn().mockResolvedValue({ url: original, blocked: false });
    const result = await discoverGoogleNews(
      { maxItems: 1, maxRequests: 3 },
      { fetch: fixture('<link rel="canonical" href="' + first + '">'), resolveInBrowser: browser },
    );
    expect(browser).toHaveBeenCalledWith(first);
    expect(result.items).toEqual([{ url: original, title, discoveryUrl: first }]);
    expect(result.attempted).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it.each(['captcha', 'startup'])('does not restart browser attempts after %s failure', async (failure) => {
    const fetch = vi.fn<typeof fetchText>(async (url) =>
      response(url, url === rssUrl ? xml([first, second]) : '<title>Google News</title>'),
    );
    const browser =
      failure === 'captcha'
        ? vi.fn().mockResolvedValue({ url: original, blocked: true })
        : vi.fn().mockRejectedValue(new Error('Chromium unavailable'));
    const result = await discoverGoogleNews({}, { fetch, resolveInBrowser: browser });
    expect(result.items).toEqual([]);
    expect(browser).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('shares the finite request budget between HTTP and browser resolutions', async () => {
    const browser = vi.fn();
    const result = await discoverGoogleNews({ maxRequests: 2 }, { fetch: fixture('opaque'), resolveInBrowser: browser });
    expect(result.attempted).toBe(2);
    expect(browser).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });

  it('extracts only explicit headline links from an optional official HTML listing', async () => {
    const home = 'https://news.google.com/home';
    const fetch = vi.fn<typeof fetchText>(async (url) =>
      response(
        url,
        url === rssUrl
          ? '<rss><channel/></rss>'
          : `<a href="https://other.example/account">登入</a><h3><a href="${original}">${title}</a></h3>`,
      ),
    );
    const result = await discoverGoogleNews({ htmlUrl: home }, { fetch });
    expect(result.items).toEqual([{ url: original, title, discoveryUrl: home }]);
  });
});

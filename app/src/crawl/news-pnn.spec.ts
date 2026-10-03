import { describe, expect, it } from 'vitest';
import type { fetchText } from './fetch.ts';
import { discoverNews } from './news-discovery.ts';
import { discoverPnn, pnnArticle, pnnCandidates } from './news-pnn.ts';

const row = {
  postId: '4317a6a5-5911-4dcf-8808-a2003b8e2e98',
  viewerURL: 'http://pnn5.aotter.net/viewer/4317a6a5-5911-4dcf-8808-a2003b8e2e98',
  originURL: 'https://www.cna.com.tw/news/aipl/202610020345.aspx',
  title: '公開新聞測試標題 | 中央社 CNA',
  reference: '中央社 CNA',
  publishedDate: new Date('2026-10-03T01:06:00Z').getTime(),
};
const candidate = pnnCandidates({ success: [row] })[0];
const paragraphs = [
  '（中央社記者王大明台北2日電）今日地方政府公布交通改善方案，說明工程背景、經費安排與交通調整。',
  ...Array.from(
    { length: 8 },
    (_, i) => `第${i + 1}段報導內容：居民表示期待路線改善，政府將在公開會議蒐集意見並檢討執行進度，記者訪問專家說明對日常生活的影響。`,
  ),
  '政府表示將持續觀察。（編輯：陳承功）1151002',
];
const original = (date = '2026-10-02T14:08:00Z', title = row.title) =>
  `<title>${title}</title><link rel="canonical" href="${row.originURL}"><script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', url: row.originURL, datePublished: date, dateModified: '2026-10-03T02:00:00Z' })}</script><div class="PrimarySide"><div class="paragraph">${paragraphs.map((p) => `<p>${p}</p>`).join('')}</div></div>`;
const viewer = (ps = paragraphs) =>
  `<section id="main"><header id="header"><h1>${row.title}</h1></header><div id="article-content"><div><p>分享按鈕不是正文</p></div><div>${ps.map((p) => `<p>${p}</p>`).join('')}<div><p>贊助與下載APP</p></div></div><p>網站版權聲明</p></div></section>`;
const now = new Date('2026-10-03T13:00:00Z');

describe('PNN hosted CNA stories with independently checked publication evidence', () => {
  it('uses original publication time, keeps provider/source URL and removes surrounding reader controls', () => {
    const item = pnnArticle(candidate, viewer(), original(), now);
    expect(item?.publishedAt?.toISOString()).toBe('2026-10-02T14:08:00.000Z');
    expect(item?.url).toBe(row.viewerURL.replace('http:', 'https:'));
    expect(item?.description).toContain(row.originURL);
    expect(item?.creator).toBe('中央社 CNA');
    expect(item?.verifiedContent?.body).toContain(paragraphs.at(-1));
    expect(item?.verifiedContent?.body).not.toMatch(/分享按鈕|贊助|版權聲明/);
  });
  it('allows a changed reporter byline when the complete article and closing paragraph still match', () => {
    const ps = [...paragraphs];
    ps[0] = ps[0].replace('王大明', '');
    expect(pnnArticle(candidate, viewer(ps), original(), now)).not.toBeNull();
  });
  it('rejects restricted original or viewer even when hidden body paragraphs match', () => {
    expect(pnnArticle(candidate, viewer() + '<div id="paywall"></div>', original(), now)).toBeNull();
    expect(
      pnnArticle(
        candidate,
        viewer(),
        original() + '<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>',
        now,
      ),
    ).toBeNull();
  });
  it('does not mistake a matching opening excerpt or missing closing paragraph for full text', () => {
    expect(pnnArticle(candidate, viewer(paragraphs.slice(0, 3)), original(), now)).toBeNull();
    expect(pnnArticle(candidate, viewer(paragraphs.slice(0, -1)), original(), now)).toBeNull();
  });
  it('rejects unrelated text or mismatched title', () => {
    const unrelated = ['（中央社記者台北2日電）', '完全不相關的事件內容。'.repeat(50)];
    expect(pnnArticle(candidate, viewer(unrelated), original(), now)).toBeNull();
    expect(pnnArticle(candidate, viewer(), original('2026-10-02T14:08:00Z', '另一篇新聞'), now)).toBeNull();
  });
  it('never falls back to the aggregator batch timestamp when original publication time is unavailable', () => {
    expect(pnnArticle(candidate, viewer(), original(''), now)).toBeNull();
    expect(pnnArticle(candidate, viewer(), original('2026-12-01T00:00:00Z'), now)).toBeNull();
  });
  it('keeps old original publication dates only with archive inclusion', () => {
    expect(pnnArticle(candidate, viewer(), original('2024-10-02T14:08:00Z'), now)).toBeNull();
    expect(pnnArticle(candidate, viewer(), original('2024-10-02T14:08:00Z'), now, true)?.publishedAt?.toISOString()).toBe(
      '2024-10-02T14:08:00.000Z',
    );
  });
  it.each([
    { originURL: 'http://127.0.0.1/article' },
    { originURL: 'https://www.cna.com.tw@127.0.0.1/article' },
    { originURL: 'https://user:pass@www.cna.com.tw/news/aipl/202610020345.aspx' },
    { originURL: 'https://www.cna.com.tw/news/aipl/202610020345.aspx?next=https://example.com' },
    { originURL: 'https://www.cna.com.tw/about' },
    { viewerURL: 'https://unrelated.example/viewer/4317a6a5-5911-4dcf-8808-a2003b8e2e98' },
    { viewerURL: 'https://pnn5.aotter.net/viewer/wrong-id' },
    { reference: 'Ptt 批踢踢實業坊' },
  ])('rejects unreviewed feed references before any network access: %j', (change) => {
    expect(pnnCandidates({ success: [{ ...row, ...change }] })).toEqual([]);
  });
  it('fetches only scoped first-party viewer and original and ignores feed batch date', async () => {
    const fetch: typeof fetchText = async (url) => ({
      url,
      status: 200,
      body: url.includes('/api/pnn/') ? JSON.stringify({ success: [row] }) : url.includes('/viewer/') ? viewer() : original(),
      contentType: 'text/html',
      ms: 1,
    });
    const result = await discoverPnn({ homeUrl: 'https://pnn.tw/' }, { fetch, now: () => now });
    expect(result.items).toHaveLength(1);
    expect(result.attempted).toBe(3);
    expect(result.samples[0].publishedAt).toBe('2026-10-02T14:08:00.000Z');
  });
  it('uses this adapter through the standard discovery entrypoint', async () => {
    const fetch: typeof fetchText = async (url) => ({
      url,
      status: 200,
      body: url.includes('/api/pnn/') ? JSON.stringify({ success: [row] }) : url.includes('/viewer/') ? viewer() : original(),
      contentType: 'text/html',
      ms: 1,
    });
    const result = await discoverNews({ homeUrl: 'https://pnn.tw/' }, { fetch, now: () => now });
    expect(result.strategy).toBe('api');
    expect(result.items[0]?.publishedAt?.toISOString()).toBe('2026-10-02T14:08:00.000Z');
    expect(result.items[0]?.verifiedContent?.body).toContain(paragraphs.at(-1));
  });
  it('stops on rate limiting without requesting either body', async () => {
    let calls = 0;
    const fetch: typeof fetchText = async (url) => {
      calls++;
      return { url, status: 429, body: '', contentType: 'text/html', ms: 1 };
    };
    expect((await discoverPnn({ homeUrl: 'https://pnn.tw/' }, { fetch })).items).toEqual([]);
    expect(calls).toBe(1);
  });
});

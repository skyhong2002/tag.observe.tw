import { describe, expect, it } from 'vitest';
import { authorCreditParts, authorDisplay } from '../../web/src/lib/author-display.mts';
import { publicArticle } from '../src/similarity/compute.ts';

const source = (media: string, name: string, evidence: string) => ({ media, name, evidence });
describe('liveboard author and source roles', () => {
  it.each(['友站新聞', '社論', '責任編輯 靳璦', '責任編輯：靳璦'])('omits the non-author credit %s', (credit) => {
    expect(authorDisplay([credit])).toBe('未署名');
  });
  it('keeps the named author when a separate credit names an editor', () => {
    expect(authorDisplay(['王俊勝', '責任編輯 靳璦'])).toBe('作者 王俊勝');
  });
  it('uses the same author/source grouping on similarity articles', () => {
    const article = publicArticle({
      id: 1,
      media: 'msn',
      title: '新聞',
      url: 'https://example.com/',
      publishedAt: new Date('2026-10-06T00:00:00Z'),
      authors: ['TVBS新聞網', '高鈺婷'],
      creator: 'TVBS新聞網',
      chars: 500,
      attributions: [
        { media: 'tvbs', name: 'TVBS新聞網', country: '台灣', countryCode: 'TW', kind: 'explicit', evidence: '內容提供者：TVBS新聞網' },
      ],
    });
    expect(authorDisplay(article.authors, article)).toBe('作者 高鈺婷 · 來源 TVBS新聞網');
    expect(authorCreditParts(article.authors, article).find((part) => part.media === 'tvbs')?.evidence).toBe('內容提供者：TVBS新聞網');
  });
  it('separates an MSN writer from the supplying publisher', () => {
    expect(authorDisplay(['TVBS新聞網', '高鈺婷'], { media: 'msn' })).toBe('作者 高鈺婷 · 來源 TVBS新聞網');
  });
  it('preserves both named authors', () => {
    expect(authorDisplay(['金東天', '薛秀蓮'])).toBe('作者 金東天、薛秀蓮');
  });
  it('does not call a named translator a reporter', () => {
    expect(authorDisplay(['經濟日報／ 編譯葉亭均／綜合外電'])).toBe('作者 葉亭均');
  });
  it('preserves the original writer and translator', () => {
    expect(authorDisplay(['文 / Amy Denney 編譯 / 朱緯'])).toBe('作者 Amy Denney、朱緯');
  });
  it.each(['網路溫度計', '民間全民電視公司', '1111人力銀行 | 全球華人股份有限公司'])('keeps %s as an institutional byline', (credit) => {
    expect(authorDisplay([credit])).toBe(`機構署名 ${credit}`);
  });
  it('does not turn an institutional author into a cited outlet', () => {
    expect(authorCreditParts(['網路溫度計'], { media: 'pchome' })).toEqual([{ label: '機構署名', text: '網路溫度計' }]);
  });
  it('shows an explicit AFP citation alongside the FTV institutional byline', () => {
    expect(authorDisplay(['民間全民電視公司'], { media: 'ftv', attributions: [source('afp', '法新社', 'AFP 法新社報導')] })).toBe(
      '機構署名 民間全民電視公司 · 引用 法新社',
    );
  });
  it('shows a CNA source and a separate AFP citation', () => {
    expect(authorDisplay(['中央社'], { media: 'pchome', attributions: [source('afp', '法新社', '法新社報導')] })).toBe(
      '來源 中央社 · 引用 法新社',
    );
  });
  it('uses the agency dateline as a source, not a person', () => {
    expect(authorDisplay(['中央社台北5日電'], { media: 'worldjournal' })).toBe('來源 中央社');
  });
  it('keeps evidence and an internal media link for an explicit source', () => {
    expect(authorCreditParts([], { media: 'msn', attributions: [source('tvbs', 'TVBS新聞網', '內容提供者：TVBS新聞網')] })).toEqual([
      { label: '來源', text: 'TVBS新聞網', media: 'tvbs', evidence: '內容提供者：TVBS新聞網' },
    ]);
  });
  it('deduplicates an outlet without discarding explicit evidence', () => {
    const parts = authorCreditParts(['中央社'], { media: 'pchome', attributions: [source('cna', '中央社', '中央社報導')] });
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ label: '引用', evidence: '中央社報導' });
  });
  it('ignores a publisher citing itself and technical page credits', () => {
    expect(authorDisplay(['牧迪網頁設計'], { media: 'bo6s', attributions: [source('bo6s', '波新聞', '波新聞報導')] })).toBe('未署名');
  });
  it('retains an unclassified original credit without inventing a role', () => {
    expect(authorDisplay(['新聞編輯'])).toBe('機構署名 新聞編輯');
  });
  it('does not invent an author for missing credits', () => {
    expect(authorDisplay([])).toBe('未署名');
  });
});

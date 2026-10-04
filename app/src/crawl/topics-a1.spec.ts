import { describe, expect, it } from 'vitest';
import { childSelectorFor, fetchTopicListings, TOPIC_RULES } from './topics.ts';

const ruleOf = (media: string) => TOPIC_RULES.find((r) => r.media === media)!;
const response = (url: string, body: string, status = 200) => ({ url, body, status, contentType: 'text/html', ms: 1 });

describe('CNA 新聞專題', () => {
  const api = 'https://www.cna.com.tw/cna2018api/api/WNewsList';
  const html = `<a href="https://netzero.cna.com.tw/">淨零碳排</a><a href="https://academy.cna.com.tw/">新聞學院</a>
    <ul id="jsMainList"><li><a href="/topic/newstopic/5056.aspx"><img data-src="https://img/5056.jpg"><h2><span>2026九合一選舉</span></h2></a></li>
    <li><a href="https://netzero.cna.com.tw"><h2><span>淨零碳排</span></h2></a></li>
    <li><a href="/news/aipl/202610040066.aspx"><h2><span>一則新聞</span></h2></a></li></ul>`;
  const page = (items: object[], next: string) => JSON.stringify({ Result: 'Y', ResultData: { NextPageIdx: next, Items: items } });

  it('reads the HTML list, then pages through the WNewsList API by POST', async () => {
    const calls: [string, string | undefined, string | undefined][] = [];
    const bodies = [
      html,
      page(
        [
          { PageUrl: 'https://www.cna.com.tw/topic/newstopic/4655.aspx', HeadLine: '川普關稅戰', ImageM: 'https://img/4655.jpg' },
          { PageUrl: 'https://www.cna.com.tw/news/aipl/1.aspx', HeadLine: '新聞' },
          { PageUrl: 'https://other.example/topic/newstopic/1.aspx', HeadLine: '外站' },
        ],
        '3',
      ),
      page([], ''),
    ];
    const result = await fetchTopicListings(ruleOf('cna'), async (url, opts) => {
      if (url.endsWith('.json')) return response(url, '{"NewsItems":[]}');
      calls.push([url, opts?.method, opts?.body]);
      return response(url, bodies[calls.length - 1]);
    });
    expect(calls.map(([url, method]) => [url, method])).toEqual([
      ['https://www.cna.com.tw/list/newstopic.aspx', undefined],
      [api, 'POST'],
      [api, 'POST'],
    ]);
    expect(JSON.parse(calls[1][2]!)).toEqual({ action: '0', category: 'newstopic', pagesize: '20', pageidx: 2 });
    expect(result.items.map((t) => [t.title, t.url, t.kind, t.page, t.image])).toEqual([
      ['2026九合一選舉', 'https://www.cna.com.tw/topic/newstopic/5056.aspx', 'topic', 1, 'https://img/5056.jpg'],
      ['淨零碳排', 'https://netzero.cna.com.tw/', 'topic', 1, null],
      ['川普關稅戰', 'https://www.cna.com.tw/topic/newstopic/4655.aspx', 'topic', 2, 'https://img/4655.jpg'],
    ]);
    expect(result.sources[0]).toMatchObject({ url: 'https://www.cna.com.tw/list/newstopic.aspx', kind: 'topic', items: 3, pages: 2 });
  });

  it('reads sub-topics on its topic pages', () => {
    expect(childSelectorFor('cna', 'https://www.cna.com.tw/topic/newstopic/5056.aspx')).toBe('.definKind h2 a');
    expect(childSelectorFor('cna', 'https://www.cna.com.tw/project/20260430-danjiang-bridge/')).toBeUndefined();
  });
});

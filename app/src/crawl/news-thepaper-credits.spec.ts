import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';
import { thePaperCredits } from './news-thepaper-credits.ts';

const url = 'https://www.thepaper.cn/newsDetail_forward_34209759';
const page = (credit: string, changes = {}) => {
  const state = {
    props: {
      pageProps: {
        contId: 34209759,
        detailData: { contentDetail: { contId: 34209759, name: '原文章標題', author: credit, originalFlag: '2', ...changes } },
      },
    },
  };
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script><main><h1>原文章標題</h1><div class="headerContent__abc"><div class="left__def"><div>${credit}</div></div></div><div class="cententWrap__ghi"><p>原文章完整內容。</p></div><div>责任编辑：苏晨</div></main>`;
};

it('splits The Paper explicitly declared reporters and contributing trainee credits after article and visible-header corroboration', () => {
  for (const [credit, names] of [
    ['澎湃新闻记者 邹娟 见习记者 洪旭东', ['邹娟', '洪旭东']],
    ['澎湃新闻记者 陈绪厚 实习生 王肖丝雨', ['陈绪厚', '王肖丝雨']],
    ['澎湃新闻记者 陈悦 徐亦嘉 俞凯', ['陈悦', '徐亦嘉', '俞凯']],
    ['澎湃新闻记者 邹佳雯', ['邹佳雯']],
  ] as const)
    expect(extractArticle(page(credit), url).authors).toEqual(names);
  expect(extractArticle(page('唐健辉/新华网客户端'), url)).toMatchObject({ authors: ['唐健辉'], provider: '新华网' });
  const client = extractArticle(page('新华网客户端'), url);
  expect(client.authors).toEqual(['新华网客户端']);
  expect(extractAttributions(client.body ?? '', 'thepaper', client.provider).map((a) => a.media)).toEqual(['xinhuanet']);
  const agency = extractArticle(page('新华社'), url);
  expect(extractAttributions(agency.body ?? '', 'thepaper', agency.provider).map((a) => a.media)).toEqual(['xinhua']);
  expect(extractArticle(page('澎湃新闻记者 陈绪厚  实习生 王肖丝雨'), url).authors).toEqual(['陈绪厚', '王肖丝雨']);
});

it('does not normalize unmatched or incomplete The Paper embedded author records', () => {
  const credit = '澎湃新闻记者 邹佳雯';
  for (const changes of [{ contId: 123 }, { name: '另一文章' }, { author: '王小明' }, { originalFlag: '9' }])
    expect(thePaperCredits(load(page(credit, changes)), url)).toBeNull();
  expect(thePaperCredits(load(page('责任编辑：苏晨')), url)).toBeNull();
  expect(thePaperCredits(load(page(`${credit}提供活動介紹`)), url)).toBeNull();
  expect(thePaperCredits(load(page(credit)), 'https://example.com/newsDetail_forward_34209759')).toBeNull();
});

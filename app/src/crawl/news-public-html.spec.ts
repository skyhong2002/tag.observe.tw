import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { parsePublicJson, publicArticleHtml } from './news-public-html.ts';

describe('public publisher hydration', () => {
  it('strips JSON comments and CDATA wrappers without changing URL/string contents', () => {
    const input =
      '/*<![CDATA[*/{"url":"https://paper.test/a//b", // publisher comment\n"headline":"An escaped \\"quote\\" and /* literal */", "image": [ /* size note */ "https://img.test/a.jpg"]}/*]]>*/';
    expect(parsePublicJson(input)).toEqual({
      url: 'https://paper.test/a//b',
      headline: 'An escaped "quote" and /* literal */',
      image: ['https://img.test/a.jpg'],
    });
    expect(() => parsePublicJson('{"headline": function(){ return "fake"; }}')).toThrow();
  });

  it('adds QQ full public story only for matching identity and explicit nonpay status', () => {
    const url = 'https://news.qq.com/rain/a/20261003A07YKE00';
    const data = {
      article_id: '20261003A07YKE00',
      title: '新聞',
      pubtime: '2026-10-03 17:47:37',
      article_is_pay: false,
      payment_column_info_v1: { is_column_pay: false, is_column_article_pay: false },
      originContent: { text: '<p>公開新聞全文</p>' },
    };
    const html = () => `<script>window.DATA=${JSON.stringify(data)};</script>`;
    const restored = publicArticleHtml(html(), url);
    const $ = cheerio.load(restored);
    const article = JSON.parse($('script[data-news-public]').text());
    expect(article).toMatchObject({ '@type': 'NewsArticle', url, articleBody: '<p>公開新聞全文</p>' });
    expect(publicArticleHtml(restored, url)).toBe(restored);
    data.payment_column_info_v1.is_column_article_pay = true;
    expect(publicArticleHtml(html(), url)).toBe(html());
    data.payment_column_info_v1.is_column_article_pay = false;
    data.article_id = '20261003AOTHER';
    expect(publicArticleHtml(html(), url)).toBe(html());
  });

  it('does not expose arbitrary hidden transport or other hosts', () => {
    const html = '<template id="B:0"></template><div hidden id="S:0"><p>Hidden body</p></div>';
    expect(publicArticleHtml(html, 'https://paper.test/news/1')).toBe(html);
    const restored = cheerio.load(publicArticleHtml(html, 'https://taiwannews.com.tw/news/1'));
    expect(restored('[id="S:0"]').attr('hidden')).toBeDefined();
  });
});

import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { voicettankAuthors, voicettankCategoryRepair, voicettankFeedCreator } from './news-voicettank.ts';

const url = 'https://voicettank.org/20261008-2/';
const account = 'https://voicettank.org/author/1234567890/';
const title = '【書摘】《戰後日本政治史》';
function page(name = '【書摘】') {
  const graph = [
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      mainEntityOfPage: { '@id': `${url}#webpage` },
      headline: title,
      author: { '@id': `${account}#author` },
    },
    { '@type': 'Person', '@id': `${account}#author`, name, url: account },
    { '@type': 'BlogPosting', mainEntityOfPage: url, headline: title, author: { '@type': 'Person', name, url: account } },
  ];
  return `<link rel="canonical" href="${url}"><meta property="og:url" content="${url}"><meta property="og:title" content="${title} – 思想坦克｜Voicettank"><meta name="author" content="${name}"><script type="application/ld+json">${JSON.stringify({ '@graph': graph })}</script><body class="single-post postid-33990"><article id="post-33990" class="post type-post"><div class="header-standard header-classic single-header"><h1 class="entry-title">${title}</h1><span class="author vcard"><a class="author-url" href="${account}">${name}</a></span><span class="author vcard"><a class="author-url" href="${account}">${name}</a></span></div><div class="post-entry"><p>正文由媒體選出的一段書摘，介紹日本政治史的相關發展。</p><p>書名：戰後日本政治史<br>作者：境家史郎<br>出版社：台大出版中心</p><p>推薦閱讀：王宏恩專欄。攝影：陳大明。</p></div></article></body>`;
}
it('excludes only the corroborated shared book-excerpt account without assigning the book author or recommendation writer', () => {
  const html = page();
  expect(voicettankAuthors(load(html), url)).toEqual([]);
  const article = extractArticle(html, url);
  expect(article.authors).toEqual([]);
  expect(article.body).toContain('境家史郎');
  expect(article.authors).not.toContain('王宏恩');
});
it('preserves named column writers rather than filtering actual contributors', () => {
  expect(voicettankAuthors(load(page('王宏恩')), url)).toBeNull();
  expect(extractArticle(page('王宏恩'), url).authors).toEqual(['王宏恩']);
});
it('requires matching own article identities, headline and linked account in both structured declarations', () => {
  for (const html of [
    page().replace(`rel="canonical" href="${url}`, 'rel="canonical" href="https://voicettank.org/20261008-1/'),
    page().replace('postid-33990', 'postid-33991'),
    page().replace('single-post', 'archive'),
    page().replace('class="entry-title">' + title, 'class="entry-title">其他書摘'),
    page().replace('content="' + title + ' –', 'content="其他書摘 –'),
    page().replace('"mainEntityOfPage":"' + url, '"mainEntityOfPage":"https://voicettank.org/other/'),
    page().replace('"name":"【書摘】"', '"name":"王宏恩"'),
    page().replace('class="author-url" href="' + account, 'class="author-url" href="https://other.test/'),
    page() + `<link rel="canonical" href="${url}">`,
    page() + '<h1>推薦作品</h1>',
    page().replace('type="application/ld+json"', 'type="text/plain"'),
  ])
    expect(voicettankAuthors(load(html), url)).toBeNull();
  expect(voicettankAuthors(load(page()), 'https://other.test/20261008-2/')).toBeNull();
  expect(voicettankAuthors(load(page()), 'invalid')).toBeNull();
});

it('keeps the known RSS category from restoring a cleared journalist credit while preserving real stored contributors', () => {
  expect(voicettankFeedCreator('voicettank', '【書摘】')).toBeNull();
  expect(voicettankFeedCreator('voicettank', '王宏恩')).toBe('王宏恩');
  expect(voicettankFeedCreator('other', '【書摘】')).toBe('【書摘】');
  expect(voicettankCategoryRepair('voicettank', { authors: ['【書摘】'], creator: '【書摘】' }, [])).toEqual({
    authors: [],
    creator: null,
  });
  expect(voicettankCategoryRepair('voicettank', { authors: null, creator: '【書摘】' }, [])).toEqual({ authors: [], creator: null });
  expect(voicettankCategoryRepair('voicettank', { authors: ['王宏恩', '【書摘】'], creator: '王宏恩、【書摘】' }, [])).toEqual({
    authors: ['王宏恩'],
    creator: '王宏恩',
  });
  expect(voicettankCategoryRepair('voicettank', { authors: ['王宏恩'], creator: '王宏恩' }, [])).toBeNull();
  expect(voicettankCategoryRepair('voicettank', { authors: ['【書摘】'] }, ['王宏恩'])).toBeNull();
  expect(voicettankCategoryRepair('other', { authors: ['【書摘】'] }, [])).toBeNull();
});

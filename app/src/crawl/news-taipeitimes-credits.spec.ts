import { expect, it } from 'vitest';
import { extractAttributions } from '../similarity/attribution.ts';
import { extractArticle } from './article.ts';
import { sourceByMedia } from './registry.ts';

it('distinguishes Taipei Times main agency dispatch credit from the city and photo credit', () => {
  const url = 'https://www.taipeitimes.com/News/feat/archives/2026/10/08/2003865586';
  const spec = sourceByMedia('taipeitimes')?.article;
  const html = `<meta property="og:url" content="${url}"><meta property="article:published_time" content="2026-10-08T00:00:00+08:00"><li id="left_blake"><div class="archives"><h1>Own report</h1><ul class="boxTitle"><li><div class="name">AFP, WASHINGTON, DC</div></li></ul><p>Own complete report.</p><p>Photo: AP</p></div></li><aside><div class="name">Reuters, LONDON</div></aside>`;
  const parsed = extractArticle(html, url, spec);
  expect(parsed).toMatchObject({ authors: ['AFP'], provider: 'AFP', publishedAt: new Date('2026-10-07T16:00:00Z') });
  expect(extractAttributions(parsed.body ?? '', 'taipeitimes', parsed.provider).map((a) => a.media)).toEqual(['afp']);
  const personal = extractArticle(html.replace('AFP, WASHINGTON, DC', 'Juan Fernando Herrera Ramos'), url, spec);
  expect(personal.authors).toEqual(['Juan Fernando Herrera Ramos']);
  expect(personal.provider).toBeNull();
  expect(extractAttributions(personal.body ?? '', 'taipeitimes', personal.provider)).toEqual([]);
  expect(extractArticle(html.replace('AFP, WASHINGTON, DC', 'AFP, WASHINGTON, DC via a commentator'), url, spec).provider).toBeNull();
  expect(
    extractArticle(html.replace(`content="${url}"`, 'content="https://www.taipeitimes.com/News/feat/archives/2026/10/08/000"'), url, spec)
      .provider,
  ).toBeNull();
});

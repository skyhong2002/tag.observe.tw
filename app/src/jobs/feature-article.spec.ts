import { expect, it, vi } from 'vitest';
import type { ArticleDetail } from '../crawl/article.ts';
import type { Db } from '../db/client.ts';
import { indexFeatureArticle } from './feature-article.ts';

const { runIndex } = vi.hoisted(() => ({ runIndex: vi.fn(async (..._args: unknown[]) => ({ inserted: 1 })) }));
vi.mock('../crawl/pipeline.ts', () => ({ runIndex }));

it('indexes the feature itself with its own original date, body and tags, including short introductions', async () => {
  const feature = { media: 'cna', url: 'https://www.cna.com.tw/project/feature', title: '專題名稱', image: null };
  const detail: ArticleDetail = {
    body: '這是原站專題的導言。',
    bodyStatus: 'short',
    bodySource: 'selector:p',
    authors: [],
    tags: ['原站標籤'],
    image: null,
    description: null,
    canonical: null,
    title: '專題名稱',
    publishedAt: new Date('2020-01-01'),
    provider: null,
    keywordSource: 'meta',
  };
  await indexFeatureArticle({} as Db, feature, detail);
  expect(runIndex.mock.calls[0][2]).toEqual({
    listed: {
      errors: [],
      items: [
        {
          url: feature.url,
          title: feature.title,
          publishedAt: detail.publishedAt,
          tags: detail.tags,
          verifiedContent: { body: detail.body, bodyStatus: 'short', bodySource: detail.bodySource, authors: [] },
        },
      ],
    },
  });
});

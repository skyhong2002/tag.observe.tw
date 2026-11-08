import { describe, expect, it } from 'vitest';
import { sourceByMedia } from './registry.ts';
import { urlKey } from './text.ts';

describe('yahoo url_key (#30)', () => {
  const spec = sourceByMedia('yahoo');
  const key = (url: string) => urlKey(url, spec?.list.articleId);

  it('does not merge unrelated stories that share the nine-digit suffix', () => {
    const old = key('https://tw.news.yahoo.com/2歲還不講話-情緒障礙是主因-010000049.html');
    const other = key('https://tw.news.yahoo.com/%E5%8B%95%E7%95%AB-mappa-%E6%9C%80%E6%96%B0-010000049.html');
    expect(old).not.toBe(other);
    expect(old).not.toContain('#');
  });

  it('still folds tracking and fragment variants of the same story', () => {
    expect(key('https://tw.news.yahoo.com/story-010000049.html?utm_source=x#top')).toBe(
      key('https://tw.news.yahoo.com/story-010000049.html'),
    );
  });
});

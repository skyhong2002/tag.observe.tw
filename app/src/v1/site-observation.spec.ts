import { describe, expect, it } from 'vitest';
import { fallbackTitle, pageKind } from './site-observation.ts';

describe('observed page names', () => {
  it('names pages whose GA title is only the site name from their path', () => {
    expect(fallbackTitle('/article/')).toBe('最新文章');
    expect(fallbackTitle('/tag/蔣萬安/')).toBe('蔣萬安新聞與趨勢');
    expect(fallbackTitle('/journalist/方承業/')).toBe('方承業 的報導');
    expect(fallbackTitle('/article/42/', new Map([[42, '某篇報導']]))).toBe('某篇報導');
    expect(fallbackTitle('/eve/914/')).toBe('事件 #914');
    expect(fallbackTitle('/unknown/path/')).toBe('/unknown/path/');
    expect(pageKind('/tag/蔣萬安/')).toBe('tag');
  });
});

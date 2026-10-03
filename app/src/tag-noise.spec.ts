import { describe, expect, it } from 'vitest';
import { isTagNoise } from './tag-noise.ts';

describe('analysis noise', () => {
  it('excludes categories and standalone Gregorian/ROC years in common forms', () => {
    for (const tag of [
      '地方',
      '生活',
      '地方生活',
      '2015',
      '2015年',
      '115年',
      '民國115年',
      '２０２６年',
      '二〇一五年',
      '一五年',
      'NO_TAG',
    ]) {
      expect(isTagNoise(tag), tag).toBe(true);
    }
  });
  it('keeps financial codes and specific subjects even when no_equal excludes them', () => {
    for (const tag of ['0050', '0056', '3C', '2026大選', '台灣', '日本', '民進黨', '少年', '青年', '生活美學', '彭佳慧']) {
      expect(isTagNoise(tag), tag).toBe(false);
    }
  });
});

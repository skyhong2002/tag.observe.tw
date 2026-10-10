import { describe, expect, it } from 'vitest';
import { diffBody, diffTitle } from './text-diff.ts';

const show = (segments: [number, string][]) => segments.map(([op, t]) => (op === 0 ? t : op < 0 ? `[-${t}-]` : `{+${t}+}`)).join('');

describe('text diff', () => {
  it('ignores width variants and spacing in titles', () => {
    expect(diffTitle('國慶焰火台東登場！1.9萬發煙火　逾500人', '國慶焰火台東登場! 1.9萬發煙火 逾500人')).toEqual([
      [0, '國慶焰火台東登場! 1.9萬發煙火 逾500人'],
    ]);
  });

  it('keeps numbers whole and marks both sides of a replacement', () => {
    expect(show(diffTitle('共1.9萬發煙火', '共19萬發煙火')!)).toBe('共[-1.9-]{+19+}萬發煙火');
  });

  it('shows only the changed spots of a body with a short context', () => {
    const kept = '巴黎車展是歐洲歷史最悠久的汽車展會之一，第91屆巴黎車展將於10月12日至18日舉行。';
    const diff = diffBody(
      `下周一開幕的巴黎車展。${kept}今年第二季度市場份額達到10.7%。`,
      `本文共40字\n\n周一開幕的巴黎車展。${kept}今年第2季市場占有率達到10.7%。`,
    )!;
    expect(diff.identical).toBe(false);
    expect(diff.hunks.map(show)).toEqual([
      '[-下-]周一開幕的巴黎車展。巴黎車展…',
      '…月12日至18日舉行。今年第[-二季度-]{+2季+}市場[-份額-]{+占有率+}達到10.7%。',
    ]);
    expect(diff).toMatchObject({ removed: 6, added: 5, more: 0 });
  });

  it('reports identical bodies, site chrome aside', () => {
    expect(
      diffBody('第一段。\n\n第二段。', '本文共8字\n\n第一段。\n第二段。\n\n※ 歡迎用「轉貼」或「分享」的方式轉傳文章連結'),
    ).toMatchObject({
      identical: true,
      hunks: [],
    });
  });

  it('gives up on rewrites too large to show', () => {
    const a = Array.from({ length: 2000 }, (_, i) => String.fromCodePoint(0x4e00 + (i % 500))).join('');
    const b = Array.from({ length: 2000 }, (_, i) => String.fromCodePoint(0x6000 + (i % 500))).join('');
    expect(diffBody(a, b)).toBeNull();
  });
});

describe('rewrites', () => {
  it('leaves rewritten versions unmarked', () => {
    expect(diffTitle('賴清德國慶談話不讓威權侵蝕民主', '陸委會回嗆國台辦：摒棄鴕鳥心態')).toBeNull();
    const kept = '巴黎車展是歐洲歷史最悠久的汽車展會之一。';
    expect(diffBody(`${kept}甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉`, `${kept}一二三四五六七八九十天地玄黃宇宙洪荒日月`)).toBeNull();
  });
});

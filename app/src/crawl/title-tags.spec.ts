import { describe, expect, it } from 'vitest';
import { buildVocab, tagsFromTitle } from './title-tags.ts';

const vocab = buildVocab([
  { tag: '川普', n: 60 },
  { tag: '川習會', n: 40 },
  { tag: '習近平', n: 55 },
  { tag: '桃園機場', n: 20 },
  { tag: '桃園', n: 30 },
  { tag: '人生', n: 4 },
  { tag: '切割', n: 30 },
  { tag: '人生切割術', n: 5 },
  { tag: 'AI', n: 50 },
  { tag: '輝達', n: 25 },
  { tag: '中央社', n: 99 },
  { tag: '2026', n: 80 },
  { tag: '亞運', n: 45 },
]);

describe('tagsFromTitle', () => {
  it('finds known tags, prefers longer matches, orders by frequency', () => {
    expect(tagsFromTitle('川習會登場 川普與習近平談AI晶片', vocab)).toEqual(['川普', '習近平', 'AI', '川習會']);
    expect(tagsFromTitle('桃園機場大排長龍', vocab)).toEqual(['桃園機場']);
    expect(tagsFromTitle('台北市長參訪', vocab)).toEqual([]); // generic per the no-equal list
  });
  it('drops generic tags, pure numbers and Latin tags inside words', () => {
    expect(tagsFromTitle('中央社報導 2026 AIRBUS 新機', vocab)).toEqual([]);
    expect(tagsFromTitle('輝達推出新AI晶片', vocab)).toEqual(['AI', '輝達']);
  });
  it('ignores rarely-used two-character words and matches work titles only whole', () => {
    expect(tagsFromTitle('第二季《人生切割術》即將推出', vocab)).toEqual(['人生切割術']);
    expect(tagsFromTitle('《切割的人生》上映', vocab)).toEqual([]);
    expect(tagsFromTitle('人生很難', vocab)).toEqual([]);
  });
  it('caps the number of tags', () => {
    expect(tagsFromTitle('川普 習近平 AI 輝達 亞運 桃園', vocab, 3)).toHaveLength(3);
  });
});

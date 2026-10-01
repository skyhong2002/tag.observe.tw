import { describe, expect, it } from 'vitest';
import { buildVocab } from '../crawl/title-tags.ts';
import { topicTagSets, topicTags } from './topic-related.ts';

const vocab = buildVocab(['核電重啟', '台師大', '抽血案', '失智', '總預算案', '沈伯洋', '亞運'].map((tag) => ({ tag, n: 50 })));

describe('topicTags', () => {
  it('keeps tags that stand for the topic name', () => {
    expect(topicTags('核電重啟', vocab)).toEqual(['核電重啟']);
    expect(topicTags('台師大抽血案', vocab).sort()).toEqual(['台師大', '抽血案']);
    expect(topicTags('2027總預算案', vocab)).toEqual(['總預算案']);
    expect(topicTags('沈伯洋風潮', vocab)).toEqual(['沈伯洋']);
  });

  it('drops a fragment that covers half the name or less', () => {
    expect(topicTags('馬駁失智傳聞', vocab)).toEqual([]);
    expect(topicTags('亞運捷報', vocab)).toEqual([]);
  });

  it('accepts a specific tag covering 40-50% of the name, not a ubiquitous one', () => {
    const v = buildVocab([
      { tag: '黎智英', n: 11 },
      { tag: '助理費', n: 13 },
      { tag: '亞運', n: 774 },
    ]);
    expect(topicTags('港府逮捕黎智英', v)).toEqual(['黎智英']);
    expect(topicTags('助理費除罪化', v)).toEqual(['助理費']);
    expect(topicTags('亞運捷報', v)).toEqual([]);
  });
});

describe('topicTagSets', () => {
  it('falls back to the most specific single tag that still stands for the name', () => {
    const v = buildVocab([
      { tag: '黃子佼', n: 11 },
      { tag: '道歉', n: 49 },
      { tag: '市議員', n: 10 },
      { tag: '選戰', n: 37 },
    ]);
    expect(topicTagSets('黃子佼性騷道歉', v)).toEqual([['道歉', '黃子佼'], ['黃子佼']]);
    expect(topicTagSets('縣市議員選戰', v)).toEqual([['選戰', '市議員'], ['市議員']]);
  });
});

import { describe, expect, it } from 'vitest';
import { buildVocab } from '../crawl/title-tags.ts';
import { matchTopics, topicTagSets, topicTagSummary, topicTags, topicTitleTags } from './topic-related.ts';

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

describe('topicTitleTags', () => {
  it('keeps every tag that stands for the name, without package words', () => {
    const v = buildVocab([
      { tag: '黃子佼', n: 11 },
      { tag: '道歉', n: 49 },
      { tag: '懶人包', n: 40 },
      { tag: '核電', n: 40 },
    ]);
    expect(topicTitleTags('黃子佼性騷道歉', v).sort()).toEqual(['道歉', '黃子佼'].sort());
    expect(topicTitleTags('核電懶人包', v)).toEqual(['核電']);
    expect(topicTitleTags('懶人包', v)).toEqual([]);
  });
});

describe('topicTagSummary', () => {
  it('counts outlets and items per kind, most outlets first, singletons dropped', () => {
    const s = topicTagSummary([
      { media: 'cna', kind: 'topic', tags: ['核電', '能源'] },
      { media: 'pts', kind: 'feature', tags: ['核電'] },
      { media: 'pts', kind: 'topic', tags: ['核電', '颱風'] },
      { media: 'udn', kind: 'feature', tags: ['颱風'] },
      { media: 'udn', kind: 'feature', tags: ['孤例'] },
    ]);
    expect(s).toEqual([
      { tag: '核電', media: 2, topic: 2, feature: 1 },
      { tag: '颱風', media: 2, topic: 1, feature: 1 },
    ]);
    expect(
      topicTagSummary(
        [
          { media: 'a', kind: 'topic', tags: ['x'] },
          { media: 'a', kind: 'topic', tags: ['x'] },
        ],
        1,
      ),
    ).toEqual([{ tag: 'x', media: 1, topic: 2, feature: 0 }]);
  });
});

describe('matchTopics', () => {
  const at = (d: string) => `2026-0${d}T00:00:00.000Z`;
  const items = [
    { id: '1', media: 'pts', title: '核電公投', tags: ['核電'], time: at('1-01'), updatedAt: at('1-01') },
    { id: '2', media: 'cna', title: '核電重啟', tags: ['核電'], time: at('2-01'), updatedAt: at('2-01') },
    { id: '3', media: 'cna', title: '核廢料', tags: ['核電'], time: at('1-01'), updatedAt: null },
    { id: '4', media: 'cna', title: '核電之後', tags: ['核電'], time: at('3-01'), updatedAt: at('3-01') },
    { id: '5', media: 'udn', title: 'AI 浪潮', tags: ['AI'], time: at('3-01'), updatedAt: at('3-01') },
    // First seen long ago, but a new story since: updated after 4.
    { id: '6', media: 'cna', title: '核四', tags: ['核電'], time: at('1-01'), updatedAt: at('4-01') },
  ];
  it('filters by tag, outlets with most matches first, most recently updated first, unknown last', () => {
    expect(matchTopics(items, { tag: '核電' }, ['pts', 'cna']).map((i) => i.id)).toEqual(['6', '4', '2', '3', '1']);
  });
  it('filters titles case-insensitively and combines with the tag', () => {
    expect(matchTopics(items, { q: 'ai' }).map((i) => i.id)).toEqual(['5']);
    expect(matchTopics(items, { tag: '核電', q: '重啟' }).map((i) => i.id)).toEqual(['2']);
    expect(matchTopics(items, { tag: 'AI', q: '核' })).toEqual([]);
  });
  it('breaks ties between outlets by the given order', () => {
    const two = [items[0], items[4]];
    expect(matchTopics(two, {}, ['udn', 'pts']).map((i) => i.id)).toEqual(['5', '1']);
  });
});

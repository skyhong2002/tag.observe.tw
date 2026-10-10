import { describe, expect, it } from 'vitest';
import {
  type ArticleRow,
  aliasTags,
  CoOccurrence,
  clusterEvents,
  hubTags,
  matchThread,
  outletBoilerplate,
  siteTags,
  threadUpdate,
} from './events-compute.ts';
import { BURST_STEPS, computeBurst, computeRanking } from './ranking-compute.ts';

const t0 = new Date('2026-09-28T08:00:00Z');
const art = (id: number, media: string, tags: string[], minutesAgo = 10): ArticleRow => ({
  id,
  media,
  publishedAt: new Date(t0.getTime() - minutesAgo * 60e3),
  url: `https://${media}.tw/${id}`,
  title: `t${id}`,
  image: null,
  tags,
});
const rows: ArticleRow[] = [
  art(1, 'a', ['核電', '公投', '台電']),
  art(2, 'b', ['核電', '公投']),
  art(3, 'c', ['核電', '公投', '經濟部']),
  art(4, 'a', ['核電', '台電']),
  art(5, 'a', ['亞運', '游泳']),
  art(6, 'b', ['亞運', '游泳', '金牌']),
  art(7, 'c', ['亞運', '金牌']),
  art(8, 'a', ['天氣']),
  art(9, 'b', ['天氣', '颱風']),
];

describe('CoOccurrence', () => {
  it('does not connect reports using their own source aliases', () => {
    const co = new CoOccurrence([art(1, 'ftnn', ['FTNN 新聞網', '台積電']), art(2, 'udn', ['FTNN 新聞網', '台積電'])]);
    expect(co.count('FTNN 新聞網')).toBe(1);
    expect(co.shared('FTNN 新聞網', '台積電')).toBe(1);
  });
  it('finds equal tags at >50% co-occurrence, transitively', () => {
    const co = new CoOccurrence(rows);
    expect(co.count('核電')).toBe(4);
    expect([...co.equal('核電').keys()]).toEqual(['公投']);
    expect([...co.closure('核電', new Set()).keys()].sort()).toEqual(['公投']);
    expect([...co.closure('亞運', new Set()).keys()].sort()).toEqual(['游泳', '金牌'].sort());
    expect(co.closure('天氣', new Set(['颱風'])).size).toBe(0);
  });
});

describe('clusterEvents', () => {
  it('ranks new events above 300 older terms using the cut-off ceiling of truncated history', () => {
    const background = Array.from({ length: 310 }, (_, i) => art(100 + i, 'a', [`既有主題${i}`]));
    const fresh = [
      art(1, 'a', ['大立光', 'CPO', '林恩平']),
      art(2, 'b', ['大立光', 'CPO', '林恩平']),
      art(3, 'c', ['大立光', 'CPO']),
      art(4, 'a', ['高虹安', '莊競程']),
      art(5, 'b', ['高虹安', '莊競程']),
      art(6, 'c', ['高虹安', '莊競程']),
    ];
    const basis = {
      id: 'event-candidates:all',
      media: ['a', 'b', 'c'],
      coverageFrom: '2026-09-20T00:00:00Z',
      validFrom: '2026-09-21T00:00:00Z',
    };
    const chart = (articles: ArticleRow[]) =>
      computeRanking(
        articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
        { hours: 24, basis },
      );
    // An older top-500 snapshot cannot prove zero, but it caps the new story at its lowest kept score.
    const older = { ...chart(background), truncated: true };
    const entries = computeBurst(chart([...background, ...fresh]), new Map(BURST_STEPS.map(([h]) => [h, older])));
    const cpo = entries.find((e) => e.tag === 'CPO')!;
    expect(entries.indexOf(cpo)).toBeLessThan(10);
    expect(cpo.burst).toBeGreaterThan(cpo.normalized);
    expect(Object.values(cpo.history).every((score) => score === null)).toBe(true);
    expect(clusterEvents(entries, [...background, ...fresh], [], { now: t0, maxTags: 300 })).toHaveLength(2);

    const events = clusterEvents(entries, [...background, ...fresh], [], { now: t0 });
    expect(events).toHaveLength(2);
    const financial = events.find((e) => e.major.includes('大立光'))!;
    expect(financial.tags.map(([tag]) => tag)).toEqual(expect.arrayContaining(['大立光', 'CPO', '林恩平']));
    expect(financial.memberIds.sort()).toEqual([1, 2, 3]);
    expect(financial.score).toBe(cpo.burst);
    expect(events.find((e) => e.major.includes('高虹安'))?.memberIds.sort()).toEqual([4, 5, 6]);
    // The ceiling feeds burst only; public history stays unknown.
    expect(cpo.history[48]).toBeNull();
  });
  it('does not merge unrelated subjects through a category or year tag', () => {
    const articles = [
      art(1, 'a', ['彭佳慧', '許富凱', '地方生活', '115年']),
      art(2, 'b', ['彭佳慧', '許富凱', '地方生活', '115年']),
      art(3, 'a', ['核電', '公投', '地方生活', '115年']),
      art(4, 'b', ['核電', '公投', '地方生活', '115年']),
    ];
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const events = clusterEvents(computeBurst(chart, new Map()), articles, [], { now: t0 });
    expect(events.map((e) => e.tags.map(([tag]) => tag))).toEqual([
      ['彭佳慧', '許富凱'],
      ['核電', '公投'],
    ]);
  });
  it('groups equal tags into events, picks major tags and news like events.php', () => {
    const ranking = computeRanking(
      rows.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { weight: 3, hours: 24 },
    );
    const burst = computeBurst(
      ranking,
      new Map([
        [3, null],
        [6, null],
        [12, null],
        [24, null],
        [48, null],
      ]),
    );
    const events = clusterEvents(burst, rows, [], { now: t0 });
    const tags = events.map((e) => e.tags.map(([t]) => t).sort());
    // 台電 (2 articles, both with 核電) is equal-to 核電, so it joins that event via tagmap.
    expect(tags).toContainEqual(['公投', '台電', '核電']);
    expect(tags).toContainEqual(['亞運', '游泳', '金牌']);
    expect(events.every((e) => e.tags.length > 1)).toBe(true);
    expect(events.map((e) => e.rank)).toEqual([1, 2]);
    const nuclear = events.find((e) => e.tags.some(([t]) => t === '核電')) as NonNullable<(typeof events)[number]>;
    expect(nuclear.major).toEqual(['核電', '公投', '台電']);
    expect(nuclear.news.length).toBeGreaterThan(0);
    expect(nuclear.majorNews.length).toBeGreaterThan(0);
    expect(new Set(nuclear.news.map((n) => n.url)).size).toBe(nuclear.news.length);
  });
  it('keeps two stories apart when only an umbrella tag links them', () => {
    // Golf and a tennis row both mostly carry 亞運, but are never reported together.
    const articles = [
      ...[1, 2, 3, 4].map((i) => art(i, 'a', ['曾雅妮', '高爾夫', '亞運'])),
      ...[5, 6, 7, 8].map((i) => art(i, 'b', ['握手', '謝淑薇', '亞運'])),
      ...[9, 10].map((i) => art(i, 'c', ['亞運', '金牌'])),
    ];
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const burst = computeBurst(chart, new Map());
    const groups = (hubs: boolean) => clusterEvents(burst, articles, [], { now: t0, hubs }).map((e) => e.tags.map(([t]) => t).sort());
    expect(groups(false)).toHaveLength(1);
    const split = groups(true);
    expect(split).toHaveLength(2);
    expect(split.find((g) => g.includes('曾雅妮'))).not.toContain('握手');
    // The umbrella stays with one story instead of disappearing.
    expect(split.filter((g) => g.includes('亞運'))).toHaveLength(1);
  });
  it('flags a tag as a hub only when the tags reaching it are unrelated', () => {
    // 握手 and 網球 both lean on 謝淑薇 and are also reported together.
    const articles = [
      ...[1, 2, 3, 4].map((i) => art(i, 'a', ['握手', '謝淑薇'])),
      ...[5, 6].map((i) => art(i, 'b', ['網球', '謝淑薇', '握手'])),
    ];
    const co = new CoOccurrence(articles);
    const order = ['握手', '網球'];
    expect(hubTags(co, order, new Map(order.map((t) => [t, co.closure(t, new Set())]))).size).toBe(0);
  });
  it('attaches only articles carrying two of the event tags, one outlet first', () => {
    const articles = [
      ...[1, 2, 3].map((i) => art(i, 'a', ['沈伯洋', '競選總部', '蔡英文'], i)),
      art(4, 'b', ['沈伯洋', '競選總部'], 1),
      art(5, 'c', ['沈伯洋', '蔡英文'], 1),
      // Carries one event tag each: a church visit and another candidate's HQ.
      art(6, 'd', ['蔡英文', '安樂教會'], 0),
      art(7, 'e', ['競選總部', '彰化'], 0),
    ];
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const [ev] = clusterEvents(computeBurst(chart, new Map()), articles, [], { now: t0 });
    expect(ev.tags.map(([t]) => t).sort()).toEqual(['競選總部', '沈伯洋', '蔡英文'].sort());
    expect(ev.articles).toBe(5);
    const ids = ev.news.map((n) => n.id);
    expect(ids).not.toContain(6);
    expect(ids).not.toContain(7);
    // Three outlets before a second article from outlet a.
    expect(
      ev.news
        .slice(0, 3)
        .map((n) => n.media)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
    expect(ev.majorNews.map((n) => n.id)).not.toContain(6);
  });
  it('ignores outlet section tags that every article of one outlet carries', () => {
    const articles = [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => art(i, 'oncc', ['東網', '產經新聞', i < 5 ? '天氣' : '台股'])),
      ...[9, 10].map((i) => art(i, 'cna', ['天氣', '東北季風'])),
      ...[11, 12].map((i) => art(i, 'cna', ['台股', '台指期'])),
    ];
    expect([...siteTags(articles)].sort()).toEqual(['東網', '產經新聞']);
    const co = new CoOccurrence(articles);
    expect(co.count('東網')).toBe(0);
    expect(co.closure('天氣', new Set()).has('東網')).toBe(false);
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const groups = clusterEvents(computeBurst(chart, new Map()), articles, [], { now: t0 }).map((e) => e.tags.map(([t]) => t).sort());
    expect(groups).toHaveLength(2);
    for (const g of groups) expect(g).not.toContain('東網');
  });
  it('drops an event whose articles are mostly already listed under higher-ranked events', () => {
    // 韓國瑜 and 侯友宜 appear at two rallies; each rally is its own story.
    const articles = [
      ...['c', 'd', 'e', 'f'].map((m, i) => art(i + 1, m, ['李四川', '板橋'])),
      ...[5, 6].map((i) => art(i, 'a', ['李四川', '板橋', '韓國瑜', '侯友宜'])),
      ...['c', 'd', 'e', 'f'].map((m, i) => art(i + 7, m, ['江啟臣', '盧秀燕'])),
      ...[11, 12].map((i) => art(i, 'b', ['江啟臣', '盧秀燕', '韓國瑜', '侯友宜'])),
      art(13, 'a', ['韓國瑜', '侯友宜']),
    ];
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const burst = computeBurst(chart, new Map());
    const groups = (duplicateShare: number) =>
      clusterEvents(burst, articles, [], { now: t0, duplicateShare }).map((e) => e.tags.map(([t]) => t).sort());
    const all = groups(2);
    expect(all.some((g) => g.join() === ['韓國瑜', '侯友宜'].sort().join())).toBe(true);
    const deduped = groups(0.5);
    expect(deduped).toHaveLength(all.length - 1);
    expect(deduped.some((g) => g.join() === ['韓國瑜', '侯友宜'].sort().join())).toBe(false);
  });
  it('drops the duplicate even when it outscores the events it duplicates', () => {
    // 韓國瑜/侯友宜 across more outlets than either rally: higher burst, same articles.
    const articles = [
      ...[1, 2, 3, 4].map((i) => art(i, 'a', ['李四川', '板橋'])),
      ...['c', 'd'].map((m, i) => art(i + 5, m, ['李四川', '板橋', '韓國瑜', '侯友宜'])),
      ...[7, 8, 9, 10].map((i) => art(i, 'b', ['江啟臣', '盧秀燕'])),
      ...['e', 'f'].map((m, i) => art(i + 11, m, ['江啟臣', '盧秀燕', '韓國瑜', '侯友宜'])),
      art(13, 'g', ['韓國瑜', '侯友宜']),
    ];
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const burst = computeBurst(chart, new Map());
    const all = clusterEvents(burst, articles, [], { now: t0, duplicateShare: 2 });
    expect(all[0].tags.map(([t]) => t).sort()).toEqual(['侯友宜', '韓國瑜']);
    const deduped = clusterEvents(burst, articles, [], { now: t0 });
    expect(deduped).toHaveLength(2);
    expect(deduped.some((e) => e.tags.some(([t]) => t === '韓國瑜'))).toBe(false);
  });
  it('folds a longer tag into the shorter tag it contains and mostly co-occurs with', () => {
    const articles = [
      ...[1, 2].map((i) => art(i, 'a', ['名古屋亞運', '亞運', '王婕菱'])),
      ...[3, 4, 11].map((i) => art(i, 'b', ['名古屋亞運', '王婕菱'])),
      ...[5, 6, 7].map((i) => art(i, 'c', ['亞運', '李洋'])),
      // 亞運會 never appears with 亞運: no alias. 日本麥當勞 folds into the
      // longest qualifying tag, 麥當勞, and never into a blocked tag.
      ...[8, 9, 10].map((i) => art(i, 'd', ['亞運會', '盧彥勳'])),
      ...[12, 13].map((i) => art(i, 'e', ['日本麥當勞', '麥當勞', '日本'])),
    ];
    const co = new CoOccurrence(articles);
    const tags = ['亞運', '名古屋亞運', '亞運會', '王婕菱', '李洋', '日本麥當勞', '麥當勞', '日本'];
    expect(Object.fromEntries(aliasTags(co, tags))).toEqual({ 名古屋亞運: '亞運', 日本麥當勞: '麥當勞' });
    expect(Object.fromEntries(aliasTags(co, tags, { blocked: new Set(['麥當勞', '亞運']) }))).toEqual({ 日本麥當勞: '日本' });
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const burst = computeBurst(chart, new Map());
    const events = clusterEvents(burst, articles, [], { now: t0 });
    const games = events.find((e) => e.tags.some(([t]) => t === '亞運')) as (typeof events)[number];
    expect(games.tags.map(([t]) => t)).not.toContain('名古屋亞運');
    // The article tagged 名古屋亞運 (not 亞運) + 王婕菱 belongs through the alias.
    expect(games.memberIds).toContain(4);
  });
  it('strips tags an outlet stamps on nearly every article, from that outlet only', () => {
    const military = ['國防部', '國軍', '空軍'];
    const articles = [
      // 青年日報: eight unrelated stories, all carrying the military set.
      ...['月曆', '音樂節', '綜藝', '糖業', '鐵路', '營隊', '重陽', '律師'].map((t, i) => art(i + 1, 'ydn', [...military, t])),
      // Real coverage elsewhere.
      ...['storm', 'ltn', 'ctitv'].map((m, i) => art(i + 20, m, ['F-16V', '空軍', '國防部'])),
    ];
    const boiler = outletBoilerplate(articles);
    expect([...boiler.keys()]).toEqual(['ydn']);
    expect([...(boiler.get('ydn') as Set<string>)].sort()).toEqual(military.sort());
    const chart = computeRanking(
      articles.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { hours: 24 },
    );
    const burst = computeBurst(chart, new Map());
    const events = clusterEvents(burst, articles, [], { now: t0 });
    expect(events).toHaveLength(1);
    expect(events[0].tags.map(([t]) => t).sort()).toEqual(['F-16V', '國防部', '空軍'].sort());
    expect(events[0].memberIds.sort()).toEqual([20, 21, 22]);
    // Without the rule the eight 青年日報 stories are the event.
    const raw = clusterEvents(burst, articles, [], { now: t0, boilerplate: false });
    expect(raw[0].memberIds.length).toBeGreaterThanOrEqual(8);
  });
  it('honours the no-equal list', () => {
    const ranking = computeRanking(
      rows.map((r) => ({ media: r.media, tags: r.tags.map((t) => `[${t}]`).join('') })),
      { weight: 3, hours: 24 },
    );
    const burst = computeBurst(ranking, new Map());
    const events = clusterEvents(burst, rows, ['公投'], { now: t0 });
    expect(events.some((e) => e.tags.some(([t]) => t === '公投'))).toBe(false);
  });
});

describe('threads', () => {
  it('continues a thread on >=2 major hits and rebuilds all/max like events_history.php', () => {
    const th = { id: 1, lastTime: t0, allTags: ['核電', '公投', '台電'], history: { '2026-09-28 15:00:00': { 核電: 10, 公投: 8 } } };
    expect(matchThread(['核電', '公投', '經濟部'], [th])?.id).toBe(1);
    expect(matchThread(['核電', '亞運'], [th])).toBeNull();
    const u = threadUpdate(
      th,
      '2026-09-28 16:00:00',
      ['核電', '經濟部'],
      [
        ['核電', 12],
        ['經濟部', 5],
      ],
    );
    expect(u.hours).toBe(2);
    expect(u.maxTag).toBe('核電');
    expect(u.maxScore).toBe(12);
    expect(u.allTags).toEqual(['核電', '經濟部', '公投']);
    expect(u.majorTags[0]).toBe('核電');
  });
  it('picks the thread sharing the most major tags, then the most recent', () => {
    const at = (h: number) => new Date(t0.getTime() + h * 3600e3);
    const golf = { id: 1, lastTime: at(-1), allTags: ['曾雅妮', '徐薇淩', '高爾夫'], history: {} };
    const tennis = { id: 2, lastTime: at(-2), allTags: ['握手', '曾雅妮', '徐薇淩', '網球'], history: {} };
    expect(matchThread(['握手', '曾雅妮', '網球'], [golf, tennis])?.id).toBe(2);
    expect(matchThread(['曾雅妮', '徐薇淩'], [tennis, golf])?.id).toBe(1);
    expect(matchThread(['曾雅妮', '金牌'], [golf, tennis])).toBeNull();
  });
});

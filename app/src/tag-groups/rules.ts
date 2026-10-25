import type { TagGroupKind, TagPersonFacts } from '../db/schema.ts';

// Tag groups (docs/tag-groups.md): the definitions copied from the legacy
// site and the rules that file a tag into them automatically.

export type GroupDef = { id: number; label: string; kind: TagGroupKind };

// Legacy tag_group, same ids. The 現任／內閣／北市府 groups were filled by
// hand in 2016–2022, so their legacy members are seeded as review.
export const LEGACY_GROUPS: GroupDef[] = [
  '政治人物',
  '現任立委',
  '現任縣市長',
  '民進黨',
  '國民黨',
  '時代力量',
  '親民黨',
  '意見領袖',
  '運動明星',
  '名嘴',
  '藝人',
  '歌手樂團',
  '商場經理人',
  '縣市議員',
  '議題',
  '政府部門單位',
  '公司廠商',
  '內閣',
  '北市府',
  '社會新聞人物',
  '外語藝人',
  '中港藝人',
  '外國運動員',
  '外國政治人物',
  '電視電影',
  '商品店家',
  '網紅',
  '六都市長候選人',
].map((label, i) => ({ id: i + 1, label, kind: 'group' }));

export const DATED_GROUPS = new Set([2, 3, 18, 19, 28]);

/**
 * Rosters for a term (legislators, mayors, councillors, the cabinet, the
 * Taipei city government, mayoral candidates): kept from official lists by
 * the site, so no rule files a tag into them and readers do not vote on them
 * (owner's decision, 2026-10-16). Their labels name the year a term began,
 * e.g. 「2024 立委」; a new term gets a new group.
 */
export const CURATED_GROUPS = new Set([2, 3, 14, 18, 19, 28, 1008]);

// Legacy catalogue 1–10 (11–15 were editors' work queues, not topics).
export const TOPICS: GroupDef[] = ['政治', '體育', '娛樂', '社會', '國際', '生活', '科技', '動物', '健康醫療', '產業金融'].map(
  (label, i) => ({ id: 101 + i, label, kind: 'topic' }),
);

export const SEED_GROUPS = [...LEGACY_GROUPS, ...TOPICS];
const byLabel = new Map(SEED_GROUPS.map((g) => [g.label, g.id]));
const id = (label: string) => byLabel.get(label) as number;

export type Pick = { groupId: number; note: string };

const TAIWAN = /中華民國|臺灣|台灣/;
const CHINA_HK = /中華人民共和國|中國|香港|澳門/;
const POLITICIAN = /政治人物|政治家|政治活動家/;
const PERFORMER = /演員|藝人|主持人|模特|偶像|配音|喜劇|舞者/;
const SINGER = /歌手|樂團|樂隊|音樂家|詞曲|作曲家|饒舌/;
const ATHLETE = /運動員|球員|選手|投手|捕手|打者|教練/;
const CREATOR = /YouTuber|網紅|網路紅人|部落客|實況主|直播主/i;
const BUSINESS = /企業家|執行長|商人|董事長|創辦人|企業大亨/;
const PARTIES: Record<string, string> = { 民主進步黨: '民進黨', 中國國民黨: '國民黨', 時代力量: '時代力量', 親民黨: '親民黨' };

/** Identity groups for a person tag, from its Wikidata facts (tag_people). */
export function personGroups(facts: TagPersonFacts): Pick[] {
  const out: Pick[] = [];
  const add = (label: string, note: string) => {
    if (!out.some((p) => p.groupId === id(label))) out.push({ groupId: id(label), note });
  };
  const citizenship = facts.citizenship.join('、');
  const local = TAIWAN.test(citizenship);
  const chinaHk = !local && CHINA_HK.test(citizenship);
  const jobs = facts.occupations.join('、');
  const politician = POLITICIAN.test(jobs) || facts.positions.length > 0;

  if (politician) add(local ? '政治人物' : '外國政治人物', local ? '台灣政治人物' : `${facts.citizenship[0] ?? '外國'}政治人物`);
  // Office holders (立委、縣市長、議員、內閣) are curated rosters, not filed here.
  if (local) for (const party of facts.parties) if (PARTIES[party]) add(PARTIES[party], `${party}黨員`);
  // Wikidata lists 川普 as an actor and 高金素梅 as one: for a politician
  // the news means the politician, so the entertainment groups stay out.
  const performer = politician ? undefined : facts.occupations.find((j) => PERFORMER.test(j));
  const singer = politician ? undefined : facts.occupations.find((j) => SINGER.test(j));
  if (performer || singer) add(local ? '藝人' : chinaHk ? '中港藝人' : '外語藝人', (performer ?? singer) as string);
  if (singer && local) add('歌手樂團', singer);
  const athlete = facts.occupations.find((j) => ATHLETE.test(j));
  if (athlete) add(local ? '運動明星' : '外國運動員', athlete);
  const creator = facts.occupations.find((j) => CREATOR.test(j));
  if (creator) add('網紅', creator);
  const business = facts.occupations.find((j) => BUSINESS.test(j));
  if (business && !politician) add('商場經理人', business);
  return out;
}

// Wikidata P31 (instance of) → group, and the topics a tag of that kind
// is expected under. Direct types only: subclasses (P279) are not followed,
// so add a type here when an admin keeps filing the same kind of tag by
// hand. Plain nouns often share a name with a show or a company (「失聯」
// is a TV series), so unless the tag's outlets file it under one of the
// expected topics, the row waits for review.
const TYPE_GROUPS: Record<string, [string, string[]]> = {
  Q4830453: ['公司廠商', ['產業金融', '科技']], // 企業
  Q783794: ['公司廠商', ['產業金融', '科技']], // 公司
  Q891723: ['公司廠商', ['產業金融', '科技']], // 上市公司
  Q6881511: ['公司廠商', ['產業金融', '科技']], // 工商企業
  Q167037: ['公司廠商', ['產業金融', '科技']], // 股份有限公司
  Q46970: ['公司廠商', ['產業金融', '國際', '生活']], // 航空公司
  Q18388277: ['公司廠商', ['產業金融', '科技']], // 科技公司
  Q1058914: ['公司廠商', ['產業金融', '科技']], // 軟體公司
  Q327333: ['政府部門單位', ['政治', '社會', '生活']], // 政府機關
  Q192350: ['政府部門單位', ['政治', '社會', '生活']], // 部會
  Q2659904: ['政府部門單位', ['政治', '社會', '生活']], // 政府組織
  Q637846: ['政府部門單位', ['政治']], // 國會議院
  Q35749: ['政府部門單位', ['政治']], // 議會
  Q11424: ['電視電影', ['娛樂']], // 電影
  Q5398426: ['電視電影', ['娛樂']], // 電視劇
  Q15416: ['電視電影', ['娛樂']], // 電視節目
  Q1259759: ['電視電影', ['娛樂']], // 迷你劇
  Q63952888: ['電視電影', ['娛樂']], // 動畫電視劇
  Q24856: ['電視電影', ['娛樂']], // 電影系列
  Q431289: ['商品店家', ['產業金融', '生活', '科技']], // 品牌
  Q507619: ['商品店家', ['產業金融', '生活']], // 連鎖店
  Q7278: ['政治', []], // 政黨
  Q12136: ['健康醫療', []], // 疾病
  Q112193867: ['健康醫療', []], // 疾病類型
  Q623109: ['體育', []], // 體育聯賽
  Q15991290: ['體育', []], // 職業體育聯盟
  Q13393265: ['體育', []], // 籃球隊
  Q13027888: ['體育', []], // 棒球隊
};

export const HUMAN = 'Q5';

/** Groups for a non-person tag from its Wikidata types; `topics` are the
 *  topic groups the tag is already in. */
export function typeGroups(types: { id: string; label: string }[], topics: number[] = []): (Pick & { review: boolean })[] {
  const out: (Pick & { review: boolean })[] = [];
  for (const t of types) {
    const [label, expect] = TYPE_GROUPS[t.id] ?? [];
    if (!label || out.some((p) => p.groupId === id(label))) continue;
    const review = expect.length > 0 && !expect.some((e) => topics.includes(id(e)));
    out.push({ groupId: id(label), note: t.label, review });
  }
  return out;
}

// An outlet's section (articles.category) or URL path segment → topic.
// Chinese section names match by substring, earlier rules first, so
// 「國際財經」「國際政經」 are 國際 and 「財經」 is 產業金融. Latin names match whole words
// only (「pet」 must not hit 「competition」). Feed names (news, rss, all,
// realtime…) match nothing.
const SECTION_RULES: [string, RegExp][] = [
  ['體育', /體育|運動|棒球|籃球|足球|網球|高爾夫/],
  ['娛樂', /娛樂|影劇|影視|明星|藝文|音樂|電影/],
  ['健康醫療', /健康|醫療|醫藥|疾病|養生/],
  ['科技', /科技|人工智慧|數位|手機|遊戲/],
  ['動物', /動物|寵物/],
  ['國際', /國際|亞洲|歐洲|美洲|中國|大陸|全球/],
  ['政治', /政治|選舉|兩岸|立法|國會|政經/],
  ['社會', /社會|地方|法律|司法|犯罪|法院|警政/],
  ['產業金融', /財經|股|經濟|產業|金融|理財|房產|房市|基金|匯|期貨|加密|幣/],
  ['生活', /生活|旅遊|美食|消費|天氣|交通|教育|時尚|親子/],
];
const WORDS: Record<string, string> = {};
for (const [label, words] of Object.entries({
  體育: 'sport sports mlb nba baseball basketball football soccer tennis golf',
  娛樂: 'entertainment ent star stars showbiz movie movies music celebrity',
  健康醫療: 'health medical medicine',
  科技: 'tech technology ai 3c digital game games gadget',
  動物: 'pet pets animal animals',
  政治: 'politics political pol election elections',
  國際: 'world international global asia china',
  社會: 'society local crime law',
  產業金融: 'business finance money economy economic stock stocks property market markets',
  生活: 'life lifestyle travel food style education',
}))
  for (const w of words.split(' ')) WORDS[w] = label;

export function sectionTopic(section: string | null | undefined): number | null {
  if (!section) return null;
  for (const [label, rx] of SECTION_RULES) if (rx.test(section)) return id(label);
  for (const word of section.toLowerCase().split(/[^a-z0-9]+/)) if (WORDS[word]) return id(WORDS[word]);
  return null;
}

/** Topics a tag's outlets file it under. Each outlet has one vote, split
 *  over the topics of its articles that carry the tag, so a ticker feed
 *  with thousands of 台股 items weighs no more than one newspaper. */
export function voteTopics(
  rows: { media: string; topic: number; n: number }[],
  { minOutlets = 3, minShare = 0.3, max = 2 } = {},
): { groupId: number; share: number; outlets: number }[] {
  const perOutlet = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const m = perOutlet.get(r.media) ?? new Map<number, number>();
    m.set(r.topic, (m.get(r.topic) ?? 0) + r.n);
    perOutlet.set(r.media, m);
  }
  if (perOutlet.size < minOutlets) return [];
  const votes = new Map<number, number>();
  const outlets = new Map<number, number>();
  for (const m of perOutlet.values()) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    for (const [topic, n] of m) {
      votes.set(topic, (votes.get(topic) ?? 0) + n / total);
      outlets.set(topic, (outlets.get(topic) ?? 0) + 1);
    }
  }
  return [...votes]
    .map(([groupId, v]) => ({ groupId, share: v / perOutlet.size, outlets: outlets.get(groupId) ?? 0 }))
    .filter((t) => t.share >= minShare && t.outlets >= 2)
    .sort((a, b) => b.share - a.share)
    .slice(0, max);
}

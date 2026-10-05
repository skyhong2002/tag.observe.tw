import catalog from '../data/favicon-catalog.json' with { type: 'json' };

// Reviewed source labels only. The display-name catalog also contains vague
// aliases such as 自由/天下 and legacy annotations; do not treat those as tags.
const aliases: Record<string, string[]> = {
  ftnn: ['鋒燦傳媒', '鋒燦 FTNN'],
  ltn: ['自由時報電子報', '自由電子報', '自由評論', '自由財經', '自由廣場'],
  setn: ['三立新聞網財經中心', '三立'],
  epochtimes: ['台灣大紀元', '洛杉磯大紀元'],
  commonhealth: ['康健雜誌'],
  businesstoday: ['今週刊'],
  hk01: ['hk01'],
  bo6s: ['bo6s'],
  mplus: ['mplus'],
  tvbs: ['TVBS'],
  ftv: ['民視'],
  gamer: ['巴哈姆特'],
  udn: ['udn', 'UDN 聯合新聞網'],
  ctitv: ['中天', '中天新聞'],
  ettoday: ['ETtoday', '東森新聞雲'],
  chinatimes: ['中時', '中時電子報'],
  nownews: ['NOWnews'],
  mirror: ['鏡周刊', '鏡傳媒'],
  rti: ['央廣', '中央廣播電台'],
};
const normalize = (tag: string) => tag.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
const names = new Map(
  Object.entries(catalog).map(([media, entry]) => [
    media,
    new Set([entry.title, ...(aliases[media] ?? [])].filter((name): name is string => !!name).map(normalize)),
  ]),
);

// An outlet's own brand is source metadata, not a reporting topic. Keep other
// outlets' names: they can be the subject of a report.
export function isOwnMediaTag(tag: string, media?: string): boolean {
  return !!media && (names.get(media)?.has(normalize(tag)) ?? false);
}

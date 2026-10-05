import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import countryRegistry from '../../data/media-countries.json' with { type: 'json' };
import { reporterCredit } from '../crawl/byline.ts';

export type OutletIdentity = { media: string; name: string; country: string; countryCode: string };
export type Attribution = OutletIdentity & { evidence: string; kind: 'explicit' };

/** Supplying content differs from citing it; both roles require evidence. */
export function attributionRole(source: { evidence: string }): '來源' | '引用' {
  return /^內容提供者[：:]/u.test(source.evidence.trim()) ? '來源' : '引用';
}

/** Aggregate relationships include content providers and explicit citations. */
export const ATTRIBUTION_RELATION_LABEL = '來源／引用';

type Outlet = OutletIdentity & { aliases: string[] };
const titles = favicons as Record<string, { title: string | null }>;
const countries: Record<string, string> = {
  TW: '台灣',
  GB: '英國',
  FR: '法國',
  US: '美國',
  JP: '日本',
  KR: '韓國',
  CN: '中國',
  DE: '德國',
};
const outlet = (media: string, name: string, countryCode: string, aliases: string[]): Outlet => ({
  media,
  name,
  country: countries[countryCode] ?? '未知',
  countryCode,
  aliases: [...new Set([name, ...aliases])],
});

// Country describes the outlet's home jurisdiction, not the place where a story
// happened, its reporter's nationality, ownership, or an article's original author.
const outlets: Outlet[] = [
  outlet('yahoo', 'Yahoo奇摩新聞', 'TW', ['Yahoo', 'Yahoo新聞', 'Yahoo News']),
  outlet('reuters', '路透社', 'GB', ['Reuters', '路透']),
  outlet('afp', '法新社', 'FR', ['AFP', 'Agence France-Presse']),
  outlet('ap', '美聯社', 'US', ['AP', 'Associated Press', '美联社']),
  outlet('bbc', 'BBC', 'GB', ['BBC News', '英國廣播公司', '英国广播公司']),
  outlet('cnn', 'CNN', 'US', ['美國有線電視新聞網', '美国有线电视新闻网']),
  outlet('nhk', 'NHK', 'JP', ['日本放送協會', '日本放送协会', 'NHK World Japan', 'NHK World-Japan']),
  outlet('kyodo', '共同社', 'JP', ['Kyodo', 'Kyodo News', '共同通信社']),
  outlet('yonhap', '韓聯社', 'KR', ['Yonhap', 'Yonhap News Agency', '韩联社']),
  outlet('xinhua', '新華社', 'CN', ['Xinhua', 'Xinhua News Agency', '新华社']),
  outlet('dw', '德國之聲', 'DE', ['DW', 'Deutsche Welle', '德国之声']),
  outlet('rfi', '法國國際廣播電台', 'FR', ['RFI', '法廣', '法广']),
  outlet('nikkei', '日本經濟新聞', 'JP', ['Nikkei', '日經', '日经', '日本经济新闻']),
  outlet('cna', '中央社', 'TW', ['CNA', '中央通訊社', '中央通讯社']),
  outlet('ltn', '自由時報', 'TW', ['自由时报', '自由時報電子報']),
  outlet('udn', '聯合新聞網', 'TW', ['UDN', '聯合報', '联合报', '聯合新聞', '联合新闻网']),
  outlet('udnmoney', '經濟日報', 'TW', ['经济日报']),
  outlet('chinatimes', '中國時報', 'TW', ['中時新聞網', '中時電子報', '中時', '中国时报']),
  outlet('ctee', '工商時報', 'TW', ['工商时报']),
  outlet('ettoday', 'ETtoday新聞雲', 'TW', ['ETtoday', '東森新聞雲', 'ETtoday新聞']),
  outlet('ebc', '東森新聞', 'TW', ['東森新聞台', '东森新闻']),
  outlet('setn', '三立新聞網', 'TW', ['三立新聞', '三立', '三立新闻网']),
  outlet('tvbs', 'TVBS', 'TW', ['TVBS新聞網', 'TVBS新聞']),
  outlet('nownews', 'NOWnews', 'TW', ['NOWnews今日新聞', '今日新聞']),
  outlet('cts', '華視新聞', 'TW', ['華視', '华视']),
  outlet('ttv', '台視新聞', 'TW', ['台視', '臺視', '台视']),
  outlet('ctv', '中視新聞', 'TW', ['中視', '中视']),
  outlet('ftv', '民視新聞', 'TW', ['民視', '民视']),
  outlet('pts', '公視新聞', 'TW', ['公視', '公视', '公視新聞網']),
  outlet('ctitv', '中天新聞', 'TW', ['中天新聞網', '中天新闻']),
  outlet('mirror', '鏡週刊', 'TW', ['鏡周刊', '镜周刊']),
  outlet('mirrordaily', '鏡報', 'TW', ['鏡報新聞網']),
  outlet('mnews', '鏡新聞', 'TW', ['鏡電視', '镜新闻']),
  outlet('upmedia', '上報', 'TW', ['上報新聞', '上报']),
  outlet('newtalk', 'Newtalk新聞', 'TW', ['新頭殼', 'Newtalk', '新头壳']),
  outlet('storm', '風傳媒', 'TW', ['风传媒']),
  outlet('tnl', '關鍵評論網', 'TW', ['The News Lens', '关键评论网']),
  outlet('cmmedia', '信傳媒', 'TW', ['信传媒']),
  outlet('rti', '中央廣播電臺', 'TW', ['Rti', '中央廣播電台', '央廣', '央广']),
  outlet('ctwant', 'CTWANT', 'TW', ['周刊王']),
  outlet('nextapple', '壹蘋新聞網', 'TW', ['壹蘋', '壹苹新闻网']),
  outlet('bccnews', '中廣新聞', 'TW', ['中廣', '中广']),
  outlet('cnews', '匯流新聞網', 'TW', ['匯流新聞', '汇流新闻网', 'CNEWS', 'CNEWS匯流新聞網']),
  outlet('ftnn', 'FTNN新聞網', 'TW', ['FTNN', '鋒燦傳媒']),
  outlet('taisounds', '太報', 'TW', ['太报']),
  outlet('reporter', '報導者', 'TW', ['报道者', 'The Reporter']),
  outlet('yam', '蕃新聞', 'TW', ['蕃薯藤新聞']),
  outlet('knews', '知新聞', 'TW', []),
  outlet('taipeitimes', 'Taipei Times', 'TW', ['台北時報']),
];

/** Every outlet name and alias known to attribution, for byline filtering. */
export function knownOutletNames(): string[] {
  return [...new Set(outlets.flatMap((o) => [o.media, ...o.aliases]))];
}

const identityOnly = ({ media, name, country, countryCode }: OutletIdentity): OutletIdentity => ({
  media,
  name: titles[media]?.title ?? name,
  country,
  countryCode,
});

/** Resolve known local keys or exact outlet names; unknown countries stay unknown. */
export function outletIdentity(mediaOrName: string): OutletIdentity {
  const value = mediaOrName.trim();
  const known = outlets.find((o) => o.media === value.toLowerCase() || o.aliases.some((a) => a.toLowerCase() === value.toLowerCase()));
  if (known) return identityOnly(known);
  const entry = (countryRegistry.media as Record<string, { countryCode: string }>)[value];
  if (entry)
    return {
      media: value,
      name: titles[value]?.title ?? value,
      countryCode: entry.countryCode,
      country: (countryRegistry.countries as Record<string, string>)[entry.countryCode] ?? '待確認',
    };
  return { media: value, name: titles[value]?.title ?? value, country: '未知', countryCode: 'ZZ' };
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = outlets.map((o) => ({
  outlet: o,
  pattern: new RegExp(
    `(?<![A-Za-z0-9_])(?:${o.aliases
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex)
      .join('|')})(?![A-Za-z0-9_])`,
    'gi',
  ),
}));
const closeQuote = '[\\s」』》”"）)]*';
const report = new RegExp(
  `^${closeQuote}(?:[（(][^()（）]{1,45}[）)]${closeQuote})?(?:的)?(?:報導|報道|报道)(?:指出|稱|称|表示|說|说|提到|透露|引述|分析|，|,|：|:|$)`,
);
const credit =
  /(?:來源|来源|出處|出处|轉載自|转载自|摘自|編譯自|编译自|編譯[：:／/]|编译[：:／/]|引述|引用|援引|授權自|授权自|授權來源|授权来源)\s*[：:／/]?\s*[「『《“"]*\s*$/;
const authorization = new RegExp(`^${closeQuote}(?:授權|授权)(?:刊登|轉載|转载|提供|發布|发布)`);

function explicitContext(before: string, after: string): boolean {
  // A photograph credit does not establish the source of the article's text.
  if (/(?:圖片|图片|照片|攝影|摄影|影像|圖|图)\s*(?:來源|来源|出處|出处)\s*[：:]?\s*[「『《“"]*\s*$/.test(before)) return false;
  return report.test(after) || credit.test(before) || authorization.test(after);
}

// Catalog display titles name outlets that attribution has no aliases for (菱傳媒 → rwnews).
const titledMedia = new Map(
  Object.entries(titles)
    .filter(([, entry]) => entry.title)
    .reverse()
    .map(([media, entry]) => [entry.title as string, media]),
);
// Longest first, so 今周刊 never stops at a shorter alias that prefixes it.
const knownNames = [...new Set([...titledMedia.keys(), ...outlets.flatMap((o) => o.aliases)])]
  .filter((name) => name.length >= 2)
  .sort((a, b) => b.length - a.length);
const creditRole = /^(?:圖[、.．・]?文|文[、.．・]?圖|文|撰文|來源|供稿|提供)$/u;
const newsDesk = /(?:中心|編輯部|編輯室|新聞部|採訪部|報導|报道)$/u;

/** The organization in a credit line. Pages may put the whole lead paragraph in the credit
 * slot: 圖、文／菱傳媒, 民視新聞／吳憲昌 綜合報導, 政治中心／李筱舲報導 2026年…. */
function creditedOrganization(provider: string): string {
  const syndication = /^•?\s*以上言論由\s+(.+?)\s+授權轉載[，,]/u.exec(provider);
  if (syndication) return syndication[1].trim();
  const rights = /本文版權(?:為|屬|归|歸)(.{2,30}?)所有/u.exec(provider);
  if (rights) return rights[1].trim();
  const [first, second] = provider.split(/\s*[／/]\s*/u);
  if (second === undefined) return provider;
  if (!creditRole.test(first)) return first;
  // 文.圖／今周刊台股Q4上看… : the name runs into the lead without a space.
  const named = knownNames.find((name) => second.startsWith(name));
  return named ?? second.split(/\s/u)[0];
}

/** A provider field can be a byline, desk, or publisher. Do not invent media from people. */
export function providerOutlet(provider: string): OutletIdentity | null {
  const raw = provider.trim();
  if (!raw || reporterCredit(raw)) return null;
  const value = creditedOrganization(raw);
  // Yahoo's own desks/channels belong to the publisher, not external outlets.
  if (/^Yahoo(?:奇摩)?(?:新聞|即時新聞|名人娛樂|電影戲劇|股市|財經|遊戲|房地產|特別企劃)/i.test(value)) return outletIdentity('yahoo');
  // Newsroom desks belong to the publisher; a sentence is never an outlet name.
  if (!value || value.length > 30 || newsDesk.test(value)) return null;
  if (/(?:記者|记者|撰稿人|特約作者|\breporter\b|\bcorrespondent\b)/iu.test(value)) return null;
  const titled = titledMedia.get(value);
  const identity = outletIdentity(titled ?? value);
  if (identity.countryCode !== 'ZZ' || Object.hasOwn(titles, identity.media)) return identity;
  // Unknown organizations may retain their label, but a bare person's name
  // supplies no evidence that a new media organization exists.
  return /(?:新聞|傳媒|媒體|通訊社|日報|時報|週刊|周刊|雜誌|電視|廣播|\bnews\b|\bmedia\b|\bpress\b|\btimes\b)/iu.test(value)
    ? identity
    : null;
}

export function normalizeAttributions(values: Attribution[], publisher: string): Attribution[] {
  const own = outletIdentity(publisher).media;
  const result = new Map<string, Attribution>();
  for (const value of values) {
    const provider = /^內容提供者[：:]\s*(.*)$/u.exec(value.evidence);
    const identity = provider ? providerOutlet(provider[1]) : outletIdentity(value.media);
    if (!identity || identity.media === own || reporterCredit(identity.media)) continue;
    if (!result.has(identity.media)) result.set(identity.media, { ...value, ...identity });
  }
  return [...result.values()];
}

/** Return only cited outlets. A match is evidence of citation, never original authorship. */
export function extractAttributions(body: string, publisher: string, provider?: string | null): Attribution[] {
  const own = outletIdentity(publisher).media;
  const found = new Map<string, Attribution>();
  const add = (identity: OutletIdentity, evidence: string) => {
    if (identity.media !== own && !found.has(identity.media)) {
      found.set(identity.media, { ...identity, evidence: evidence.replace(/\s+/g, ' ').trim().slice(0, 160), kind: 'explicit' });
    }
  };
  const providerIdentity = provider ? providerOutlet(provider) : null;
  if (providerIdentity) add(providerIdentity, `內容提供者：${provider?.trim()}`);
  // CNA syndicated copy commonly starts with its agency dispatch byline.
  // Require the enclosing dateline and date/electric-dispatch suffix so a
  // news story merely mentioning a CNA reporter cannot become a citation.
  const dispatch = /^\s*[（(]\s*中央社(?:記者|记者)[\p{L}·．\s]{2,50}(?:\d{1,2}|[一二三四五六七八九十廿]{1,3})日(?:電|电)\s*[）)]/u.exec(
    body,
  );
  if (dispatch) add(outletIdentity('cna'), dispatch[0]);
  for (const sentence of body.split(/[。！？!?；;\n]+/)) {
    for (const { outlet: identity, pattern } of mentions) {
      if (identity.media === own) continue;
      for (const match of sentence.matchAll(pattern)) {
        const start = match.index;
        const end = start + match[0].length;
        if (explicitContext(sentence.slice(Math.max(0, start - 45), start), sentence.slice(end, end + 90))) {
          const evidenceStart = Math.max(0, start - 45);
          add(identityOnly(identity), sentence.slice(evidenceStart, Math.max(end, evidenceStart + 160)));
        }
      }
    }
  }
  return [...found.values()];
}

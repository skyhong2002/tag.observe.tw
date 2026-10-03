import favicons from '../../data/favicon-catalog.json' with { type: 'json' };
import { knownOutletNames } from '../similarity/attribution.ts';

// Bylines are stored as the publisher wrote them: a reporter, a desk, an
// agency, a dateline, or several people in one string. Journalist pages need
// a person (or a consistent pen name), so credits are split and then filtered
// against outlet names, desks, roles, places and anything that is not shaped
// like a name. Rejecting a real pseudonym costs one page; accepting a desk
// invents a person, so unknown shapes are dropped.

const HAN = '\\p{Script=Han}';
const PLACES = [
  // Taiwan
  '台北',
  '臺北',
  '新北',
  '桃園',
  '台中',
  '臺中',
  '台南',
  '臺南',
  '高雄',
  '基隆',
  '新竹',
  '苗栗',
  '彰化',
  '南投',
  '雲林',
  '嘉義',
  '屏東',
  '宜蘭',
  '花蓮',
  '台東',
  '臺東',
  '澎湖',
  '金門',
  '馬祖',
  '連江',
  '汐止',
  '板橋',
  '萬里',
  '台灣',
  '臺灣',
  '離島',
  // Abroad
  '東京',
  '大阪',
  '首爾',
  '北京',
  '上海',
  '香港',
  '澳門',
  '曼谷',
  '新加坡',
  '吉隆坡',
  '雅加達',
  '馬尼拉',
  '河內',
  '新德里',
  '倫敦',
  '巴黎',
  '柏林',
  '布魯塞爾',
  '羅馬',
  '馬德里',
  '日內瓦',
  '莫斯科',
  '基輔',
  '華盛頓',
  '紐約',
  '洛杉磯',
  '舊金山',
  '芝加哥',
  '西雅圖',
  '休士頓',
  '多倫多',
  '溫哥華',
  '雪梨',
  '墨爾本',
  '杜拜',
  '特拉維夫',
  '耶路撒冷',
  '伊斯坦堡',
  '開羅',
  '聖保羅',
  '墨西哥城',
  '阿迪斯阿貝巴',
  '名古屋',
  '福岡',
  '札幌',
  '沖繩',
  '京都',
  '橫濱',
  '釜山',
  '深圳',
  '廣州',
  '成都',
  '重慶',
  '武漢',
  '天津',
  '杭州',
  '南京',
  '廈門',
  '福州',
  '胡志明市',
  '金邊',
  '仰光',
  '達卡',
  '德黑蘭',
  '利雅德',
  '巴格達',
  '貝魯特',
  '安卡拉',
  '雅典',
  '維也納',
  '布拉格',
  '華沙',
  '布達佩斯',
  '斯德哥爾摩',
  '奧斯陸',
  '哥本哈根',
  '赫爾辛基',
  '阿姆斯特丹',
  '里斯本',
  '都柏林',
  '蘇黎世',
  '伯恩',
  '米蘭',
  '梵蒂岡',
  '渥太華',
  '蒙特婁',
  '波士頓',
  '費城',
  '邁阿密',
  '亞特蘭大',
  '達拉斯',
  '丹佛',
  '拉斯維加斯',
  '聖地牙哥',
  '檀香山',
  '坎培拉',
  '布里斯本',
  '奧克蘭',
  '威靈頓',
  '約翰尼斯堡',
  '奈洛比',
  '布宜諾斯艾利斯',
  '利馬',
  '哈瓦那',
  '巴拿馬',
  '聖荷西',
  '關島',
  '帛琉',
  '吐瓦魯',
  '諾魯',
  '斐濟',
  '海地',
  '貝里斯',
  '巴拉圭',
  '瓜地馬拉',
  '宏都拉斯',
  '中國',
  '日本',
  '韓國',
  '美國',
  '英國',
  '法國',
  '德國',
  '巴西',
  '印度',
  '歐洲',
  '俄羅斯',
  '烏克蘭',
  '以色列',
  '加拿大',
  '澳洲',
];
const ROLE_WORDS = new Set([
  '記者',
  '特派記者',
  '資深記者',
  '實習記者',
  '特約記者',
  '本報記者',
  '中央社記者',
  '駐外記者',
  '文',
  '圖',
  '圖文',
  '文字',
  '攝影',
  '編譯',
  '翻譯',
  '撰文',
  '撰稿',
  '採訪',
  '整理',
  '口述',
  '主筆',
  '作者',
  '影音',
  '製作',
  '企劃',
  '報導',
  '報道',
  '特約作者',
  '特約撰述',
  '專欄作家',
  '特稿',
  '綜合報導',
  '即時報導',
  '連線報導',
  '綜合外電報導',
  '外電',
  '本報訊',
  '本報',
  '匿名',
  '不具名',
  '讀者投書',
  '投書',
  '記者群',
  '團隊',
  '編輯',
  '特派',
  '特派員',
  '记者',
  '编辑',
  '编译',
  '综合报道',
  '报道',
  '撰文',
  '文字',
]);
// Credits for people who did not write the story: the desk editor, proofreader, host.
const NON_AUTHOR_ROLE =
  /^(?:責任編輯|責編|核稿|審稿|校對|主編|總編輯|編輯|監製|主持人|主播|製作人|美術|設計|剪輯|攝影記者|责任编辑|责编|主编|总编辑)(?:[：:／/]|\s|$)/u;
const OUTLET_PREFIX = /^(?:時報|聯合報|聯合晚報|聯合新聞網|經濟日報|中央社|本報|世界新聞網|世界日報)(?=[\p{Script=Han}])/u;
const AUTHOR_ROLE_PREFIX = new RegExp(
  `^(?:(?:特派|資深|實習|特約|本報|中央社|駐[${HAN}]{1,4})?(?:記者|记者)|特派員?|文字?|圖文|圖|攝影|編譯|编译|翻譯|撰文|撰稿|採訪|整理|口述|主筆|作者|特約作者|特約撰述|專欄作家|報導|报道)\\s*[：:／/]?\\s*`,
  'u',
);
const DATELINE = new RegExp(
  `\\s*(?<place>${PLACES.join('|')})?\\s*(?<day>\\d{1,2}日?)?\\s*(?:專電|電|綜合外電報導|綜合外電|綜合報導|综合报道|即時報導|連線報導|現場報導|採訪報導|特稿|報導|报道)\\s*$`,
  'u',
);
const ORG_WORDS =
  /(?:新聞|新闻|傳媒|传媒|媒體|媒体|中心|編輯|编辑|记者|报道|编译|综合|日報|時報|晚報|週刊|周刊|雜誌|電視|廣播|公司|團隊|製作|頻道|電子報|通訊社|通信社|報導|報道|報系|快訊|綜合|提供|贊助|更多|特輯|外電|小組|企劃|企畫|工作室|研究院|研究所|研究中心|基金會|協會|學會|中央社|編輯台|編輯部|編輯室|編輯組|播客|論壇|社論|評論|專欄|投稿|投書|讀者|網友|記者|特派|主播|攝影|影音|編譯|整理|採訪|撰文|口述|本報|本刊|本網|官方|官網|小編|數位|全民|民間|社群|粉絲|專頁|有限|股份|集團|品牌|出版|數據|智庫|大學|學院|機構|政府|委員會|議會|理財|財經|科技|娛樂|體育|國際|政治|社會|生活|地方|兩岸|焦點|即時|要聞|頭條|專題|直播|影片|圖輯|新聞台|電台|報社|世界|全球|天地|聯播|頻道|網路|線上|新聞網|報業|日刊|月刊|季刊|年鑑|百科|資訊|情報|觀察|觀點|解析|分析|速報|快報|晨報|午報|夜報|早報|筆記|日記|教室|講堂|課程|學堂)/u;
const ORG_SUFFIX = /(?:局|處|署|社|報|报|網|网|台|臺|組|部|室|隊|會|院|所|校|廠|店|館|站|版|欄|中心|公司|集團)$/u;
// "崔馨方整理": the role follows the name at some desks.
const ROLE_SUFFIX = new RegExp(`^([${HAN}]{2,5})(?:整理|撰文|撰稿|採訪|編譯|攝影|報導|编译|报道)$`, 'u');
const BRAND_PREFIX =
  /^(?:東森|三立|中天|民視|華視|台視|臺視|中視|公視|中廣|中央社|壹蘋|中時|聯合報|聯合新聞|自由時報|蘋果|鏡週|鏡周|鏡新聞|鏡報|鏡電視|風傳|上報|新頭殼|關鍵評論|信傳|太報|報導者|蕃薯|鉅亨|經濟日|工商時|天下|遠見|商周|商業周|今周|今週|匯流|銳傳|民報|新新聞|放言|年代|非凡|寰宇|大愛|人間|客家|原民|警廣|教育廣播|漢聲|正聲|中央廣播|央廣|大紀元|新唐人|看中國|希望之聲|自由亞洲|美國之音|德國之聲|法廣|路透|法新|美聯|共同|韓聯|新華|人民|環球|觀察者|澎湃|界面|財新|金融時報|華爾街|紐約時報|彭博|日經|朝日|讀賣|每日|產經|BBC|CNN|NHK|Yahoo|ETtoday|NOWnews|TVBS|CTWANT|MoneyDJ|TechNews|Newtalk|Bloomberg|Reuters|AFP)/iu;
const ORG_LATIN =
  /^(?:news|media|events|pr|marketing|communications|consulting|foundation|association|university|institute|school|club|church|hospital|clinic|bank|securities|capital|investment|investments|research|industry|industries|holdings|enterprise|enterprises|partners|editor|editorial|editors|team|staff|desk|studio|studios|magazine|press|times|daily|post|journal|technology|tech|co|ltd|inc|corp|group|network|tv|radio|podcast|taiwan|taipei|global|digital|online|lab|labs|center|centre|bureau|agency|reuters|afp|ap|bloomberg|cnbc|bbc|cnn|nhk|yahoo|google|official|admin|administrator|webmaster|guest|anonymous|unknown|author|writer|reporter|correspondent|contributor|contributors|service|services|solutions|international|company|limited|insider|review|reviews|style|fashion|beauty|health|life|sports|business|finance|money|the|of|and|www|com|net|org|tw|hk|cn|jp)$/i;
const GENERIC_HAN = new Set([
  '匿名',
  '不具名',
  '本報訊',
  '讀者',
  '網友',
  '編輯',
  '記者',
  '綜合',
  '外電',
  '編譯',
  '整理',
  '特稿',
  '社論',
  '快訊',
  '即時',
  '中時',
  '中央',
  '聯合',
  '自由',
  '東森',
  '三立',
  '民視',
  '華視',
  '台視',
  '中視',
  '公視',
  '鏡週',
  '壹蘋',
  '風傳',
  '上報',
  '太報',
  '民報',
  '天下',
  '遠見',
  '商周',
  '今周',
  '大紀元',
  '觀天下',
  '食尚玩家',
  '東森健康',
  '閱政治',
  '全球大爆卦',
  '天下文化',
  '青年日報',
  '旺得富理財網',
  '優分析產業數據中心',
  '運動視界編輯',
  '新聞編輯',
  '更多文章',
  '贊助提供',
  '特輯',
  '即時中心',
  '政治中心',
  '國際中心',
  '娛樂組',
  '編輯組',
  '生活中心',
  '社會中心',
  '財經中心',
  '體育中心',
  '地方中心',
  '健康中心',
  '文教中心',
  '影劇中心',
  '大陸中心',
  '兩岸中心',
  '要聞中心',
  '新聞中心',
  '數位中心',
  '網路中心',
  '即時新聞中心',
  '社運',
  '發電機',
  '主筆室',
  '網編組',
  '書房編輯',
  '數位編輯',
  '達小編',
  '創小編',
  '瘋先生',
]);

function normalize(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}
let blocklist: Set<string> | null = null;
function outletBlocklist(): Set<string> {
  if (!blocklist) {
    const titles = Object.values(favicons as Record<string, { title: string | null }>)
      .map((v) => v.title)
      .filter((v): v is string => !!v);
    const keys = Object.keys(favicons as Record<string, unknown>);
    blocklist = new Set([...titles, ...keys, ...knownOutletNames(), ...GENERIC_HAN].map((v) => normalize(v).toLowerCase()));
  }
  return blocklist;
}
const hanOnly = (value: string) => new RegExp(`^[${HAN}·．・]+$`, 'u').test(value);
const latinOnly = (value: string) => /^[A-Za-z][A-Za-z.'’\- ]*$/.test(value);

function hanName(value: string): boolean {
  if (outletBlocklist().has(value.toLowerCase())) return false;
  if (/\d/.test(value) || ORG_WORDS.test(value) || ORG_SUFFIX.test(value) || BRAND_PREFIX.test(value)) return false;
  if (PLACES.some((place) => value === place || (place.length >= 2 && value.startsWith(place)))) return false;
  const plain = new RegExp(`^[${HAN}]{2,5}$`, 'u');
  const dotted = new RegExp(`^[${HAN}]{1,7}(?:[·．・][${HAN}]{1,7}){1,3}$`, 'u');
  return plain.test(value) || dotted.test(value);
}
function latinName(value: string): boolean {
  if (value.length < 2 || value.length > 40 || outletBlocklist().has(value.toLowerCase())) return false;
  const words = value.split(' ').filter(Boolean);
  if (words.length < 1 || words.length > 4) return false;
  if (words.some((word) => ORG_LATIN.test(word.replace(/[.,]+$/, '')))) return false;
  // TTV, AFP, CNA: short all-caps credits are organizations, not names.
  if (words.length === 1 && /^[A-Z]{2,5}$/.test(value)) return false;
  return true;
}
function mixedName(value: string): boolean {
  if (value.length > 30 || /\d/.test(value)) return false;
  const han = value.replace(/[^\p{Script=Han}·．・]/gu, '');
  const latin = value
    .replace(/[\p{Script=Han}·．・]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return han.length > 0 && latin.length > 0 && hanName(han) && latinName(latin);
}
function isName(value: string): boolean {
  if (hanOnly(value)) return hanName(value);
  if (latinOnly(value)) return latinName(value);
  return mixedName(value);
}

function piecesOf(raw: string): string[] {
  const text = normalize(raw)
    .replace(/[（(][^()（）]*[)）]/gu, ' ')
    .replace(/[「」『』《》〔〕【】[\]"“”]/gu, ' ');
  return text
    .split(/\s*[／/｜|：:、,，；;＋+&]\s*/u)
    .map((piece) => piece.trim())
    .filter(Boolean);
}
function namesInPiece(piece: string): string[] {
  if (NON_AUTHOR_ROLE.test(piece)) return [];
  const unbranded = piece.replace(OUTLET_PREFIX, '');
  const credited = AUTHOR_ROLE_PREFIX.test(unbranded);
  let text = unbranded.replace(AUTHOR_ROLE_PREFIX, '').trim();
  const dateline = DATELINE.exec(text);
  if (dateline) {
    text = text.slice(0, dateline.index).trim();
    // "波士頓1日電" names an unknown city, not a reporter; "呂佳蓉北京30日電"
    // keeps the name because the city was recognised and stripped.
    if (dateline.groups?.day && !dateline.groups.place && !credited) return [];
  }
  text = text.replace(ROLE_SUFFIX, '$1');
  if (!text) return [];
  const tokens = text.split(' ').filter((token) => !ROLE_WORDS.has(token));
  if (!tokens.length) return [];
  if (tokens.every(hanOnly)) {
    // "謝 東明" is one person split by a space; "吳允芊 賴心怡" is two people.
    const merged: string[] = [];
    for (const token of tokens) {
      const last = merged[merged.length - 1];
      if (last !== undefined && (last.length === 1 || token.length === 1) && last.length + token.length <= 5)
        merged[merged.length - 1] = last + token;
      else merged.push(token);
    }
    return merged.filter(hanName);
  }
  if (tokens.every(latinOnly)) return latinName(tokens.join(' ')) ? [tokens.join(' ')] : [];
  return isName(tokens.join(' ')) ? [tokens.join(' ')] : [];
}

/** People (or consistent pen names) credited in one stored byline value. */
export function personNames(raw: string): string[] {
  if (!raw || raw.length > 200) return [];
  const result: string[] = [];
  for (const piece of piecesOf(raw)) {
    for (const name of namesInPiece(piece)) if (!result.includes(name)) result.push(name);
  }
  return result;
}
/** Distinct people across an article's stored credits, in credit order. */
export function journalistNames(values: readonly string[]): string[] {
  const result: string[] = [];
  for (const value of values) for (const name of personNames(value)) if (!result.includes(name)) result.push(name);
  return result;
}
/** Canonical page key for a name: NFKC, single spaces; case is part of a pen name. */
export function journalistKey(name: string): string {
  return normalize(name);
}

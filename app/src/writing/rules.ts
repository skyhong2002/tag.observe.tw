// How an article was written, from its own text only (docs: /method/#writing).
// Every label describes something printed in the article; none rates quality.
//
// 1. Social retelling: the lead (first LEAD_CHARS characters) says someone
//    posted on a platform — 「沈政男10日在臉書貼文…」.
// 2. Poster role: title words in the clause naming the poster (「精神科醫師」),
//    or, for a bare name, the role that name usually carries (writing/people.ts).
// 3. Headline wording: teaser, reaction and attack words in the title.
//
// Changing any pattern changes results: bump VERSION so the job re-analyses
// the bodies it still has and charts can mark the change.
export const VERSION = 'writing-v2';
export const LEAD_CHARS = 250;
export const MIN_BODY = 200;

export const ROLES = ['公職政治', '前任公職', '評論名嘴', '專家企業', '醫療健康', '氣象', '藝人網紅', '機構', '網友民眾', '未知'] as const;
export type Role = (typeof ROLES)[number];
export const PLATFORMS = ['Facebook', 'Threads', 'Instagram', 'X', 'YouTube', '節目直播', 'PTT', 'Dcard', '社群'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const TITLE_TAGS = ['懸念', '反應', '攻擊'] as const;
export type TitleTag = (typeof TITLE_TAGS)[number];

const PLATFORM_WORDS: Array<[Platform, string]> = [
  ['Facebook', '臉書粉專|臉書|粉絲專頁|粉專|FB|Facebook|facebook'],
  ['Threads', 'Threads|threads|脆'],
  ['Instagram', 'IG|Instagram|instagram|限時動態'],
  ['X', 'X平台|平台X|社群X|推特|Twitter|twitter'],
  ['YouTube', 'YouTube|youtube|YT頻道|頻道'],
  ['節目直播', '直播|Podcast|podcast|節目'],
  ['PTT', 'PTT|ptt'],
  ['Dcard', 'Dcard|dcard'],
  ['社群', '社群平台|個人社群|社群媒體|社交媒體|社交平台|社群|微博|小紅書|抖音|TikTok|LINE'],
];
const platformAlt = PLATFORM_WORDS.map(([, w]) => w).join('|');
const postAlt = '發文|PO文|po文|貼文|撰文|發布|發佈|分享|留言|上傳|中表示|中指出|中直言|中透露|上表示|上指出|上直言';
// 「在／於／透過 … 臉書（粉專「…」）… 發文」; the platform must sit inside one clause.
const SOCIAL = new RegExp(
  `(?:在|於|透過|經營的|個人)[^。，,\\n]{0,12}?(?:${platformAlt})(?:「[^」]{0,24}」)?[^。\\n]{0,8}?(?:${postAlt})`,
  'u',
);
// A named page speaking: 「氣象粉專「台灣颱風論壇」指出」.
const PAGE = new RegExp(`(?:${platformAlt})「([^」]{1,24})」[^。\\n]{0,6}?(?:${postAlt}|指出|表示|提醒|宣布)`, 'u');
// 「吳靜怡發文指出」: a post without the platform named.
const BARE = /(?:PO文|po文|發文)(?:指出|表示|說|直言|稱|強調|批評?|嗆|回應|提到|質疑|分享|寫道|透露)/u;

// Checked in order; earlier roles win when a clause carries several titles.
// Former officeholders speak as commentators, so 前任公職 precedes 公職政治;
// 「星座專家」 is an entertainer, so 藝人網紅 precedes 專家企業.
const ROLE_WORDS: Array<[Exclude<Role, '未知'>, RegExp]> = [
  [
    '網友民眾',
    /網友|網民|原PO|原po|一名|一位|有位|某位|民眾|女子|男子|婦人|網路上|用戶|使用者|帳號|女大生|男大生|媽媽|爸爸|人夫|人妻|上班族|通勤族|家長|學生|住戶|房客|乘客|旅客|遊客|車主|司機|駕駛|房仲|店員|屋主|消費者|顧客|員工|投資人|不具名/u,
  ],
  // 「前國民黨主席」「前交通部長」, but not 前往／日前／目前.
  [
    '前任公職',
    /(?<![之日先目提眼])前(?![往來面後夕天年日晚])\p{Script=Han}{0,4}?(?:總統|院長|部長|立委|立法委員|議員|市長|縣長|主席|發言人|國安會|大使|主委|局長|署長|次長|首相|總理|檢察總長)/u,
  ],
  ['評論名嘴', /名嘴|媒體人|評論員|政論|作家|主持人|製作人|退將|退役|時事評論|專欄/u],
  ['醫療健康', /醫師|醫生|名醫|營養師|藥師|心理師|護理師|中醫|診所|醫院|牙醫|治療師|科主任|內科|外科|醫學|營養/u],
  ['氣象', /氣象|天氣|氣候|颱風論壇/u],
  [
    '公職政治',
    /總統|院長|部長|次長|署長|局長|處長|首長|市長|縣長|鎮長|鄉長|區長|立委|立法委員|議員|議長|主席|黨|候選人|參選人|發言人|主委|秘書長|大使|總理|首相|國務卿|官員|政府|市府|縣府|國防部|外交部|競辦|競總|國會|白宮|府方|議會|里長|州長|參議員|眾議員|政委|特使|檢察官|法官|警方|警察局|分局/u,
  ],
  [
    '藝人網紅',
    /藝人|歌手|演員|女星|男星|偶像|天后|天王|女神|網紅|YouTuber|youtuber|部落客|KOL|創作者|女團|男團|樂團|諧星|導演|主播|模特|啦啦隊|球員|選手|投手|球星|達人|命理|星座/u,
  ],
  ['專家企業', /律師|教授|學者|博士|專家|分析師|研究員|講師|顧問|會計師|理財|經濟學家|執行長|董事長|創辦人|總經理/u],
  ['機構', /公司|集團|官方|協會|基金會|出版|業者|品牌|聯盟|工會|大學|店家|餐廳|超商|銀行|歌迷會|後援會|粉絲團/u],
];

/** The first role whose title words appear in text, or null. */
export function roleOf(text: string): Exclude<Role, '未知'> | null {
  return ROLE_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
}

// Trailing time and adverb words between a name and 「在臉書」.
const TAIL =
  /(?:今天|今日|昨天|昨日|昨晚|今晚|今早|前晚|前天|昨夜|稍晚|深夜|半夜|清晨|一早|日前|稍早|稍後|隨後|近日|先前|隨即|則|也|再度|再次|更|又|親自|特別|上午|下午|晚間|凌晨|中午|今|昨|就|曾|[0-9０-９]+[日月]|接連|紛紛|也都|亦|卻是|卻|還|仍|原本|事後|平時會|平時|經常|時常|常|會|都)+$/u;
const NOT_NAME = /^(?:有|他|她|其|對此|此外|同時|另外|因此|而|並|由|本人|對方|當事人|該|這名|那名|此|甚至|至於)|[他她其們]$/u;
// Words that end a clause like a name but name nobody (「以…為題」「家屬」).
const COMMON = new Set(
  '為題 一事 本人 兩人 友人 家屬 居民 目擊者 粉絲 影迷 學生 政治 今年 去年 過去 深夜 涉嫌 賽後 不時 網路 小編 官方 當局 外界 雙方 女方 男方 團隊 校方 院方 警方 記者 媒體 總統 市長 立委 議員 醫師 專家 業者 網紅 藝人 鄰居 同學 同事 老師 家人 親友 少女 少年 孩子 兒子 女兒 太太 老公 老婆 丈夫 妻子 母親 父親 網民 群組 社團 中國部 國人 台灣 中國 美國 日本'.split(
    ' ',
  ),
);
// Job titles that only separate a description from the name (「泌尿科副主任黃品叡」).
const TITLE_ONLY = /(?:副?主任|總監|所長|校長|理事長|社長|總編輯|主編|編輯|老師|教練|團長|隊長|特助|助理|代表)/u;

/** The clause right before the posting phrase, captions and datelines removed. */
export function posterClause(body: string, at: number) {
  let s = body.slice(Math.max(0, at - 60), at);
  s = s
    .replace(/[（(][^）)]*[）)]/gu, '')
    .replace(/\[[^\]]*\]/gu, '')
    .replace(/記者[^／/]{0,12}[／/][^ 　]{0,8}報導/gu, '');
  const cut = Math.max(...['。', '！', '？', '\n', '；', '」'].map((c) => s.lastIndexOf(c)));
  return s.slice(cut + 1).trim();
}

/** The Han-character run that ends the clause, without time words: a candidate name. */
export function posterName(clause: string): string | null {
  // 「發表看法的施景中」: a name starts after 的 or a conjunction; 「王妤嫻在影片曝光後
  // 甜蜜發文」: the poster comes before 在／於.
  const run = clause
    .replace(/(?:在|於)[^，,]*$/u, '')
    .replace(TAIL, '')
    .match(/[\p{Script=Han}·．A-Za-z]{2,8}$/u)?.[0]
    .split(/[的與和及]/u)
    .at(-1);
  const name = run?.replace(/(?:臉書|粉專|本人|自己)$/u, '');
  if (!name || name.length < 2 || COMMON.has(name)) return null;
  if (NOT_NAME.test(name) || NOT_NAME.test(name.slice(-3))) return null;
  return name;
}

/** Suffixes of a name run, longest first: 「精神科醫師沈政男」 → 沈政男 is among them. */
export function nameCandidates(run: string): string[] {
  const out: string[] = run.length > 4 ? [run] : [];
  for (const k of [4, 3, 2]) if (run.length >= k) out.push(run.slice(-k));
  return out;
}

export interface SocialPost {
  platform: Platform;
  /** Clause plus posting phrase, trimmed to fit article_writing.evidence. */
  evidence: string;
  /** Name run at the end of the clause, before resolution. */
  name: string | null;
  role: Role;
  roleSource: 'clause' | null;
}

function earliest(lead: string) {
  const found = ([SOCIAL, PAGE, BARE] as const)
    .map((re) => ({ m: re.exec(lead), page: re === PAGE }))
    .filter((f): f is { m: RegExpExecArray; page: boolean } => !!f.m);
  return found.sort((a, b) => a.m.index - b.m.index)[0] ?? null;
}

/** A title introducing the name elsewhere in the article: 「日本學者小笠原欣幸」. */
function introducedAs(body: string, name: string): Exclude<Role, '未知'> | null {
  const text = body.slice(0, 1500);
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + name.length)) {
    const before = text.slice(Math.max(0, at - 10), at);
    const role = roleOf(before.slice(Math.max(...['，', '。', '！', '？', '；', '\n', '」'].map((c) => before.lastIndexOf(c))) + 1));
    if (role) return role;
  }
  return null;
}

export function socialPost(body: string): SocialPost | null {
  if (body.length < MIN_BODY) return null;
  const lead = body.slice(0, LEAD_CHARS);
  const found = earliest(lead);
  if (!found) return null;
  const { m } = found;
  // 「社群平台X」: the most specific platform named in the phrase wins.
  const platform = PLATFORM_WORDS.find(([, w]) => new RegExp(w, 'u').test(m[0]))?.[0] ?? '社群';
  const clause = posterClause(lead, m.index);
  // Earlier comma-separated parts usually name someone else (「韓國瑜致詞，…」);
  // 「施景中，7日在臉書…」 puts only the date after the comma, so step back once.
  const parts = clause.split(/[，,]/u);
  let subject = parts.at(-1) ?? '';
  if (!subject.replace(TAIL, '') && parts.length > 1) subject = `${parts.at(-2)}${subject}`;
  const evidence = `${clause}${m[0]}`.slice(-200);
  // A named page is its own poster (「台灣颱風論壇」).
  const page = found.page ? m[1] : null;
  const run = page ?? posterName(subject);
  const name = run && !page ? stripTitle(run) : run;
  // The page's own name, the poster's clause, the posting phrase (「林老師氣象站」),
  // then how the article introduced the name earlier.
  const role = (page ? roleOf(page) : null) ?? roleOf(subject) ?? roleOf(m[0]) ?? (name ? introducedAs(body, name) : null);
  return { platform, evidence, name, role: role ?? '未知', roleSource: role ? 'clause' : null };
}

const TITLE_WORDS: Array<[TitleTag, RegExp]> = [
  // Withholds the point to make the reader click: 「醫：使用前先做1事」.
  [
    '懸念',
    /[1一]事|[1一]關鍵|[1一]原因|這原因|這[1一]?點|[1-9一二三四五]大(?:原因|關鍵|警訊)|原因曝|真相曝|內幕曝|答案曝|曝光了|說話了|回應了|揭[1一]|這句話|這樣說|下場曝|下場/u,
  ],
  ['反應', /反應驚人|反應[亮絕]了|超狂|驚人|嚇壞|傻眼|崩潰|炸鍋|一面倒|打臉|嗆爆|酸爆|笑翻|看傻|暴動|網炸/u],
  ['攻擊', /狠酸|怒轟|狠轟|怒批|開嗆|嗆|轟|酸爆|噁|砲轟|痛批|狂批|暴怒|怒/u],
];

export function titleTags(title: string): TitleTag[] {
  return TITLE_WORDS.filter(([, re]) => re.test(title)).map(([tag]) => tag);
}

/** 「精神科醫師沈政男」 → 「沈政男」: drops everything up to the last title word. */
export function stripTitle(run: string): string {
  let cut = 0;
  for (const re of [...ROLE_WORDS.map(([, r]) => r), TITLE_ONLY]) {
    const g = new RegExp(re.source, 'gu');
    for (const m of run.matchAll(g)) cut = Math.max(cut, m.index + m[0].length);
  }
  const rest = run.slice(cut);
  return rest.length >= 2 ? rest : run;
}

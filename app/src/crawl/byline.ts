// Provider labels on syndication platforms may identify a person and their
// affiliation, rather than a separate publisher. Only strip an explicit role.
export function reporterCredit(value: string): string | null {
  const text = value.normalize('NFKC').trim();
  const match = /^([^|｜／/]{2,50})\s*[|｜／/]\s*[^|｜／/]*(?:特派記者|記者|撰稿人|特約作者|correspondent|reporter)\s*$/iu.exec(text);
  if (!match) return null;
  const name = match[1].trim();
  return /(?:編輯室|編輯部|新聞網|通訊社)/u.test(name) ? null : name;
}
export function normalizeAuthorCredits(values: string[]): string[] {
  return [...new Set(values.map((value) => reporterCredit(value) ?? agencyDatelineCredit(value) ?? value.trim()).filter(Boolean))];
}

/** Roles, placeholders and technical site credits do not identify authors. */
export function isNonAuthorCredit(value: string): boolean {
  const text = value.normalize('NFKC').trim();
  return (
    /^(?:友站新聞|社論|社论)$/u.test(text) ||
    /^(?:責任編輯|责任编辑|責編|责编)/u.test(text) ||
    /(?:網頁|網站|网页|网站)[\s:：]*(?:設計|设计|製作|制作)|\bweb(?:site)?\s+design\b/iu.test(text)
  );
}

const PLACES = [
  '嘉縣',
  '嘉市',
  '北市',
  '桃市',
  '中市',
  '南市',
  '高市',
  '竹縣',
  '竹市',
  '基市',
  '宜縣',
  '花縣',
  '東縣',
  '屏縣',
  '澎縣',
  '金縣',
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
  '埔里',
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
  '台灣',
  '臺灣',
  '名古屋',
  '福岡',
  '札幌',
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
  '休斯頓',
  '加州',
  '橙縣',
  '灣區',
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
  '波士頓',
  '渥太華',
  '蒙特婁',
  '里斯本',
  '斯德哥爾摩',
  '赫爾辛基',
  '哥本哈根',
  '阿姆斯特丹',
  '維也納',
  '布拉格',
  '華沙',
  '布達佩斯',
  '伯恩',
  '蘇黎世',
  '坎培拉',
  '布里斯本',
  '奧克蘭',
  '威靈頓',
  '約翰尼斯堡',
  '奈洛比',
  '布宜諾斯艾利斯',
  '利馬',
  '哈瓦那',
  '關島',
  '汐止',
  '板橋',
  '萬里',
  '離島',
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
  '奧斯陸',
  '都柏林',
  '米蘭',
  '梵蒂岡',
  '費城',
  '邁阿密',
  '亞特蘭大',
  '達拉斯',
  '丹佛',
  '拉斯維加斯',
  '聖地牙哥',
  '檀香山',
  '巴拿馬',
  '聖荷西',
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
].sort((a, b) => b.length - a.length);
const PLACE = `(?:${PLACES.join('|')})(?:縣|市)?`;
const placeName = new RegExp(`^${PLACE}$`, 'u');
const SUFFIX_ROLE = '(?:駐外記者|特派記者|特約記者|資深記者|實習記者|記者)';
const ROLE = `(?:${SUFFIX_ROLE}|編譯|採訪撰文|撰文|撰稿|(?:圖\\s*/\\s*文|文\\s*[、/]\\s*圖|圖文)(?=\\s*[/：:])|文(?=\\s*[/：:]))`;
const OUTLET =
  '(?:中央社|聯合報|聯合晚報|經濟日報|自由時報|中國時報|工商時報|台灣醒報|台灣電報|大成報|勁報|新頭殼|新頭殼newtalk|Newtalk|NOWnews|ETtoday|TVBS|CTWANT|匯流新聞網|CNEWS匯流新聞網|台灣好新聞|臺灣好新聞|台灣新生報|民眾日報|民眾網|視傳媒|台灣新聞雲|今傳媒|TMNU|好房網News|中華日報|青年日報|民生電子報|觀傳媒|威傳媒|警政時報|亞太新聞網|獨家報導|壹蘋新聞網|鏡新聞|中時新聞網|東森新聞|三立新聞網|中天新聞網|民視新聞|風傳媒|信傳媒|太報|上報|聯合新聞網|大紀元|新唐人電視台|墨新聞|互傳媒|創新聞|點傳媒|商傳媒)';
const outletName = new RegExp(`^${OUTLET}$`, 'iu');
const OPEN = '[〔【(\\[]';
const CLOSE = '[〕】)\\]]';
const PREFIX = `^(?:${OPEN}\\s*)?(?:${OUTLET}\\s*(?:${CLOSE}\\s*)?[/|:]?\\s*)?(?:${PLACE}\\s*/\\s*)?`;
const rolePrefix = new RegExp(`${PREFIX}(?:文\\s*/\\s*(?=(?:特派)?記者))?${ROLE}\\s*[/：:]?\\s*`, 'iu');
const dateline = new RegExp(
  `\\s*(?:${PLACE})(?:\\s*${PLACE})?(?:\\s*\\d{1,2}日(?:電|專電)|\\s*(?:(?:綜合|综合)?(?:報導|報道|报道)|電|專電))(?=\\s*(?:${CLOSE}|$|[。；;]))`,
  'u',
);
// A wire-service dispatch location is not an additional author.
function agencyDatelineCredit(value: string): string | null {
  const text = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return new RegExp(`^中央社\\s*/\\s*${PLACE}\\s*\\d{1,2}日(?:專電|電)$`, 'u').test(text) ? '中央社' : null;
}

const NON_PERSON =
  /(?:記者|记者|編譯|编译|編輯|编辑|攝影|摄影|整理|報導|報道|报道|新聞|新闻|通訊|通讯|中心|小組|小组|綜合|综合|採訪|采访|本報|本报|即時|即时|提問|提问|訪問|访问|中央社|法新社|美聯社|路透社|警政時報|頻道|频道|日報|日报|時報|时报|報紙|报纸|社群|週刊|周刊|月刊|年刊|雜誌|杂志|媒體|媒体|傳媒|传媒|團隊|团队|製作|制作|主編|主编|總編|总编|共同編寫|共同编写|溫度計|温度计|台灣前進)|^(?:TaiwanPlus|US Taiwan Watch)$|\b(?:staff|writer|agencies|agency|editor|team|desk|news|reporter|press|bureau)\b/iu;
const epochDateline = /^[【[]大紀元\d{4}年\d{1,2}月\d{1,2}日訊[】\]]\s*/u;

function creditedNames(value: string): string[] {
  const names = value
    .trim()
    .split(/\s*(?:[、,，&＆]|以及|(?<=[\p{Script=Han}]{2,5})[及與和](?=[\p{Script=Han}]{2,5})| (?:及|與|和|and) )\s*|\s*\/\s*/u)
    .filter((name) => name && !/^(?:SNG|VJ|ENG)$/i.test(name))
    .flatMap((name) => {
      if (!/^[\p{Script=Han}]+(?: [\p{Script=Han}]+)+$/u.test(name)) return [name];
      const parts: string[] = [];
      for (const token of name.split(' ')) {
        const last = parts[parts.length - 1];
        if (last && (last.length === 1 || token.length === 1) && last.length + token.length <= 5) parts[parts.length - 1] += token;
        else parts.push(token);
      }
      return parts;
    });
  if (!names.length) return [];
  // Han bylines have short names or dotted indigenous/foreign names. Latin
  // names may contain spaces; they still need an explicit author role.
  const valid = (name: string) =>
    !NON_PERSON.test(name) &&
    !placeName.test(name) &&
    !outletName.test(name) &&
    !/(?:網|网|報|报|刊|編輯部|编辑部|編輯室|编辑室)$/.test(name) &&
    !/^[A-Z]{2,5}$/.test(name) &&
    (/^[\p{Script=Han}]{2,5}$/u.test(name) ||
      /^[\p{Script=Han}]{1,8}(?:[·・.][\p{Script=Han}]{1,8}){1,3}$/u.test(name) ||
      /^[A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*(?: [A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*){0,3}$/u.test(name));
  return names.every(valid) ? [...new Set(names)] : [];
}

/** Explicit reporter/writer declarations at the start of a byline or body lead. */
export function reporterNames(value: string): string[] {
  // The publisher's opening date is followed by a separate parenthesized
  // reporter declaration; only remove that exact dateline at the start.
  const text = value.normalize('NFKC').replace(/[╱∕]/g, '/').replace(/\s+/g, ' ').trim().replace(epochDateline, '');
  if (!text) return [];
  const writer = /^文\s+([\p{Script=Han}]{2,5})$/u.exec(text);
  if (writer) return creditedNames(writer[1]);
  // Xinhua wire dispatches put a parenthesized reporter credit immediately
  // after their city/date dateline. Later quoted mentions do not qualify.
  const xinhua = /^(?:新华社|新華社)[\p{Script=Han}]{1,12}\d{1,2}月\d{1,2}日(?:电|電)\s*\((?:记者|記者)\s*([^()]{2,60})\)/u.exec(text);
  if (xinhua) return creditedNames(xinhua[1]);
  // Imported health features credit their original writer and translator in
  // one field. Both roles establish authorship; editors remain separate.
  const translated = /^(?:文|撰文|撰稿|作者)\s*[/：:]\s*(.+?)\s+(?:編譯|翻譯)\s*[/：:]\s*(.+)$/u.exec(text);
  if (translated) {
    const writers = creditedNames(translated[1]);
    const translators = creditedNames(translated[2]);
    return writers.length && translators.length ? [...new Set([...writers, ...translators])] : [];
  }
  // A desk-prefixed television byline explicitly ends at its reporting place.
  const desk = new RegExp(
    `^(?:社會|政治|生活|國際|財經|體育|娛樂|地方|新聞)中心\\s*/\\s*(.+?)\\s+${PLACE}\\s*(?:報導|報道|报道)$`,
    'u',
  ).exec(text);
  if (desk) return creditedNames(desk[1]);
  const prefix = rolePrefix.exec(text);
  if (prefix) {
    let rest = text.slice(prefix[0].length);
    // CNA dispatches and bracketed regional reports concatenate the name and
    // location. Strip the dateline before considering ordinary delimiters.
    const place = dateline.exec(rest);
    if (place) return creditedNames(rest.slice(0, place.index));
    rest = rest.replace(/(?:綜合|综合)?(?:報導|報道|报道)(?=\s*(?:[〕】)\]]|$))/, '');
    // A photo/editor credit belongs to a separate role, never to the writer.
    rest = rest.replace(/\s*[、,，;；]\s*(?:攝影|摄影|圖|圖文|編輯|编辑)[\s/:：].*$/u, '');
    const boundary = /[/|:：〕】)\]]|\s+(?:圖(?:文)?|攝影|摄影)[/:：]/u.exec(rest);
    if (boundary) return creditedNames(rest.slice(0, boundary.index));
    return creditedNames(rest);
  }
  // Some publishers put the name before the role or omit the role in a
  // bracketed "name / place 報導" declaration. Require its explicit suffix.
  const suffix = new RegExp(`${PREFIX}(.+?)\\s*(?:${SUFFIX_ROLE})(?=\\s*(?:[/|:：]|${CLOSE}|${PLACE}\\s*(?:報導|報道|报道)|$))`, 'iu').exec(
    text,
  );
  if (suffix) return creditedNames(suffix[1]);
  const plum = /^梅花新聞網\s+([^/]+)\s*\/\s*綜合報導/u.exec(text);
  if (plum) return creditedNames(plum[1]);
  // Bo News credits can share a plain-text paragraph with the entire report.
  // Its explicit publisher prefix and a known location delimit the signature.
  const bo = new RegExp(
    `^(?:${OPEN}\\s*)?波新聞[─－—-]\\s*([^/|:：〕】)\\]]+)\\s*/\\s*${PLACE}(?:報導|報道|报道)?(?=\\s|$|${CLOSE})`,
    'u',
  ).exec(text);
  if (bo) return creditedNames(bo[1]);
  const namedOutlet =
    /^(?:[【〔([]\s*)?(?:Lai|賴)傳媒、記者爆料網(?:\s*\/\s*|\s+)\s*([^/|:：〕】)\]]+)\s*\/\s*(?:[^/〕】)\]]{1,12})(?:[〕】)\]]|$)/u.exec(
      text,
    );
  if (namedOutlet) return creditedNames(namedOutlet[1]);
  const parenthesizedEnglish = /^\(By\s+([^()]+)\)$/iu.exec(text);
  if (parenthesizedEnglish) return creditedNames(parenthesizedEnglish[1]);
  const english = /^By\s+([^|:：〕】)\]]+)(?:$|\s*\/)/iu.exec(text);
  if (english) return creditedNames(english[1]);
  const report = new RegExp(
    `${PREFIX}([^/|:：〕】)\\]]+)\\s*/\\s*(?:${PLACE}|綜合(?:外電)?|综合(?:外电)?)\\s*(?:報導|報道|报道)(?=\\s*(?:${CLOSE}|$|[。；;]))`,
    'u',
  ).exec(text);
  return report ? creditedNames(report[1]) : [];
}

/** Only a body's opening credit establishes authorship; skip leading photo captions. */
export function extractLeadReporterNames(body: string): string[] {
  for (const paragraph of body
    .trim()
    .split(/\n\s*\n/)
    .slice(0, 3)) {
    const names = reporterNames(paragraph);
    if (names.length) return names;
    if (epochDateline.test(paragraph.normalize('NFKC').trim()) && !paragraph.normalize('NFKC').trim().replace(epochDateline, '')) continue;
    if (!/^(?:[▲▼]|\s*$)|[（(](?:[^（）()]{0,40}(?:圖|攝|照)|圖[／/])[^（）()]*[）)]$/.test(paragraph)) break;
  }
  return [];
}

/** CNA syndicated reports credit their translator in the closing parenthesis. */
export function extractClosingReporterNames(body: string): string[] {
  // Verified Daai transcripts separate reporting names from production names
  // with a vertical bar. Only a complete standalone terminal credit qualifies.
  const daai =
    /(?:^|\n\s*\n)([\p{Script=Han}]{2,5}(?:\s+[\p{Script=Han}]{2,5}){0,4})\s+(?:尼泊爾|花蓮)報導(?:[│|]\s*[\p{Script=Han}]{2,5}(?:\s+[\p{Script=Han}]{2,5}){0,4}\s+製作)?\s*$/u.exec(
      body,
    );
  if (daai) return creditedNames(daai[1]);
  // Red Star reports close with a standalone reporter line and optional
  // editing/review lines. A reporter mentioned inside narrative is not a credit.
  const redStar =
    /(?:^|\n\s*\n)(?:红星新闻记者|紅星新聞記者)\s+([^\n。！？]{2,40})(?:\n\s*\n(?:编辑|編輯|审核|審核)\s+[^\n。！？]{2,40}){0,2}\s*$/u.exec(
      body,
    );
  if (redStar) return creditedNames(redStar[1]);
  const closing = /[（(]\s*編譯\s*[:：]\s*([^（）()\n]{2,60})\s*[）)]\s*(?:\d{6,8})?\s*$/.exec(body);
  if (closing) return creditedNames(closing[1]);
  // Verified NTD syndicated reports end in a standalone reporting credit.
  // Do not search narrative paragraphs for people mentioned as reporters.
  const last =
    body
      .trim()
      .split(/\n\s*\n/)
      .at(-1)
      ?.trim() ?? '';
  // NTD Asia Pacific closes video transcripts with a publisher-prefixed
  // credit, sometimes merged into the final paragraph by <br> markup.
  const asiaPacific = new RegExp(
    `(?:^|[。！？]\\s+)新唐人亞太電視\\s+([^。！？]{2,60}?)\\s+(?:${PLACE}(?:\\s*${PLACE})?|綜合(?:外電)?)報導$`,
    'u',
  ).exec(last.normalize('NFKC').replace(/\s+/g, ' '));
  if (asiaPacific) return creditedNames(asiaPacific[1]);
  return /^新唐人電視台記者[^。！？\n]{2,60}(?:綜合)?報導$/.test(last) ? reporterNames(last) : [];
}

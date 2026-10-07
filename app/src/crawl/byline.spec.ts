import { describe, expect, it } from 'vitest';
import {
  extractClosingReporterNames,
  extractLeadReporterNames,
  isNonAuthorCredit,
  normalizeAuthorCredits,
  reporterCredit,
  reporterNames,
} from './byline.ts';

describe('explicit reporter credits', () => {
  it('accepts a standalone writer credit without treating ordinary prose as a byline', () => {
    expect(extractLeadReporterNames('文 张红日\n\n文章介紹巴西選舉。')).toEqual(['张红日']);
    expect(reporterNames('文 张红日与同事讨论了这一话题。')).toEqual([]);
    expect(reporterNames('文 新闻编辑中心')).toEqual([]);
  });

  it('reads the reporters in an opening Xinhua dispatch credit', () => {
    expect(reporterNames('新华社莫斯科10月7日电（记者王作葵　刘恺）俄罗斯发布通告。')).toEqual(['王作葵', '刘恺']);
    expect(reporterNames('新華社莫斯科10月7日電（記者王作葵、劉愷）政府发布通告。')).toEqual(['王作葵', '劉愷']);
    expect(reporterNames('引述新华社莫斯科10月7日电（记者王作葵 刘恺）的消息。')).toEqual([]);
    expect(reporterNames('新华社莫斯科10月7日电（责任编辑王小明）政府发布通告。')).toEqual([]);
    expect(extractLeadReporterNames('政府发布通告。\n\n新华社莫斯科10月7日电（记者王作葵 刘恺）')).toEqual([]);
  });

  it('extracts NTD Asia Pacific terminal credits even after a merged paragraph', () => {
    expect(extractClosingReporterNames('完整新聞內容。 新唐人亞太電視 黃亮戩 林嘉韋 邱春蓉 台灣台北報導')).toEqual([
      '黃亮戩',
      '林嘉韋',
      '邱春蓉',
    ]);
    expect(extractClosingReporterNames('新聞正文。\n\n新唐人亞太電視 池千里 陳玲芝 綜合報導')).toEqual(['池千里', '陳玲芝']);
    expect(extractClosingReporterNames('受訪者提到「新唐人亞太電視 池千里 陳玲芝 綜合報導」。')).toEqual([]);
    expect(extractClosingReporterNames('新唐人亞太電視 池千里 陳玲芝 綜合報導\n\n以上是受訪者的引述。')).toEqual([]);
  });

  it.each(['友站新聞', '社論', '社论', '責任編輯 靳璦', '責任編輯靳璦', '牧迪網頁設計', 'Web Design Studio', '網站製作'])(
    'excludes non-author credit %s',
    (value) => {
      expect(isNonAuthorCredit(value)).toBe(true);
    },
  );
  it.each(['黃彩絹', '作者：王小明｜責任編輯：靳璦', '編輯部', '社論委員會', '中央社'])(
    'preserves actual writer or institutional credit %s',
    (value) => {
      expect(isNonAuthorCredit(value)).toBe(false);
    },
  );
  it.each([
    ['記者林欣漢 陳政宇／台北報導', ['林欣漢', '陳政宇']],
    ['【陳靜文／綜合報導】政策今天公布。', ['陳靜文']],
    ['記者張小媛、周威志、侯彩紅、郭翊軒、SNG／台北報導', ['張小媛', '周威志', '侯彩紅', '郭翊軒']],
    ['記者曾和平／台北報導', ['曾和平']],
    ['記者王小明及李小明／台北報導', ['王小明', '李小明']],
    ['記者郭 嘉／台北報導', ['郭嘉']],
    ['（中央社特派記者李小明瓜地馬拉6日電）政策今天公布。', ['李小明']],
    ['【觀傳媒記者洪議政／台北報導】政策今天公布。', ['洪議政']],
    ['記者廖建智嘉縣報導', ['廖建智']],
    ['【記者廖建智嘉市報導】', ['廖建智']],
    ['【記者王小明高市報導】', ['王小明']],
    ['【記者王小明臺北市報導】', ['王小明']],
    ['好房網News記者李彥穎／高雄報導', ['李彥穎']],
    ['記者林欣漢／台北報導', ['林欣漢']],
    ['〔記者林欣漢／台北報導〕政策今天公布。', ['林欣漢']],
    ['記者李欣芳、陳政宇／台北報導', ['李欣芳', '陳政宇']],
    ['（中央社記者王心妤、葉冠吟台北6日電）政策今天公布。', ['王心妤', '葉冠吟']],
    ['（中央社特派記者戴雅真名古屋6日電）政策今天公布。', ['戴雅真']],
    ['（中央社記者唐佩君布魯塞爾6日專電）政策今天公布。', ['唐佩君']],
    ['【台灣醒報記者呂翔禾台北報導】政策今天公布。', ['呂翔禾']],
    ['【台灣電報記者廖宥婷/台中報導】', ['廖宥婷']],
    ['【大成報記者于郁金/嘉義報導】', ['于郁金']],
    ['【視傳媒記者羅蔚舟/新竹報導】', ['羅蔚舟']],
    ['【范麗玉記者 台南報導】政策今天公布。', ['范麗玉']],
    ['［台灣新聞雲］記者劉至程/花蓮報導', ['劉至程']],
    ['【Lai傳媒、記者爆料網／周庭慶／花蓮報導】政策今天公布。', ['周庭慶']],
    ['【Lai傳媒、記者爆料網 金東天 / 高雄報導】政策今天公布。', ['金東天']],
    ['【賴傳媒、記者爆料網 王俊勝 / 台東報導】台東基地發生火警。', ['王俊勝']],
    ['【亞太新聞網／記者范文濱／桃園報導】政策今天公布。', ['范文濱']],
    ['【警政時報 薛秀蓮 / 台北報導】政策今天公布。', ['薛秀蓮']],
    ['經濟日報 / 編譯葉亭均 / 綜合外電', ['葉亭均']],
    ['波新聞─范曉龍／台北市', ['范曉龍']],
    ['波新聞─李至文／高雄 115年第二屆全國原住民族舉重錦標賽於高雄舉行。', ['李至文']],
    ['波新聞—李至文 / 高雄\n賽事於高雄舉行。', ['李至文']],
    ['波新聞─李至文／高雄報導', ['李至文']],
    ['【波新聞─李至文／高雄報導】賽事於高雄舉行。', ['李至文']],
    ['CNEWS匯流新聞網記者王佐銘／台北報導', ['王佐銘']],
    ['【記者卓羽榛臺北報導】', ['卓羽榛']],
    ['【今傳媒/記者李祖東報導】', ['李祖東']],
    ['TMNU記者 陳們明／綜合報導', ['陳們明']],
    ['【曾宛如／綜合報導】政策今天公布。', ['曾宛如']],
    ['編譯陳韻涵／綜合報導', ['陳韻涵']],
    ['圖／文：王子豪', ['王子豪']],
    ['文、圖／王小明', ['王小明']],
    ['圖文／王小明', ['王小明']],
    ['文／圖：王小明', ['王小明']],
    ['文／記者林欣若　圖／品牌提供', ['林欣若']],
    ['梅花新聞網 洪子苓/綜合報導', ['洪子苓']],
    ['文／陳韻涵', ['陳韻涵']],
    ['文／Amy Denney 編譯／朱緯', ['Amy Denney', '朱緯']],
    ['文 / Amy Denney 編譯 / 朱緯', ['Amy Denney', '朱緯']],
    ['台北／記者林欣漢', ['林欣漢']],
    ['林欣漢記者／台北報導', ['林欣漢']],
    ['林欣漢／台北報導', ['林欣漢']],
    ['記者／林欣漢', ['林欣漢']],
    ['記者谷辣斯．尤達卡／台北報導', ['谷辣斯.尤達卡']],
    ['By Lo Tien-pin and Fion Khan', ['Lo Tien-pin', 'Fion Khan']],
    ['記者林欣漢、林欣漢／台北報導', ['林欣漢']],
    ['記者林欣漢 圖／張小明', ['林欣漢']],
    ['【大紀元2026年10月06日訊】（大紀元記者陸希休斯頓報導）休士頓師大附中校友會歡聚中秋。', ['陸希']],
    ['（大紀元記者陸希休士頓報導）休士頓師大附中校友會歡聚中秋。', ['陸希']],
    ['【大紀元2026年10月05日訊】（大紀元記者戴德蔓台灣台北報導）貢獻獎舉行頒獎典禮。', ['戴德蔓']],
    ['【大紀元2026年10月06日訊】（大紀元記者薛明珠加州報導）民主人士出席聽證會。', ['薛明珠']],
    ['（大紀元記者邱晨加拿大多倫多報道）社區舉辦活動。', ['邱晨']],
    ['（大紀元記者徐曼沅橙縣報導）社區舉辦活動。', ['徐曼沅']],
    ['（大紀元記者曹景哲灣區報導）社區舉辦活動。', ['曹景哲']],
    ['【大紀元2026年10月05日訊】（大紀元記者呈工綜合報導）國際政策出現變化。', ['呈工']],
    ['記者呈工綜合報導', ['呈工']],
    ['（大紀元記者常學西雅圖綜合報導）航空和鐵路運輸能力同步擴充。', ['常學']],
    ['（大紀元記者鍾元台灣綜合報導）陸委會召開座談會。', ['鍾元']],
    ['（大紀元記者良克霖費城綜合報道）房屋淨值大幅提升。', ['良克霖']],
    ['（大紀元記者田青渥太華綜合報導）地稅是選民關心議題。', ['田青']],
  ])('extracts %s', (value, expected) => {
    expect(reporterNames(value)).toEqual(expected);
  });

  it.each([
    '警方告訴記者王小明，事件仍待調查。',
    '記者王小明今天表示，事件仍待調查。',
    '記者會今天在台北舉行，市長表示將公布政策。',
    '記者提問／市長回答',
    '（中央社台北6日電）政策今天公布。',
    '攝影記者王小明／台北報導',
    '圖／記者王小明',
    '責任編輯／王小明',
    '編輯王小明／綜合報導',
    '記者社會中心／綜合報導',
    '王小明',
    '文字大小',
    '記者財經頻道／台北報導',
    '記者娛樂頻道／台北報導',
    '記者健康頻道／台北報導',
    '文／鏡週刊',
    '文／七逗旅遊網',
    '文／常春月刊',
    '文／大成報',
    '文／勁報',
    '文／臺北市',
    '文／主編',
    '文／網路溫度計',
    '文／共同編寫',
    '文／社群編輯',
    '記者新聞製作團隊／台北報導',
    '記者中央社／台北報導',
    '記者警政時報／台北報導',
    'By Staff writer',
    'By Staff writer, with agencies',
    'Staff writer, with agencies',
    'By TaiwanPlus',
    'By US Taiwan Watch',
    '文／台灣前進',
    '【台北／綜合報導】',
    '文／Amy Denney 責任編輯／李維真',
    '文／Amy Denney 編譯／新聞中心',
    '【大紀元2026年10月06日訊】休士頓師大附中校友會歡聚中秋。',
    '【新唐人北京時間2026年10月06日訊】石油咽喉突然易手！',
    '校友表示（大紀元記者陸希休斯頓報導）活動相當熱鬧。',
    '波新聞─李至文／高雄人文故事持續報導中。',
    '本文引用波新聞─李至文／高雄 賽事報導。',
  ])('does not invent an author from %s', (value) => {
    expect(reporterNames(value)).toEqual([]);
  });

  it('preserves syndication credit normalization', () => {
    expect(reporterCredit('王小明／中央社記者')).toBe('王小明');
    expect(reporterCredit('中央社／新聞網')).toBeNull();
    expect(normalizeAuthorCredits([' 王小明 ', '王小明／中央社記者', '中央社'])).toEqual(['王小明', '中央社']);
  });
});

describe('closing translator credits', () => {
  it('recognizes an explicit CNA translation credit followed by the ROC date', () => {
    expect(extractClosingReporterNames('新聞內文。（編譯：陳彥鈞）1151006')).toEqual(['陳彥鈞']);
    expect(extractClosingReporterNames('新聞內文。（編譯：陳彥鈞）')).toEqual(['陳彥鈞']);
  });
  it('rejects editorial, photography and nonterminal mentions', () => {
    expect(extractClosingReporterNames('新聞內文。（編輯：王小明）1151006')).toEqual([]);
    expect(extractClosingReporterNames('新聞內文。（攝影：王小明）1151006')).toEqual([]);
    expect(extractClosingReporterNames('（編譯：陳彥鈞）1151006\n\n其他報導內容。')).toEqual([]);
    expect(extractClosingReporterNames('新聞內文。（編譯：新聞中心）1151006')).toEqual([]);
  });
});

describe('body lead credits', () => {
  it('recognizes the opening reporter declaration after photo captions', () => {
    expect(extractLeadReporterNames('▲市長出席記者會。（圖／記者張小明攝）\n\n記者王小明／台北報導\n\n市長今天公布政策。')).toEqual([
      '王小明',
    ]);
    expect(extractLeadReporterNames('現場照片（圖／記者張小明攝）\n\n記者王小明／台北報導')).toEqual(['王小明']);
  });
  it('stops at the first prose paragraph and does not credit a reporter quoted later', () => {
    expect(extractLeadReporterNames('市長今天公布政策。\n\n記者王小明／台北報導')).toEqual([]);
    expect(extractLeadReporterNames('▲現場照片\n\n市長今天公布政策。\n\n記者王小明／台北報導')).toEqual([]);
  });
  it('limits the caption scan to the first three paragraphs', () => {
    expect(extractLeadReporterNames('▲照片一\n\n▲照片二\n\n▲照片三\n\n記者王小明／台北報導')).toEqual([]);
  });
  it('accepts an exact publisher date paragraph followed immediately by its reporter credit', () => {
    expect(extractLeadReporterNames('【大紀元2026年10月06日訊】\n\n（大紀元記者陸希休斯頓報導）休士頓師大附中校友會歡聚中秋。')).toEqual([
      '陸希',
    ]);
    expect(extractLeadReporterNames('【大紀元2026年10月06日訊】校友歡聚中秋。\n\n（大紀元記者陸希休斯頓報導）')).toEqual([]);
  });
});

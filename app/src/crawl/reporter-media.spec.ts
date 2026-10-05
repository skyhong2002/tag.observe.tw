import { describe, expect, it } from 'vitest';
import { extractArticle } from './article.ts';
import { overrides } from './sources/overrides.ts';

// Public publisher samples fetched 2026-10-06. Keep only the first 160
// characters needed to exercise each real byline shape; no network in tests.
const samples = [
  {
    media: 'ettoday',
    url: 'https://www.ettoday.net/news/20261003/3248494.htm',
    lead: '▲中央氣象署發布豪大雨特報。（示意圖／ETtoday資料照）\n\n記者李依琳／台北報導\n\n中央氣象署針對8縣市發布豪大雨特報，東北季風影響及午後對流雲系發展旺盛，易有短延時強降雨，今（3日）屏東縣及宜蘭縣山區有局部大雨或豪雨，宜蘭、花蓮、南投、台南、屏東地區及雲林以南山區有局部大雨發生的機率，請注意雷擊及強陣風，山區請留',
    expected: ['李依琳'],
    declared: ['李依琳'],
  },
  {
    media: 'ftnn',
    url: 'https://www.ftnn.com.tw/news/584275',
    lead: '記者邱梓欣／綜合報導\n\n台股本周（9／29～10／2）最後一個交易日（2日）收在48,475.74點，本周共攻高上漲451.14點、漲幅0.94％。據證交所籌碼動向，投信本周買超205.04億元。觀察賣超個股方面， 由於美國記憶體大廠美光（Micron）財報、財測皆優於市場預期，帶動記憶體景氣，台廠相關如華邦電（234',
    expected: ['邱梓欣'],
    declared: ['邱梓欣'],
  },
  {
    media: 'cna',
    url: 'https://www.cna.com.tw/news/ahel/202610030169.aspx',
    lead: '（中央社記者陳至中台北3日電）陽明交通大學醫學系一名男教師傳出涉及性平事件，校方今天表示，已暫停該名教師的職務，並已進行校安通報。陽明交大一名女學生近期在社群平台Threads上以#IAmJaneDoe的形式，指遭一名醫學系男教師騷擾，陸續有多名網友貼文分享類似經歷。陽明交大校方今天表示，該名教師去年才到職，醫學系與性',
    expected: ['陳至中'],
    declared: ['陳至中'],
  },
  {
    media: 'newtalk',
    url: 'https://newtalk.tw/news/view/2026-10-03/1063427',
    lead: '（中央社記者黎建忠名古屋3日電）名古屋亞洲運動會高爾夫國手王偉軒今天沒能在最終回合再飆低桿數，以平標準70桿作收，以4天低於標準11桿的269桿獲第5，而男子團體以1桿之差排第4。\n\n連3屆參加亞運的王偉軒首回合繳出全場最低65桿獨居領先，可惜後3回合開低走高，依序繳出66、68、70桿。\n\n王偉軒最終回合抓3博蒂、吞',
    expected: ['黎建忠'],
    declared: ['文/中央社'],
  },
  {
    media: 'anntw',
    url: 'https://www.anntw.com/articles/20261001-BSy0',
    lead: '【台灣醒報記者呂翔禾台北報導】演員舒淇跨足導演大成功！金馬獎1日公布入圍名單，舒淇入圍最佳新導演，執導的《女孩》還入圍10項金馬獎，包括最佳劇情片、女配角、新演員、攝影等。但入圍最多的是阮經天主演的《狂忘警探》，共入圍11項。\n\n第63屆金馬將於11月22日（日）晚上5點於北流舉辦，主持人為曾以《大濛》爭奪金馬影帝的柯',
    expected: ['呂翔禾'],
    declared: [],
  },
  {
    media: 'enn',
    url: 'https://17news.net/archives/340971',
    lead: '【台灣電報記者廖宥婷/台中報導】\n\n日本知名媒體藝術家真鍋大度（Daito Manabe）海外首個大型個展「關係時態—超越模擬的生命形式」（RELATIONAL TIME–Life Beyond Simulation）今（3）日在臺中市立美術館正式開展，真鍋大度親自帶來開幕演出。展覽由香港微波國際新媒體藝術節節目總監鄺',
    expected: ['廖宥婷'],
    declared: ['廖 宥婷'],
  },
  {
    media: 'greatnews',
    url: 'https://greatnews.com.tw/news_pagein.php?iType=1010&n_id=315270',
    lead: '【大成報記者于郁金/嘉義報導】中秋佳節將至，為向住院榮民表達誠摯關懷與祝福，嘉義榮民服務處處長許淑菁於23日率領榮欣志工與替代役男，前往臺中榮民總醫院灣橋分院進行慰問；在院長陳正榮陪同下，一行親自探視住院榮民長輩並致贈營養補充品，提前歡度中秋與榮民節，場面溫馨感人。\n\n許淑菁處長指出，住院榮民是榮服處時時刻刻牽掛對象，',
    expected: ['于郁金'],
    declared: ['大成報'],
  },
  {
    media: 'nvns',
    url: 'https://nvns.net/news_view.php?new_sn=144960&new_csn=1977',
    lead: '▲勞動力發展署桃竹苗分署「衣啟飛翔」創客基地舉辦「2026原創服裝大賞頒獎典禮」，署長黃齡玉（第二排左10）與貴賓、獲獎設計師、模特兒大合影。(圖／桃竹苗分署提供)\n\n【視傳媒記者羅蔚舟/新竹報導】 勞動部「2026原創服裝大賞頒獎典禮」今（10/3）日下午於台北松山文創園區熱鬧登場，以「From EGO to ECO',
    expected: ['羅蔚舟'],
    declared: [],
  },
  {
    media: 'owlting',
    url: 'https://news.owlting.com/articles/1465126',
    lead: '【范麗玉記者 台南報導】\n\n面對全球嚴峻的淨零碳排趨勢、碳邊境調整機制（CBAM）以及勞動力結構轉變，台灣製造業正加速迎向「AI × 低碳」的雙軸轉型。由台南市府主辦、工研院執行的「智慧機器人產業系列研討會」第四場於今（2）日盛大舉行，主題鎖定「淨零碳排、綠色科技與循環經濟」。會中匯聚產官學研專家，深入探討企業永續碳管',
    expected: ['范麗玉'],
    declared: ['民生好報'],
  },
  {
    media: 'news886',
    url: 'https://886.news/archives/365077',
    lead: '［台灣新聞雲］記者劉至程/花蓮報導\n\n花蓮縣議會議長盃系列活動—115年「健康樂活＊女力綻放」社區婦女趣味體適能運動會，今天在光復商工體育館舉行，議長張峻親臨主持，強調適度運動有助維持健康，透過團隊競賽，也能增進交流、凝聚社區感情。\n\n活動由花蓮縣議會主辦、花蓮縣光復鄉豐禾社區產業促進會承辦，包括縣議員蔡依靜、光復鄉代',
    expected: ['劉至程'],
    declared: ['金雷鳴'],
  },
  {
    media: 'new_report',
    url: 'https://new-reporter.com/news/280329/',
    lead: '【Lai傳媒、記者爆料網／周庭慶／花蓮報導】台9線花蓮縣光復鄉路段今（3）日驚傳死亡車禍！1輛車內無患者的民間救護車疑因天雨路滑衝入對向車道，與兩輛車相撞，造成1輛小貨車駕駛受困車內送醫傷重不治，另有3人受傷，警方表示現場相關跡證均已蒐證保存，供後續事故鑑定及肇事責任分析。\n\n台9線花蓮縣光復鄉路民間救車因天雨路滑，失',
    expected: ['周庭慶'],
    declared: ['賴傳媒'],
  },
  {
    media: 'bo6s',
    url: 'https://www.bo6s.com.tw/news_detail.php?NewsID=117213',
    lead: '波新聞─范曉龍／台北市\n\n2026台北市議員選戰進入最後衝刺，大安文山向來是新人突圍難度較高的選區之一。民進黨市議員候選人劉品妡從政治幕僚轉戰第一線，除密集走市場、站路口、深入社區，也試圖以人本交通、行人安全與地方建設等市政議題建立個人辨識度。從近期選戰布局觀察，她的訴求並未只鎖定傳統政黨支持者，而是試圖透過生活議題與',
    expected: ['范曉龍'],
    declared: ['牧迪網頁設計'],
  },
  {
    media: 'cnews',
    url: 'https://cnews.com.tw/%e4%b8%8d%e8%ae%93%e7%99%8c%e7%97%87%e6%a1%86%e4%bd%8f%e4%ba%ba%e7%94%9f%ef%bc%81%e7%99%be%e4%bd%8d%e4%b9%b3%e7%99%8c%e7%97%85%e5%8f%8b%e7%99%bb%e3%80%8c%e6%84%9b%e6%b3%a2%e8%88%9e%e5%90%8e%e3%80%8d/',
    lead: 'CNEWS匯流新聞網記者王佐銘／台北報導\n\n「人生70才開始，開始永遠不嫌遲。」70歲的郭含笑，曾在丈夫因肺癌離世後，接著面對自己罹患乳癌的打擊。如今她開始學舞、反覆練習，希望站上舞台時，大家看見的是充滿自信的自己。今年邁入第15年的「愛波舞后」，集結100多位乳癌病友登台，台灣癌症基金會盼透過舞蹈與同儕陪伴，讓病友在',
    expected: ['王佐銘'],
    declared: ['王 佐銘'],
  },
  {
    media: 'idn',
    url: 'https://www.idn.com.tw/news/news_content.aspx?catid=1&catsid=2&catdid=0&artid=20261002carey100008',
    lead: '【記者卓羽榛臺北報導】針對沈伯洋委員今提出教育相關政見，臺北市教育局表示，多項內容與市府近年推動、已可見到階段性成果的教育政策一致，樂見他肯定市府、也提醒他臺北市今年發布的「教育政策白皮書2.0」，當中提出10大核心方案，從學生、教師到校園環境各面向持續精進，歡迎他多加參閱、完整了解當前進度成果。\n\n教育局強調，教育政',
    expected: ['卓羽榛'],
    declared: ['卓羽榛臺北報導'],
  },
  {
    media: 'mknews',
    url: 'https://mknews.com.tw/2026/10/1001048/',
    lead: '【今傳媒/記者李祖東報導】高雄市議員李雅慧表示，後勁溪污染是楠梓人無法忽視的痛。過去的污染事件，一次次留下難以抹去的記憶；前陣子又接連發生魚群大量死亡事件，更讓大家擔心：到底問題出在哪裡？\n\n後勁溪沿岸產業多元，環境部現行放流水標準是依產業別區分，包含半導體、光電、石化、化工、金屬等不同類別，各有不同管制項目與限值。\n',
    expected: ['李祖東'],
    declared: ['天天上新聞'],
  },
  {
    media: 'tmnu',
    url: 'https://www.tmnu.org.tw/news/4840',
    lead: '台灣本島最高媽祖像盛大落成(圖／台中市政府提供)\n\nTMNU記者 陳們明／綜合報導\n\n「大安港媽祖文化園區」雕像今3日舉行落成典禮，市長盧秀燕出席表示，這座園區過去「有園區、無媽祖」，在她初次競選市長時曾向海線鄉親許下承諾「一定要讓媽祖立起來」，如今歷經兩任任期與多方努力，終於兌現承諾，為台中海線觀光與信仰補齊最核心的',
    expected: ['陳們明'],
    declared: ['TMNU台灣多媒體新聞聯合網'],
  },
  {
    media: 'innews',
    url: 'https://innews.com.tw/%e3%80%8c2026%e6%96%b0%e7%ab%b9%e5%b8%82%e8%8d%89%e5%9c%b0%e6%95%85%e4%ba%8b%e7%af%80%e3%80%8d%e9%96%8b%e8%b7%91%ef%bc%81%e5%8c%97%e5%a4%a7%e5%85%ac%e5%9c%92%e5%8c%96%e8%ba%ab%e3%80%8c%e9%96%b1/',
    lead: '（記者陳嫣蔚／新竹報導）「2026新竹市草地故事節－閱讀群島」今(3)日在北大公園熱鬧登場！第三屆草地故事節與深耕兒童閱讀的信誼基金會合作策展，以《小金魚逃走了》、《藍皮慢火車》、《媽媽買綠豆》等經典繪本為主題，將書中的故事與場景搬進北大公園，打造沉浸式立體閱讀空間，並結合主題故事屋、閱讀沙龍、兒童體驗、舞台演出及閱讀',
    expected: ['陳嫣蔚'],
    declared: ['嫣蔚 陳'],
  },
  {
    media: 'kamalan_news',
    url: 'https://www.kamalan-news.com/political/22/19155',
    lead: '【記者譚杰、趙奇濤／宜蘭報導】\n\n2026蘭陽媽祖文化節今（3）日進入第二天，媽祖鑾轎持續巡行蘭陽，沿途信眾設香案迎駕、雙手合十祈福，遶境隊伍所到之處熱鬧滾滾。隨著縣長選戰持續升溫，國民黨宜蘭縣長候選人吳宗憲、民進黨宜蘭縣長候選人林國漳今天也分別現身遶境隊伍，隨香祈福、與沿途鄉親互動，宗教盛事也意外成了兩位候選人深入人',
    expected: ['譚杰', '趙奇濤'],
    declared: ['譚杰', '趙奇濤'],
  },
];
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');

describe('publisher reporter bylines', () => {
  it.each(samples)('$media recognizes the published lead credit', ({ url, lead, expected, declared }) => {
    const meta = declared.map((name) => `<meta name="author" content="${escapeHtml(name)}">`).join('');
    const body = lead
      .split('\n\n')
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join('');
    const detail = extractArticle(meta + '<article>' + body + '</article>', url);
    expect(detail.authors).toEqual(expected);
  });

  it('reads the current LTN news byline above the article rather than a photo credit', () => {
    const html =
      '<meta name="author" content="自由時報電子報"><div class="article_meta"><span class="article_edit">記者<a>黃子暘</a>／新北報導</span></div><article><p>新聞內文。</p><p>圖為議員。（記者王明攝）</p></article>';
    const url = 'https://news.ltn.com.tw/news/politics/breakingnews/5594440';
    expect(extractArticle(html, url, overrides.ltn.article).authors).toEqual(['黃子暘']);
  });

  it('keeps the full Mnews reporting team when JSON-LD only names the first reporter', () => {
    const url = 'https://www.mnews.tw/story/20261003sot1822001';
    const html =
      '<meta name="author" content="楊旂"><meta name="author" content="康鈺偉">' +
      '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'NewsArticle', url, author: { '@type': 'Person', name: '楊旂' } }) +
      '</script><article><p>新聞內文。</p></article>';
    expect(extractArticle(html, url, overrides.mnews.article).authors).toEqual(['楊旂', '康鈺偉']);
  });

  it('reads PTS reporter links only from article credits', () => {
    const html =
      '<nav><a href="/author/99">其他記者</a></nav><div class="article_authors"><div class="reporter-container"><a href="/author/267">姜筑</a><span> / 綜合報導</span></div></div><article><p>新聞內文。</p></article>';
    expect(extractArticle(html, 'https://news.pts.org.tw/article/829786', overrides.pts.article).authors).toEqual(['姜筑']);
  });

  it('reads the visible I-media credit absent from structured metadata', () => {
    const html =
      '<div class="entry__meta-author"><a href="/Home/Search?Author=123">梅花新聞網 洪子苓/綜合報導</a></div><article><p>新聞內文。</p></article>';
    expect(extractArticle(html, 'https://i-media.tw/Article/Detail/51186', overrides.i_media.article).authors).toEqual(['洪子苓']);
  });

  it('does not use Taipei Times related-story bylines as the main article reporter', () => {
    const html =
      '<div id="left_blake"><div class="name">Staff writer, with agencies</div><div class="archives"><p>News story.</p></div></div><div class="related"><h6>By Lo Tien-pin and Fion Khan</h6></div>';
    expect(
      extractArticle(html, 'https://www.taipeitimes.com/News/front/archives/2026/10/03/2003850560', overrides.taipeitimes.article).authors,
    ).toEqual(['Staff writer, with agencies']);
  });

  it('does not borrow Elementor recommendation reporters when the main article has no lead byline', () => {
    const html =
      '<meta name="author" content="郭 嘉"><article><div class="elementor-widget-theme-post-content"><p>1111人力銀行長期關心國內觀光旅遊，攜手立委共同召開公聽會。</p></div></article>' +
      '<article><p>【警政時報／廖妙茜、陳雅芳報導】另一則新聞。</p></article>';
    expect(extractArticle(html, 'https://www.watchmedia01.com/archives/554984', overrides.watchmedia01.article).authors).toEqual(['郭 嘉']);
  });

  it('reads the verified Vigor main body before reporters in other page containers', () => {
    const html =
      '<meta name="author" content="鍾和風"><div class="tdb_single_content"><div class="tdb-block-inner"><p>記者鍾和風/高雄報導</p><p>持續推動高雄永續旅遊。</p></div></div>' +
      '<article><p>記者高婕/高雄報導</p><p>另一則新聞。</p></article>';
    expect(extractArticle(html, 'https://vigormedia.tw/test-report/').authors).toEqual(['鍾和風']);
  });

  it('reads Twreporter article metadata in an aside and ignores the text size control', () => {
    const html =
      '<div id="article-body"><div>文字大小</div><p>《報導者》盤點政府為亡者尋親的死亡公告。</p>' +
      '<aside class="desktop-aside__AsideFlexBox"><div class="metadata__AuthorSection"><div>文字<a href="/authors/63e0920457677e0700046870">報導者 Podcast 製作團隊</a></div>' +
      '<div>攝影<a href="/authors/6375a04e6adfe4070037e4ae">黃世澤</a></div></div></aside></div>';
    expect(extractArticle(html, 'https://www.twreporter.org/a/podcast-2026-10-02', overrides.reporter.article).authors).toEqual([
      '報導者 Podcast 製作團隊',
      '黃世澤',
    ]);
  });

  it('reads Vogue headline credits without reporters from recommended embeds', () => {
    const html =
      '<div class="content-header-text"><span class="byline"><a class="byline__name-link" href="/author/nicole-lee">Nicole Lee</a>、<a class="byline__name-link" href="/author/chen-yu">Chen Yu</a>和<a class="byline__name-link" href="/author/avril-chen">Avril Chen</a></span></div>' +
      '<article><p>1997年，Vogue Taiwan創刊一周年，林志玲首次登上封面。</p><div><a class="byline" href="/author/chara-yu">Chara Yu</a></div></article>';
    expect(
      extractArticle(html, 'https://www.vogue.com.tw/article/2026-october-cover-lin-chi-ling', overrides.vogue.article).authors,
    ).toEqual(['Nicole Lee', 'Chen Yu', 'Avril Chen']);
  });

  it('reads the Housefun reporter from a partner article with publisher author metadata', () => {
    const html =
      '<meta name="author" content="好房網News"><article><p>好房網News記者李彥穎／高雄報導</p><p>高雄市議會進行市政總質詢。</p></article>';
    expect(extractArticle(html, 'https://www.myhousing.com.tw/n/n01/south-taiwan/kaohsiung-estate/297341/').authors).toEqual(['李彥穎']);
  });

  it('reads Vogue standard header authors and translators without embedded recommendation bylines', () => {
    const html =
      '<meta name="author" content="Marthe Mabille"><div class="content-header__accreditation"><span class="byline">By <a class="byline__name-link" href="/author/marthe-mabille">Marthe Mabille</a></span>' +
      '<span class="byline">Translated and Adapted by <a class="byline__name-link" href="/author/kuan-lin">Kuan Lin</a></span></div>' +
      '<article><p>Alessandro Michele選擇讚頌未知。</p><div><a class="byline" href="/author/chara-yu">Chara Yu</a></div></article>';
    expect(
      extractArticle(html, 'https://www.vogue.com.tw/article/valentino-spring-summer-2027-antibiblioteca-concept', overrides.vogue.article)
        .authors,
    ).toEqual(['Marthe Mabille', 'Kuan Lin']);
  });

  it.each([
    {
      media: 'ithome',
      url: 'https://www.ithome.com.tw/news/179415',
      html: '<div class="submitted"><span class="author"><a href="/users/李建興">李建興</a></span></div>',
      expected: ['李建興'],
    },
    {
      media: 'coolloud',
      url: 'http://www.coolloud.org.tw/node/99536',
      html: '<div class="group-author"><div class="field-name-field-author"><a href="/author/陳韋綸">陳韋綸</a></div><div>苦勞網特約編輯</div></div>',
      expected: ['陳韋綸'],
    },
    {
      media: 'digitimes',
      url: 'https://www.digitimes.com.tw/col/article/?id=18320',
      html: '<div class="author-caption"><a href="/col/author/?id=294"><h2><span>徐宏民</span><small>國立台灣大學資訊工程學系教授</small></h2></a></div>',
      expected: ['徐宏民'],
    },
  ])('$media reads the primary visible author without their biography', ({ media, url, html, expected }) => {
    expect(extractArticle(html + '<article><p>新聞內文。</p></article>', url, overrides[media].article).authors).toEqual(expected);
  });

  it.each([
    {
      url: 'https://news.owlting.com/articles/1466446',
      credit: '爆料網',
      lead: '【Lai傳媒、記者爆料網 金東天／高雄報導】高雄前鎮藏壽司時代大道店昨晚驚傳火警。',
      expected: ['金東天'],
    },
    {
      url: 'https://new-reporter.com/news/280580/',
      credit: '警政時報',
      lead: '【警政時報 薛秀蓮 ／台北報導】三部都會客家紀錄片首映登場。',
      expected: ['薛秀蓮'],
    },
    {
      url: 'https://leho.com.tw/archives/396994',
      credit: '亞太新聞網',
      lead: '▲桃園公共工程金品獎邁入第10屆。（市府提供）\n\n【亞太新聞網／記者范文濱／桃園報導】\n\n公共工程攸關市民生活品質。',
      expected: ['范文濱'],
    },
  ])('uses the demonstrated person instead of syndication metadata at $url', ({ url, credit, lead, expected }) => {
    const html = `<meta name="author" content="${credit}"><article>${lead
      .split('\n\n')
      .map((p) => `<p>${p}</p>`)
      .join('')}</article>`;
    expect(extractArticle(html, url).authors).toEqual(expected);
  });

  it('reads the named translator from the LTN syndicated article ending rather than its agency header', () => {
    const url = 'https://news.ltn.com.tw/news/world/breakingnews/5596642';
    const html =
      '<meta name="author" content="自由時報電子報"><div class="article_meta"><span class="article_edit">中央社</span></div>' +
      '<article><p>奈及利亞總統證實，軍機墜毀造成機上32人罹難。</p><p>已經指示空軍立即徹查墜機原因。（編譯：陳彥鈞）1151006</p></article>';
    expect(extractArticle(html, url, overrides.ltn.article).authors).toEqual(['陳彥鈞']);
  });

  it('reads the UDN economic news translator from its visible full credit', () => {
    const url = 'https://udn.com/news/story/7333/9796647';
    const html =
      '<div class="article-content__author">經濟日報／ 編譯葉亭均／綜合外電</div>' +
      '<div class="article-content__editor"><p>中美AI技術差距急速拉近，DeepSeek僅落後美對手3%。</p></div>';
    expect(extractArticle(html, url, overrides.udn.article).authors).toEqual(['葉亭均']);
  });

  it('keeps both Epochtimes original writer and translator from the structured main credit', () => {
    const url = 'https://www.epochtimes.com/b5/26/10/4/n14863184.htm';
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'NewsArticle', url, author: [{ '@type': 'Person', name: '文／Amy Denney 編譯／朱緯' }] }) +
      '</script><article><p>更年期荷爾蒙變化可能造成眼睛乾澀。</p><p>責任編輯：李維真</p></article>';
    expect(extractArticle(html, url).authors).toEqual(['Amy Denney', '朱緯']);
  });

  it('reads the EpochTimes reporter following its opening publisher date instead of its organization metadata', () => {
    const html =
      '<meta name="author" content="大紀元"><article><p>【大紀元2026年10月06日訊】 （大紀元記者陸希休斯頓報導）休士頓師大附中校友會歡聚中秋。</p></article>';
    expect(extractArticle(html, 'https://www.epochtimes.com/b5/26/10/6/n14864000.htm').authors).toEqual(['陸希']);
  });

  it('reads the Bo News signature when its plain-text prose follows the location in the same paragraph', () => {
    const html =
      '<meta name="author" content="牧迪網頁設計"><article><p>波新聞─李至文／高雄 115年第二屆全國原住民族舉重錦標賽於高雄巿鼓山高中舉行。</p></article>';
    expect(extractArticle(html, 'https://www.bo6s.com.tw/news_detail.php?NewsID=117270').authors).toEqual(['李至文']);
  });

  it('reads the traditional Lai publisher prefix instead of Taiwanline placeholder credits', () => {
    const html =
      '<meta name="author" content="友站新聞"><article><p>【賴傳媒、記者爆料網 王俊勝 / 台東報導】台東志航基地發生火警。</p></article>';
    expect(extractArticle(html, 'https://twline365.com/2026/10/01/story').authors).toEqual(['王俊勝']);
  });

  it.each(['責任編輯 靳璦', '責任編輯：靳璦', '責任編輯靳璦', '友站新聞', '社論'])(
    'excludes editorial role or placeholder metadata %s from authorship',
    (credit) => {
      const url = 'https://example.com/editor-credit';
      const html =
        '<meta name="author" content="' +
        credit +
        '"><script type="application/ld+json">' +
        JSON.stringify({ '@type': 'NewsArticle', url, author: { '@type': 'Person', name: credit } }) +
        '</script><article><p>陸委會發表聲明。</p></article>';
      expect(extractArticle(html, url).authors).toEqual([]);
    },
  );

  it('reads the 1111 header reporter before excluding its combined date and author from the article body', () => {
    const html =
      '<meta name="author" content="1111人力銀行 | 全球華人股份有限公司"><div class="yellow-white-bg"><h1>金山萬里溫泉季</h1>' +
      '<time>2026-10-05 晚上 10:10&nbsp;記者黃彩絹／綜合報導</time><div><p>金山萬里溫泉季活動開跑，帶動北海岸秋冬觀光熱潮。</p></div></div>';
    const detail = extractArticle(html, 'https://www.1111.com.tw/news/jobns/167694', overrides['1111'].article);
    expect(detail.authors).toEqual(['黃彩絹']);
    expect(detail.body).not.toContain('10:10');
  });

  it.each(['牧迪網頁設計', 'Web Design Studio'])('never treats site designer metadata %s as authorship', (designer) => {
    const html = `<meta name="author" content="${designer}"><article><p>全國原住民族舉重錦標賽於高雄舉行。</p></article>`;
    expect(extractArticle(html, 'https://www.bo6s.com.tw/news_detail.php?NewsID=117270').authors).toEqual([]);
  });

  it('uses TVBS visible authorship without promoting its responsible editor from structured metadata', () => {
    const url = 'https://news.tvbs.com.tw/health/4030065';
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({
        '@type': 'NewsArticle',
        url,
        author: [
          { '@type': 'Person', name: '網路溫度計' },
          { '@type': 'Person', name: '鄒昀孝' },
        ],
      }) +
      '</script><li data-section="article-contributors"><span>作者：網路溫度計｜責任編輯：鄒昀孝</span></li><article><p>換季感冒常見迷思。</p></article>';
    expect(extractArticle(html, url, overrides.tvbs.article).authors).toEqual(['網路溫度計']);
  });

  it.each(['作者：高鈺婷', '記者 高鈺婷 報導'])('preserves TVBS personal credits %s', (credit) => {
    const html = `<li data-section="article-contributors">${credit}</li><article><p>南韓金融機構遭遇駭客攻擊。</p></article>`;
    expect(extractArticle(html, 'https://news.tvbs.com.tw/world/4031876', overrides.tvbs.article).authors).toEqual(['高鈺婷']);
  });

  it('keeps the Worldjournal agency dispatch without crediting its photo journalist as the writer', () => {
    const url = 'https://www.worldjournal.com/wj/story/121479/9796785';
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify({ '@type': 'NewsArticle', url, author: { '@type': 'Person', name: '中央社台北5日電' } }) +
      '</script><article><figure><figcaption>林郁婷在亞運奪金。（特派記者陳正興／攝影）</figcaption></figure><p>林郁婷笑說錯失股市進場良機。</p></article>';
    expect(extractArticle(html, url).authors).toEqual(['中央社台北5日電']);
  });

  it('keeps FTV anonymous publisher credit without inventing a reporter from its AFP introduction', () => {
    const html =
      '<meta name="author" content="民間全民電視公司"><article><p>AFP 法新社報導</p><p>葉門親政府軍反攻包圍摩卡港。</p></article>';
    expect(extractArticle(html, 'https://www.ftvnews.com.tw/news/detail/2026A06W0029').authors).toEqual(['民間全民電視公司']);
  });

  it('keeps RTI news desk credit without promoting its responsible editor to article author', () => {
    const url = 'https://www.rti.org.tw/news?uid=3&pid=235850';
    const html =
      '<a href="/newsauthorlist?id=7">新聞編輯</a><div>責任編輯：張芯瑜</div><article><p>中國東方航空空服員下跪事件引發議論。</p></article>';
    expect(extractArticle(html, url, overrides.rti.article).authors).toEqual(['新聞編輯']);
  });
});

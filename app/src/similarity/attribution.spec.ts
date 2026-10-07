import { describe, expect, it } from 'vitest';
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import { attributionRole, extractAttributions, normalizeAttributions, outletIdentity } from './attribution.ts';

describe('explicit media attribution', () => {
  it('reads an explicit Health News reference with a URL without inventing a source from a plain mention', () => {
    expect(extractAttributions('資料來源：健康醫療網 https://www.healthnews.com.tw/readnews.php?id=69779', 'tyenews')).toContainEqual(
      expect.objectContaining({ media: 'healthnews', name: '健康醫療網', countryCode: 'TW' }),
    );
    expect(extractAttributions('健康醫療網舉辦活動。', 'tyenews')).toEqual([]);
    expect(extractAttributions('圖片來源：健康醫療網', 'tyenews')).toEqual([]);
    expect(extractAttributions('資料來源：健康醫療網', 'healthnews')).toEqual([]);
    const dispatch = extractAttributions('【健康醫療網／記者陳靖安報導】醫師說明過敏症狀。', 'tyenews');
    expect(dispatch).toContainEqual(expect.objectContaining({ media: 'healthnews', evidence: '來源：【健康醫療網／記者陳靖安報導】' }));
    expect(attributionRole(dispatch[0])).toBe('來源');
    expect(extractAttributions('文章提到【健康醫療網／記者陳靖安報導】的文字。', 'tyenews')).toEqual([]);
    expect(extractAttributions('【健康醫療網／攝影陳靖安】照片說明。', 'tyenews')).toEqual([]);
  });
  it('recognizes reviewed Hakka fact-check and AMM press-release supplied-copy declarations', () => {
    const cooperation =
      '編按：《客新聞》與《MyGoPen》合作反詐騙，將提供「事實查核」、「詐騙破解」等相關新聞訊息，本篇文章由《MyGoPen》提供，後續查核內容。';
    const source = extractAttributions(cooperation, 'hakkanews');
    expect(source).toEqual([expect.objectContaining({ media: 'mygopen', countryCode: 'ZZ' })]);
    expect(attributionRole(source[0])).toBe('來源');
    expect(extractAttributions('人物表示' + cooperation, 'hakkanews')).toEqual([]);
    expect(extractAttributions(cooperation.replace('提供，', '討論，'), 'hakkanews')).toEqual([]);
    const release = '申請情況反映產業關注\n\n洛杉磯2026年10月8日 /美通社/ — 組織公佈申請名單。';
    const agency = extractAttributions(release, 'ammtw');
    expect(agency).toEqual([expect.objectContaining({ media: 'prnewswire', countryCode: 'ZZ' })]);
    expect(attributionRole(agency[0])).toBe('來源');
    expect(extractAttributions('公司提及美通社活動。', 'ammtw')).toEqual([]);
    expect(extractAttributions('圖片來源：美通社', 'ammtw')).toEqual([]);
    expect(extractAttributions(release.replace('/美通社/ —', '/美通社/ 的活動'), 'ammtw')).toEqual([]);
    expect(extractAttributions('前文。\n\n前文。\n\n前文。\n\n洛杉磯2026年10月8日 /美通社/ — 舊新聞。', 'ammtw')).toEqual([]);
  });
  it('recognizes a declared published commentary source without guessing its country', () => {
    for (const body of [
      '北韓官媒朝中社今（7）日刊登評論，批評對台軍售。',
      '据凤凰卫视报道，朝中社10月7日引述国际事务分析师的文章。',
      '朝鲜国家通讯社朝中社星期三在一篇评论文章中，引用分析师的话。',
    ]) {
      const source = extractAttributions(body, 'voachinese').find((x) => x.media === 'kcna');
      expect(source).toMatchObject({ name: '朝中社', countryCode: 'ZZ', country: '未知', kind: 'explicit' });
      expect(attributionRole(source!)).toBe('引用');
    }
    for (const body of ['朝中社將刊登評論。', '訪談提到朝中社的名稱。', '圖片來源：朝中社', '朝中社的評論風格引發討論。'])
      expect(extractAttributions(body, 'voachinese')).toEqual([]);
    expect(extractAttributions('朝中社今（7）日刊登評論，批評政策。', 'kcna')).toEqual([]);
    expect(extractAttributions('Reuters10月7日引述消息人士。', 'voachinese')).toEqual([]);
    expect(extractAttributions('朝中社123ABC报道新闻。', 'voachinese')).toEqual([]);
  });
  it('resolves the declared simplified Guancha provider to its reviewed catalog identity', () => {
    expect(extractAttributions('新聞內容。', 'ifeng', '观察者网')).toContainEqual({
      media: 'guancha',
      name: '觀察者網',
      countryCode: 'CN',
      country: '中國',
      evidence: '內容提供者：观察者网',
      kind: 'explicit',
    });
  });

  it('recognizes Dongqiudi as an outlet even without a generic media suffix', () => {
    expect(extractAttributions('', 'news_sina', '懂球帝')).toEqual([
      expect.objectContaining({ media: 'dongqiudi', name: '懂球帝', countryCode: 'CN', evidence: '內容提供者：懂球帝' }),
    ]);
    expect(extractAttributions('', 'news_sina', '王晨晨')).toEqual([]);
  });
  it('resolves original organizational credits in reprinted bannedbook articles', () => {
    expect(extractAttributions('', 'bannedbook', '希望之聲TV')).toEqual([
      expect.objectContaining({ media: 'soundofhope', countryCode: 'US', evidence: '內容提供者：希望之聲TV' }),
    ]);
    expect(extractAttributions('', 'bannedbook', '美國之音')).toEqual([
      expect.objectContaining({ media: 'voachinese', countryCode: 'US', evidence: '內容提供者：美國之音' }),
    ]);
    expect(extractAttributions('', 'bannedbook', 'RFI法廣')[0]?.media).toBe('rfi');
    expect(extractAttributions('', 'bannedbook', '新唐人電視台NTDTV')[0]?.media).toBe('ntdtv');
    expect(extractAttributions('', 'bannedbook', '古莉')).toEqual([]);
  });
  it('recognizes a supplied agency dispatch and explicit source field without relabeling cited reporting', () => {
    const [dispatch] = extractAttributions('（中央社記者謝靜雯台北5日電）今天公布結果。', 'worldjournal');
    expect(attributionRole(dispatch)).toBe('來源');
    expect(attributionRole({ evidence: '來源：路透社' })).toBe('來源');
    expect(attributionRole({ evidence: '中央社報導，今天公布結果。' })).toBe('引用');
    expect(attributionRole({ evidence: '根據中央社記者謝靜雯的報導，今天公布結果。' })).toBe('引用');
  });
  it('distinguishes a content provider from a cited outlet using preserved evidence', () => {
    const result = extractAttributions('法新社報導，事件已確認。', 'pchome', '中央社');
    expect(result.map((source) => [source.media, attributionRole(source)])).toEqual([
      ['cna', '來源'],
      ['afp', '引用'],
    ]);
    expect(result[0].evidence).toBe('內容提供者：中央社');
    expect(attributionRole({ evidence: '法新社報導指出，內容提供者：中央社為頁面標示。' })).toBe('引用');
  });
  it('recognizes reporting and credit cues with outlet countries', () => {
    const result = extractAttributions('根據《路透社》報導，市場回穩。法新社報導指出，協議已簽署。來源：美聯社', 'udn');
    expect(result.map((a) => [a.media, a.countryCode, a.kind])).toEqual([
      ['reuters', 'GB', 'explicit'],
      ['afp', 'FR', 'explicit'],
      ['ap', 'US', 'explicit'],
    ]);
    expect(result[0].evidence).toContain('路透社》報導');
  });

  it('supports Latin aliases, translations, authorization, and deduplication', () => {
    const result = extractAttributions('日本放送協會（NHK）報導，地震發生。引述共同社消息。CNN授權刊登。CNN報導指出市場回穩。', 'ltn');
    expect(result.map((a) => a.media)).toEqual(['nhk', 'kyodo', 'cnn']);
    expect(result[0].countryCode).toBe('JP');
  });

  it('recognizes a complete source-citing report cue without treating media mentions as citations', () => {
    const result = extractAttributions('據彭博社援引消息人士報導稱，歐盟正準備採取措施。', 'rfi');
    expect(result.map((x) => [x.media, x.name, x.countryCode, attributionRole(x)])).toEqual([['bloomberg', '彭博社', 'ZZ', '引用']]);
    expect(extractAttributions('彭博社援引消息人士討論本公司的營運。據彭博社的職員表示，辦公室已搬遷。', 'rfi')).toEqual([]);
    expect(extractAttributions('圖片來源：彭博社援引消息人士報導稱，會議結束。', 'rfi')).toEqual([]);
  });

  it('retains all known outlets in a complete standalone reference list', () => {
    expect(extractAttributions('（資料來源：Bloomberg, Guardian, Economist）', 'cw').map((x) => x.media)).toEqual([
      'bloomberg',
      'guardian',
      'economist',
    ]);
    expect(extractAttributions('資料來源：BBC, 不明網站, Reuters', 'cw').map((x) => x.media)).toEqual(['bbc', 'reuters']);
    expect(extractAttributions('（圖片來源：Bloomberg, Guardian, Economist）', 'cw')).toEqual([]);
    // Existing explicit "來源：Bloomberg" remains a citation; the list rule
    // must not extend the prose declaration to its other mentioned outlets.
    expect(extractAttributions('讀者認為資料來源：Bloomberg, Guardian, Economist 有問題。', 'cw').map((x) => x.media)).toEqual([
      'bloomberg',
    ]);
  });

  it('recognizes a quoted outlet with an explicit according-to message declaration', () => {
    const result = extractAttributions('另一方面，根據《BBC》的消息指，賴斯亦接近與阿仙奴續長約。', 'stheadline');
    expect(result.map((x) => [x.media, attributionRole(x)])).toEqual([['bbc', '引用']]);
    expect(result[0].evidence).toContain('根據《BBC》的消息指');
    expect(extractAttributions('圖片來源：根據《BBC》的消息指，照片是當天拍攝。', 'stheadline')).toEqual([]);
    expect(extractAttributions('根據《BBC》的消息指數，本站研究員推算數值。BBC消息指控員工。', 'stheadline')).toEqual([]);
  });

  it('does not infer an origin from mentions or reports about media companies', () => {
    expect(
      extractAttributions(
        'CNN宣布裁員。美聯社的總部今天重新開放。根據CNN的人事公告，公司將改組。新聞報導提到BBC。CNN報導部門將縮編。AP reported a restructuring of CNN.',
        'udn',
      ),
    ).toEqual([]);
  });

  it('does not confuse short English aliases with substrings', () => {
    expect(extractAttributions('來源：Apple。來源：HAPPY。來源：WhatsApp。CNNIC報導指出，調查結束。', 'ltn')).toEqual([]);
    expect(extractAttributions('AP報導指出，調查結束。', 'ltn')[0]?.media).toBe('ap');
  });

  it('excludes the publishing outlet by key or name', () => {
    expect(extractAttributions('中央社報導，會議結束。來源：CNA', 'cna', '中央通訊社')).toEqual([]);
    expect(extractAttributions('聯合報報導，會議結束。', '聯合新聞網')).toEqual([]);
  });

  it('does not treat photo credits as text attribution', () => {
    expect(extractAttributions('圖片來源：路透社。照片出處：AP。', 'ltn')).toEqual([]);
  });

  it('preserves explicit providers and unknown countries', () => {
    expect(extractAttributions('', 'udn', 'Reuters')[0]).toMatchObject({ media: 'reuters', countryCode: 'GB' });
    expect(extractAttributions('', 'udn', 'Example News')[0]).toMatchObject({ media: 'Example News', country: '未知', countryCode: 'ZZ' });
  });

  it('separates Yahoo reporters and internal desks from external media', () => {
    for (const provider of [
      '潘鈺楨｜Yahoo名人娛樂特派記者',
      '許瑞麟｜Yahoo名人娛樂特派記者',
      'Yahoo新聞編輯室',
      'Yahoo股市',
      'Yahoo名人娛樂特派記者',
    ]) {
      expect(extractAttributions('', 'yahoo', provider)).toEqual([]);
    }
    expect(extractAttributions('', 'yahoo', '王小明')).toEqual([]);
    expect(extractAttributions('路透社報導指出，消息獲得證實。', 'yahoo', '潘鈺楨｜Yahoo名人娛樂特派記者').map((a) => a.media)).toEqual([
      'reuters',
    ]);
    expect(extractAttributions('', 'udn', 'Yahoo新聞編輯室')[0]).toMatchObject({ media: 'yahoo', countryCode: 'TW' });
  });

  it('reads the outlet from credit lines that run into the lead paragraph', () => {
    // 民視 pages put the credit and the opening paragraph in one element.
    for (const provider of [
      '政治中心／李筱舲報導 2026年九合一選舉進入倒數階段，台北市長選戰持續升溫。《壹蘋新聞網》近日也發起網路投票調查。',
      '娛樂中心／綜合報導前主播張宇離開新聞圈後成功轉型為藝人，經常在社群平台分享生活。',
      '社會中心／新聞綜合報導',
      '民視新聞／吳憲昌 綜合報導',
      '民視新聞／綜合報導',
    ]) {
      expect(extractAttributions('', 'ftv', provider)).toEqual([]);
    }
    expect(extractAttributions('', 'ftv', '圖、文／CNEWS匯流新聞網')[0]).toMatchObject({ media: 'cnews' });
    expect(extractAttributions('', 'ftv', '圖、文／菱傳媒')[0]).toMatchObject({ media: 'rwnews' });
    expect(extractAttributions('', 'rwnews', '圖、文／菱傳媒')).toEqual([]);
    expect(extractAttributions('', 'ftv', '文.圖／今周刊台股Q4上看5萬3，選舉年上漲機率8成！')[0]).toMatchObject({ media: 'businesstoday' });
    expect(extractAttributions('', 'travelnews', '※本文版權為宜蘭新聞網所有，歡迎轉載，請務必註明出處※')).toEqual([]);
  });

  it('repairs stored provider labels without deleting valid foreign citations', () => {
    const fake = {
      media: '潘鈺楨｜Yahoo名人娛樂特派記者',
      name: '潘鈺楨｜Yahoo名人娛樂特派記者',
      country: '未知',
      countryCode: 'ZZ',
      kind: 'explicit' as const,
      evidence: '內容提供者：潘鈺楨｜Yahoo名人娛樂特派記者',
    };
    const reuters = extractAttributions('路透社報導，消息獲得證實。', 'yahoo');
    expect(normalizeAttributions([fake, ...reuters], 'yahoo')).toEqual(reuters);
  });

  it('bounds evidence and retains the explicit cue', () => {
    const result = extractAttributions(`${'背景'.repeat(200)}根據路透社報導，${'事件'.repeat(200)}`, 'ltn');
    expect(result[0].evidence.length).toBeLessThanOrEqual(160);
    expect(result[0].evidence).toContain('路透社報導');
  });

  it('does not connect an outlet to a cue in another sentence', () => {
    expect(extractAttributions('引述官員。CNN今天裁員。', 'udn')).toEqual([]);
  });

  it('recognizes a syndicated CNA dispatch only at the beginning of the article', () => {
    const dispatch = '（中央社記者王小明台北3日電）';
    expect(extractAttributions(`${dispatch}市府今天公布交通政策。`, 'ebc')).toEqual([
      expect.objectContaining({ media: 'cna', countryCode: 'TW', evidence: dispatch, kind: 'explicit' }),
    ]);
    expect(extractAttributions(`${dispatch}市府今天公布交通政策。`, 'cna')).toEqual([]);
    expect(extractAttributions(`受訪者提到${dispatch}的稿件。`, 'ebc')).toEqual([]);
    expect(extractAttributions('中央社記者受訪表示，今天採訪市長。', 'ebc')).toEqual([]);
    expect(extractAttributions('（中央社記者王小明台北3日）市府今天公布政策。', 'ebc')).toEqual([]);
  });
});

describe('outlet identity', () => {
  it('resolves local keys and foreign aliases', () => {
    expect(outletIdentity('tvbs')).toMatchObject({ media: 'tvbs', countryCode: 'TW' });
    expect(outletIdentity('德國之聲')).toMatchObject({ media: 'dw', countryCode: 'DE' });
    expect(outletIdentity('Yonhap')).toMatchObject({ media: 'yonhap', countryCode: 'KR' });
    expect(outletIdentity('新華社')).toMatchObject({ media: 'xinhua', countryCode: 'CN' });
  });

  it('identifies all 29 selected Taiwan publishers without guessing other catalog countries', () => {
    expect(baseline.sources).toHaveLength(29);
    for (const source of baseline.sources) expect(outletIdentity(source.media).countryCode).toBe('TW');
  });

  it('uses local display metadata without guessing an unknown country', () => {
    expect(outletIdentity('hypebeast')).toMatchObject({ media: 'hypebeast', country: '香港', countryCode: 'HK' });
    expect(outletIdentity('unlisted')).toEqual({ media: 'unlisted', name: 'unlisted', country: '未知', countryCode: 'ZZ' });
  });
});

it('recognizes joint reporting declarations without guessing unknown peers or quoted mentions', () => {
  expect(extractAttributions('据美联社和哥伦比亚广播公司等媒体报道，公布了法庭文件。', 'ifeng').map((x) => x.media)).toEqual(['ap']);
  expect(extractAttributions('根據《美聯社》與「路透社」等媒體報導，官方發布公告。', 'ifeng').map((x) => x.media)).toEqual([
    'ap',
    'reuters',
  ]);
  expect(extractAttributions('据美联社和路透社等媒体报道，官方發布公告。', 'ap').map((x) => x.media)).toEqual(['reuters']);
  expect(extractAttributions('美联社和路透社等媒体参加了记者会。', 'ifeng')).toEqual([]);
  expect(extractAttributions('照片據美聯社與路透社等媒體報導，活動結束。', 'ifeng')).toEqual([]);
  expect(extractAttributions('据反对美联社和未知新闻公司等媒体报道，活动结束。', 'ifeng')).toEqual([]);
});

it('keeps DW agency providers separate from its declared collective author', () => {
  expect(extractAttributions('新聞內文。', 'dw', '德新社、法新社、美聯社').map((x) => x.media)).toEqual(['afp', 'ap']);
  expect(extractAttributions('新聞內文。', 'dw', '德正')).toEqual([]);
  expect(extractAttributions('新聞內文。', 'dw', '未知供稿者、美聯社').map((x) => x.media)).toEqual(['ap']);
});

it('recognizes reviewed Sputnik reporting labels without treating satellite technology or photos as article sources', () => {
  expect(extractAttributions('中評社香港10月7日電／衛星新聞報道，俄羅斯外長表示。', 'hk_crntt')).toMatchObject([
    { media: 'sputnik', countryCode: 'ZZ', kind: 'explicit' },
  ]);
  expect(extractAttributions('据俄罗斯卫星通讯社报道，部长回应。', 'hk_crntt').map((a) => a.media)).toEqual(['sputnik']);
  expect(extractAttributions('據Sputnik報導，部長回應。', 'hk_crntt').map((a) => a.media)).toEqual(['sputnik']);
  expect(extractAttributions('照片來源：衛星新聞', 'hk_crntt')).toEqual([]);
  expect(extractAttributions('新發射的衛星傳回影像，衛星新聞技術論壇發表研究。', 'hk_crntt')).toEqual([]);
});

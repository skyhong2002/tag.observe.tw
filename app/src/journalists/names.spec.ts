import { describe, expect, it } from 'vitest';
import { journalistKey, journalistNames, personNames } from './names.ts';

describe('personNames', () => {
  it('keeps plain Chinese, Latin and mixed names and pen names', () => {
    for (const raw of [
      '魏甫丞',
      '張瀞文',
      '克里斯·巴拉紐克',
      'Olivia Ireland',
      'Una Wang',
      'Doris',
      'ycr',
      '瑪法達',
      '手哥 HANDBRO',
      '小孟老師',
    ])
      expect(personNames(raw), raw).toEqual([raw]);
  });
  it('rejects outlets, desks, roles and generic credits', () => {
    for (const raw of [
      '民間全民電視公司',
      '自由時報電子報',
      'MoneyDJ新聞',
      '鉅亨網新聞中心',
      '大紀元',
      '新聞編輯',
      '鏡週刊',
      '綜合報導',
      '經濟日報',
      'TTV',
      '中央社',
      '聯合新聞網／ 綜合報導',
      'CTWANT',
      '即時中心',
      '贊助提供',
      'TechNews 編輯台',
      '更多文章',
      '文/中央社',
      '娛樂組',
      '食尚玩家',
      'Bloomberg',
      '商傳媒',
      '青年日報',
      '東森健康',
      '特輯',
      '中時',
      '本報訊',
      '責任編輯 靳璦',
      '編輯',
      '文',
      '社論',
      '讀者投書',
      '報導者 Podcast 製作團隊',
      'Tatler Taiwan',
      'UDIGIT TECHNOLOGY CO.,LTD.',
      '柴柴的理財小天地',
      '嘻嘻哈哈看世界2026-10-03 18:19发布于江苏',
      '中央社／ 台北2日電',
      '台北30日電',
      '名古屋',
      '英國費爾福27日綜合外電報導',
      '波士頓1日電',
      '社運 發電機',
      '记者：刘保罗'.slice(0, 2),
      'Miin Events (EN)',
      'Style Du Monde',
      '星洲网',
      '新浪新闻',
    ])
      expect(personNames(raw), raw).toEqual([]);
  });
  it('strips roles, outlets, datelines and affiliations around a name', () => {
    expect(personNames('聯合報／ 記者／郭雪筠')).toEqual(['郭雪筠']);
    expect(personNames('觀天下／ 記者陳惠玲／汐止報導')).toEqual(['陳惠玲']);
    expect(personNames('文／王佳宜')).toEqual(['王佳宜']);
    expect(personNames('世界新聞網王若馨／即時報導')).toEqual(['王若馨']);
    expect(personNames('蕭保祥／台南報導')).toEqual(['蕭保祥']);
    expect(personNames('黃緒生台北報導')).toEqual(['黃緒生']);
    expect(personNames('呂佳蓉北京29日電')).toEqual(['呂佳蓉']);
    expect(personNames('林宏翰洛杉磯1日專電')).toEqual(['林宏翰']);
    expect(personNames('中央社／ 記者張謙香港2電')).toEqual(['張謙']);
    expect(personNames('時報編譯柯婉琇綜合外電')).toEqual(['柯婉琇']);
    expect(personNames('經濟日報／ 編譯劉忠勇／綜合外電')).toEqual(['劉忠勇']);
    expect(personNames('特派劉肇育')).toEqual(['劉肇育']);
    expect(personNames('上報快訊／簡紹儒')).toEqual(['簡紹儒']);
    expect(personNames('武廷融 綜合報導')).toEqual(['武廷融']);
    expect(personNames('崔馨方整理')).toEqual(['崔馨方']);
    expect(personNames('實習編輯 鄒鎮宇')).toEqual(['鄒鎮宇']);
    expect(personNames('香港特約記者 麥燕庭')).toEqual(['麥燕庭']);
    expect(personNames('蕭惠中（安聯台灣大壩基金經理人）')).toEqual(['蕭惠中']);
    expect(personNames('許劍虹（Samuel Hui）')).toEqual(['許劍虹']);
    expect(personNames('克里斯·巴拉紐克 （Chris Baraniuk）')).toEqual(['克里斯·巴拉紐克']);
    expect(personNames('记者：刘保罗')).toEqual(['刘保罗']);
    expect(personNames('吳旻洲 台北')).toEqual(['吳旻洲']);
  });
  it('splits co-bylines and joins a surname separated from its given name', () => {
    expect(personNames('吳允芊 賴心怡 江文賢 顧元松')).toEqual(['吳允芊', '賴心怡', '江文賢', '顧元松']);
    expect(personNames('林菁樺、鍾麗華')).toEqual(['林菁樺', '鍾麗華']);
    expect(personNames('洪偉峻,鍾志恆')).toEqual(['洪偉峻', '鍾志恆']);
    expect(personNames('曾靖珊 蔡奕輝 巴西聖保羅')).toEqual(['曾靖珊', '蔡奕輝']);
    expect(personNames('謝 東明')).toEqual(['謝東明']);
    expect(personNames('韋 石')).toEqual(['韋石']);
    expect(personNames('文／Mike Donghia 編譯／王蘭')).toEqual(['Mike Donghia', '王蘭']);
    expect(personNames('周行一 Edward H.Chow')).toEqual(['周行一 Edward H.Chow']);
  });
  it('deduplicates across an article’s credits and normalises the page key', () => {
    expect(journalistNames(['記者王小明', '王小明／台北報導', '陳大文'])).toEqual(['王小明', '陳大文']);
    expect(journalistKey('　王小明  ')).toBe('王小明');
    expect(journalistKey('Ｄoris')).toBe('Doris');
  });
});

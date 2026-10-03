import { describe, expect, it } from 'vitest';
import baseline from '../../data/traffic-baseline.json' with { type: 'json' };
import { extractAttributions, normalizeAttributions, outletIdentity } from './attribution.ts';

describe('explicit media attribution', () => {
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

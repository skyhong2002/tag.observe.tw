// Display/analysis noise is narrower than no_equal: people, places and parties
// can be useful ranking terms even when they must not connect event clusters.
const CATEGORIES = new Set([
  '地方',
  '生活',
  '地方生活',
  '生活消費',
  '生活新聞',
  '地方新聞',
  '新聞',
  '即時',
  '即時新聞',
  '即時新聞網',
  '熱門新聞',
  '焦點',
  '要聞',
  '國際',
  '國際要聞',
  '政治',
  '社會',
  '財經',
  '財經總覽',
  '娛樂',
  '娛樂專題',
  '科技',
  '科技前線',
  '體育',
  '運動',
  '運動總覽',
  '健康',
  '旅遊',
  '未分類',
  '其他',
  '其它',
  '首頁',
  '綜合',
  '精選',
  '推薦',
  'google編輯嚴選',
  'headline',
  'notag',
  'notags',
  'no tag',
  'no_tag',
]);

// Bare English function words are not topics. Real multi-word titles and
// abbreviations (The Hope, US, AI) remain intact; compare whole tags only.
const ENGLISH_FUNCTION_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'of',
  'to',
  'with',
  'from',
  'by',
  'is',
  'are',
  'was',
  'were',
]);

// Section and brand labels end in 新聞/要聞/匯流/總覽 (國際新聞, 體育新聞,
// 台灣要聞, 政治匯流, 快新聞, 梅花新聞). 東網 puts four of them on every
// article, so on 2026-10-05 國際新聞 and 體育新聞 became major tags of the
// weather event. 假新聞 is a subject, not a section.
const SECTION_SUFFIX = /(?:新聞|要聞|匯流|總覽)$/;
const SUBJECTS = new Set(['假新聞']);

export const TAG_NOISE_RULE_VERSION = '2';
export type TagNoiseReason = 'control-character' | 'empty' | 'category' | 'english-function-word' | 'section-label' | 'bare-year';

export const hasTagControlCharacters = (tag: string): boolean => /\p{Cc}/u.test(tag);

export function tagNoiseReasons(tag: string): TagNoiseReason[] {
  // Check the original label before trim/NFKC can hide tabs or line breaks.
  // Format characters (e.g. emoji ZWJ) are not control characters.
  if (hasTagControlCharacters(tag)) return ['control-character'];
  const t = tag.normalize('NFKC').trim().toLowerCase();
  if (!t) return ['empty'];
  if (CATEGORIES.has(t)) return ['category'];
  if (ENGLISH_FUNCTION_WORDS.has(t)) return ['english-function-word'];
  if (SECTION_SUFFIX.test(t) && !SUBJECTS.has(t)) return ['section-label'];
  // Whole terms only: keep 0050, 0056, 3C, 2026大選 and named historical events.
  return /^(?:(?:西元|公元)?(?:19|20|21)\d{2}(?:年(?:度)?)?|(?:民國)?[1-9]\d{1,2}年(?:度)?|民國[1-9]\d{1,2}|(?:民國|西元|公元)?[〇零○一二三四五六七八九]{2,4}年(?:度)?)$/.test(
    t,
  )
    ? ['bare-year']
    : [];
}

export function isTagNoise(tag: string): boolean {
  return tagNoiseReasons(tag).length > 0;
}

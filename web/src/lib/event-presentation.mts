// Shared by the event table and news demo. Ranking belongs to the event group;
// choosing its representative headline must not depend on image availability.
const PREFIX = /^(快訊|快新聞|最新|影音?|影片|獨家|圖輯?|更新|直播|即時)\s*[／/｜|:：]\s*/;
const SUFFIX = /\s*[｜|]\s*[^｜|]{1,12}$/;
export const cleanEventHeadline = (title: string) => title.replace(PREFIX, '').replace(SUFFIX, '').trim();

export function selectEventLead<T extends { title: string }>(news: readonly T[], major: readonly string[]): T | null {
  return (
    news
      .map((article) => ({
        article,
        title: cleanEventHeadline(article.title),
        hits: major.filter((tag) => article.title.includes(tag)).length,
      }))
      .filter((item) => item.title.length >= 6)
      .sort((a, b) => b.hits - a.hits || a.title.length - b.title.length)[0]?.article ?? null
  );
}

/** Labels describe the displayed headline, not every topic in a broad cluster. */
export function headlineTags(title: string, candidates: readonly string[]): string[] {
  const lower = title.toLowerCase();
  return [...new Set(candidates)].filter((tag) => {
    if (!tag.trim()) return false;
    const needle = tag.toLowerCase();
    let at = lower.indexOf(needle);
    while (at !== -1) {
      const before = lower[at - 1] ?? '',
        after = lower[at + needle.length] ?? '';
      // Do not label OpenAI as AI, or a similar Latin substring as a new topic.
      if ((!/^[a-z0-9]/.test(needle) || !/[a-z0-9]/.test(before)) && (!/[a-z0-9]$/.test(needle) || !/[a-z0-9]/.test(after))) return true;
      at = lower.indexOf(needle, at + 1);
    }
    return false;
  });
}

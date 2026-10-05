// Shared by the event table and news demo. Ranking belongs to the event group;
// choosing its representative headline must not depend on image availability.
const PREFIX = /^(快訊|快新聞|最新|影音?|影片|獨家|圖輯?|更新|直播|即時)\s*[／/｜|:：]\s*/;
const SUFFIX = /\s*[｜|]\s*[^｜|]{1,12}$/;
export const cleanEventHeadline = (title: string) => title.replace(PREFIX, '').replace(SUFFIX, '').trim();

// Stored titles stay whole; a few outlets' titles run on into the lede, so
// displayed headlines stop at this many characters.
export const HEADLINE_MAX = 60;
export function clipHeadline(title: string, max = HEADLINE_MAX): string {
  const chars = [...title];
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join('')
        .trimEnd()}…`
    : title;
}

export function selectEventLead<T extends { title: string }>(news: readonly T[], major: readonly string[]): T | null {
  return (
    news
      .map((article) => ({
        article,
        title: cleanEventHeadline(article.title),
        hits: major.filter((tag) => article.title.includes(tag)).length,
      }))
      .filter((item) => item.title.length >= 6)
      // A title that runs into its lede names more tags; it only leads when
      // no headline-sized title is left.
      .sort(
        (a, b) =>
          Number(a.title.length > HEADLINE_MAX) - Number(b.title.length > HEADLINE_MAX) ||
          b.hits - a.hits ||
          a.title.length - b.title.length,
      )[0]?.article ?? null
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

// Outlet-wide share images (a logo where the photo should be) look broken as
// an event cover. They are recognisable two ways: a known filename, or the
// same URL on several of the event's reports.
const GENERIC_IMAGE = /UDN_BABY|pic_fb\.|sitelogo|\/logo[^/]*\.(png|jpg|svg)$|default[-_]?(og|share)/i;
export function selectEventCover<T extends { image: string | null }>(
  news: readonly T[],
  lead: T | null,
  allowed: (url: string | null | undefined) => boolean,
): T | null {
  const seen = new Map<string, number>();
  for (const n of news) if (n.image) seen.set(n.image, (seen.get(n.image) ?? 0) + 1);
  const ok = (n: T) => allowed(n.image) && !GENERIC_IMAGE.test(n.image as string) && seen.get(n.image as string) === 1;
  if (lead && ok(lead)) return lead;
  return news.find(ok) ?? null;
}

/** One headline selection for the page, metadata and share image. */
export function eventThreadHeadline(data: {
  thread: { majorTags: string[] };
  hours: Array<{ news: Array<{ title: string }>; major: string[] }>;
}) {
  const latest = data.hours[0];
  const lead = latest ? selectEventLead(latest.news, latest.major) : null;
  return lead ? clipHeadline(cleanEventHeadline(lead.title)) : data.thread.majorTags.join('、');
}

/** The photo for the thread page: the latest hour's lead when its picture is
 *  usable, otherwise another report on the thread, newest hour first. */
export function eventThreadCover<T extends { title: string; image: string | null }>(
  hours: ReadonlyArray<{ news: readonly T[]; major: readonly string[] }>,
  allowed: (url: string | null | undefined) => boolean,
): T | null {
  for (const h of hours) {
    const cover = selectEventCover(h.news, selectEventLead(h.news, h.major), allowed);
    if (cover) return cover;
  }
  return null;
}

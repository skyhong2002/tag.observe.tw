import pLimit from 'p-limit';
import { fetchText } from './fetch.ts';
import { storyPageDate, type TopicStory } from './topic-page.ts';

// Topic pages of some outlets (womany, 天下, TVBS, 食尚玩家…) print no date
// next to their stories, and we do not crawl those outlets' articles: such a
// topic has no 最後更新 and cannot be classified. Its stories' own pages say
// when they were published, so a few of them are read — the newest end of the
// list (最後更新) and the oldest (the span that tells 議題 from 專題) — and
// the date is stored on the story (TopicStory.date) and carried over to every
// later check (carryStoryDates), so a story page is read at most once.

/** A stored story's date, or the mark that its page shows none. */
export type KnownStoryDate = Pick<TopicStory, 'date' | 'dateless'>;

/** Stories without a date get the one stored for the same key earlier (on
 *  this topic, else on another topic of the outlet); `dateless` carries too. */
export function carryStoryDates(stories: TopicStory[], ...known: Array<Map<string, KnownStoryDate>>): TopicStory[] {
  return stories.map((s) => {
    if (s.date) return s;
    for (const k of known) {
      const prev = k.get(s.key);
      if (prev?.date) return { ...s, date: prev.date };
      if (prev?.dateless) return { ...s, dateless: true };
    }
    return s;
  });
}

const trailingId = (key: string) => {
  const m = /(\d{3,})(?!.*\d)/.exec(key);
  return m ? Number(m[1]) : null;
};

/** Whether the list runs newest first, from the dates known so far (else
 *  the stories' numeric ids, which outlets hand out in order); by default yes. */
export function newestFirst(stories: TopicStory[], dateOf: (s: TopicStory) => Date | null): boolean {
  const vote = (values: Array<number | null>) => {
    const seq = values.filter((v): v is number => v !== null);
    let score = 0;
    for (let i = 1; i < seq.length; i++) score += Math.sign(seq[i - 1] - seq[i]);
    return score;
  };
  const byDate = vote(stories.map((s) => (dateOf(s) ? +(dateOf(s) as Date) : null)));
  if (byDate) return byDate > 0;
  const byId = vote(stories.map((s) => trailingId(s.key)));
  return byId >= 0;
}

/**
 * The stories whose own page to read: of the newest `newest` and the oldest
 * `oldest` stories (stories whose page shows no date skipped), those without
 * a date. A topic dated at both ends needs none, and neither does one whose
 * story pages read so far (`giveUp` of them) all lacked a date: its stories
 * are not articles (a 專題's own sub-pages).
 */
export function storiesToDate(
  stories: TopicStory[],
  dateOf: (s: TopicStory) => Date | null,
  { newest = 2, oldest = 1, giveUp = 3 }: { newest?: number; oldest?: number; giveUp?: number } = {},
): TopicStory[] {
  if (stories.filter((s) => s.dateless).length >= giveUp && !stories.some(dateOf)) return [];
  const ordered = newestFirst(stories, dateOf) ? stories : [...stories].reverse();
  const open = ordered.filter((s) => !s.dateless);
  const ends = new Set([...open.slice(0, newest), ...(oldest ? open.slice(-oldest) : [])]);
  return [...ends].filter((s) => !dateOf(s) && storyUrl(s));
}

/** Where a story's page is: the link as found, else its url_key (host/path). */
export function storyUrl(s: TopicStory): string | null {
  if (s.url) return s.url;
  return /^[^/#?]+\.[^/#?]+(?:[/?]|$)/.test(s.key) && !s.key.includes('#') ? `https://${s.key}` : null;
}

/**
 * Reads story pages (2 at a time, 15 s each, no retry) for their publish date
 * (storyPageDate). A page read without a date, or gone (404/410), maps to
 * null: it is not read again. Unreachable pages are left out to retry later.
 */
export async function fetchStoryDates(
  stories: TopicStory[],
  {
    fetch = fetchText,
    now = new Date(),
    concurrency = 2,
    timeout = 15000,
  }: { fetch?: typeof fetchText; now?: Date; concurrency?: number; timeout?: number } = {},
): Promise<Map<string, Date | null>> {
  const out = new Map<string, Date | null>();
  const gate = pLimit(concurrency);
  await Promise.all(
    stories.map((s) =>
      gate(async () => {
        const url = storyUrl(s);
        if (!url || out.has(s.key)) return;
        try {
          const res = await fetch(url, { timeout, retries: 0 });
          if (res.status === 404 || res.status === 410) out.set(s.key, null);
          else if (res.status < 400) out.set(s.key, storyPageDate(res.body, res.url || url, now));
        } catch {
          // Timeout or refused: try again at the next check.
        }
      }),
    ),
  );
  return out;
}

/** The story pages to read this run: at most `cap`, and at most `perMedia`
 *  from one outlet (天下 answered a burst with 429s), 議題 (kind topic) first,
 *  in the order the topics were given (the job's due order: active first). */
export function storyFetchBudget(
  topics: Array<{ kind: string | null; media?: string; stories: TopicStory[] }>,
  cap: number,
  perMedia = Number.POSITIVE_INFINITY,
): TopicStory[] {
  const ordered = [...topics.filter((t) => t.kind === 'topic'), ...topics.filter((t) => t.kind !== 'topic')];
  const seen = new Set<string>();
  const taken = new Map<string, number>();
  const out: TopicStory[] = [];
  for (const t of ordered)
    for (const s of t.stories) {
      if (out.length >= cap) return out;
      if (seen.has(s.key) || (taken.get(t.media ?? '') ?? 0) >= perMedia) continue;
      seen.add(s.key);
      taken.set(t.media ?? '', (taken.get(t.media ?? '') ?? 0) + 1);
      out.push(s);
    }
  return out;
}

import { journalistKey, setRequestedExclusions } from './names.ts';

// People ask to leave the journalist pages by filing a GitHub issue whose title
// starts with the prefix below (the site pre-fills it). An open request hides
// the page as soon as the next sync runs; nobody has to review it first. The
// owner reverses a bogus request by adding the `rejected` label. Closing an
// issue does not restore the page, so resolved requests can be tidied away.

export const REPOSITORY = process.env.JOURNALIST_REMOVAL_REPOSITORY || 'skyhong2002/tag.observe.tw';
export const REMOVAL_TITLE_PREFIX = '記者頁移除請求';
export const REJECTED_LABEL = 'rejected';
const SYNC_INTERVAL_MS = Number(process.env.JOURNALIST_REMOVAL_SYNC_MINUTES || 10) * 60e3;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

export interface IssueLike {
  title?: unknown;
  labels?: unknown;
  pull_request?: unknown;
}

/** The name a removal issue asks about, or null when the title is not a request. */
export function requestedName(title: unknown): string | null {
  if (typeof title !== 'string') return null;
  const match = /^\s*記者頁移除請求\s*[：:]\s*(.+?)\s*$/u.exec(title);
  if (!match) return null;
  const name = journalistKey(match[1]);
  return name.length >= 2 && name.length <= 40 && !/[%_\\\p{C}]/u.test(name) ? name : null;
}
const labelNames = (labels: unknown): string[] =>
  Array.isArray(labels)
    ? labels
        .map((label) => (typeof label === 'string' ? label : (label as { name?: unknown })?.name))
        .filter((n): n is string => typeof n === 'string')
    : [];
/** Names requested by issues that are not pull requests and not labelled rejected. */
export function parseRemovalRequests(issues: readonly IssueLike[]): string[] {
  const names: string[] = [];
  for (const issue of issues) {
    if (issue.pull_request) continue;
    if (labelNames(issue.labels).some((label) => label.toLowerCase() === REJECTED_LABEL)) continue;
    const name = requestedName(issue.title);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export type IssueFetcher = (url: string) => Promise<{ status: number; json(): Promise<unknown> }>;
const githubFetch: IssueFetcher = (url) =>
  fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'tag.observe.tw journalist-removal-sync',
      ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });

/** All removal requests currently on the repository, newest first. Throws when GitHub cannot be read. */
export async function fetchRemovalRequests(fetchImpl: IssueFetcher = githubFetch): Promise<string[]> {
  const issues: IssueLike[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/issues?state=all&per_page=${PAGE_SIZE}&page=${page}`);
    if (response.status !== 200) throw new Error(`GitHub issues returned ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('GitHub issues response is not a list');
    issues.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return parseRemovalRequests(issues);
}

/** Poll GitHub now and on an interval; `onChange` fires when the excluded set differs from before. */
export function startRemovalRequestSync({
  log,
  onChange,
  fetchImpl,
  intervalMs = SYNC_INTERVAL_MS,
}: {
  log: { info(obj: object, msg: string): void; warn(obj: object, msg: string): void };
  onChange: (names: string[]) => void;
  fetchImpl?: IssueFetcher;
  intervalMs?: number;
}): { stop(): void; run(): Promise<void>; ready: Promise<void> } {
  const run = async () => {
    try {
      const names = await fetchRemovalRequests(fetchImpl);
      if (setRequestedExclusions(names)) {
        log.info({ count: names.length }, 'journalist removal requests changed');
        onChange(names);
      }
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'journalist removal sync failed; keeping previous list');
    }
  };
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer), run, ready: run() };
}

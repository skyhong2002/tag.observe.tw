import { journalistKey, setRequestedExclusions } from './names.ts';

// People ask to leave the journalist pages by filing a GitHub issue whose title
// starts with the prefix below (the site pre-fills it). An open request hides
// the page as soon as the next sync runs; nobody has to review it first. With
// write access enabled, the sync acknowledges and closes it. The owner
// reverses a bogus request by adding the `rejected` label. Closing an issue
// does not restore the page, so resolved requests can be tidied away.

export const REPOSITORY = process.env.JOURNALIST_REMOVAL_REPOSITORY || 'skyhong2002/tag.observe.tw';
export const REMOVAL_TITLE_PREFIX = '記者頁移除請求';
export const REJECTED_LABEL = 'rejected';
export const RESOLUTION_MARKER = '<!-- tag.observe.tw:journalist-removal-resolved -->';
export const RESOLUTION_COMMENT = `${RESOLUTION_MARKER}

這則移除請求已由系統套用，記者頁已從站內索引移除。此 issue 會自動關閉；若要撤回請求，請加上 rejected 標籤。`;
const SYNC_INTERVAL_MS = Number(process.env.JOURNALIST_REMOVAL_SYNC_MINUTES || 10) * 60e3;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const autoResolveEnabled = () => process.env.JOURNALIST_REMOVAL_AUTO_RESOLVE === '1';

export interface IssueLike {
  title?: unknown;
  labels?: unknown;
  pull_request?: unknown;
  number?: unknown;
  state?: unknown;
  comments_url?: unknown;
  url?: unknown;
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

export type IssueResponse = { status: number; json(): Promise<unknown> };
export type IssueFetcher = (url: string, init?: RequestInit) => Promise<IssueResponse>;
const githubFetch: IssueFetcher = (url, init = {}) =>
  fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      accept: 'application/vnd.github+json',
      'user-agent': 'tag.observe.tw journalist-removal-sync',
      ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });

const issueUrl = (number: number) => `https://api.github.com/repos/${REPOSITORY}/issues/${number}`;
const commentsUrl = (issue: IssueLike, number: number) =>
  typeof issue.comments_url === 'string' && issue.comments_url ? issue.comments_url : `${issueUrl(number)}/comments`;
const issueNumber = (issue: IssueLike): number | null =>
  typeof issue.number === 'number' && Number.isSafeInteger(issue.number) && issue.number > 0 ? issue.number : null;

function isRemovalIssue(issue: IssueLike): boolean {
  if (issue.pull_request) return false;
  if (labelNames(issue.labels).some((label) => label.toLowerCase() === REJECTED_LABEL)) return false;
  return requestedName(issue.title) !== null;
}

async function hasResolutionComment(issue: IssueLike, number: number, fetchImpl: IssueFetcher): Promise<boolean> {
  const response = await fetchImpl(`${commentsUrl(issue, number)}?per_page=100`);
  if (response.status !== 200) throw new Error(`GitHub issue comments returned ${response.status}`);
  const comments = await response.json();
  if (!Array.isArray(comments)) throw new Error('GitHub issue comments response is not a list');
  return comments.some(
    (comment) =>
      typeof (comment as { body?: unknown })?.body === 'string' && (comment as { body: string }).body.includes(RESOLUTION_MARKER),
  );
}

/** Acknowledge and close one eligible open request. Safe to retry after a partial failure. */
export async function resolveRemovalIssue(issue: IssueLike, fetchImpl: IssueFetcher = githubFetch): Promise<boolean> {
  const number = issueNumber(issue);
  if (number === null || issue.state !== 'open' || !autoResolveEnabled() || !process.env.GITHUB_TOKEN) return false;
  if (!(await hasResolutionComment(issue, number, fetchImpl))) {
    const comment = await fetchImpl(`${commentsUrl(issue, number)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: RESOLUTION_COMMENT }),
    });
    if (comment.status !== 201) throw new Error(`GitHub issue comment returned ${comment.status}`);
  }
  const close = await fetchImpl(typeof issue.url === 'string' && issue.url ? issue.url : issueUrl(number), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
  });
  if (close.status !== 200) throw new Error(`GitHub issue close returned ${close.status}`);
  return true;
}

/** All removal requests currently on the repository, newest first. Throws when GitHub cannot be read. */
export async function fetchRemovalIssues(fetchImpl: IssueFetcher = githubFetch): Promise<IssueLike[]> {
  const issues: IssueLike[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/issues?state=all&per_page=${PAGE_SIZE}&page=${page}`);
    if (response.status !== 200) throw new Error(`GitHub issues returned ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('GitHub issues response is not a list');
    issues.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return issues;
}

/** Names requested by issues currently visible to the synchronizer. */
export async function fetchRemovalRequests(fetchImpl: IssueFetcher = githubFetch): Promise<string[]> {
  return parseRemovalRequests(await fetchRemovalIssues(fetchImpl));
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
      const issues = await fetchRemovalIssues(fetchImpl);
      const names = parseRemovalRequests(issues);
      if (setRequestedExclusions(names)) {
        log.info({ count: names.length }, 'journalist removal requests changed');
        onChange(names);
      }
      if (autoResolveEnabled() && process.env.GITHUB_TOKEN) {
        for (const issue of issues) {
          if (!isRemovalIssue(issue) || issue.state !== 'open') continue;
          try {
            if (await resolveRemovalIssue(issue, fetchImpl)) log.info({ issue: issue.number }, 'journalist removal issue resolved');
          } catch (error) {
            log.warn(
              { issue: issue.number, error: error instanceof Error ? error.message : String(error) },
              'journalist removal issue resolution failed',
            );
          }
        }
      }
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'journalist removal sync failed; keeping previous list');
    }
  };
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer), run, ready: run() };
}

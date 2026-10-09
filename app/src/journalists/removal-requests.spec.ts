import { describe, expect, it } from 'vitest';
import { isExcludedJournalist, setRequestedExclusions } from './names.ts';
import {
  fetchRemovalRequests,
  parseRemovalRequests,
  RESOLUTION_COMMENT,
  requestedName,
  resolveRemovalIssue,
  startRemovalRequestSync,
} from './removal-requests.ts';

describe('removal requests', () => {
  it('reads the name from the pre-filled title with either colon', () => {
    expect(requestedName('記者頁移除請求：王小明')).toBe('王小明');
    expect(requestedName(' 記者頁移除請求: Una  Wang ')).toBe('Una Wang');
    expect(requestedName('記者頁移除請求：')).toBeNull();
    expect(requestedName('請移除我的頁面')).toBeNull();
    expect(requestedName('記者頁移除請求：%')).toBeNull();
  });
  it('skips pull requests and rejected issues, keeps closed ones', () => {
    const names = parseRemovalRequests([
      { title: '記者頁移除請求：王小明', labels: [] },
      { title: '記者頁移除請求：李大華', labels: [{ name: 'Rejected' }] },
      { title: '記者頁移除請求：張三', pull_request: {} },
      { title: '記者頁移除請求：王小明', labels: ['question'] },
      { title: 'bug: 排行榜壞了' },
    ]);
    expect(names).toEqual(['王小明']);
  });
  it('pages through the GitHub API and applies the result', async () => {
    const calls: string[] = [];
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `記者頁移除請求：人${i}`, labels: [] }));
    const fetchImpl = async (url: string) => {
      calls.push(url);
      const body = url.endsWith('page=1') ? page(100) : [{ title: '記者頁移除請求：最後一人', labels: [] }];
      return { status: 200, json: async () => body };
    };
    const names = await fetchRemovalRequests(fetchImpl);
    expect(calls).toHaveLength(2);
    expect(names).toHaveLength(101);
    expect(names.at(-1)).toBe('最後一人');
  });
  it('hides a requested person until the request is withdrawn, and clears caches once per change', async () => {
    let changes = 0;
    let issues: Array<{ title: string; labels: string[] }> = [{ title: '記者頁移除請求：測試記者', labels: [] }];
    const sync = startRemovalRequestSync({
      log: { info() {}, warn() {} },
      onChange: () => changes++,
      fetchImpl: async () => ({ status: 200, json: async () => issues }),
      intervalMs: 3600e3,
    });
    await sync.ready;
    expect(isExcludedJournalist('測試記者')).toBe(true);
    await sync.run();
    expect(changes).toBe(1);
    issues = [{ title: '記者頁移除請求：測試記者', labels: ['rejected'] }];
    await sync.run();
    expect(isExcludedJournalist('測試記者')).toBe(false);
    expect(changes).toBe(2);
    sync.stop();
    setRequestedExclusions([]);
  });
  it('keeps the previous list when GitHub fails', async () => {
    setRequestedExclusions(['保留者']);
    const warnings: string[] = [];
    const sync = startRemovalRequestSync({
      log: { info() {}, warn: (_o, msg) => warnings.push(msg) },
      onChange: () => {},
      fetchImpl: async () => ({ status: 403, json: async () => ({}) }),
      intervalMs: 3600e3,
    });
    await sync.ready;
    sync.stop();
    expect(isExcludedJournalist('保留者')).toBe(true);
    expect(warnings).toHaveLength(1);
    setRequestedExclusions([]);
  });

  it('comments and closes an open request without duplicating an existing acknowledgement', async () => {
    const previousToken = process.env.GITHUB_TOKEN;
    const previousAutoResolve = process.env.JOURNALIST_REMOVAL_AUTO_RESOLVE;
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.JOURNALIST_REMOVAL_AUTO_RESOLVE = '1';
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    let acknowledged = false;
    const fetchImpl = async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : undefined });
      if (init.method === 'POST') {
        acknowledged = true;
        return { status: 201, json: async () => ({}) };
      }
      if (init.method === 'PATCH') return { status: 200, json: async () => ({}) };
      return { status: 200, json: async () => (acknowledged ? [{ body: RESOLUTION_COMMENT }] : []) };
    };
    const issue = {
      number: 3,
      state: 'open',
      title: '記者頁移除請求：測試記者',
      labels: [],
      comments_url: 'https://api.github.com/repos/skyhong2002/tag.observe.tw/issues/3/comments',
      url: 'https://api.github.com/repos/skyhong2002/tag.observe.tw/issues/3',
    };
    await expect(resolveRemovalIssue(issue, fetchImpl)).resolves.toBe(true);
    expect(calls.map(({ method }) => method)).toEqual(['GET', 'POST', 'PATCH']);
    expect(JSON.parse(calls[1].body ?? '{}')).toEqual({ body: RESOLUTION_COMMENT });
    const firstCallCount = calls.length;
    issue.state = 'open';
    await expect(resolveRemovalIssue(issue, fetchImpl)).resolves.toBe(true);
    expect(calls.slice(firstCallCount).map(({ method }) => method)).toEqual(['GET', 'PATCH']);
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
    if (previousAutoResolve === undefined) delete process.env.JOURNALIST_REMOVAL_AUTO_RESOLVE;
    else process.env.JOURNALIST_REMOVAL_AUTO_RESOLVE = previousAutoResolve;
  });
});

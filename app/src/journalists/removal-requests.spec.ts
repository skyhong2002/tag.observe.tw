import { describe, expect, it } from 'vitest';
import { isExcludedJournalist, setRequestedExclusions } from './names.ts';
import { fetchRemovalRequests, parseRemovalRequests, requestedName, startRemovalRequestSync } from './removal-requests.ts';

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
});

// The daily tag-avatars job (app/src/jobs/tag-avatars-run.ts): it must stop on
// its time budget or when the worker shuts down, and always free the models.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
let clock = 0;
vi.mock('../src/avatars/run.ts', () => ({
  busyTags: async () => ['賴清德', '台北', '蘇巧慧', '失敗'],
  processTag: async (_db: unknown, tag: string) => {
    calls.push(tag);
    clock += 60e3;
    if (tag === '失敗') throw Error('wikidata down');
    return { tag, status: tag === '台北' ? 'none' : 'auto' };
  },
}));
const released = vi.fn();
vi.mock('../src/avatars/models.ts', () => ({ releaseModels: async () => released() }));

const { runTagAvatarsJob } = await import('../src/jobs/tag-avatars-run.ts');
const db = {} as never;

describe('tag-avatars job', () => {
  beforeEach(() => {
    calls.length = 0;
    clock = 0;
    released.mockClear();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
  });

  it('runs every tag, counts statuses and errors, and frees the models', async () => {
    expect(await runTagAvatarsJob(db)).toEqual({ candidates: 4, done: 4, auto: 2, none: 1, error: 1 });
    expect(released).toHaveBeenCalledOnce();
  });

  it('stops when its time budget is spent', async () => {
    const r = await runTagAvatarsJob(db, { budgetMs: 90e3 });
    expect(calls).toEqual(['賴清德', '台北']);
    expect(r.done).toBe(2);
    expect(released).toHaveBeenCalledOnce();
  });

  it('stops when the worker shuts down', async () => {
    const stop = new AbortController();
    stop.abort();
    expect((await runTagAvatarsJob(db, { signal: stop.signal })).done).toBe(0);
    expect(released).toHaveBeenCalledOnce();
  });
});

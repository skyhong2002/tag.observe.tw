import { afterEach, expect, it, vi } from 'vitest';
import { loadDemo, loadHomeGraph, loadHomeJournalists, loadHomeTopics, mediaStats } from '../src/lib/demo.ts';

afterEach(() => vi.unstubAllGlobals());

it('serves the lead data while optional home panel requests are still pending', async () => {
  let releasing = false;
  const pending: Array<(response: Response) => void> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const url = String(input);
      if (!releasing && /\/api\/v1\/(similarity|journalists|topics|media-stats)(\?|\/|$)/.test(url)) {
        return new Promise<Response>((resolve) => pending.push(resolve));
      }
      if (url.includes('/events/threads')) return Promise.resolve(Response.json({ threads: [] }));
      if (url.includes('/events')) return Promise.resolve(Response.json({ events: [], builtAt: '2026-10-07T00:00:00Z' }));
      if (url.includes('/media-stats')) return Promise.resolve(Response.json({ media: [] }));
      return Promise.resolve(new Response(null, { status: 503 }));
    }),
  );
  const panels = Promise.all([loadHomeGraph(), loadHomeJournalists(), loadHomeTopics(), mediaStats()]);
  let panelsDone = false;
  void panels.then(() => {
    panelsDone = true;
  });
  try {
    const lead = await loadDemo();
    expect(lead.events?.builtAt).toBe('2026-10-07T00:00:00Z');
    expect(pending).toHaveLength(4);
    expect(panelsDone).toBe(false);
  } finally {
    releasing = true;
    pending.forEach((resolve) => {
      resolve(new Response(null, { status: 503 }));
    });
    await panels;
  }
});

it('streams lead data before below-fold camp rankings, sharing the news request', async () => {
  const pending: Array<(response: Response) => void> = [];
  const fetcher = vi.fn((input: string) => {
    const url = new URL(String(input));
    const category = url.searchParams.get('category');
    if (category === 'blue' || category === 'green') return new Promise<Response>((resolve) => pending.push(resolve));
    if (url.pathname.endsWith('/events/threads')) return Promise.resolve(Response.json({ threads: [] }));
    if (url.pathname.endsWith('/events')) return Promise.resolve(Response.json({ events: [], builtAt: '2026-10-13T00:00:00Z' }));
    if (category === 'news')
      return Promise.resolve(Response.json({ snapshot: { hourStart: '2026-10-13T00:00:00Z', articleCount: 100 }, entries: [] }));
    return Promise.resolve(new Response(null, { status: 503 }));
  });
  vi.stubGlobal('fetch', fetcher);
  let leadDone = false;
  const work = loadDemo().then((data) => {
    leadDone = true;
    return data;
  });
  try {
    // Do not await work without a bound: the old implementation would deadlock
    // this test because the camp requests are deliberately still unresolved.
    await vi.waitFor(() => expect(leadDone).toBe(true), { timeout: 1000, interval: 10 });
    const data = await work;
    expect(data.events?.builtAt).toBe('2026-10-13T00:00:00Z');
    expect(pending).toHaveLength(2);
    expect(fetcher.mock.calls.filter(([url]) => new URL(url).searchParams.get('category') === 'news')).toHaveLength(1);
    let shareDone = false;
    void data.campShare.then(() => {
      shareDone = true;
    });
    await Promise.resolve();
    expect(shareDone).toBe(false);
    for (const resolve of pending)
      resolve(Response.json({ snapshot: { hourStart: '2026-10-13T00:00:00Z', articleCount: 20 }, entries: [] }));
    expect(await data.campShare).toMatchObject({ articles: 100, camps: [{ articles: 20 }, { articles: 60 }, { articles: 20 }] });
  } finally {
    for (const resolve of pending) resolve(new Response(null, { status: 503 }));
    await work;
  }
});

it.each(['network', 'malformed'])('keeps optional camp %s failures recoverable without failing the lead', async (failure) => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const url = new URL(String(input));
      if (url.searchParams.get('category') === 'blue')
        return failure === 'network' ? Promise.reject(Error('optional unavailable')) : Promise.resolve(Response.json({ snapshot: null }));
      if (url.searchParams.get('category'))
        return Promise.resolve(Response.json({ snapshot: { hourStart: '2026-10-13T00:00:00Z', articleCount: 100 }, entries: [] }));
      if (url.pathname.endsWith('/events/threads')) return Promise.resolve(Response.json({ threads: [] }));
      if (url.pathname.endsWith('/events')) return Promise.resolve(Response.json({ events: [], builtAt: '2026-10-13T00:00:00Z' }));
      return Promise.resolve(new Response(null, { status: 503 }));
    }),
  );
  const data = await loadDemo();
  expect(data.events?.builtAt).toBe('2026-10-13T00:00:00Z');
  expect(await data.campShare).toBeNull();
});

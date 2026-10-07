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

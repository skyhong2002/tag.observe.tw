import { expect, it } from 'vitest';
import { describe as describeUrl, RequestLog } from '../src/lib/request-log.mts';

const MB = 1024 * 1024;

function harness(options: { linesPerMinute?: number } = {}) {
  let clock = 0;
  let heap = 100 * MB;
  const lines: Array<[string, Record<string, unknown>]> = [];
  const log = new RequestLog({
    now: () => clock,
    heapUsed: () => heap,
    log: (message, detail) => lines.push([message, detail]),
    ...options,
  });
  return {
    log,
    lines,
    advance: (ms: number) => (clock += ms),
    grow: (bytes: number) => (heap += bytes),
  };
}

it('keeps query keys but drops their values', () => {
  expect(describeUrl('/similarity/?threshold=0.65&hours=168&hours=24')).toEqual({
    path: '/similarity/',
    keys: 'hours,threshold',
    group: '/similarity/',
  });
  expect(describeUrl('/media/udn/').group).toBe('/media/*');
  expect(describeUrl('/_next/static/chunks/a.js').group).toBe('/_next/static');
  expect(describeUrl('/').group).toBe('/');
});

it('logs slow requests and heap jumps with the in-flight count, not fast ones', () => {
  const { log, lines, advance, grow } = harness();
  const fast = {};
  const slow = {};
  const heavy = {};
  log.start(fast, '/writing/');
  log.start(slow, '/similarity/?hours=168');
  log.start(heavy, '/media/udn/');
  advance(100);
  log.finish(fast, '/writing/', 200);
  grow(40 * MB);
  log.finish(heavy, '/media/udn/', 200);
  advance(2000);
  log.finish(slow, '/similarity/?hours=168', 499);
  expect(lines.map(([, detail]) => [detail.path, detail.status, detail.inflight])).toEqual([
    ['/media/udn/', 200, 2],
    ['/similarity/', 499, 1],
  ]);
  expect(lines[0][1]).toMatchObject({ heapBeforeMB: 100, heapAfterMB: 140, keys: '' });
  expect(lines[1][1]).toMatchObject({ ms: 2100, keys: 'hours' });
});

it('caps per-request lines and summarises each minute', () => {
  const { log, lines, advance } = harness({ linesPerMinute: 1 });
  for (let i = 0; i < 3; i++) {
    const request = {};
    log.start(request, '/similarity/');
    advance(3000);
    log.finish(request, '/similarity/', 200);
  }
  const asset = {};
  log.start(asset, '/_next/static/chunks/a.js');
  log.finish(asset, '/_next/static/chunks/a.js', 200);
  log.finish({}, '/never-started/', 200);
  log.flush();
  expect(lines).toHaveLength(2);
  expect(lines[1]).toEqual([
    'tag-web requests',
    {
      requests: 4,
      inflight: 0,
      maxInflight: 1,
      heapUsedMB: 100,
      statuses: { 200: 4 },
      groups: { '/similarity/': { n: 3, p95: 3000, max: 3000 }, '/_next/static': { n: 1, p95: 0, max: 0 } },
      lines: 1,
      dropped: 2,
    },
  ]);
  log.flush();
  expect(lines[2][1]).toMatchObject({ requests: 0, lines: 0, dropped: 0, groups: {} });
});

// Request diagnostics for tag-web (#36). The SSR server's heap grows until V8
// aborts, and nothing recorded which requests were in flight when it did. This
// keeps the record without flooding the journal: one summary line a minute,
// plus a line for each request that was slow or moved the heap, capped per
// minute. Paths keep their query keys but never the values.

const MB = 1024 * 1024;

export interface RequestLogOptions {
  now?: () => number;
  heapUsed?: () => number;
  log?: (message: string, detail: Record<string, unknown>) => void;
  slowMs?: number;
  heapJumpBytes?: number;
  linesPerMinute?: number;
}

interface Open {
  started: number;
  heapBefore: number | null;
}

interface Group {
  count: number;
  durations: number[];
}

/** '/media/udn/?page=2&q=x' -> { path: '/media/udn/', keys: 'page,q', group: '/media/*' } */
export function describe(url: string): { path: string; keys: string; group: string } {
  const query = url.indexOf('?');
  const path = query < 0 ? url : url.slice(0, query);
  const keys = query < 0 ? '' : [...new Set(new URLSearchParams(url.slice(query + 1)).keys())].sort().join(',');
  const [first = '', second] = path.split('/').filter(Boolean);
  const group = first === '' ? '/' : first === '_next' ? `/_next/${second ?? ''}` : second ? `/${first}/*` : `/${first}/`;
  return { path, keys, group };
}

const isAsset = (path: string) => path.startsWith('/_next/static/') || path.startsWith('/_next/image');

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

export class RequestLog {
  private readonly open = new WeakMap<object, Open>();
  private readonly now: () => number;
  private readonly heapUsed: () => number;
  private readonly log: (message: string, detail: Record<string, unknown>) => void;
  private readonly slowMs: number;
  private readonly heapJumpBytes: number;
  private readonly linesPerMinute: number;
  private inflight = 0;
  private maxInflight = 0;
  private groups = new Map<string, Group>();
  private statuses = new Map<number, number>();
  private lines = 0;
  private dropped = 0;

  constructor(options: RequestLogOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.heapUsed = options.heapUsed ?? (() => process.memoryUsage().heapUsed);
    this.log = options.log ?? ((message, detail) => console.log(message, JSON.stringify(detail)));
    this.slowMs = options.slowMs ?? 2000;
    this.heapJumpBytes = options.heapJumpBytes ?? 32 * MB;
    this.linesPerMinute = options.linesPerMinute ?? 60;
  }

  start(request: object, url: string): void {
    this.inflight += 1;
    this.maxInflight = Math.max(this.maxInflight, this.inflight);
    this.open.set(request, { started: this.now(), heapBefore: isAsset(describe(url).path) ? null : this.heapUsed() });
  }

  finish(request: object, url: string, status: number): void {
    const entry = this.open.get(request);
    if (!entry) return;
    this.open.delete(request);
    const inflight = this.inflight;
    this.inflight = Math.max(0, this.inflight - 1);
    const ms = Math.round(this.now() - entry.started);
    const { path, keys, group } = describe(url);
    const bucket = this.groups.get(group) ?? { count: 0, durations: [] };
    bucket.count += 1;
    bucket.durations.push(ms);
    this.groups.set(group, bucket);
    this.statuses.set(status, (this.statuses.get(status) ?? 0) + 1);
    if (entry.heapBefore === null) return;
    const heapAfter = this.heapUsed();
    if (ms < this.slowMs && heapAfter - entry.heapBefore < this.heapJumpBytes) return;
    if (this.lines >= this.linesPerMinute) {
      this.dropped += 1;
      return;
    }
    this.lines += 1;
    this.log('tag-web request', {
      path,
      keys,
      status,
      ms,
      heapBeforeMB: Math.round(entry.heapBefore / MB),
      heapAfterMB: Math.round(heapAfter / MB),
      inflight,
    });
  }

  /** Emit the minute's summary and start a new one. */
  flush(): void {
    const requests = [...this.groups.values()].reduce((sum, group) => sum + group.count, 0);
    const groups = Object.fromEntries(
      [...this.groups.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, group]) => [name, { n: group.count, p95: p95(group.durations), max: Math.max(...group.durations) }]),
    );
    this.log('tag-web requests', {
      requests,
      inflight: this.inflight,
      maxInflight: this.maxInflight,
      heapUsedMB: Math.round(this.heapUsed() / MB),
      statuses: Object.fromEntries(this.statuses),
      groups,
      lines: this.lines,
      dropped: this.dropped,
    });
    this.groups = new Map();
    this.statuses = new Map();
    this.maxInflight = this.inflight;
    this.lines = 0;
    this.dropped = 0;
  }
}

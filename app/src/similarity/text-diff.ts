// Word-level differences between two versions of a story, for readers to see
// what a republisher changed. Han characters are single tokens; Latin words and
// numbers stay whole, so "1.9萬" against "19萬" reads as one replaced number.
// Width variants (！ vs !) and whitespace never count as changes.

/** 0 kept, -1 only in the earlier version, 1 only in the later one. */
export type DiffOp = -1 | 0 | 1;
export type DiffSegment = [DiffOp, string];
export interface TextDiff {
  identical: boolean;
  /** Changed spots in reading order, each with a little kept text around it; the rest is left out. */
  hunks: DiffSegment[][];
  /** Changed spots not sent. */
  more: number;
  /** Characters only in the earlier / later version. */
  removed: number;
  added: number;
}

const TOKEN =
  /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}](?:[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}.,%'’_-]*[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}%])?|\s+|[\s\S]/gu;
const MAX_EDITS = 1500;
const CONTEXT = 14;
const MAX_HUNKS = 12;
const MAX_SIDE = 160;
// Beyond this share of the shorter version changed, it is a rewrite, not an edit:
// a wall of marks reads worse than the shared passage and shows too much text.
const MAX_BODY_CHANGE = 0.5;
const MAX_TITLE_CHANGE = 0.6;
// Site chrome that one outlet adds around every story; not an editorial change.
const CHROME = [/^本文共\s*[\d,]+\s*字\s*$/, /^※\s*歡迎用「轉貼」或「分享」/];

interface Token {
  text: string;
  key: string;
}
function tokenize(value: string): Token[] {
  return (value.match(TOKEN) ?? []).map((text) => ({ text, key: /^\s+$/.test(text) ? ' ' : text.normalize('NFKC').toLowerCase() }));
}
function stripChrome(body: string) {
  return body
    .split(/\n+/)
    .filter((line) => !CHROME.some((pattern) => pattern.test(line.trim())))
    .join('\n')
    .trim();
}

/** Myers' O(ND) diff over token keys; null when the versions differ by more than `limit` edits. */
function myers(a: Token[], b: Token[], limit: number): DiffOp[] | null {
  const n = a.length,
    m = b.length,
    max = Math.min(n + m, limit),
    offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? v[offset + k + 1]! : v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[x]!.key === b[y]!.key) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, offset, n, m, d);
    }
  }
  return null;
}
function backtrack(trace: Int32Array[], offset: number, n: number, m: number, steps: number): DiffOp[] {
  const ops: DiffOp[] = [];
  let x = n,
    y = m;
  for (let d = steps; d > 0; d--) {
    const v = trace[d]!,
      k = x - y;
    const prevK = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? k + 1 : k - 1;
    const prevX = v[offset + prevK]!,
      prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push(0);
      x--;
      y--;
    }
    ops.push(x === prevX ? 1 : -1);
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    ops.push(0);
    x--;
    y--;
  }
  return ops.reverse();
}

interface Run {
  op: DiffOp | 2;
  a: Token[];
  b: Token[];
}
/** Kept runs and change runs (op 2 holds both sides), alternating. */
function runs(a: Token[], b: Token[]): Run[] | null {
  let start = 0;
  while (start < a.length && start < b.length && a[start]!.key === b[start]!.key) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end]!.key === b[b.length - 1 - end]!.key) end++;
  const ops = myers(a.slice(start, a.length - end), b.slice(start, b.length - end), MAX_EDITS);
  if (!ops) return null;
  const result: Run[] = [];
  const push = (kept: boolean, ta: Token[], tb: Token[]) => {
    const last = result.at(-1);
    if (last && (last.op === 0) === kept) {
      last.a.push(...ta);
      last.b.push(...tb);
    } else result.push({ op: kept ? 0 : 2, a: [...ta], b: [...tb] });
  };
  if (start) push(true, a.slice(0, start), b.slice(0, start));
  let i = start,
    j = start;
  for (const op of ops) {
    if (op === 0) push(true, [a[i++]!], [b[j++]!]);
    else if (op === -1) push(false, [a[i++]!], []);
    else push(false, [], [b[j++]!]);
  }
  if (end) push(true, a.slice(a.length - end), b.slice(b.length - end));
  return cleanup(result);
}
const text = (tokens: Token[]) => tokens.map((t) => t.text).join('');
const visible = (tokens: Token[]) => tokens.some((t) => t.key !== ' ');
/** Fold tiny kept islands into the changes around them, and drop whitespace-only changes. */
function cleanup(input: Run[]): Run[] {
  const result: Run[] = [];
  for (let i = 0; i < input.length; i++) {
    const run = { ...input[i]! };
    if (run.op === 2 && !visible(run.a) && !visible(run.b)) run.op = 0;
    const prev = result.at(-1),
      next = input[i + 1];
    const island = run.op === 0 && prev?.op === 2 && next?.op === 2 && run.a.filter((t) => t.key !== ' ').length <= 1;
    if (prev && (island || (prev.op === 0) === (run.op === 0))) {
      prev.a.push(...run.a);
      prev.b.push(...run.b);
    } else result.push({ op: run.op, a: [...run.a], b: [...run.b] });
  }
  return result;
}

const chars = (tokens: Token[]) => Array.from(text(tokens).replace(/\s/g, '')).length;
/** Changed characters over the shorter version's length: both sides summed, or the larger side for short texts. */
function changedShare(result: Run[], larger = false) {
  let changed = 0,
    a = 0,
    b = 0;
  for (const run of result) {
    a += chars(run.a);
    b += chars(run.b);
    if (run.op === 2) changed += larger ? Math.max(chars(run.a), chars(run.b)) : chars(run.a) + chars(run.b);
  }
  return changed / Math.max(1, Math.min(a, b));
}
function clip(value: string, side: 'start' | 'end') {
  const chars = Array.from(value.replace(/\s+/g, ' '));
  if (chars.length <= CONTEXT) return value.replace(/\s+/g, ' ');
  return side === 'end' ? `…${chars.slice(-CONTEXT).join('')}` : `${chars.slice(0, CONTEXT).join('')}…`;
}
function bounded(value: string) {
  const chars = Array.from(value.replace(/\s+/g, ' '));
  return chars.length <= MAX_SIDE ? chars.join('') : `${chars.slice(0, MAX_SIDE).join('')}…（共 ${chars.length} 字）`;
}

/** The whole of a short text (a title), with every change marked. */
export function diffTitle(earlier: string, later: string): DiffSegment[] | null {
  const result = runs(tokenize(earlier.trim()), tokenize(later.trim()));
  if (!result || changedShare(result, true) > MAX_TITLE_CHANGE) return null;
  return result.flatMap((run): DiffSegment[] =>
    run.op === 0
      ? [[0, text(run.b)]]
      : (
          [
            [-1, text(run.a)],
            [1, text(run.b)],
          ] as DiffSegment[]
        ).filter(([, value]) => value),
  );
}

/** Only the changed spots of a body, each with a short kept context; null when it was rewritten too much to show. */
export function diffBody(earlier: string, later: string): TextDiff | null {
  const result = runs(tokenize(stripChrome(earlier)), tokenize(stripChrome(later)));
  if (!result || changedShare(result) > MAX_BODY_CHANGE) return null;
  const changes = result.filter((run) => run.op === 2);
  const removed = changes.reduce((sum, run) => sum + Array.from(text(run.a).replace(/\s/g, '')).length, 0);
  const added = changes.reduce((sum, run) => sum + Array.from(text(run.b).replace(/\s/g, '')).length, 0);
  const hunks: DiffSegment[][] = [];
  let current: DiffSegment[] | null = null;
  for (let i = 0; i < result.length; i++) {
    const run = result[i]!;
    if (run.op === 0) continue;
    const before = result[i - 1],
      after = result[i + 1];
    // Changes closer than two contexts apart share one hunk.
    if (!current) {
      current = [];
      if (before) current.push([0, clip(text(before.b), 'end')]);
    }
    if (run.a.length) current.push([-1, bounded(text(run.a))]);
    if (run.b.length) current.push([1, bounded(text(run.b))]);
    const gap = after ? text(after.b) : '';
    if (after && result[i + 2] && Array.from(gap).length <= CONTEXT * 2) current.push([0, gap.replace(/\s+/g, ' ')]);
    else {
      if (after) current.push([0, clip(gap, 'start')]);
      hunks.push(current);
      current = null;
    }
  }
  return {
    identical: changes.length === 0,
    hunks: hunks.slice(0, MAX_HUNKS),
    more: Math.max(0, hunks.length - MAX_HUNKS),
    removed,
    added,
  };
}

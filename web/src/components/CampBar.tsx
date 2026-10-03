import type { Camp, CampBaseline, EventCoverage } from '@/lib/pages';

// Ground.news-style camp presentation for one event: a single coverage line
// on cards ("藍營 62% · 13 家"), a split bar with the day's baseline marked so
// the eye reads deviation rather than the raw ratio, and the two badges a
// reader needs to know about: a tilt (one camp writing far more than usual)
// and a blind spot (one camp barely there at all).

export const CAMP_LABEL: Record<Camp, string> = { blue: '藍營', green: '綠營', other: '其他' };
export const CAMP_FILL: Record<Camp, string> = {
  blue: 'bg-blue-600 dark:bg-blue-500',
  green: 'bg-emerald-600 dark:bg-emerald-500',
  other: 'bg-zinc-400 dark:bg-zinc-500',
};
const CAMP_TEXT: Record<Camp, string> = {
  blue: 'text-blue-700 dark:text-blue-300',
  green: 'text-emerald-700 dark:text-emerald-300',
  other: 'text-zinc-600 dark:text-zinc-400',
};

/** Where the baseline sits on the blue/green split, as blue's share in percent. */
export const baselineBlue = (b?: CampBaseline | null) => {
  const n = (b?.outlets.blue ?? 0) + (b?.outlets.green ?? 0);
  return n ? Math.round(((b?.outlets.blue ?? 0) / n) * 100) : 50;
};

/** Blue minus green, as shares of all outlets on the story: 綠 30%、其他 25%、
 *  藍 50% gives 藍營 +20. The sign names the camp ahead. */
export function leanDelta(c: EventCoverage): { camp: Camp; pct: number; shares: Record<Camp, number> } | null {
  const total = c.camps.blue + c.camps.green + c.camps.other;
  if (!total) return null;
  const share = (k: Camp) => Math.round((c.camps[k] / total) * 100);
  const shares = { blue: share('blue'), green: share('green'), other: share('other') };
  const delta = shares.blue - shares.green;
  return { camp: delta >= 0 ? 'blue' : 'green', pct: Math.abs(delta), shares };
}

export function leanTitle(c: EventCoverage): string | undefined {
  const d = leanDelta(c);
  if (!d) return undefined;
  const order: Camp[] = ['green', 'other', 'blue'];
  return `${order.map((k) => `${CAMP_LABEL[k]} ${d.shares[k]}%`).join('、')}；${CAMP_LABEL[d.camp]}比對方多 ${d.pct} 個百分點`;
}

/** Signed percentage-point gap, coloured by the camp ahead. */
export function LeanText({ c, className = '' }: { c: EventCoverage; className?: string }) {
  const d = leanDelta(c);
  if (!d) return null;
  return (
    <span className={`font-medium tabular-nums ${CAMP_TEXT[d.camp]} ${className}`} title={leanTitle(c)}>
      {CAMP_LABEL[d.camp]} +{d.pct}%
    </span>
  );
}

/** The one badge worth showing, blind spot first since it is the stronger claim. */
export function CampBadge({ c, className = '' }: { c: EventCoverage; className?: string }) {
  const spot = c.blindspot[0];
  if (spot) {
    const n = c.camps[spot];
    return (
      <span
        className={`inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-px text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200 ${className}`}
        title={`${CAMP_LABEL[spot]}媒體幾乎沒報導，${CAMP_LABEL[spot]}讀者看不到這件事`}
      >
        盲點：{CAMP_LABEL[spot]}
        {n === 0 ? '沒有報導' : `只有 ${n} 家`}
      </span>
    );
  }
  if (c.tilt) {
    return (
      <span
        className={`inline-flex rounded px-1.5 py-px text-xs font-medium ${
          c.tilt === 'blue'
            ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200'
            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
        } ${className}`}
        title={leanTitle(c)}
      >
        {CAMP_LABEL[c.tilt]}重點
      </span>
    );
  }
  return null;
}

/** Mini three-segment bar (綠、其他、藍) by outlet count, same order as FullBar. */
export function SplitBar({ c, width = 'w-20' }: { c: EventCoverage; width?: string }) {
  const order: Camp[] = ['green', 'other', 'blue'];
  const total = order.reduce((n, k) => n + c.camps[k], 0);
  if (!total) return null;
  const text = order.map((k) => `${CAMP_LABEL[k]} ${c.camps[k]} 家`).join('、');
  return (
    <span className={`inline-flex h-2 ${width} shrink-0 overflow-hidden rounded-full`} title={text}>
      <span className="sr-only">{text}</span>
      {order
        .filter((k) => c.camps[k] > 0)
        .map((k) => (
          <span key={k} className={CAMP_FILL[k]} style={{ flexGrow: c.camps[k] }} aria-hidden />
        ))}
    </span>
  );
}

/** The card line: the bar, outlet counts per camp in the bar's order, badge. */
export function CampLine({ c, compact = false }: { c: EventCoverage; compact?: boolean }) {
  const order: Camp[] = ['green', 'other', 'blue'];
  if (!order.some((k) => c.camps[k] > 0)) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
      <SplitBar c={c} width={compact ? 'w-14' : 'w-20'} />
      <LeanText c={c} />
      <span className="tabular-nums" title={order.map((k) => `${CAMP_LABEL[k]} ${c.camps[k]} 家`).join('、')}>
        {compact
          ? `${order.reduce((n, k) => n + c.camps[k], 0)} 家`
          : order.map((k, i) => (
              <span key={k}>
                {i > 0 && ' · '}
                <span className={CAMP_TEXT[k]}>
                  {CAMP_LABEL[k]} {c.camps[k]}
                </span>
              </span>
            ))}
        {!compact && ' 家'}
      </span>
      <CampBadge c={c} />
    </span>
  );
}

/** Three segments with labels, as on the home page, for the lead tier. */
export function FullBar({ c }: { c: EventCoverage }) {
  const order: Camp[] = ['green', 'other', 'blue'];
  const total = order.reduce((n, k) => n + c.camps[k], 0);
  if (!total) return null;
  const text = order.map((k) => `${CAMP_LABEL[k]} ${c.camps[k]} 家`).join('、');
  return (
    <div className="flex h-5 w-full overflow-hidden rounded text-[11px] font-medium text-white" title={text}>
      <span className="sr-only">{text}</span>
      {order
        .filter((k) => c.camps[k] > 0)
        .map((k) => (
          <span
            key={k}
            className={`flex items-center justify-center overflow-hidden whitespace-nowrap ${CAMP_FILL[k]}`}
            style={{ flexGrow: c.camps[k] }}
            aria-hidden
          >
            {c.camps[k] / total >= 0.18 && `${CAMP_LABEL[k]} ${Math.round((c.camps[k] / total) * 100)}%`}
          </span>
        ))}
    </div>
  );
}

/** The hour's reference split, shown once above the table. */
export function BaselineBar({ b, label = '過去 24 小時整體' }: { b: CampBaseline; label?: string }) {
  const order: Camp[] = ['green', 'other', 'blue'];
  const total = order.reduce((n, k) => n + b.articles[k], 0);
  if (!total) return null;
  const pct = (k: Camp) => Math.round((b.articles[k] / total) * 100);
  const text = order.map((k) => `${CAMP_LABEL[k]} ${pct(k)}%（${b.outlets[k]} 家、${b.articles[k].toLocaleString()} 篇）`).join('、');
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
      <span>{label}</span>
      <span className="flex h-2.5 w-40 overflow-hidden rounded-full" title={text}>
        <span className="sr-only">{text}</span>
        {order.map((k) => (
          <span key={k} className={CAMP_FILL[k]} style={{ flexGrow: b.articles[k] }} aria-hidden />
        ))}
      </span>
      <span className="tabular-nums" aria-hidden>
        {order.map((k) => (
          <span key={k} className={`${CAMP_TEXT[k]} mr-2`}>
            {CAMP_LABEL[k]} {pct(k)}%
          </span>
        ))}
      </span>
      <span>
        藍綠家數比約 {baselineBlue(b)}：{100 - baselineBlue(b)}，下方每條的白線就是這個位置。
      </span>
    </div>
  );
}

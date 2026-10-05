import { sparklineRuns } from '@/lib/sparkline.mts';

/** Decorative trends need no chart runtime, canvas initialization or hydration. */
export default function Sparkline({
  values,
  color = '#c2410c',
  rank = false,
  dots = rank,
  className = 'h-8 w-24',
}: {
  values: (number | null)[];
  color?: string;
  rank?: boolean;
  /** A dot per sample; on by default for rank trails, off for long ones. A lone sample always gets one. */
  dots?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 96 32" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
      {sparklineRuns(values, rank).map((run) => {
        const points = run.map(([x, y]) => `${x},${y}`).join(' ');
        return (
          <g key={run[0][0]}>
            {!rank && run.length > 1 && <polygon points={`${run[0][0]},30 ${points} ${run.at(-1)![0]},30`} fill={color} opacity="0.12" />}
            <polyline points={points} fill="none" stroke={color} strokeWidth={rank ? 2 : 1.5} vectorEffect="non-scaling-stroke" />
            {(dots || run.length === 1) && run.map(([x, y]) => <circle key={x} cx={x} cy={y} r="2" fill={color} />)}
          </g>
        );
      })}
    </svg>
  );
}

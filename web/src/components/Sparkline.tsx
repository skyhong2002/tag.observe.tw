import { sparklineRuns } from '@/lib/sparkline.mts';

/** Decorative trends need no chart runtime, canvas initialization or hydration. */
export default function Sparkline({
  values,
  color = '#c2410c',
  rank = false,
  className = 'h-8 w-24',
}: {
  values: (number | null)[];
  color?: string;
  rank?: boolean;
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
            {rank && run.map(([x, y]) => <circle key={x} cx={x} cy={y} r="2" fill={color} />)}
          </g>
        );
      })}
    </svg>
  );
}

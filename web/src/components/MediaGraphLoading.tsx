// Decorative placeholders, never actual media or inferred relationships.
const nodes = [
  [100, 170, 28],
  [180, 310, 34],
  [265, 105, 24],
  [310, 240, 48],
  [350, 390, 26],
  [450, 130, 36],
  [480, 305, 58],
  [590, 205, 44],
  [640, 390, 30],
  [720, 110, 26],
  [760, 290, 38],
  [860, 200, 24],
];
const links = [
  [0, 3],
  [1, 3],
  [1, 4],
  [2, 5],
  [3, 5],
  [3, 6],
  [4, 6],
  [5, 7],
  [6, 7],
  [6, 8],
  [7, 9],
  [7, 10],
  [8, 10],
  [9, 11],
  [10, 11],
];

export default function MediaGraphLoading() {
  return (
    <div
      role="status"
      className="relative h-full min-h-0 w-full overflow-hidden bg-gradient-to-b from-zinc-50/60 to-white dark:from-zinc-900 dark:to-zinc-950"
      data-testid="media-graph-loading"
    >
      <svg
        viewBox="0 0 960 500"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-zinc-200 motion-safe:animate-pulse dark:text-zinc-800"
      >
        {links.map(([a, b], i) => (
          <line
            key={`${a}-${b}`}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            stroke="currentColor"
            strokeWidth={i % 3 === 0 ? 2 : 1}
            strokeDasharray={i % 3 === 0 ? '5 6' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {nodes.map(([x, y, size], i) => (
          <g key={`${x}-${y}`}>
            <rect
              x={x - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              rx={size / 4}
              fill="currentColor"
              className={
                i === 3 || i === 7 ? 'text-orange-100 dark:text-orange-950' : i === 6 ? 'text-violet-100 dark:text-violet-950' : ''
              }
            />
            <rect x={x - size / 2} y={y + size / 2 + 10} width={size} height="4" rx="2" fill="currentColor" />
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center p-5">
        <div className="max-w-full rounded-2xl border border-zinc-200/70 bg-white/90 px-6 py-5 text-center shadow-sm backdrop-blur-sm dark:border-zinc-700/60 dark:bg-zinc-900/90">
          <div
            aria-hidden="true"
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400"
          >
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="m7 8 9 2M7 8l4 10m5-8-5 8" />
              <circle cx="7" cy="8" r="3" fill="currentColor" stroke="none" />
              <circle cx="17" cy="10" r="2.5" fill="currentColor" stroke="none" />
              <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">正在整理媒體關係</p>
          <p className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">準備媒體圖示與新聞連線</p>
          <div aria-hidden="true" className="mt-3 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 rounded-full bg-orange-400 motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// The liveboard's settings (/liveboard/setting/): which board to show and how
// the simple one turns. A signed-in reader keeps them in /auth/me/prefs under
// `liveboard` (app/src/reader/validate.ts); everyone keeps a copy in
// localStorage, so a wall tablet opens on its own board without signing in.
// Query parameters override both for one visit: ?mode=simple (or the older
// ?simple=1), ?lens=growth,blue, ?pictures=0, ?history=3, ?interval=6, ?step=5, ?hold=10, ?words=48, ?scale=80, ?change=rank.
// A lens is a keyword cloud, the top events, or a leaderboard of the day's
// topics (/api/v1/liveboard/scenes); each is one of SimpleBoard's scenes.
// Plain data, so the server page can read it too.

interface LensBase {
  key: string;
  title: string;
  note: string;
  /** Every word of the lens takes this colour (pictures keep their own)… */
  accent: string;
  /** …or this lighter one on the dark theme. */
  dark: string;
}
/** A keyword cloud: a tag ranking, played from its past hours to now. */
export interface CloudLens extends LensBase {
  scene: 'cloud';
  category: string;
  order: 'growth' | 'burst' | 'score';
}
/** The top events, one at a time: score against the previous hour, and the last hour's articles. */
export interface EventLens extends LensBase {
  scene: 'events';
}
/** Which of /api/v1/liveboard/scenes' leaderboards a board lens shows. */
export type BoardKey = 'media' | 'threads' | 'categories' | 'groups';
/** A leaderboard of the day's topics: articles over the last 24 hours, in the last hour, and the change from the hour before. */
export interface BoardLens extends LensBase {
  scene: 'board';
  board: BoardKey;
}
export type Lens = CloudLens | EventLens | BoardLens;
const cloud = (lens: Omit<CloudLens, 'scene'>): CloudLens => ({ scene: 'cloud', ...lens });
export const LENSES: Lens[] = [
  // All outlets together, in plain ink (white on the dark theme).
  cloud({ key: 'all', title: '綜合', note: '所有媒體最常寫的關鍵字', category: 'all', order: 'score', accent: '#27272a', dark: '#f4f4f5' }),
  cloud({
    key: 'growth',
    title: '正在發酵',
    note: '升溫最快的關鍵字',
    category: 'all',
    order: 'growth',
    accent: '#c2410c',
    dark: '#fb923c',
  }),
  cloud({
    key: 'blue',
    title: '藍營媒體在講',
    note: '藍營傾向媒體的關鍵字',
    category: 'blue',
    order: 'score',
    accent: '#1d4ed8',
    dark: '#60a5fa',
  }),
  cloud({
    key: 'day',
    title: '新聞熱詞',
    note: '新聞媒體最常寫的關鍵字',
    category: 'news',
    order: 'score',
    accent: '#c2410c',
    dark: '#fb923c',
  }),
  cloud({
    key: 'green',
    title: '綠營媒體在講',
    note: '綠營傾向媒體的關鍵字',
    category: 'green',
    order: 'score',
    accent: '#15803d',
    dark: '#4ade80',
  }),
  cloud({
    key: 'burst',
    title: '突然爆量',
    note: '突然被大量報導的關鍵字',
    category: 'all',
    order: 'burst',
    accent: '#c2410c',
    dark: '#fb923c',
  }),
  cloud({
    key: 'alt',
    title: '非主流媒體在講',
    note: '非主流媒體的關鍵字',
    category: 'alt',
    order: 'score',
    accent: '#7e22ce',
    dark: '#c084fc',
  }),
  cloud({
    key: 'tech',
    title: '科技圈在講',
    note: '科技與 3C 媒體的關鍵字',
    category: '3c',
    order: 'score',
    accent: '#0e7490',
    dark: '#22d3ee',
  }),
  cloud({
    key: 'finance',
    title: '財經圈在講',
    note: '財經媒體的關鍵字',
    category: 'finance',
    order: 'score',
    accent: '#a16207',
    dark: '#fbbf24',
  }),
  { key: 'events', scene: 'events', title: '事件', note: '比上一小時的分數，與這一小時的新報導', accent: '#b91c1c', dark: '#f87171' },
  {
    key: 'threads',
    scene: 'board',
    board: 'threads',
    title: '事件串',
    note: '24 小時內有新報導的跨媒體事件',
    accent: '#be123c',
    dark: '#fb7185',
  },
  {
    key: 'media',
    scene: 'board',
    board: 'media',
    title: '媒體議題',
    note: '各家媒體自己的議題與專題',
    accent: '#0f766e',
    dark: '#2dd4bf',
  },
  {
    key: 'categories',
    scene: 'board',
    board: 'categories',
    title: '分類',
    note: '政治、生活、國際等分類的報導量',
    accent: '#4d7c0f',
    dark: '#a3e635',
  },
  {
    key: 'groups',
    scene: 'board',
    board: 'groups',
    title: '人物與政黨',
    note: '政黨、政治人物等群組的報導量',
    accent: '#be185d',
    dark: '#f472b6',
  },
];

export interface LiveboardSettings {
  mode: 'full' | 'simple';
  /** Lens keys, in the order the simple board shows them. */
  lenses: string[];
  /** Draw tags that have one as their picture (faces, flags, logos). */
  pictures: boolean;
  /** Steps the simple board starts back, playing each forward to now (0 shows only now)… */
  history: number;
  /** …each this many hours apart (one of INTERVALS). */
  interval: number;
  /** Seconds each past hour stays once its animation is over. */
  step: number;
  /** Seconds the present stays, once its animation is over, before the next lens. */
  hold: number;
  /** Most keywords in the cloud. */
  words: number;
  /** Size of everything on the simple board, in percent: smaller fits more on a screen that cannot zoom. */
  scale: number;
  /** A badge beside each word with its change since the previous step: its place (▲3), its score (+12%), or none. */
  change: 'off' | 'rank' | 'value';
}
/** What a device that has never saved settings shows: the last day in 6-hour steps, with each word's change in place. */
export const DEFAULTS: LiveboardSettings = {
  mode: 'simple',
  lenses: [
    'all',
    'events',
    'day',
    'growth',
    'threads',
    'blue',
    'green',
    'media',
    'burst',
    'categories',
    'alt',
    'groups',
    'tech',
    'finance',
  ],
  pictures: true,
  history: 4,
  interval: 6,
  step: 4,
  hold: 12,
  words: 32,
  scale: 100,
  change: 'rank',
};
/** Hours between steps: back as far as 8 days. */
export const INTERVALS = [1, 2, 3, 6, 12, 24] as const;
export const LIMITS = { history: [0, 8], step: [3, 30], hold: [5, 120], words: [12, 80], scale: [60, 160] } as const;

const int = (value: unknown, [min, max]: readonly [number, number], fallback: number) => {
  const n = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const lensKeys = (value: unknown) =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).filter(
    (key, i, all): key is string => typeof key === 'string' && LENSES.some((l) => l.key === key) && all.indexOf(key) === i,
  );

/** Any stored or sent value, made whole: unknown keys and lenses are dropped, numbers clamped. */
export function normalizeSettings(raw: unknown, base: LiveboardSettings = DEFAULTS): LiveboardSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const lenses = 'lenses' in r ? lensKeys(r.lenses) : base.lenses;
  return {
    mode: r.mode === 'simple' || r.mode === 'full' ? r.mode : base.mode,
    lenses: lenses.length ? lenses : base.lenses,
    pictures: typeof r.pictures === 'boolean' ? r.pictures : base.pictures,
    history: int(r.history, LIMITS.history, base.history),
    interval: INTERVALS.includes(Number(r.interval) as (typeof INTERVALS)[number]) ? Number(r.interval) : base.interval,
    step: int(r.step, LIMITS.step, base.step),
    hold: int(r.hold, LIMITS.hold, base.hold),
    words: int(r.words, LIMITS.words, base.words),
    scale: int(r.scale, LIMITS.scale, base.scale),
    change: r.change === 'off' || r.change === 'rank' || r.change === 'value' ? r.change : base.change,
  };
}

/** The settings a query string asks for, over `base`; `mode` is only set when the query names one. */
export function settingsFromQuery(query: Record<string, string | undefined>, base: LiveboardSettings): LiveboardSettings {
  const mode = query.mode === 'simple' || query.simple === '1' ? 'simple' : query.mode === 'full' ? 'full' : undefined;
  return normalizeSettings(
    {
      ...(mode ? { mode } : {}),
      ...(query.lens ? { lenses: query.lens } : {}),
      ...(query.pictures === '0' || query.pictures === '1' ? { pictures: query.pictures === '1' } : {}),
      history: query.history,
      interval: query.interval,
      step: query.step,
      hold: query.hold,
      words: query.words,
      scale: query.scale,
      ...(query.change ? { change: query.change } : {}),
    },
    base,
  );
}
/** The query that shows a board with these settings without saving them (the settings page's 預覽). */
export function settingsQuery(s: LiveboardSettings) {
  const query = new URLSearchParams({ mode: s.mode });
  if (s.mode === 'simple') {
    query.set('lens', s.lenses.join(','));
    query.set('pictures', s.pictures ? '1' : '0');
    for (const key of ['history', 'interval', 'step', 'hold', 'words', 'scale'] as const) query.set(key, String(s[key]));
    query.set('change', s.change);
  }
  return query.toString();
}
export const QUERY_KEYS = ['mode', 'simple', 'lens', 'pictures', 'history', 'interval', 'step', 'hold', 'words', 'scale', 'change'];

export const pickLenses = (keys: string[]) => keys.map((key) => LENSES.find((l) => l.key === key)).filter((l) => l !== undefined);
/** The first keyword cloud of these lenses (the page fetches its present ranking with the page). */
export const firstCloud = (keys: string[]) =>
  pickLenses(keys).find((l): l is CloudLens => l.scene === 'cloud') ?? (LENSES.find((l) => l.scene === 'cloud') as CloudLens);

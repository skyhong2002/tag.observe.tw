// The 藍綠對照 lens (SimpleBoard): two camps' keyword rankings on one
// spectrum. Each word sits left or right by how much more one camp writes it
// than the other (share of voice, on a log scale), and its colour drifts from
// green through the ink between to blue the same way. Plain functions, so
// they can be tested.

export interface Term {
  tag: string;
  /** Its score, for its size. */
  weight: number;
  /** Its articles in the ranking's window, for the camps' share of voice. */
  count?: number;
}
/** A word on the spectrum: its size, and where it sits (0 green's, ½ even, 1 blue's). */
export interface Spread extends Term {
  blue: number;
}

/** A camp writing a word this many times (as a share of all it wrote) as the other reaches the edge. */
export const EDGE_RATIO = 4;

/**
 * The words of both camps' top `top`, each placed by share of voice: its
 * articles as a share of all the camp's ranked articles, so the busier camp
 * does not pull everything its way. A word one camp did not rank counts half
 * that camp's smallest. Its place is the log ratio of the two shares, even in
 * the middle and EDGE_RATIO either way at the edges (beyond, at the edge), as
 * the events page leans its camps; its size the larger of its two scores.
 * The `words` heaviest.
 */
export function spreadCamps(green: readonly Term[], blue: readonly Term[], words: number, top = 40): Spread[] {
  const voice = (terms: readonly Term[]) => {
    const total = terms.reduce((n, t) => n + (t.count ?? 0), 0) || 1;
    const least = Math.min(...terms.map((t) => t.count ?? 0).filter((n) => n > 0), 1);
    return { of: new Map(terms.map((t) => [t.tag, (t.count ?? 0) / total])), missing: least / 2 / total };
  };
  const g = voice(green);
  const b = voice(blue);
  const weight = new Map<string, number>();
  for (const t of [...green, ...blue]) weight.set(t.tag, Math.max(weight.get(t.tag) ?? 0, t.weight));
  const edge = Math.log2(EDGE_RATIO);
  const tags = new Set([...green.slice(0, top), ...blue.slice(0, top)].map((t) => t.tag));
  return [...tags]
    .map((tag) => {
      const lean = Math.log2((b.of.get(tag) || b.missing) / (g.of.get(tag) || g.missing));
      return { tag, weight: weight.get(tag) ?? 0, blue: (Math.max(-edge, Math.min(edge, lean)) + edge) / (2 * edge) };
    })
    .sort((x, y) => y.weight - x.weight || x.tag.localeCompare(y.tag))
    .slice(0, words);
}

/** Where a word with this blue share is centred across a canvas `width` wide, `pad` in from each edge. */
export const spreadX = (blue: number, width: number, pad: number) => pad + blue * (width - 2 * pad);

const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
/** `a` to `b`, `t` of the way. */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x
    .map((v, i) =>
      Math.round(v + (y[i] - v) * Math.min(1, Math.max(0, t)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
/** A diverging colour: green at 0, the neutral ink at ½, blue at 1 (never a mid-hue between the two). */
export const campColour = (blue: number, green: string, ink: string, blueHex: string) =>
  blue < 0.5 ? mixHex(green, ink, blue * 2) : mixHex(ink, blueHex, (blue - 0.5) * 2);

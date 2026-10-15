// The 藍綠對照 lens (SimpleBoard): two camps' keyword rankings side by side,
// split three ways so each camp's own words stand apart from the ones both
// write about. Plain functions, so the split can be tested.

export interface Term {
  tag: string;
  weight: number;
}
export type Panel = 'left' | 'middle' | 'right';
export type Panels = Record<Panel, Term[]>;
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Each camp's `top` words, split: those only the left camp has among them,
 * those both have (sized by the larger of the two weights), and those only
 * the right camp has; at most `per` in each, strongest first.
 */
export function splitCamps(left: readonly Term[], right: readonly Term[], per: number, top = 40): Panels {
  const l = left.slice(0, top);
  const r = right.slice(0, top);
  const inLeft = new Map(l.map((t) => [t.tag, t.weight]));
  const inRight = new Map(r.map((t) => [t.tag, t.weight]));
  const middle = l
    .filter((t) => inRight.has(t.tag))
    .map((t) => ({ tag: t.tag, weight: Math.max(t.weight, inRight.get(t.tag) ?? 0) }))
    .sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
  return {
    left: l.filter((t) => !inRight.has(t.tag)).slice(0, per),
    middle: middle.slice(0, per),
    right: r.filter((t) => !inLeft.has(t.tag)).slice(0, per),
  };
}

/**
 * Where the three clouds go under a band `top` high, each with a `label`
 * line above it: side by side on a wide canvas, stacked on a tall one, `gap`
 * apart.
 */
export function panelRects(width: number, height: number, top: number, label: number, gap: number): Record<Panel, Rect> {
  const order: Panel[] = ['left', 'middle', 'right'];
  const out = {} as Record<Panel, Rect>;
  if (height > width * 1.1) {
    const each = (height - top - 2 * gap) / 3;
    order.forEach((p, i) => {
      out[p] = { x: 0, y: top + i * (each + gap) + label, width, height: Math.max(0, each - label) };
    });
  } else {
    const each = (width - 2 * gap) / 3;
    order.forEach((p, i) => {
      out[p] = { x: i * (each + gap), y: top + label, width: each, height: Math.max(0, height - top - label) };
    });
  }
  return out;
}

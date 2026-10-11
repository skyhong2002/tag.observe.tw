import { createRequire } from 'node:module';

// Lucide line icons (ISC), vendored by tools/gen-lucide-icons.ts, and the
// check that a string is one emoji (docs/tag-visuals.md).

const require = createRequire(import.meta.url);
type IconSet = { source: string; license: string; icons: Record<string, { tags: string[]; body: string }> };
let set: IconSet | null = null;
const icons = () => (set ??= require('./lucide-icons.json') as IconSet).icons;

export const iconNames = () => Object.keys(icons());
export const isIcon = (name: string) => Object.hasOwn(icons(), name);

/** The icon as a stand-alone SVG drawn in `currentColor`, for a CSS mask or an <img>. */
export function iconSvg(name: string, colour = 'currentColor') {
  const icon = icons()[name];
  if (!icon) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icon.body}</svg>`;
}

/** Icons whose name or tags contain every word of `q` (English), names first. */
export function searchIcons(q: string, limit = 60) {
  const words = q
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!words.length) return [];
  const all = Object.entries(icons());
  const inName = all.filter(([n]) => words.every((w) => n.includes(w)));
  const inTags = all.filter(
    ([n, i]) => !inName.some(([m]) => m === n) && words.every((w) => n.includes(w) || i.tags.some((t) => t.includes(w))),
  );
  return [...inName, ...inTags].slice(0, limit).map(([n]) => n);
}

// One emoji: a pictograph or a flag, with joiners, variation selectors and skin tones.
const EMOJI =
  /^(?:\p{Regional_Indicator}{2}|[\p{Extended_Pictographic}\p{Emoji_Presentation}](?:[\u{FE0F}\u{20E3}\p{Emoji_Modifier}]|\u{200D}[\p{Extended_Pictographic}\p{Emoji_Presentation}])*[\u{FE0F}]?)$/u;
export const isEmoji = (s: string) => s.length <= 16 && EMOJI.test(s);

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync(new URL('../src/app/_home/home.module.css', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const palette = readFileSync(new URL('../node_modules/tailwindcss/theme.css', import.meta.url), 'utf8');

// Compute relative luminance from the installed palette rather than copied hex approximations.
function luminance(token: string) {
  const match = palette.match(new RegExp(`--color-${token}: oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\)`));
  if (!match) throw new Error(`Missing palette token: ${token}`);
  const L = Number(match[1]) / 100;
  const angle = (Number(match[3]) * Math.PI) / 180;
  const a = Number(match[2]) * Math.cos(angle);
  const b = Number(match[2]) * Math.sin(angle);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

it('keeps small ranking movement labels readable on dark panels and hover tint', () => {
  expect(globals).toContain('--color-brand-950: var(--color-orange-950);');
  for (const [selector, token] of [
    ['rankNew', 'red-400'],
    ['rankUp', 'emerald-400'],
  ]) {
    expect(css).toContain(`:global([data-theme="dark"]) .${selector} { color: var(--color-${token}); }`);
    // The hover tint is translucent brand-950 on zinc-900; test both backing colours.
    for (const background of ['zinc-900', 'orange-950']) {
      const ratio = (luminance(token) + 0.05) / (luminance(background) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  }
});

it('gives standalone homepage controls an explicit hit area in normal and retry states', () => {
  const controls = css.match(/\/\* Standalone controls[\s\S]*?\n}/)?.[0] ?? '';
  for (const selector of [
    '.sectionHeading > a',
    '.heroFoot > a',
    '.legend > a',
    '.campShareLinks > a',
    '.campShareStatus button',
    '.rankingRetry',
    '.empty > a',
  ]) {
    expect(controls).toContain(selector);
  }
  expect(controls).toMatch(/min-width: 44px/);
  expect(controls).toMatch(/min-height: 44px/);
  expect(css).toMatch(/\.mastheadCloudLink \{[^}]*min-width: 24px; min-height: 24px/);
});

it('keeps short standalone title links at least 24px without replacing their line clamp', () => {
  for (const selector of ['.gapGroup li > a', '.pairNames > a', '.topicBody h3 > a']) {
    const rule = css.split(`${selector} {`).at(-1)?.split('}')[0] ?? '';
    expect(rule).toContain('min-width: 24px');
    expect(rule).toContain('min-height: 24px');
  }
  expect(css).toMatch(/\.gapGroup li > a \{[^}]*display: -webkit-box;[^}]*-webkit-line-clamp: 2/);
  expect(css).toMatch(/\.topicBody h3 > a \{[^}]*display: -webkit-box;[^}]*-webkit-line-clamp: 2/);
});

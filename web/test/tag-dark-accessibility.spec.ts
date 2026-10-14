import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const palette = read('../node_modules/tailwindcss/theme.css');
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

it('uses AA text tokens against dark trend, event/status panels and related-tag chips', () => {
  for (const foreground of ['zinc-300', 'zinc-400']) {
    for (const background of ['zinc-950', 'zinc-900', 'zinc-800']) {
      expect((luminance(foreground) + 0.05) / (luminance(background) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  }
  for (const source of ['../src/components/EventCard.tsx', '../src/components/EventDayView.tsx', '../src/components/PeriodEvents.tsx', '../src/components/EventOverview.tsx', '../src/components/article/ArticleTags.tsx', '../src/app/(site)/group/page.tsx', '../src/app/(site)/group/[id]/page.tsx', '../src/app/(site)/event/page.tsx']) {
    expect(read(source).match(/text-zinc-500(?! dark:text-zinc-400)/g)).toBeNull();
  }
  const css = read('../src/app/globals.css');
  expect(css).toMatch(/\[data-theme="dark"\] \.table-stack td\[data-label\]::before \{\s*color: var\(--color-zinc-400\)/);
  const status = read('../src/components/TagStatusPanel.tsx');
  const evidence = read('../src/components/DraftEvidence.tsx');
  // Every secondary label must have a readable dark override, including counts on zinc-800 chips.
  expect(status.match(/text-zinc-500(?! dark:text-zinc-400)/g)).toBeNull();
  expect(status).toContain('text-zinc-600 dark:text-zinc-300');
  expect(evidence).toContain('text-zinc-500 dark:text-zinc-400');
  expect(read('../src/app/(site)/tag/[tag]/page.tsx')).toContain('text-sm font-medium text-zinc-600 dark:text-zinc-300');
});

it('applies CSS theme colour to legend, inactive legend, axes and names; updates after theme changes', () => {
  const css = read('../src/app/globals.css');
  const chart = read('../src/components/TagChartCanvas.tsx');
  expect(css).toMatch(/\.tag-trend-chart \{[^}]*--tag-chart-label: var\(--color-zinc-600\);[^}]*color: var\(--tag-chart-label\)/);
  expect(css).toMatch(/\[data-theme="dark"\] \.tag-trend-chart \{[^}]*--tag-chart-label: var\(--color-zinc-300\)/);
  expect(chart).toContain('className="tag-trend-chart h-80 w-full"');
  expect(chart).toContain('getComputedStyle(ref.current).color');
  expect(chart).toContain('legend: { textStyle: { color }, inactiveColor: color, pageTextStyle: { color } }');
  expect(chart).toContain('xAxis: { axisLabel: { color }, nameTextStyle: { color } }');
  expect(chart).toContain('yAxis: [0, 1, 2].map(() => ({ axisLabel: { color }, nameTextStyle: { color } }))');
  expect(chart).toContain("attributeFilter: ['data-theme']");
  expect(chart).toContain('return () => themeObserver.disconnect()');
  expect(chart).toContain('tabular-nums text-zinc-500 dark:text-zinc-400');
});

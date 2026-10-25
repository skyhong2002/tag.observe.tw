import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import config from '../next.config.ts';
import { homeImageSizes } from '../src/lib/home-images.mts';

const requireWeb = createRequire(new URL('../package.json', import.meta.url));
const React = requireWeb('react');
const { renderToStaticMarkup } = requireWeb('react-dom/server');
const { getImgProps } = requireWeb('next/dist/shared/lib/get-img-props');
const { imageConfigDefault } = requireWeb('next/dist/shared/lib/image-config');
const defaultLoader = requireWeb('next/dist/shared/lib/image-loader').default;
const imageProps = (props: Record<string, unknown>) =>
  getImgProps(props, {
    imgConf: { ...imageConfigDefault, ...config.images },
    defaultLoader,
  }).props;

function imageComponent() {
  const code = ts.transpileModule(readFileSync(new URL('../src/app/_home/NewsImage.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const imports: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': requireWeb('react/jsx-runtime'),
    '@/components/SafeImage': { default: (props: Record<string, unknown>) => React.createElement('img', imageProps(props)) },
    '@/lib/home-images.mts': { homeImageSizes },
    './home.module.css': { default: { picture: 'picture', pictureFallback: 'fallback', pictureMark: 'mark', photo: 'photo' } },
  };
  const exports: { default?: unknown } = {};
  runInNewContext(code, {
    exports,
    require: (key: string) => {
      if (!(key in imports)) throw Error(`Unexpected import ${key}`);
      return imports[key];
    },
  });
  return exports.default;
}
const NewsImage = imageComponent();

// Resolve our supported sizes syntax only; actual browser layout remains a
// candidate check. Compare declared widths with the current CSS grid arithmetic.
function declaredWidth(sizes: string, viewport: number) {
  for (const part of sizes.split(', ')) {
    const match = part.match(/^(?:\(max-width: (\d+)px\) )?(.*)$/)!;
    if (match[1] && viewport > Number(match[1])) continue;
    const calc = match[2].match(/^calc\(([\d.]+)vw - ([\d.]+)px\)$/);
    return calc ? (viewport * Number(calc[1])) / 100 - Number(calc[2]) : Number.parseFloat(match[2]);
  }
  throw Error('No image size');
}
const centerWidth = (viewport: number) =>
  viewport <= 640
    ? viewport - 32
    : viewport <= 1000
      ? Math.min(((viewport - 52) * 1.9) / 2.9, viewport - 272)
      : ((Math.min(viewport, 1152) - 72) * 2) / 3.85;

describe('home image delivery (offline SSR, not visual quality)', () => {
  it.each([320, 390, 412, 640, 641, 690, 768, 1000, 1001, 1152, 1280])('matches CSS slots within one pixel at %i', (viewport) => {
    const center = centerWidth(viewport);
    const slots = { hero: center - 2, story: (center - (viewport <= 640 ? 30 : 34)) * (viewport <= 640 ? 0.28 : 0.27), topic: 72 };
    for (const kind of ['hero', 'story', 'topic'] as const) {
      expect(Math.abs(declaredWidth(homeImageSizes[kind], viewport) - slots[kind])).toBeLessThan(1);
    }
  });
  it('keeps the LCP image discoverable in SSR and eager/high without duplicate preload flags', () => {
    const html = renderToStaticMarkup(React.createElement(NewsImage, { src: 'https://example.test/hero.jpg', priority: true }));
    expect(html).toContain('<img');
    expect(html).toContain('fetchPriority="high"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('q=75');
    expect(html).toContain('sizes="(max-width: 640px) calc(100vw - 34px)');
  });
  it.each(['story', 'topic'])('uses lazy/low WebP-capable optimization and quality65 for %s', (variant) => {
    const html = renderToStaticMarkup(React.createElement(NewsImage, { src: 'https://example.test/thumb.jpg', variant }));
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('fetchPriority="low"');
    expect(html).toContain('q=65');
    if (variant === 'topic') expect(html).toContain('sizes="72px"');
    expect(config.images?.formats).toEqual(['image/webp']);
    expect(config.images?.qualities).toEqual([65, 75]);
  });
  it('offers a 192px source for a 390px-wide phone at 2x, preserving high-DPR resolution', () => {
    const props = imageProps({ src: 'https://example.test/thumb.jpg', alt: '', fill: true, sizes: homeImageSizes.story, quality: 65 });
    const widths = [...props.srcSet.matchAll(/ (\d+)w/g)].map((match: RegExpMatchArray) => Number(match[1]));
    const required = declaredWidth(homeImageSizes.story, 390) * 2;
    expect(widths.find((width: number) => width >= required)).toBe(192);
    expect(widths).toContain(384); // higher DPR is still allowed
  });
  it('retains the non-network fallback for missing artwork', () => {
    const html = renderToStaticMarkup(React.createElement(NewsImage, { src: null }));
    expect(html).toContain('class="fallback"');
    expect(html).not.toContain('<img');
  });
});

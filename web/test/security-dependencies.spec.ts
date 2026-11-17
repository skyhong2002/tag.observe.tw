import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const version = (name: string): number[] => lock.packages[`node_modules/${name}`].version.split('.').map(Number);
const atLeast = (actual: number[], floor: number[]) => {
  for (let i = 0; i < floor.length; i++) if (actual[i] !== floor[i]) return actual[i] > floor[i];
  return true;
};

// Next <= 16.4.0 ships an Image Optimization API that can reach remote code
// execution through SVG input on glibc Linux (GHSA-2464-fhr4-w9xw); 16.4.1
// also requires the patched sharp 0.35.5. This server optimizes images from
// any host, so the web lockfile must never fall back below either floor.
// Next 16.3.0–16.4.4 also leak root params across 'use cache' calls made
// through unstable_cache(), and `next build` refuses to run on them; 16.4.6
// is the current patched release.
it.each([
  ['next', [16, 4, 6]],
  ['@next/third-parties', [16, 4, 6]],
  ['sharp', [0, 35, 5]],
])('locks %s at a patched version', (name, floor) => {
  expect(atLeast(version(name), floor), `${name} ${version(name).join('.')}`).toBe(true);
});

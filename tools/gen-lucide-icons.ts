import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Vendors the Lucide icon set (ISC) as one compact JSON for tag visuals
// (docs/tag-visuals.md): name → English tags and the SVG body. The package
// itself is 66 MB, so it stays a dev dependency.
//   node tools/gen-lucide-icons.ts
const require = createRequire(import.meta.url);
const dir = require.resolve('lucide-static/package.json').replace(/package\.json$/, '');
const { version, license } = JSON.parse(readFileSync(`${dir}package.json`, 'utf8'));
const nodes: Record<string, [string, Record<string, string>][]> = JSON.parse(readFileSync(`${dir}icon-nodes.json`, 'utf8'));
const tags: Record<string, string[]> = JSON.parse(readFileSync(`${dir}tags.json`, 'utf8'));
const attr = (a: Record<string, string>) =>
  Object.entries(a)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
const icons = Object.fromEntries(
  Object.keys(nodes)
    .sort()
    .map((name) => [name, { tags: tags[name] ?? [], body: nodes[name].map(([el, a]) => `<${el}${attr(a)}/>`).join('') }]),
);
const out = {
  source: `lucide-static ${version}`,
  license: `${license}: ${readFileSync(`${dir}LICENSE`, 'utf8').trim()}`,
  icons,
};
writeFileSync('app/src/tag-visuals/lucide-icons.json', `${JSON.stringify(out)}\n`);
console.log(`${Object.keys(icons).length} icons from lucide-static ${version}`);

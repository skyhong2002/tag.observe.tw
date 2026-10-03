/** Inspired by skyhong2002/infovore's src/output/cloud.ts:
 * square-root size scaling, centre-out spiral packing, then smaller retries.
 * News weights count distinct articles rather than personal attention time.
 */
export interface CloudTerm {
  label: string;
  count: number;
}
export interface PlacedWord extends CloudTerm {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

const widthOf = (label: string, size: number) =>
  Array.from(label).reduce(
    (n, char) => n + (/[^\u0000-\u00ff]/.test(char) ? 1 : /[ilI.,: ]/.test(char) ? 0.35 : /[MW@]/.test(char) ? 0.95 : 0.66),
    0,
  ) *
    size +
  4;
export function layoutWordCloud(terms: CloudTerm[], width = 300, height = 230): PlacedWord[] {
  if (width < 40 || height < 30) return [];
  const unique = new Map<string, CloudTerm>();
  for (const term of terms) {
    const label = term.label.trim();
    if (label && Number.isFinite(term.count) && term.count > 0 && !unique.has(label)) unique.set(label, { label, count: term.count });
  }
  const sorted = [...unique.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-TW')).slice(0, 50);
  const max = sorted[0]?.count ?? 1;
  const naturalSize = (count: number) => 12 + 17 * Math.sqrt(count / max);
  const requestedArea = sorted.reduce((sum, term) => {
    const size = naturalSize(term.count);
    return sum + widthOf(term.label, size) * size * 1.6;
  }, 0);
  const scale = Math.max(0.5, Math.min(1, Math.sqrt((width * height * 0.55) / Math.max(1, requestedArea))));
  const placed: PlacedWord[] = [];
  for (const term of sorted) {
    let done = false;
    const natural = Math.max(11, Math.round(naturalSize(term.count) * scale));
    for (let fontSize = natural; fontSize >= 11 && !done; fontSize--) {
      // CJK ascent/descent can exceed the nominal em box in system fonts.
      const w = widthOf(term.label, fontSize),
        h = fontSize * 1.6;
      if (w > width - 8 || h > height - 8) continue;
      for (let step = 0; step < 2600; step++) {
        const angle = step * 0.17,
          radius = angle * 0.75;
        const x = Math.round(width / 2 + Math.cos(angle) * radius - w / 2);
        const y = Math.round(height / 2 + (Math.sin(angle) * radius * height) / width - h / 2);
        if (x < 4 || y < 4 || x + w > width - 4 || y + h > height - 4) continue;
        if (placed.some((p) => x < p.x + p.width + 3 && x + w + 3 > p.x && y < p.y + p.height + 3 && y + h + 3 > p.y)) continue;
        placed.push({ ...term, x, y, width: w, height: h, fontSize });
        done = true;
        break;
      }
    }
  }
  return placed;
}

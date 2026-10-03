// Candidate search for the full similarity index. MinHash estimates the
// Jaccard overlap of two shingle sets from a fixed 128-value sketch, and LSH
// banding (64 bands of 2 values) turns "probably similar" into a hash lookup,
// so a new article is compared with every article within the window without
// building an inverted index of every shingle.
//
// Dice 0.5, the lowest selectable threshold, is Jaccard 1/3. A pair at that
// overlap shares at least one band with probability 1 − (1 − (1/3)²)⁶⁴ ≈ 99.95%;
// at the default 0.65 (Jaccard ≈ 0.48) misses are below one in 10⁶. Candidates
// are then scored exactly with body-shingle-v1 on the stored bodies, so the
// sketch only decides which pairs get compared, never the published score.
export const SKETCH = 128;
export const BANDS = 64;
const ROWS = SKETCH / BANDS;
export const SKETCH_BYTES = SKETCH * 4;
// Two standard errors below Jaccard 1/3 at 128 values, so borderline pairs
// still reach the exact comparison.
export const MIN_ESTIMATE = 0.2;

function fmix32(h: number) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
// Fixed seeds: sketches are stored, so they must not change between runs.
const SEEDS = (() => {
  const seeds = new Uint32Array(SKETCH);
  let state = 0x2545f491;
  for (let i = 0; i < SKETCH; i++) {
    state = (state + 0x9e3779b9) >>> 0;
    seeds[i] = fmix32(state);
  }
  return seeds;
})();

/** Distinct 32-bit hashes of the 5-character shingles of normalized text. */
export function shingleHashes(text: string): Uint32Array {
  const seen = new Set<number>();
  for (let i = 0; i <= text.length - 5; i++) {
    let h = 0x811c9dc5;
    for (let k = i; k < i + 5; k++) h = Math.imul(h ^ text.charCodeAt(k), 0x01000193);
    seen.add(h >>> 0);
  }
  return Uint32Array.from(seen);
}

export function minhash(hashes: Uint32Array): Uint32Array {
  const sketch = new Uint32Array(SKETCH).fill(0xffffffff);
  for (const h of hashes)
    for (let i = 0; i < SKETCH; i++) {
      const v = fmix32(h ^ SEEDS[i]);
      if (v < sketch[i]) sketch[i] = v;
    }
  return sketch;
}

export function bandKey(sketch: Uint32Array, band: number): number {
  let h = Math.imul(band + 1, 0x9e3779b1);
  for (let r = 0; r < ROWS; r++) h = Math.imul(h ^ sketch[band * ROWS + r], 0x01000193);
  return fmix32(h);
}

/** Estimated Jaccard similarity of the two sets the sketches came from. */
export function estimate(a: Uint32Array, b: Uint32Array): number {
  let same = 0;
  for (let i = 0; i < SKETCH; i++) if (a[i] === b[i]) same++;
  return same / SKETCH;
}

export function sketchToBuffer(sketch: Uint32Array): Buffer {
  const buffer = Buffer.alloc(SKETCH_BYTES);
  for (let i = 0; i < SKETCH; i++) buffer.writeUInt32LE(sketch[i], i * 4);
  return buffer;
}
export function sketchFromBuffer(buffer: Uint8Array): Uint32Array {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const sketch = new Uint32Array(SKETCH);
  for (let i = 0; i < SKETCH; i++) sketch[i] = view.getUint32(i * 4, true);
  return sketch;
}

export interface SketchedArticle {
  id: number;
  media: string;
  publishedAt: number;
  sketch: Uint32Array;
}

/**
 * Pairs worth an exact comparison: each `batch` article against every
 * `indexed` article and every earlier batch article, from other media and
 * published within `windowMs` of each other. Together with earlier runs this
 * visits every pair in the window exactly once.
 */
export function findCandidates(batch: SketchedArticle[], indexed: Iterable<SketchedArticle>, windowMs: number) {
  const buckets = new Map<number, number | number[]>();
  const add = (key: number, i: number) => {
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, i);
    else if (typeof bucket === 'number') buckets.set(key, [bucket, i]);
    else bucket.push(i);
  };
  const candidates: Array<{ a: SketchedArticle; b: SketchedArticle; estimate: number }> = [];
  // `key` deduplicates one probe: the same pair can share several bands.
  const consider = (i: number, other: SketchedArticle, seen: Set<number>, key: number) => {
    if (seen.has(key)) return;
    seen.add(key);
    const article = batch[i];
    if (article.media === other.media || article.id === other.id) return;
    if (Math.abs(article.publishedAt - other.publishedAt) > windowMs) return;
    const value = estimate(article.sketch, other.sketch);
    if (value >= MIN_ESTIMATE) candidates.push({ a: article, b: other, estimate: value });
  };
  // Batch against itself: probe before inserting, so only earlier articles match.
  for (let i = 0; i < batch.length; i++) {
    const keys = Array.from({ length: BANDS }, (_, band) => bandKey(batch[i].sketch, band));
    const seen = new Set<number>();
    for (const key of keys) {
      const bucket = buckets.get(key);
      if (bucket === undefined) continue;
      for (const j of typeof bucket === 'number' ? [bucket] : bucket) consider(i, batch[j], seen, j);
    }
    for (const key of keys) add(key, i);
  }
  for (const other of indexed) {
    const seen = new Set<number>();
    for (let band = 0; band < BANDS; band++) {
      const bucket = buckets.get(bandKey(other.sketch, band));
      if (bucket === undefined) continue;
      for (const i of typeof bucket === 'number' ? [bucket] : bucket) consider(i, other, seen, i);
    }
  }
  return candidates;
}

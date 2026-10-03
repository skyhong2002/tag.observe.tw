import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../data/favicon-local.json' with { type: 'json' };
import { FAVICON_BASE, iconUrl } from '../src/v1/icons.ts';

describe('reviewed media icons', () => {
  it('ships every manifest entry as a versioned 192px PNG', () => {
    for (const [id, entry] of Object.entries(manifest)) {
      const bytes = readFileSync(new URL(`../../web/public/favicons/${id}.png`, import.meta.url));
      expect(bytes.subarray(0, 8).toString('hex'), id).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16), `${id} width`).toBe(192);
      expect(bytes.readUInt32BE(20), `${id} height`).toBe(192);
      const revision = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
      expect(entry.revision, id).toBe(revision);
      expect(iconUrl(id), id).toBe(`${FAVICON_BASE}${id}.png?v=${revision}`);
      expect(['http:', 'https:'], id).toContain(new URL(entry.source).protocol);
    }
  });

  it('does not treat inherited object properties as stored icons', () => {
    expect(iconUrl('toString')).toBeNull();
    expect(iconUrl('unknown-outlet')).toBeNull();
  });

  it('uses the name fallback for the unavailable Apple Daily icon instead of a broken remote image', () => {
    expect(iconUrl('apple')).toBeNull();
  });
});

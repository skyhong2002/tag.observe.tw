import { describe, expect, it } from 'vitest';
import { decodeEntities } from './text.ts';

describe('decodeEntities', () => {
  it('decodes a twice-encoded feed and leaves single encoding alone', () => {
    expect(decodeEntities('單元7。&amp;#10;兆豐銀')).toBe('單元7。\n兆豐銀');
    expect(decodeEntities('S&amp;P 500')).toBe('S&P 500');
    expect(decodeEntities('A &lt;b&gt;')).toBe('A <b>');
  });
});

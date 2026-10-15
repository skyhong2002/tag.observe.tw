// Node's ICU puts a thin space (U+2009) between date and time where browsers
// put a plain one; client components then failed hydration (React #418).
export const plainSpaces = (text: string) => text.replace(/\s/gu, ' ');

/** Numeric entities a twice-encoded feed left in stored text (「&#10;」) shown as characters; newlines as spaces. */
export const leftoverEntities = (text: string) =>
  text.replace(/&#(x[0-9a-f]+|\d+);/gi, (m, e: string) => {
    const code = e[0].toLowerCase() === 'x' ? Number.parseInt(e.slice(1), 16) : Number.parseInt(e, 10);
    if (!Number.isFinite(code) || code <= 0 || code >= 0x110000) return m;
    return code === 10 || code === 13 ? ' ' : String.fromCodePoint(code);
  });

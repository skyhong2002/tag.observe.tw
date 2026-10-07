/** Read only the publisher's JSON record matching this article's NewsID. */
export function daaiNewsRecord(html: string, id: number): Record<string, unknown> | null {
  for (const match of html.matchAll(/var\s+news\s*=\s*'((?:\\.|[^'\\])*)'/g)) {
    try {
      const raw = JSON.parse(`"${match[1].replace(/\\'/g, "'")}"`);
      const row = JSON.parse(raw.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t'));
      if (row.NewsID === id && typeof row.Description === 'string' && typeof row.Title === 'string') return row;
    } catch {
      // A malformed or unrelated recommendation cannot establish article prose.
    }
  }
  return null;
}

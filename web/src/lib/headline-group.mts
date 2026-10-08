import type { TextPart } from './headline-compare.mts';

export interface GroupHeadlinePart extends TextPart {
  emphasis?: 'phrase' | 'passage';
}

const wordSegmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' });
const keyOf = (text: string) => text.normalize('NFKC').toLowerCase();

/** The same phrase matching, scoped to the two headlines actually displayed. */
export function pairHeadlineParts(left: string, right: string): [GroupHeadlinePart[], GroupHeadlinePart[]] {
  const [a, b] = groupHeadlineParts([left, right]);
  return [a, b];
}

/** Compare whole word sequences across outlets, independent of headline order.
 * A phrase shared by two headlines is ordinary text. Long unique passages get
 * a quieter treatment; neither style implies a semantic or political judgment.
 */
export function groupHeadlineParts(titles: readonly string[]): GroupHeadlinePart[][] {
  if (titles.length > 60) return titles.map((text) => [{ text, different: false }]);
  return compareSources(
    titles,
    titles.map((_, i) => String(i)),
  );
}

/** Count shared wording by distinct media, not by how many reports each published. */
export function mediaHeadlineParts(articles: ReadonlyArray<{ title: string; media: string }>): GroupHeadlinePart[][] {
  return compareSources(
    articles.map((a) => a.title),
    articles.map((a) => a.media),
  );
}

function compareSources(titles: readonly string[], sources: readonly string[]): GroupHeadlinePart[][] {
  const plain = (text: string): GroupHeadlinePart[] => [{ text, different: false }];
  if (new Set(sources).size < 2) return titles.map(plain);
  const segmented = titles.map((title) =>
    title.length > 600 ? [] : [...wordSegmenter.segment(title)].map((s) => ({ text: s.segment, word: Boolean(s.isWordLike) })),
  );
  const validSources = new Set(sources.filter((_, i) => segmented[i].some((token) => token.word)));
  if (validSources.size < 2) return titles.map(plain);
  // Record complete-word spans rather than arbitrary character matches. A
  // one-character Chinese segment only matches as part of a longer phrase.
  const spans = segmented.map((tokens) => {
    const found: Array<{ key: string; start: number; end: number }> = [];
    for (let start = 0; start < tokens.length; start++) {
      let phrase = '';
      for (let end = start; end < tokens.length && tokens[end].word; end++) {
        phrase += keyOf(tokens[end].text);
        const length = [...phrase].length;
        if (length > 32) break;
        if (length >= 2) found.push({ key: phrase, start, end });
      }
    }
    return found;
  });
  const frequency = new Map<string, Set<string>>();
  spans.forEach((phrases, index) => {
    for (const { key } of phrases) {
      let media = frequency.get(key);
      if (!media) frequency.set(key, (media = new Set()));
      media.add(sources[index]);
    }
  });
  return segmented.map((tokens, index) => {
    if (!tokens.length) return plain(titles[index]);
    const shared = new Set<number>();
    for (const span of spans[index]) {
      if ((frequency.get(span.key)?.size ?? 0) < 2) continue;
      for (let at = span.start; at <= span.end; at++) shared.add(at);
    }
    const parts: GroupHeadlinePart[] = [];
    tokens.forEach((token, at) => {
      const different = token.word && !shared.has(at);
      const last = parts.at(-1);
      if (last?.different === different) last.text += token.text;
      else parts.push({ text: token.text, different });
    });
    return parts.map((part) => {
      if (!part.different) return part;
      const length = [...part.text].length;
      // Isolated single characters are too ambiguous to be useful emphasis.
      if (length < 2) return { ...part, different: false };
      return { ...part, emphasis: length > 12 ? 'passage' : 'phrase' };
    });
  });
}

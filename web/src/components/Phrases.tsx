import { Fragment } from 'react';

// Chinese headlines wrap between any two characters, so a phone can split
// 連環爆 or 婚外情 across lines. Server components wrap a title in <Phrases>:
// it marks a break opportunity (<wbr>) only between words and keeps the rest
// together with word-break: keep-all; overflow-wrap: anywhere still breaks a
// run that is wider than the line. Server-only on purpose: browsers ship
// different word dictionaries, so segmenting during hydration could disagree.

const CJK = /\p{Script=Han}/u;
const OPENING = /^[「『（(《〈【“‘]$/u;
/** Longest run of Han characters glued together from single-character pieces. */
const RUN = 6;
const segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'word' });

/** The title cut into pieces that may not be split inside. */
export function phraseChunks(text: string): string[] {
  const chunks: string[] = [];
  let carry = '';
  for (const { segment, isWordLike } of segmenter.segment(text)) {
    const last = chunks.at(-1);
    if (OPENING.test(segment)) {
      carry += segment;
      continue;
    }
    const piece = carry + segment;
    carry = '';
    // Punctuation and spaces close the piece before them; single Han characters
    // (the dictionary splits names and words it does not know into them) join
    // a short Han piece before them.
    const joinsLast =
      last !== undefined &&
      ((!isWordLike && !/^\s+$/u.test(segment)) ||
        ([...segment].length === 1 && CJK.test(segment) && CJK.test(last.at(-1) ?? '') && [...last].length < RUN));
    if (joinsLast) chunks[chunks.length - 1] = last + piece;
    else chunks.push(piece);
  }
  if (carry) chunks.push(carry);
  return chunks;
}

export default function Phrases({ text }: { text: string }) {
  const chunks = phraseChunks(text);
  return (
    <span className="[overflow-wrap:anywhere] [word-break:keep-all]">
      {chunks.map((chunk, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed string
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {chunk}
        </Fragment>
      ))}
    </span>
  );
}

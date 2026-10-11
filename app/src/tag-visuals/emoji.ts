// The check that the AI's emoji is one emoji (docs/tag-visuals.md).

// One emoji: a pictograph or a flag, with joiners, variation selectors and skin tones.
const EMOJI =
  /^(?:\p{Regional_Indicator}{2}|[\p{Extended_Pictographic}\p{Emoji_Presentation}](?:[\u{FE0F}\u{20E3}\p{Emoji_Modifier}]|\u{200D}[\p{Extended_Pictographic}\p{Emoji_Presentation}])*[\u{FE0F}]?)$/u;
export const isEmoji = (s: string) => s.length <= 16 && EMOJI.test(s);

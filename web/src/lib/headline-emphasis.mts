import { type GroupHeadlinePart, mediaHeadlineParts } from './headline-group.mts';

const boilerplate = /^(快新聞|快訊|即時|最新|獨家|更新|新聞|報導)/u;
const generic = /^(本人|表示|指出|認為|回應|看待|政策|全文曝光|最新消息|最新回應|引發關注|引發討論|引起關注|引起討論|現場畫面|完整報導)$/u;

/** Sparse emphasis, not a claim about stance: only short, outlet-distinctive
 * phrases. Keep at most two spans and at most a quarter of each headline marked.
 * Use the same comparison pool for featured and expanded versions of a report.
 */
export function distinctiveHeadlineParts(articles: ReadonlyArray<{ title: string; media: string }>): GroupHeadlinePart[][] {
  return mediaHeadlineParts(articles).map((parts, index) => {
    // Strip editorial prefixes from eligibility, while preserving every source character.
    const runs = parts.flatMap((part) => {
      if (!part.different) return [part];
      const prefix = part.text.match(boilerplate)?.[0];
      return prefix
        ? [
            { text: prefix, different: false },
            { text: part.text.slice(prefix.length), different: true },
          ].filter((p) => p.text)
        : [part];
    });
    const budget = Math.min(14, Math.floor([...articles[index].title].length * 0.25));
    const candidates = runs
      .map((part, at) => ({ part, at, length: [...part.text].length }))
      .filter(({ part, length }) => part.different && length >= 4 && length <= 12 && !generic.test(part.text))
      .sort((a, b) => b.length - a.length || a.at - b.at);
    let used = 0;
    const selected = new Set<number>();
    for (const candidate of candidates) {
      if (selected.size === 2) break;
      if (used + candidate.length > budget) continue;
      selected.add(candidate.at);
      used += candidate.length;
    }
    return runs.map((part, at) => ({ text: part.text, different: selected.has(at) }));
  });
}

import { personNames } from '../../../app/src/journalists/names.ts';
import { providerOutlet } from '../../../app/src/similarity/attribution.ts';

export type CreditPart = { label: string; text: string; media?: string; evidence?: string };
type Context = {
  media?: string;
  attributions?: readonly { media: string; name: string; evidence: string }[];
};
const ORGANIZATION = /(?:公司|新聞|電視|傳媒|通訊社|編輯部|製作組|網路溫度計)/u;
const TECHNICAL_CREDIT = /(?:網頁設計|網站設計|網站製作|網頁製作)/u;

/** Author names, institutional bylines and explicit source evidence are separate roles. */
export function authorCreditParts(credits: readonly string[], context: Context = {}): CreditPart[] {
  const people = new Set<string>();
  const institutional = new Set<string>();
  const original = new Set<string>();
  const sources = new Map<string, CreditPart>();
  for (const source of context.attributions ?? []) {
    if (source.media === context.media) continue;
    sources.set(source.media, {
      label: /^內容提供者[：:]/u.test(source.evidence) ? '來源' : '引用',
      text: source.name,
      media: source.media,
      evidence: source.evidence,
    });
  }
  for (const credit of credits) {
    const text = credit.trim();
    if (!text || TECHNICAL_CREDIT.test(text)) continue;
    const names = personNames(text);
    if (names.length) {
      for (const name of names) people.add(name);
      continue;
    }
    const outlet = /^中央社[\p{Script=Han}]{2,8}\d{1,2}日(?:電|專電)$/u.test(text) ? providerOutlet('中央社') : providerOutlet(text);
    if (outlet && outlet.countryCode !== 'ZZ' && context.media && outlet.media !== context.media) {
      // A publisher in the stored byline is a source credit, not proof of a
      // quotation. Existing explicit citation evidence keeps its own label.
      if (!sources.has(outlet.media)) sources.set(outlet.media, { label: '來源', text: outlet.name, media: outlet.media });
    } else if (outlet || ORGANIZATION.test(text)) institutional.add(text);
    else original.add(text);
  }
  const result: CreditPart[] = [];
  if (people.size) result.push({ label: '作者', text: [...people].slice(0, 4).join('、') });
  if (institutional.size) result.push({ label: '機構署名', text: [...institutional].slice(0, 3).join('、') });
  if (original.size) result.push({ label: '署名', text: [...original].slice(0, 3).join('、') });
  result.push(...[...sources.values()].sort((a, b) => (a.label === '來源' ? 0 : 1) - (b.label === '來源' ? 0 : 1)).slice(0, 3));
  return result.length ? result : [{ label: '', text: '未署名' }];
}

export function authorDisplay(credits: readonly string[], context: Context = {}): string {
  return authorCreditParts(credits, context)
    .map(({ label, text }) => (label ? `${label} ${text}` : text))
    .join(' · ');
}

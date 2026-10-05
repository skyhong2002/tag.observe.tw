import { normalizeAuthorCredits } from './byline.ts';

const ORGANIZATION_CREDIT =
  /(?:新聞(?:網|雲|台)?|電子報|報社|通訊社|編輯(?:部|室)|綜合報導|中央社|路透社|法新社|美聯社|共同社|自由時報|聯合報|中國時報|工商時報|CTWANT|NOWnews|TVBS|ETtoday)|^(?:責任)?編輯[\s：:]/i;

// A failed extraction is not evidence that a historical reporter credit should
// disappear. Likewise, publisher metadata cannot replace an existing person.
export function refreshedAuthorCredits(
  current: { authors: string[] | null; creator: string | null; media: string },
  extracted: string[],
): { authors: string[]; creator: string } | null {
  const names = normalizeAuthorCredits(extracted);
  if (!names.length) return null;
  const isOrganization = (name: string) => ORGANIZATION_CREDIT.test(name) || name.toLowerCase() === current.media.toLowerCase();
  const people = names.filter((name) => !isOrganization(name));
  const existing = current.authors?.length ? current.authors : current.creator ? [current.creator] : [];
  if (!people.length && existing.some((name) => !isOrganization(name))) return null;
  const authors = people.length ? people : names;
  const creator = authors.join('、').slice(0, 256);
  if (JSON.stringify(authors) === JSON.stringify(current.authors) && creator === current.creator) return null;
  return { authors, creator };
}

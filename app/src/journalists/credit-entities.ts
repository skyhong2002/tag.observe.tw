import { outletIdentity } from '../similarity/attribution.ts';
import { isExcludedJournalist, personNames } from './names.ts';

export const CREDIT_KINDS = ['person', 'desk', 'organization', 'unknown'] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number];
export const CREDIT_LABELS: Record<CreditKind, string> = {
  person: '個人／筆名',
  desk: '編輯部／團隊',
  organization: '機構',
  unknown: '待辨識',
};
export interface CreditEntity {
  key: string;
  name: string;
  kind: CreditKind;
  media: string | null;
  organization: string | null;
  roles: string[];
}
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
const role =
  /^(特派記者|資深記者|實習記者|特約記者|駐外記者|記者|責任編輯|责任编辑|攝影記者|攝影|編譯|编译|翻譯|撰文|撰稿|採訪|整理|口述|作者|編輯|圖文|文字|文|圖)\s*[:/／]?\s*(.*)$/u;
const roleOnly = /^(?:記者|攝影|編譯|翻譯|撰文|撰稿|採訪|整理|口述|作者|編輯|圖文|文字|文|圖|責任編輯)$/u;
const desk = /(?:中心|編輯部|編輯室|編輯台|新聞部|採訪部|主筆室|小組|團隊|工作室|編輯組|新聞組|娛樂組|網編組)$/u;
const organization =
  /(?:新聞|傳媒|媒體|通訊社|通信社|日報|時報|週刊|周刊|雜誌|電視|廣播|公司|基金會|協會|學會|大學|研究院|研究所|政府|委員會|中央商情|\bnews\b|\bmedia\b|\bpress\b)/iu;
const generic = /^(?:匿名|不具名|本報訊|綜合報導|綜合外電|外電|報導|即時報導|提供|來源)$/u;

/** Classify credits, preserving uncertainty and publisher-scoped desks. Roles require explicit wording. */
export function creditEntities(values: readonly string[], publisher: string): CreditEntity[] {
  const result = new Map<string, CreditEntity>();
  const add = (name: string, kind: CreditKind, roles: string[] = []) => {
    const identity = kind === 'organization' ? outletIdentity(name) : null;
    const known = identity !== null && (identity.media !== name || identity.countryCode !== 'ZZ');
    const organizationId = kind === 'organization' && known ? (identity?.media ?? null) : null;
    const scope = kind === 'desk' || kind === 'unknown' ? publisher : null;
    const key = `${kind}:${scope ? `${scope}:` : ''}${organizationId ?? name}`;
    const previous = result.get(key);
    result.set(key, {
      key,
      name: organizationId ? (identity?.name ?? name) : name,
      kind,
      media: scope,
      organization: organizationId,
      roles: [...new Set([...(previous?.roles ?? []), ...roles])],
    });
  };
  for (const raw of values) {
    if (!raw.trim() || raw.length > 256) continue;
    let activeRoles: string[] = [];
    const pieces = normalize(raw)
      .split(/\s*[／/｜|：:、，,；;＋+&]\s*/u)
      .filter(Boolean);
    for (const piece of pieces) {
      if (roleOnly.test(piece)) {
        activeRoles = [piece];
        continue;
      }
      if (generic.test(piece)) {
        activeRoles = [];
        continue;
      }
      // Organizations and desks are checked before the person-name heuristic.
      const identity = outletIdentity(piece);
      const dispatchPeople = /(?:記者|记者|編譯|编译|撰文)/u.test(piece) ? personNames(piece, true) : [];
      if (dispatchPeople.length) {
        const explicitRole = /(?:記者|记者|編譯|编译|撰文)/u.exec(piece)?.[0];
        for (const name of dispatchPeople) if (!isExcludedJournalist(name)) add(name, 'person', explicitRole ? [explicitRole] : []);
        continue;
      }
      if (desk.test(piece)) {
        add(piece, 'desk');
        activeRoles = [];
        continue;
      }
      if (identity.countryCode !== 'ZZ' || identity.media !== piece || organization.test(piece)) {
        add(piece, 'organization');
        activeRoles = [];
        continue;
      }
      const explicit = role.exec(piece);
      const value = explicit ? explicit[2] : piece;
      const roles = explicit ? [explicit[1]] : activeRoles;
      const suffix = /(?:編譯|编译|攝影|整理|撰文|撰稿|採訪|報導)$/u.exec(value);
      const people = personNames(value, true);
      if (people.length) {
        for (const name of people) if (!isExcludedJournalist(name)) add(name, 'person', suffix ? [...roles, suffix[0]] : roles);
      } else if (value && value.length <= 120 && !generic.test(value)) add(value, 'unknown', roles);
    }
  }
  return [...result.values()];
}

export function creditsOf(row: { authors: string[] | null; creator: string | null; media: string }) {
  return creditEntities(row.authors?.length ? row.authors : row.creator?.trim() ? [row.creator] : [], row.media);
}

// Bare poster names (「邱毅今天在臉書…」) get the role that name carries most
// often elsewhere in recent article text (「前立委邱毅」), or failing that the
// role of the person groups the tag is filed in (tag-groups). Only tags known
// to be people qualify — in a person group or matched to a Wikidata human —
// which keeps tags like 「深夜」「學生」 out.
import { LEGACY_GROUPS } from '../tag-groups/rules.ts';
import { nameCandidates, type Role, roleOf } from './rules.ts';

export const MIN_HITS = 3;
export const MIN_SHARE = 0.5;
/** Characters before a mention searched for a title word. */
const WINDOW = 8;

export type Tally = Map<string, Map<Role, number>>;

export function nameMatcher(names: Iterable<string>): RegExp | null {
  const list = [...new Set(names)].filter((n) => n.length >= 2).sort((a, b) => b.length - a.length);
  if (!list.length) return null;
  return new RegExp(list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');
}

/** Adds the titled mentions of matcher's names in body to tally. */
export function tallyMentions(tally: Tally, matcher: RegExp, body: string) {
  for (const m of body.matchAll(matcher)) {
    const role = roleOf(body.slice(Math.max(0, m.index - WINDOW), m.index));
    if (!role || role === '網友民眾') continue;
    const roles = tally.get(m[0]) ?? new Map<Role, number>();
    roles.set(role, (roles.get(role) ?? 0) + 1);
    tally.set(m[0], roles);
  }
}

export interface Resolved {
  name: string;
  role: Role;
  hits: number;
  total: number;
  /** Why, when not from the text: 「分組：意見領袖」. */
  note?: string;
}

// Legacy identity groups (tag_group_defs ids 1–28, named here by their seed
// labels) that name a person's role. A group counts by its id or by its seed
// label, so an admin renaming one (「現任立委」 → 「2024 立委」) keeps its role.
// 社會新聞人物 says nothing about the role, and the rest are not people.
export const GROUP_ROLES: Record<string, Exclude<Role, '未知'>> = {
  政治人物: '公職政治',
  現任立委: '公職政治',
  現任縣市長: '公職政治',
  民進黨: '公職政治',
  國民黨: '公職政治',
  時代力量: '公職政治',
  親民黨: '公職政治',
  縣市議員: '公職政治',
  內閣: '公職政治',
  北市府: '公職政治',
  外國政治人物: '公職政治',
  六都市長候選人: '公職政治',
  意見領袖: '評論名嘴',
  名嘴: '評論名嘴',
  運動明星: '藝人網紅',
  藝人: '藝人網紅',
  歌手樂團: '藝人網紅',
  外語藝人: '藝人網紅',
  中港藝人: '藝人網紅',
  外國運動員: '藝人網紅',
  網紅: '藝人網紅',
  商場經理人: '專家企業',
};
const SEED_LABEL = new Map(LEGACY_GROUPS.map((g) => [g.id, g.label]));
export const PERSON_GROUPS = [...Object.keys(GROUP_ROLES), '社會新聞人物'];
/** Ids of the same groups, whatever they are called now. */
export const PERSON_GROUP_IDS = LEGACY_GROUPS.filter((g) => PERSON_GROUPS.includes(g.label)).map((g) => g.id);

/** One role from a tag's groups: commentary groups win, then the most specific. */
export function groupRole(groups: { id: number; label: string }[]): Exclude<Role, '未知'> | null {
  const roles = groups
    .map((g) => GROUP_ROLES[SEED_LABEL.get(g.id) ?? ''] ?? GROUP_ROLES[g.label])
    .filter((r): r is Exclude<Role, '未知'> => !!r);
  for (const r of ['評論名嘴', '藝人網紅', '專家企業', '公職政治'] as const) if (roles.includes(r)) return r;
  return null;
}

/** Names whose winning role has enough mentions and a majority; only known people. */
export function resolveTally(tally: Tally, persons: Set<string>): Map<string, Resolved> {
  const out = new Map<string, Resolved>();
  for (const [name, roles] of tally) {
    if (!persons.has(name)) continue;
    const [role, hits] = [...roles].sort((a, b) => b[1] - a[1])[0];
    const total = [...roles.values()].reduce((a, b) => a + b, 0);
    if (hits >= MIN_HITS && hits / total >= MIN_SHARE) out.set(name, { name, role, hits, total });
  }
  return out;
}

export interface Person {
  role: Role;
  roles?: Role[];
  source: 'auto' | 'admin';
}

/** The longest suffix of a name run that has a person entry. */
export function lookupPerson(run: string, people: Map<string, Person>): { name: string; person: Person } | null {
  for (const name of nameCandidates(run)) {
    const person = people.get(name);
    if (person) return { name, person };
  }
  return null;
}

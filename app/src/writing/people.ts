// Bare poster names (「邱毅今天在臉書…」) get the role that name carries most
// often elsewhere in recent article text (「前立委邱毅」). Only names that are
// also site tags qualify, which keeps ordinary words like 「隨後」 out.
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
}

/** Names whose winning role has enough mentions and a majority. */
export function resolveTally(tally: Tally, tags: Set<string>): Map<string, Resolved> {
  const out = new Map<string, Resolved>();
  for (const [name, roles] of tally) {
    if (!tags.has(name)) continue;
    const [role, hits] = [...roles].sort((a, b) => b[1] - a[1])[0];
    const total = [...roles.values()].reduce((a, b) => a + b, 0);
    if (hits >= MIN_HITS && hits / total >= MIN_SHARE) out.set(name, { name, role, hits, total });
  }
  return out;
}

export interface Person {
  role: Role;
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

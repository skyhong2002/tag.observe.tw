// Which GeneHong sheet months may seed the Similarweb history (history.ts).
// The sheet's traffic column is Similarweb's monthly visits in millions, rounded
// (checked row by row on 2026-10-10), so months before the worker existed can be
// filled from it. Only rows that provably describe the same domain are taken:
// a manual divisor (/8, /200…) or an ambiguous row is skipped, an outlet whose
// figure belongs to another outlet on a shared domain is skipped, the sheet's own
// domain must match the one Similarweb is fetched for, and every month both
// sources cover must agree within rounding. An outlet with no overlapping month
// cannot be checked and is left for a later run, once Similarweb has data for it.

/** The parts of a traffic-page outlet (web/src/lib/traffic-comparison.mts) this needs. */
export interface SeedOutlet {
  key: string;
  name: string;
  domain: string | null;
  sourceKind: 'publisher' | 'discovery';
  sharedWith?: string;
  referenceDomain?: string | null;
  /** Similarweb visits, from the snapshot and the stored history. */
  traffic: Array<{ month: string; traffic: number | null }>;
  /** GeneHong sheet values in millions. */
  referenceTraffic?: Array<{ month: string; traffic: number | null; adjusted: boolean; ambiguous: boolean }>;
}
export type SeedSkip = 'not-publisher' | 'shared-domain' | 'sheet-domain-differs' | 'no-overlap' | 'overlap-mismatch' | 'nothing-new';
export interface SeedResult {
  rows: Array<{ domain: string; month: string; visits: number }>;
  imported: Array<{ name: string; domain: string; months: string[] }>;
  skipped: Array<{ name: string; reason: SeedSkip; detail?: string }>;
}

/** Same value once the sheet's rounding (two or three decimals of a million) is allowed for. */
export const sheetMatches = (millions: number, visits: number) => Math.abs(millions * 1e6 - visits) <= Math.max(6_000, visits * 0.01);

export function sheetSeedRows(outlets: SeedOutlet[]): SeedResult {
  const result: SeedResult = { rows: [], imported: [], skipped: [] };
  for (const outlet of outlets) {
    const sheet = (outlet.referenceTraffic ?? []).filter(
      (point): point is { month: string; traffic: number; adjusted: boolean; ambiguous: boolean } =>
        point.traffic != null && !point.adjusted && !point.ambiguous,
    );
    if (!sheet.length) continue;
    const skip = (reason: SeedSkip, detail?: string) => result.skipped.push({ name: outlet.name, reason, detail });
    if (outlet.sourceKind !== 'publisher' || !outlet.domain) {
      skip('not-publisher');
      continue;
    }
    if (outlet.sharedWith) {
      skip('shared-domain', `${outlet.domain} 列在${outlet.sharedWith}`);
      continue;
    }
    if (outlet.referenceDomain && outlet.referenceDomain !== outlet.domain) {
      skip('sheet-domain-differs', `原表 ${outlet.referenceDomain}，抓取 ${outlet.domain}`);
      continue;
    }
    const fetched = new Map(outlet.traffic.filter((p) => p.traffic != null).map((p) => [p.month, p.traffic as number]));
    const overlap = sheet.filter((point) => fetched.has(point.month));
    if (!overlap.length) {
      skip('no-overlap');
      continue;
    }
    const off = overlap.find((point) => !sheetMatches(point.traffic, fetched.get(point.month) as number));
    if (off) {
      skip('overlap-mismatch', `${off.month} 原表 ${off.traffic} 百萬，Similarweb ${fetched.get(off.month)}`);
      continue;
    }
    const months = sheet.filter((point) => !fetched.has(point.month));
    if (!months.length) {
      skip('nothing-new');
      continue;
    }
    for (const point of months) result.rows.push({ domain: outlet.domain, month: point.month, visits: Math.round(point.traffic * 1e6) });
    result.imported.push({ name: outlet.name, domain: outlet.domain, months: months.map((point) => point.month) });
  }
  return result;
}

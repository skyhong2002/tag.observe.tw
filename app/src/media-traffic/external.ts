import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { type ExternalTrafficKind, type ExternalTrafficResult, trafficExternalRequests, trafficExternalSends } from '../db/schema.ts';
import { parseDomainTraffic, requestSimilarweb, TrafficFetchError, trafficDomain } from './live.ts';

// Similarweb lookups for other observe services (docs/similarweb-requests.md).
// blog.observe.tw submits domains here instead of calling Similarweb itself,
// so the machine's one IP has one requester with one budget: tag's
// media-traffic job. tag's own outlets go first; these rows only get what is
// left of the run, a few a run and a few dozen a day, and any 401/403/429
// stops the run for everyone.

export const KINDS: ExternalTrafficKind[] = ['traffic', 'similar_sites'];
const DAY = 86_400_000;
/** A row fetched this long ago is fetched again when it is submitted again. */
const STALE_DAYS = 30;
/** Retry after a refusal (401/403/429). */
const BLOCKED_RETRY = 6 * 3_600_000;
/** A domain being fetched is held this long, so a second run at the same time skips it. */
const CLAIM = 15 * 60_000;
/** After this many failed attempts a domain is no-data. */
const MAX_ATTEMPTS = 3;

/** Budget knobs, from the environment (docs/similarweb-requests.md). */
export function externalBudget(env: Record<string, string | undefined> = process.env) {
  const num = (name: string, fallback: number) => {
    const value = Number(env[name]);
    return Number.isInteger(value) && value >= 0 ? value : fallback;
  };
  return {
    /** Requests a whole run may send, tag's own included; Similarweb starts refusing near 20 in a burst. */
    run: num('TAG_SIMILARWEB_RUN_BUDGET', 15),
    /** External requests a run may send at most. */
    perRun: num('TAG_SIMILARWEB_EXTERNAL_PER_RUN', 3),
    /** External requests a day (Taipei day) at most. */
    perDay: num('TAG_SIMILARWEB_EXTERNAL_PER_DAY', 30),
    /** Domains a requester may submit a day. */
    submitPerDay: num('TAG_SIMILARWEB_SUBMIT_PER_DAY', 200),
  };
}
export type ExternalBudget = ReturnType<typeof externalBudget>;

/**
 * How many external lookups this run may send: none if tag's run was
 * refused or still has its own outlets due, else what is left of the run's
 * budget, capped per run and by what is left of the day.
 */
export function externalAllowance(
  tagRun: { attempted: number; remaining: number; blocked: boolean },
  usedToday: number,
  budget: ExternalBudget,
) {
  if (tagRun.blocked || tagRun.remaining > 0) return 0;
  return Math.max(0, Math.min(budget.perRun, budget.run - tagRun.attempted, budget.perDay - usedToday));
}

// Names that are not public internet domains, or are the observe services themselves.
const PRIVATE_SUFFIXES = [
  'localhost',
  'local',
  'internal',
  'intranet',
  'lan',
  'home',
  'corp',
  'test',
  'example',
  'invalid',
  'arpa',
  'onion',
  'ts.net',
  'observe.tw',
];

/**
 * A submitted domain, normalised (lower case, no www., no scheme, path or
 * port), or null when it is not a public domain: IP addresses, localhost,
 * single labels, private suffixes, user:pass@ forms and anything over 253
 * characters are refused.
 */
export function publicDomain(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 253 || /[\s@\\]/.test(raw)) return null;
  const domain = trafficDomain(raw.trim());
  if (!domain || domain.length > 253) return null;
  if (/^[\d.]+$/.test(domain) || domain.includes(':')) return null;
  if (domain.split('.').some((label) => label.length > 63 || label.startsWith('-') || label.endsWith('-'))) return null;
  if (PRIVATE_SUFFIXES.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`))) return null;
  return domain;
}

const taipeiDayStart = (now: Date) => {
  const offset = 8 * 3_600_000;
  return new Date(Math.floor((now.getTime() + offset) / DAY) * DAY - offset);
};

/**
 * Queues a domain for `requester`. A domain already queued is left as it
 * is, unless its result is over 30 days old (then it is fetched again).
 * Returns the row's status, or an error the API turns into 400/429.
 */
export async function submitExternal(
  db: Db,
  requester: string,
  rawDomain: unknown,
  rawKind: unknown,
  { now = new Date(), budget = externalBudget() }: { now?: Date; budget?: ExternalBudget } = {},
) {
  const domain = publicDomain(rawDomain);
  if (!domain) return { error: 'invalid_domain' as const };
  const kind = KINDS.find((k) => k === rawKind);
  if (!kind) return { error: 'invalid_kind' as const };
  const where = and(
    eq(trafficExternalRequests.requester, requester),
    eq(trafficExternalRequests.domain, domain),
    eq(trafficExternalRequests.kind, kind),
  );
  const [existing] = await db.select().from(trafficExternalRequests).where(where);
  const stale = existing?.fetchedAt && now.getTime() - existing.fetchedAt.getTime() > STALE_DAYS * DAY;
  // A refused domain keeps its wait: resubmitting must not clear a backoff.
  if (existing && (!stale || existing.status === 'blocked')) return { domain, kind, status: existing.status, created: false };
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(trafficExternalRequests)
    .where(and(eq(trafficExternalRequests.requester, requester), gte(trafficExternalRequests.requestedAt, taipeiDayStart(now))));
  if (Number(n) >= budget.submitPerDay) return { error: 'daily_limit' as const };
  if (existing) {
    await db
      .update(trafficExternalRequests)
      .set({ status: 'pending', requestedAt: now, attempts: 0, nextAttemptAt: null, lastError: null })
      .where(where);
    return { domain, kind, status: 'pending' as const, created: false };
  }
  // Two submissions at once: the second finds the first's row instead of failing.
  const [inserted] = await db
    .insert(trafficExternalRequests)
    .ignore()
    .values({ requester, domain, kind, requestedAt: now, status: 'pending', attempts: 0 });
  const created = inserted.affectedRows === 1;
  return { domain, kind, status: 'pending' as const, created };
}

/** External requests sent so far today (Taipei day), every send counted. */
export async function externalUsedToday(db: Db, now = new Date()) {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(trafficExternalSends)
    .where(gte(trafficExternalSends.at, taipeiDayStart(now)));
  return Number(n);
}

/** True while a refusal (401/403/429) is under six hours old: no external lookups until it has cooled down. */
export async function recentlyRefused(db: Db, now = new Date()) {
  const [row] = await db
    .select({ id: trafficExternalRequests.id })
    .from(trafficExternalRequests)
    .where(gte(trafficExternalRequests.refusedAt, new Date(now.getTime() - BLOCKED_RETRY)))
    .limit(1);
  return !!row;
}

/** Domains due, oldest request first; each domain is one Similarweb request for all its rows. */
export async function dueExternalDomains(db: Db, limit: number, now = new Date()) {
  if (limit <= 0) return [];
  const rows = await db
    .select({ domain: trafficExternalRequests.domain, requestedAt: trafficExternalRequests.requestedAt })
    .from(trafficExternalRequests)
    .where(
      and(
        inArray(trafficExternalRequests.status, ['pending', 'blocked']),
        or(isNull(trafficExternalRequests.nextAttemptAt), lte(trafficExternalRequests.nextAttemptAt, now)),
      ),
    )
    .orderBy(asc(trafficExternalRequests.requestedAt))
    .limit(limit * 4);
  return [...new Set(rows.map((r) => r.domain))].slice(0, limit);
}

/** The summary blog reads: traffic (if Similarweb has visits) and similar sites. */
// biome-ignore lint/suspicious/noExplicitAny: the provider's JSON, checked field by field.
export function externalResult(data: any, domain: string, now: Date): { result: ExternalTrafficResult; traffic: boolean } {
  let traffic: ReturnType<typeof parseDomainTraffic> | null = null;
  try {
    traffic = parseDomainTraffic(data, domain, now);
  } catch {
    traffic = null;
  }
  const profile = traffic?.profiles ? Object.values(traffic.profiles).at(-1) : undefined;
  const competitors = data?.Competitors?.TopSimilarityCompetitors;
  const similarSites = [
    ...new Set(
      (Array.isArray(competitors) ? competitors : [])
        .map((c: unknown) =>
          typeof c === 'string' ? c : ((c as { Domain?: unknown; domain?: unknown })?.Domain ?? (c as { domain?: unknown })?.domain),
        )
        .map((d: unknown) => publicDomain(d))
        .filter((d: string | null): d is string => !!d && d !== domain),
    ),
  ].slice(0, 20) as string[];
  return {
    traffic: !!traffic,
    result: {
      monthly: traffic?.monthly.map(({ month, visits }) => ({ month, visits })) ?? [],
      globalRank: profile?.globalRank ?? null,
      countryRank: profile?.countryRank ?? null,
      category: typeof data?.Category === 'string' ? data.Category.slice(0, 64) : null,
      topCountries: profile?.countries ?? [],
      similarSites,
    },
  };
}

/**
 * Spends this run's external allowance: one Similarweb request per due
 * domain, with the same pause as tag's own; the result goes to every row of
 * that domain (all requesters, both kinds). A 401/403/429 stops at once and
 * marks the domain blocked, to be retried after six hours.
 */
export async function runExternalRequests(
  db: Db,
  allowance: number,
  {
    request = fetch,
    now = new Date(),
    pauseMs = 3000,
    delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  const domains = await dueExternalDomains(db, allowance, now);
  const tally = { sent: 0, ok: 0, noData: 0, failed: 0, blocked: false };
  for (const domain of domains) {
    // Always the same pause first, also after tag's own last request.
    await delay(pauseMs);
    const rows = eq(trafficExternalRequests.domain, domain);
    // Claim it (a second run at the same time skips it) and count the send.
    await db
      .update(trafficExternalRequests)
      .set({ lastAttemptAt: now, nextAttemptAt: new Date(now.getTime() + CLAIM) })
      .where(rows);
    await db.insert(trafficExternalSends).values({ domain, at: now });
    tally.sent++;
    try {
      const data = await requestSimilarweb(domain, request);
      const { result, traffic } = externalResult(data, domain, now);
      for (const kind of KINDS) {
        const has = kind === 'traffic' ? traffic : result.similarSites.length > 0;
        await db
          .update(trafficExternalRequests)
          .set({
            status: has ? 'ok' : 'no-data',
            fetchedAt: now,
            lastAttemptAt: now,
            nextAttemptAt: null,
            lastError: null,
            result,
            attempts: sql`${trafficExternalRequests.attempts} + 1`,
          })
          .where(and(rows, eq(trafficExternalRequests.kind, kind)));
      }
      if (traffic) tally.ok++;
      else tally.noData++;
    } catch (failure) {
      const refused = failure instanceof TrafficFetchError && [401, 403, 429].includes(failure.status);
      const message = (failure instanceof Error ? failure.message : String(failure)).slice(0, 255);
      if (refused) {
        await db
          .update(trafficExternalRequests)
          .set({
            status: 'blocked',
            lastAttemptAt: now,
            refusedAt: now,
            nextAttemptAt: new Date(now.getTime() + BLOCKED_RETRY),
            lastError: message,
          })
          .where(rows);
        tally.blocked = true;
        break;
      }
      // Missing data or a network error: retry a day later, up to three times, then no-data.
      tally.failed++;
      // Two statements, so neither depends on the order MySQL assigns columns in.
      await db
        .update(trafficExternalRequests)
        .set({
          lastAttemptAt: now,
          lastError: message,
          attempts: sql`${trafficExternalRequests.attempts} + 1`,
          nextAttemptAt: new Date(now.getTime() + DAY),
        })
        .where(rows);
      await db
        .update(trafficExternalRequests)
        .set({ status: 'no-data' })
        .where(and(rows, gte(trafficExternalRequests.attempts, MAX_ATTEMPTS)));
    }
  }
  return tally;
}

/** Every row a requester has for a domain, for the read API. */
export async function externalResults(db: Db, requester: string, domain: string) {
  const rows = await db
    .select()
    .from(trafficExternalRequests)
    .where(and(eq(trafficExternalRequests.requester, requester), eq(trafficExternalRequests.domain, domain)));
  const result = rows.find((r) => r.result)?.result ?? null;
  return {
    domain,
    source: 'similarweb-extension' as const,
    fetchedAt:
      rows
        .map((r) => r.fetchedAt)
        .find(Boolean)
        ?.toISOString() ?? null,
    requests: rows.map((r) => ({
      kind: r.kind,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      attempts: r.attempts,
      nextAttemptAt: r.nextAttemptAt?.toISOString() ?? null,
    })),
    traffic: result?.monthly.length
      ? {
          monthly: result.monthly,
          globalRank: result.globalRank,
          countryRank: result.countryRank,
          category: result.category,
          topCountries: result.topCountries,
        }
      : null,
    similarSites: result?.similarSites ?? [],
  };
}

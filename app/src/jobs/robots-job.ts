import pLimit from 'p-limit';
import { fetchText } from '../crawl/fetch.ts';
import { allSources, excludedMedia } from '../crawl/registry.ts';
import { classifyRobots } from '../crawl/robots.ts';
import { configuredHosts } from '../crawl/rules/targets.ts';
import type { Db } from '../db/client.ts';
import { robotsObservations } from '../db/schema.ts';

// Daily: every outlet host's robots.txt, one request each, recorded for
// /admin/media/. Nothing about crawling changes with what it says.

type Log = (obj: object, msg: string) => void;

export function robotsHosts(sources = allSources()): string[] {
  return [...new Set(sources.filter((s) => !excludedMedia.has(s.media) && !s.discovery).flatMap(configuredHosts))].sort();
}

export async function runRobotsJob(
  db: Db,
  {
    log = (() => {}) as Log,
    signal,
    fetch = fetchText,
    hosts = robotsHosts(),
    now = () => new Date(),
  }: { log?: Log; signal?: AbortSignal; fetch?: typeof fetchText; hosts?: string[]; now?: () => Date } = {},
) {
  const gate = pLimit(4);
  const tally: Record<string, number> = {};
  await Promise.all(
    hosts.map((host) =>
      gate(async () => {
        if (signal?.aborted) return;
        let httpStatus: number | null = null;
        let body = '';
        let error: string | null = null;
        try {
          const res = await fetch(`https://${host}/robots.txt`, { timeout: 10000, retries: 0, maxBytes: 512 * 1024 });
          httpStatus = res.status;
          body = res.body;
        } catch (e) {
          error = (e as Error).message.slice(0, 255);
        }
        const reading = classifyRobots(httpStatus, body);
        if (reading.status === 'unreachable' && !error) error = `HTTP ${httpStatus}`;
        tally[reading.status] = (tally[reading.status] ?? 0) + 1;
        const at = now();
        const ok = reading.status !== 'unreachable';
        await db
          .insert(robotsObservations)
          .values({ host, ...reading, httpStatus, error, checkedAt: at, lastOkAt: ok ? at : null })
          .onDuplicateKeyUpdate({
            set: { ...reading, httpStatus, error, checkedAt: at, ...(ok ? { lastOkAt: at } : {}) },
          })
          .catch((e) => log({ host, err: (e as Error).message }, 'robots observation not saved'));
      }),
    ),
  );
  return { hosts: hosts.length, ...tally };
}

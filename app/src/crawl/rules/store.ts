import { appendFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type CompiledRules, compileRules, type RawRules } from './contract.ts';

// Generated crawl rules live in files, never in the database: model output
// stays out of the data (docs/generated-crawl-rules.md). One JSON file per
// outlet keeps the active revision and a short history; attempts.jsonl logs
// every generation round for target cooldowns and the daily safety caps.

export const rulesDir = () => process.env.TAG_GENERATED_RULES_DIR || join(homedir(), '.local/share/tag-analysis/generated-rules');
const HISTORY = 10;

export type RuleTrigger = 'listing' | 'body' | 'tags' | 'new-source';
export type RuleRevision = {
  revision: number;
  status: 'active' | 'superseded' | 'rejected';
  trigger: RuleTrigger;
  rules: RawRules;
  /** Hosts the outlet was shown to own when the rules were validated, and the shared ones its listing may use. */
  owned: string[];
  listingHosts?: string[];
  model: string;
  validation: unknown;
  createdAt: string;
  rejectedAt?: string;
  rejectedBy?: string;
};
export type RuleFile = { media: string; revisions: RuleRevision[] };
export type Attempt = {
  at: string;
  media: string;
  trigger: RuleTrigger;
  status: 'activated' | 'failed' | 'dry-run';
  rounds: number;
  modelCalls: number;
  reason: string | null;
  quotaPercent: number | null;
};

const fileOf = (media: string) => {
  if (!/^[a-z0-9_-]{1,32}$/i.test(media)) throw Error(`bad media ${media}`);
  return join(rulesDir(), `${media}.json`);
};
async function writeAtomic(path: string, body: string) {
  await mkdir(rulesDir(), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, path);
}

export async function readRuleFile(media: string): Promise<RuleFile> {
  try {
    return JSON.parse(await readFile(fileOf(media), 'utf8')) as RuleFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { media, revisions: [] };
    throw error;
  }
}
export const activeRevision = (file: RuleFile) => file.revisions.find((r) => r.status === 'active') ?? null;

export async function activateRules(media: string, revision: Omit<RuleRevision, 'revision' | 'status' | 'createdAt'>, now = new Date()) {
  const file = await readRuleFile(media);
  for (const r of file.revisions) if (r.status === 'active') r.status = 'superseded';
  const next = Math.max(0, ...file.revisions.map((r) => r.revision)) + 1;
  file.revisions = [{ ...revision, revision: next, status: 'active' as const, createdAt: now.toISOString() }, ...file.revisions].slice(
    0,
    HISTORY,
  );
  await writeAtomic(fileOf(media), JSON.stringify(file, null, 2));
  return next;
}
/** An admin turned the active rules off: the outlet falls back to its hand-written rules. */
export async function rejectActiveRules(media: string, by: string, now = new Date()) {
  const file = await readRuleFile(media);
  const active = activeRevision(file);
  if (!active) return false;
  Object.assign(active, { status: 'rejected', rejectedAt: now.toISOString(), rejectedBy: by });
  await writeAtomic(fileOf(media), JSON.stringify(file, null, 2));
  return true;
}

export async function recordAttempt(attempt: Attempt) {
  await mkdir(rulesDir(), { recursive: true });
  await appendFile(join(rulesDir(), 'attempts.jsonl'), `${JSON.stringify(attempt)}\n`);
}
/** Attempts since `since`, newest last (the log is read whole; trim it when it passes 2 MB). */
export async function readAttempts(since = new Date(0)): Promise<Attempt[]> {
  const path = join(rulesDir(), 'attempts.jsonl');
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const lines = text.split('\n').filter(Boolean);
  if (text.length > 2 * 1024 * 1024) await writeAtomic(path, `${lines.slice(-5000).join('\n')}\n`);
  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as Attempt;
      } catch {
        return null;
      }
    })
    .filter((a): a is Attempt => !!a && Date.parse(a.at) >= since.getTime());
}

export type ActiveRules = CompiledRules & { media: string; revision: number; trigger: RuleTrigger };
let lastScan = '';
/** Every outlet's active rules, compiled; a file that no longer compiles is skipped. Null when nothing changed. */
export async function loadActiveRules(
  warn: (media: string, err: unknown) => void = () => {},
  force = false,
): Promise<ActiveRules[] | null> {
  let names: string[];
  try {
    names = (await readdir(rulesDir())).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') names = [];
    else throw error;
  }
  const stamps = await Promise.all(names.map(async (name) => `${name}:${(await stat(join(rulesDir(), name))).mtimeMs}`));
  const scan = stamps.join('|');
  if (!force && scan === lastScan) return null;
  lastScan = scan;
  const out: ActiveRules[] = [];
  for (const name of names) {
    const media = name.slice(0, -5);
    try {
      const active = activeRevision(await readRuleFile(media));
      if (active)
        out.push({
          media,
          revision: active.revision,
          trigger: active.trigger,
          ...compileRules(active.rules, active.owned, active.listingHosts),
        });
    } catch (error) {
      warn(media, error);
    }
  }
  return out;
}

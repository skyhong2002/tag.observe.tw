// robots.txt as an outlet publishes it, classified for display on
// /admin/media/. The crawler does not obey it; this only records what it says.
// Status follows RFC 9309: a 4xx (other than 429) means no restrictions,
// while 5xx, 429 or no connection means the file could not be read.

export type RobotsStatus = 'allowed' | 'missing' | 'partial' | 'disallowed' | 'unreachable';
export type RobotsReading = { status: RobotsStatus; googleOnly: boolean; disallow: string[] };

type Group = { agents: string[]; allow: string[]; disallow: string[] };
export function parseRobots(body: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const [, field, value] = match;
    const key = field.toLowerCase();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], allow: [], disallow: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'disallow' && value) current.disallow.push(value);
    if (key === 'allow' && value) current.allow.push(value);
  }
  return groups;
}

const blocksAll = (group: Group | undefined) => !!group?.disallow.includes('/') && !group.allow.includes('/');
export function classifyRobots(httpStatus: number | null, body: string): RobotsReading {
  const empty = { googleOnly: false, disallow: [] };
  if (httpStatus === null || httpStatus === 429 || httpStatus >= 500) return { status: 'unreachable', ...empty };
  if (httpStatus >= 400) return { status: 'missing', ...empty };
  // An HTML page served as robots.txt (a soft 404) has no rules.
  if (/^\s*</.test(body)) return { status: 'missing', ...empty };
  const groups = parseRobots(body);
  const star = groups.find((g) => g.agents.includes('*'));
  const google = groups.find((g) => g.agents.some((a) => a === 'googlebot'));
  const disallow = [...new Set(star?.disallow ?? [])].slice(0, 10);
  if (blocksAll(star)) return { status: 'disallowed', googleOnly: !!google && !blocksAll(google), disallow };
  return { status: disallow.length ? 'partial' : 'allowed', googleOnly: false, disallow };
}

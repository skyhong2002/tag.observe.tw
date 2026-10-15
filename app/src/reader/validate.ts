import { journalistName } from '../v1/journalists.ts';

// Request parsing for the reader routes (routes.ts). Each parser returns the
// clean value, or a string saying what is wrong.

export type FollowKind = 'tag' | 'media' | 'journalist' | 'event';
export type Follow = { kind: FollowKind; target: string };
export type SaveKind = 'article' | 'event';
export type ReportKind = 'tags' | 'byline' | 'media' | 'other';
export type Prefs = {
  /** null follows the browser. */
  theme?: 'light' | 'dark' | null;
  analyticsOptOut?: boolean;
  /** Outlets left out of 我的動態 and the private RSS. */
  hiddenMedia?: string[];
  /** Opt-in reading history for /my/reading/. */
  history?: boolean;
  /** /liveboard/'s settings (web/src/app/liveboard/settings.ts); null forgets them. */
  liveboard?: LiveboardPrefs | null;
};
export type LiveboardPrefs = {
  mode: 'full' | 'simple';
  lenses: string[];
  pictures: boolean;
  history: number;
  interval: number;
  step: number;
  hold: number;
  words: number;
  scale: number;
  change: 'off' | 'rank' | 'value';
};

export const FOLLOW_KINDS: FollowKind[] = ['tag', 'media', 'journalist', 'event'];
export const FOLLOWS_MAX = 200;
export const SAVES_MAX = 500;
export const NOTE_MAX = 500;
export const HIDDEN_MEDIA_MAX = 100;
export const MESSAGE_MAX = 1000;
export const TAG_MAX = 60;
export const TAGS_MAX = 40;
export const LIVEBOARD_LENSES_MAX = 24;
const LIVEBOARD_INTERVALS = [1, 2, 3, 6, 12, 24];
const LIVEBOARD_NUMBERS = { history: [0, 8], step: [3, 30], hold: [5, 120], words: [12, 80], scale: [60, 160] } as const;
export const REPORT_KINDS: ReportKind[] = ['tags', 'byline', 'media', 'other'];

const cleanTag = (value: string) => value.replace(/\s+/g, ' ').trim();
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
/** Accepts 123 or "123". */
export const parseId = (value: unknown) => {
  const n = typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value) ? Number(value) : value;
  return isId(n) ? n : null;
};

export function parseFollow(body: unknown, knownMedia: (media: string) => boolean): Follow | string {
  const { kind, target } = (body ?? {}) as { kind?: unknown; target?: unknown };
  if (!FOLLOW_KINDS.includes(kind as FollowKind)) return `kind must be one of ${FOLLOW_KINDS.join(', ')}`;
  if (typeof target !== 'string' && typeof target !== 'number') return 'target is required';
  const raw = String(target);
  switch (kind as FollowKind) {
    case 'tag': {
      const tag = cleanTag(raw);
      if (!tag || tag.length > TAG_MAX || /\p{C}/u.test(tag)) return `a tag is 1–${TAG_MAX} printable characters`;
      return { kind: 'tag', target: tag };
    }
    case 'media':
      return knownMedia(raw) ? { kind: 'media', target: raw } : 'unknown media';
    case 'journalist': {
      const name = journalistName(raw);
      return name ? { kind: 'journalist', target: name } : 'name must be 2–40 printable characters';
    }
    case 'event': {
      const id = parseId(raw);
      return id ? { kind: 'event', target: String(id) } : 'an event is its thread id';
    }
  }
}

export function parseSave(body: unknown): { kind: SaveKind; id: number; note: string | null } | string {
  const { kind, id, note } = (body ?? {}) as { kind?: unknown; id?: unknown; note?: unknown };
  if (kind !== 'article' && kind !== 'event') return 'kind must be article or event';
  const targetId = parseId(id);
  if (!targetId) return 'id must be a positive integer';
  if (note !== undefined && note !== null && typeof note !== 'string') return 'note must be text';
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length > NOTE_MAX) return `note must be at most ${NOTE_MAX} characters`;
  return { kind, id: targetId, note: text || null };
}

/** A partial update: only the given keys change; unknown keys are rejected. */
export function parsePrefs(body: unknown, knownMedia: (media: string) => boolean): Prefs | string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'send an object';
  const out: Prefs = {};
  for (const [key, value] of Object.entries(body)) {
    switch (key) {
      case 'theme':
        if (value !== null && value !== 'light' && value !== 'dark') return 'theme must be light, dark or null';
        out.theme = value;
        break;
      case 'analyticsOptOut':
      case 'history':
        if (typeof value !== 'boolean') return `${key} must be true or false`;
        out[key] = value;
        break;
      case 'hiddenMedia':
        if (!Array.isArray(value) || value.length > HIDDEN_MEDIA_MAX || !value.every((m) => typeof m === 'string' && knownMedia(m)))
          return `hiddenMedia must list at most ${HIDDEN_MEDIA_MAX} known media keys`;
        out.hiddenMedia = [...new Set(value as string[])].sort();
        break;
      case 'liveboard': {
        if (value === null) {
          out.liveboard = null;
          break;
        }
        const board = parseLiveboard(value);
        if (typeof board === 'string') return `liveboard: ${board}`;
        out.liveboard = board;
        break;
      }
      default:
        return `unknown preference ${key}`;
    }
  }
  return out;
}

/** The whole liveboard setting; the board itself drops lens keys it does not know. */
function parseLiveboard(value: unknown): LiveboardPrefs | string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'send an object';
  const v = value as Record<string, unknown>;
  const extra = Object.keys(v).find(
    (k) => !['mode', 'lenses', 'pictures', 'interval', 'change', ...Object.keys(LIVEBOARD_NUMBERS)].includes(k),
  );
  if (extra) return `unknown key ${extra}`;
  if (v.mode !== 'full' && v.mode !== 'simple') return 'mode must be full or simple';
  if (
    !Array.isArray(v.lenses) ||
    !v.lenses.length ||
    v.lenses.length > LIVEBOARD_LENSES_MAX ||
    !v.lenses.every((k) => typeof k === 'string' && /^[a-z0-9-]{1,20}$/.test(k))
  )
    return `lenses must list 1–${LIVEBOARD_LENSES_MAX} lens keys`;
  if (typeof v.pictures !== 'boolean') return 'pictures must be true or false';
  if (!LIVEBOARD_INTERVALS.includes(v.interval as number)) return `interval must be one of ${LIVEBOARD_INTERVALS.join(', ')} hours`;
  if (v.change !== 'off' && v.change !== 'rank' && v.change !== 'value') return 'change must be off, rank or value';
  const numbers = {} as Record<keyof typeof LIVEBOARD_NUMBERS, number>;
  for (const [key, [min, max]] of Object.entries(LIVEBOARD_NUMBERS) as Array<[keyof typeof LIVEBOARD_NUMBERS, readonly [number, number]]>) {
    const n = v[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) return `${key} must be a whole number from ${min} to ${max}`;
    numbers[key] = n;
  }
  return {
    mode: v.mode,
    lenses: [...new Set(v.lenses as string[])],
    pictures: v.pictures,
    interval: v.interval as number,
    change: v.change,
    ...numbers,
  };
}

export function parseReport(body: unknown): { articleId: number; kind: ReportKind; tags: string[] | null; message: string } | string {
  const { articleId, kind, tags, message } = (body ?? {}) as Record<string, unknown>;
  const id = parseId(articleId);
  if (!id) return 'articleId must be a positive integer';
  if (!REPORT_KINDS.includes(kind as ReportKind)) return `kind must be one of ${REPORT_KINDS.join(', ')}`;
  const text = typeof message === 'string' ? message.trim() : '';
  if (text.length > MESSAGE_MAX) return `message must be at most ${MESSAGE_MAX} characters`;
  if (kind !== 'tags') {
    if (!text) return 'message: say what is wrong';
    return { articleId: id, kind: kind as ReportKind, tags: null, message: text };
  }
  if (!Array.isArray(tags) || tags.length > TAGS_MAX || !tags.every((t) => typeof t === 'string'))
    return `tags must be at most ${TAGS_MAX} strings`;
  const clean = [...new Set((tags as string[]).map(cleanTag).filter(Boolean))];
  if (!clean.length) return 'tags: list the tags this article should have';
  if (clean.some((t) => t.length > TAG_MAX)) return `each tag is at most ${TAG_MAX} characters`;
  return { articleId: id, kind: 'tags', tags: clean, message: text };
}

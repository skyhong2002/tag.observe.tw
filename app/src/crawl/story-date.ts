// Publish dates as topic pages show them next to a story: machine-readable
// attributes (<time datetime>, data-time, JSON-LD) and the text forms Taiwanese
// outlets print (2024-11-28 16:57, 2024/11/28, 2024.11.28, 2024年11月28日,
// 民國113年11月28日, 3小時前, 昨天). Times without a zone are Taipei time.

const MINUTE = 60e3;
const HOUR = 3600e3;
const DAY = 86400e3;
const TAIPEI = 8 * HOUR;
const EARLIEST = Date.UTC(1995, 0, 1);

/** A plausible story date: from 1995 up to a day from now. */
function plausible(t: number, now: Date): Date | null {
  return Number.isFinite(t) && t >= EARLIEST && t <= +now + DAY ? new Date(t) : null;
}

function taipei(y: number, mo: number, d: number, h = 0, mi = 0, now = new Date()): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1) return null;
  return plausible(Date.UTC(y, mo - 1, d, h, mi) - TAIPEI, now);
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i;

/** A machine-readable date attribute (datetime, content, data-time): ISO 8601
 *  with or without a zone, or epoch seconds/milliseconds; else the text forms. */
export function dateFromAttr(value: string | undefined, now = new Date()): Date | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^\d{10}$/.test(v)) return plausible(Number(v) * 1000, now);
  if (/^\d{13}$/.test(v)) return plausible(Number(v), now);
  const m = ISO.exec(v);
  if (m) {
    if (m[7])
      return plausible(
        Date.parse(
          `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}${m[7].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')}`,
        ),
        now,
      );
    return taipei(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), now);
  }
  return dateFromText(v, now);
}

const TIME = String.raw`(?:\s*(?:[T\s]|日)\s*(?:(上午|下午|AM|PM)\s*)?(\d{1,2})[:：](\d{2}))?`;
const PATTERNS: Array<[RegExp, (m: RegExpExecArray) => [number, number, number]]> = [
  // 民國113年11月28日 / 113年11月28日 (a three-digit year is the ROC calendar)
  [new RegExp(String.raw`(?:民國\s*)(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?${TIME}`), (m) => [+m[1] + 1911, +m[2], +m[3]]],
  [new RegExp(String.raw`(?<!\d)(1[01]\d)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日${TIME}`), (m) => [+m[1] + 1911, +m[2], +m[3]]],
  [new RegExp(String.raw`(?<!\d)((?:19|20)\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?${TIME}`), (m) => [+m[1], +m[2], +m[3]]],
  [new RegExp(String.raw`(?<!\d)((?:19|20)\d{2})([-/.])(\d{1,2})\2(\d{1,2})(?!\d)${TIME}`), (m) => [+m[1], +m[3], +m[4]]],
];

/**
 * The first date written in a piece of text, or null. Relative forms (N分鐘前,
 * N小時前, N天前, 昨天, 前天) count back from `now`.
 */
export function dateFromText(text: string, now = new Date()): Date | null {
  let best: { at: number; date: Date } | null = null;
  for (const [re, ymd] of PATTERNS) {
    const m = re.exec(text);
    if (!m || (best && best.at <= m.index)) continue;
    const [y, mo, d] = ymd(m);
    // The time is in the last four groups of the time suffix.
    const [ampm, hh, mm] = m.slice(-3);
    let h = hh ? +hh : 0;
    if (ampm && /下午|PM/i.test(ampm) && h < 12) h += 12;
    if (ampm && /上午|AM/i.test(ampm) && h === 12) h = 0;
    const date = taipei(y, mo, d, h, mm ? +mm : 0, now);
    if (date) best = { at: m.index, date };
  }
  const rel = /(?<!\d)(\d{1,3})\s*(分鐘|分钟|小時|小时|天|日)前|(剛剛|昨天|前天)/.exec(text);
  if (rel && (!best || rel.index < best.at)) {
    if (rel[3]) {
      if (rel[3] === '剛剛') return now;
      // Calendar days back in Taipei, at midnight: the time of day is unknown.
      const days = rel[3] === '昨天' ? 1 : 2;
      const local = new Date(+now + TAIPEI - days * DAY);
      return taipei(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(), 0, 0, now);
    }
    const n = +rel[1];
    const unit = /分/.test(rel[2]) ? MINUTE : /小/.test(rel[2]) ? HOUR : DAY;
    return plausible(+now - n * unit, now);
  }
  return best?.date ?? null;
}

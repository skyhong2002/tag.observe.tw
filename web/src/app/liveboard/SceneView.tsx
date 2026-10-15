'use client';

import Link from 'next/link';
import { CampBadge, FullBar } from '@/components/CampBar';
import MediaIcon from '@/components/MediaIcon';
import SafeImage from '@/components/SafeImage';
import Sparkline from '@/components/Sparkline';
import { authorCreditParts } from '@/lib/author-display.mts';
import { selectEventCover, selectEventLead } from '@/lib/event-presentation.mts';
import { isAllowedImage } from '@/lib/images';
import { articleHref } from '@/lib/reading.mts';
import {
  clock,
  type SceneArticle,
  type SceneBrief,
  type SceneEvent,
  type SceneRow,
  signed,
  since,
  storyHeadline,
  storyLead,
} from './scenes';
import styles from './scenes.module.css';
import type { BoardLens, EventLens } from './settings';

// The simple board's scenes other than the keyword cloud (SimpleBoard plays
// them): an event a frame, with its score against the previous hour's
// snapshot and the articles collected for it in the last hour; or a
// leaderboard of the day's topics. Both put the lens's name in a slim row on
// top with the ‹ › that step through the frames (and on to the next lens),
// and a bar that fills over the time the frame stays. Trends over the hours
// are lines, as the site's other sparklines. Links do not prefetch: a wall
// screen changes frame every few seconds and nobody is about to open them.

export default function SceneView({
  lens,
  colour,
  event,
  rows,
  frame,
  labels,
  settled,
  stay,
  onStep,
  onTo,
}: {
  lens: EventLens | BoardLens;
  colour: string;
  event?: SceneEvent;
  rows?: SceneRow[];
  /** The frame showing, and a label for each of the lens's frames (one for a leaderboard). */
  frame: number;
  labels: string[];
  /** The frame has faded in, so its stay is counting. */
  settled: boolean;
  /** Seconds the frame stays. */
  stay: number;
  onStep: (by: number) => void;
  onTo: (frame: number) => void;
}) {
  const style = { '--tint': colour } as React.CSSProperties;
  const bar = (i: number) => (
    <span className={styles.track}>
      {i < frame && <i className={styles.done} />}
      {i === frame && settled && <i key={`${lens.key}-${i}`} className={styles.fill} style={{ animationDuration: `${stay}s` }} />}
    </span>
  );
  return (
    <div className={styles.scene} style={style}>
      <header className={styles.head}>
        <Arrow by={-1} onStep={onStep} />
        <div className={styles.label}>
          <h2 className={styles.title}>{lens.title}</h2>
          <p className={styles.note}>{lens.note}</p>
        </div>
        <div className={styles.slots}>
          {labels.length > 1 ? (
            labels.map((label, i) => (
              <button
                key={label}
                type="button"
                className={styles.slot}
                data-now={i === frame || undefined}
                data-later={i > frame || undefined}
                aria-label={`跳到第 ${label} 名`}
                onClick={() => onTo(i)}
              >
                <span>{label}</span>
                {bar(i)}
              </button>
            ))
          ) : (
            <span className={styles.single}>{bar(0)}</span>
          )}
        </div>
        <Arrow by={1} onStep={onStep} />
      </header>
      <div key={`${lens.key}-${frame}`} className={styles.body}>
        {event && <EventFrame event={event} colour={colour} />}
        {rows && <Board rows={rows} lens={lens} colour={colour} />}
      </div>
    </div>
  );
}

function Arrow({ by, onStep }: { by: number; onStep: (by: number) => void }) {
  return (
    <button type="button" className={styles.arrow} aria-label={by > 0 ? '下一格' : '上一格'} onClick={() => onStep(by)}>
      {by > 0 ? '›' : '‹'}
    </button>
  );
}

/** ▲ in the lens's colour, ▼ in grey, nothing for no change. */
function Change({ value, digits = 0, unit = '' }: { value: number; digits?: number; unit?: string }) {
  const text = signed(value, digits);
  return (
    <span className={styles.change} data-down={value < 0 || undefined} data-flat={text === '±0' || undefined}>
      {text === '±0' ? '持平' : `${value > 0 ? '▲' : '▼'} ${text.slice(1)}${unit}`}
    </span>
  );
}

/** The last hours' new reports as a line, oldest at the left. As the full board's
 *  charts do, the caption sets this hour against the one before, the average and the
 *  busiest, so a quiet hour reads as quiet rather than as a bare 0. */
function Trend({ hours, colour }: { hours: number[]; colour: string }) {
  const top = Math.max(...hours);
  const peak = hours.lastIndexOf(top);
  const full = hours.slice(0, -1);
  const average = full.length ? Math.round(full.reduce((n, v) => n + v, 0) / full.length) : 0;
  // Bucket i is the hour ending (hours.length - 1 - i) hours ago.
  const peakAt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: 'numeric', hourCycle: 'h23' }).format(
    new Date(Date.now() - (hours.length - peak) * 3600e3),
  );
  return (
    <figure className={styles.trend} aria-label={`近 ${hours.length} 小時每小時新報導：${hours.join('、')}`}>
      <figcaption className={styles.sub}>
        <span>近 {hours.length} 小時每小時新報導</span>
        <span className={styles.trendStats}>
          這小時 <b>{hours.at(-1)}</b> · 上小時 <b>{hours.at(-2) ?? 0}</b> · 平均 <b>{average}</b> · 最高 <b>{top}</b>
          {top > 0 && `（${peakAt} 點起）`}
        </span>
      </figcaption>
      <Sparkline values={hours} color={colour} className={styles.trendLine} />
      <span className={styles.trendEnds}>
        <span>{hours.length} 小時前</span>
        <span>現在</span>
      </span>
    </figure>
  );
}

/** The event's keywords, larger for a stronger burst; its major ones filled in. */
function Keywords({ tags, major }: { tags: SceneEvent['tags']; major: string[] }) {
  const top = Math.max(...tags.map((t) => t.burst), 1e-9);
  const majors = new Set(major);
  // The major ones lead, even when another keyword bursts harder.
  const ordered = [...tags.filter((t) => majors.has(t.tag)), ...tags.filter((t) => !majors.has(t.tag))];
  return (
    <p className={styles.keywords}>
      {ordered.map((t) => (
        <Link
          prefetch={false}
          key={t.tag}
          href={`/tag/${encodeURIComponent(t.tag)}/`}
          data-major={majors.has(t.tag) || undefined}
          style={{ fontSize: `${(0.8 + 0.55 * Math.sqrt(Math.max(0, t.burst) / top)).toFixed(2)}em` }}
        >
          {t.tag}
        </Link>
      ))}
    </p>
  );
}

function EventFrame({ event, colour }: { event: SceneEvent; colour: string }) {
  const moved = event.prevRank === null ? null : event.prevRank - event.rank;
  const headline = storyHeadline(event.news, event.major);
  const cover = selectEventCover(event.news, selectEventLead(event.news, event.major), isAllowedImage);
  const tags = event.tags.length ? event.tags : event.major.map((tag) => ({ tag, burst: 1 }));
  const keywords = new Set(tags.map((t) => t.tag));
  const trail = (event.rankTrail ?? []).filter((r): r is number => r !== null);
  const lead = storyLead(event.news, event.major);
  return (
    <article className={styles.event}>
      <div className={styles.story}>
        {cover?.image && (
          <div className={styles.cover}>
            <SafeImage src={cover.image} alt="" width={960} height={540} />
          </div>
        )}
        <p className={styles.rank}>
          第 <b>{event.rank}</b> 名
          {moved === null ? (
            <span className={styles.change}>新上榜</span>
          ) : moved ? (
            <span className={styles.change} data-down={moved < 0 || undefined}>
              {moved > 0 ? `↑ ${moved}` : `↓ ${-moved}`}
            </span>
          ) : null}
          {event.hours && event.hours >= 2 ? <span className={styles.sub}>上榜 {event.hours} 小時</span> : null}
          {trail.length >= 2 && (
            <span className={styles.rankTrail} title={`最近 24 小時名次：${(event.rankTrail ?? []).map((r) => r ?? '－').join(' ')}`}>
              <Sparkline values={event.rankTrail ?? []} rank color={colour} className={styles.rankLine} />
              <span className={styles.sub}>24 小時名次，最高第 {Math.min(...trail)} 名</span>
            </span>
          )}
        </p>
        <h3 className={styles.headline}>
          {event.href ? (
            <Link prefetch={false} href={event.href}>
              {headline}
            </Link>
          ) : (
            headline
          )}
        </h3>
        {lead?.brief && (
          // The lead is a report like those on the right: who ran it, who else ran it, and where it probably came from.
          <div className={styles.leadMeta}>
            <Byline brief={lead.brief} recent={Date.now() - Date.parse(lead.brief.publishedAt) < 3600e3}>
              <Copies copies={lead.copies} />
            </Byline>
            <ReportTags tags={lead.brief.tags} keywords={keywords} />
            {lead.source && (
              <span className={styles.source}>
                可能來自
                <MediaIcon media={lead.source.media} size={14} />
                {lead.source.mediaTitle}
                <time>{clock(lead.source.publishedAt)}</time>
                <Link prefetch={false} href={articleHref(lead.source)} className={styles.sourceTitle}>
                  {lead.source.title}
                </Link>
              </span>
            )}
          </div>
        )}
        <Keywords tags={tags} major={event.major} />
      </div>
      <div className={styles.numbers}>
        <dl className={styles.figures}>
          <div>
            <dt>分數</dt>
            <dd>
              <b>{event.score.toFixed(1)}</b>
              {event.prevScore === null ? (
                <span className={styles.change}>新</span>
              ) : (
                <Change value={event.score - event.prevScore} digits={1} />
              )}
            </dd>
            <dd className={styles.sub}>{event.prevScore === null ? '上一小時不在榜上' : `上一小時 ${event.prevScore.toFixed(1)}`}</dd>
          </div>
          <div>
            <dt>最新報導</dt>
            <dd>
              <b>{event.newest ? since(event.newest) : '—'}</b>
            </dd>
            <dd className={styles.sub}>
              近一小時 {event.counts.hour} 篇 · 前一小時 {event.counts.previous} 篇
            </dd>
          </div>
          <div>
            <dt>今天</dt>
            <dd>
              <b>{event.counts.today}</b> 篇
            </dd>
            <dd className={styles.sub}>24 小時內 {event.coverage.outlets.length} 家媒體</dd>
          </div>
        </dl>
        {/* The events page's camp split and blind-spot badge, larger for the screen. */}
        <div className={styles.camps}>
          <FullBar c={event.coverage} />
          <CampBadge c={event.coverage} />
        </div>
        <Trend hours={event.counts.hours} colour={colour} />
        <div className={styles.reports}>
          <Articles list={event.articles} keywords={keywords} />
        </div>
      </div>
    </article>
  );
}

/** A report's line under its headline, as on every news row: outlet, its reporters and the
 *  outlets it names as source or cites (authorCreditParts, as the full board), and when — how
 *  long ago, in the lens's colour, for the last hour's arrivals. */
function Byline({ brief, recent = false, children }: { brief: SceneBrief; recent?: boolean; children?: React.ReactNode }) {
  const credits = authorCreditParts(brief.authors, brief).filter((part) => part.text !== '未署名');
  return (
    <span className={styles.byline}>
      <MediaIcon media={brief.media} size={14} />
      <span className={styles.outlet}>{brief.mediaTitle}</span>
      {credits.length > 0 && (
        <span className={styles.credits} title={credits.map((part) => part.evidence ?? `${part.label} ${part.text}`).join('\n')}>
          {credits.map((part) => (
            <span key={`${part.label}-${part.text}`} data-source={part.media ? true : undefined}>
              {part.label && `${part.label} `}
              {part.text}
            </span>
          ))}
        </span>
      )}
      <time className={styles.time} data-recent={recent || undefined}>
        {recent ? since(brief.publishedAt) : clock(brief.publishedAt)}
      </time>
      {children}
    </span>
  );
}

/** Who else ran a report, by their icons and a count. */
function Copies({ copies }: { copies: Array<{ media: string; mediaTitle: string }> }) {
  if (!copies.length) return null;
  return (
    <span className={styles.copies} title={copies.map((c) => c.mediaTitle).join('、')}>
      {copies.slice(0, 3).map((c) => (
        <MediaIcon key={c.media} media={c.media} title={c.mediaTitle} size={14} />
      ))}
      另有 {copies.length} 家刊出
    </span>
  );
}

/** A report's site tags, the event's own keywords in the lens's colour. */
function ReportTags({ tags, keywords, max = 5 }: { tags: string[]; keywords: ReadonlySet<string>; max?: number }) {
  if (!tags.length) return null;
  return (
    <span className={styles.reportTags}>
      {tags.slice(0, max).map((tag) => (
        <Link prefetch={false} key={tag} href={`/tag/${encodeURIComponent(tag)}/`} data-event={keywords.has(tag) || undefined}>
          #{tag}
        </Link>
      ))}
    </span>
  );
}

/** Each report: its headline; outlet, reporters and the outlets it names as source or cites, and
 *  when; its site tags (the event's own keywords in the lens's colour); and who else ran it. */
function Articles({ list, keywords }: { list: SceneArticle[]; keywords: ReadonlySet<string> }) {
  return (
    <ul className={styles.articles}>
      {list.map((a) => {
        return (
          <li key={a.id}>
            <span className={styles.thumb}>
              {isAllowedImage(a.image) ? (
                <SafeImage src={a.image} alt="" width={192} height={108} />
              ) : (
                <MediaIcon media={a.media} size={28} />
              )}
            </span>
            <span className={styles.articleText}>
              <Link prefetch={false} href={articleHref(a)} className={styles.articleTitle}>
                {a.title}
              </Link>
              <Byline brief={a} recent={a.recent}>
                <Copies copies={a.copies} />
              </Byline>
              <ReportTags tags={a.tags} keywords={keywords} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Board({ rows, lens, colour }: { rows: SceneRow[]; lens: EventLens | BoardLens; colour: string }) {
  const board = lens.scene === 'board' ? lens.board : null;
  const thread = board === 'threads';
  return (
    <table className={styles.board}>
      <thead>
        <tr>
          <th aria-label="名次" />
          <th className={styles.name}>
            {board === 'threads' ? '事件' : board === 'categories' ? '分類' : board === 'groups' ? '群組' : '議題'}
          </th>
          <th className={styles.trailHead}>近 12 小時</th>
          <th>今天</th>
          <th>近一小時</th>
          <th>比前一小時</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.key}>
            <td className={styles.place}>{i + 1}</td>
            <td className={styles.name}>
              <span className={styles.nameCell}>
                {r.media && <MediaIcon media={r.media} title={r.mediaTitle} size={20} />}
                {r.mediaTitle && <span className={styles.media}>{r.mediaTitle}</span>}
                <Link prefetch={false} href={r.href}>
                  {thread ? storyHeadline(r.news, r.major) : r.title}
                </Link>
              </span>
              <RowDetail row={r} thread={thread} />
            </td>
            <td className={styles.trailCell}>
              <Sparkline values={r.counts.hours} color={colour} className={styles.rowLine} />
            </td>
            <td className={styles.count}>{r.counts.today.toLocaleString()}</td>
            <td className={styles.count}>{r.counts.hour ? `+${r.counts.hour.toLocaleString()}` : '—'}</td>
            <td className={styles.count}>
              {r.counts.hour || r.counts.previous ? <Change value={r.counts.hour - r.counts.previous} /> : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A row's second line, so a short name does not leave the row empty: a thread's lead report
 *  (outlet, bylines, when) and its major tags; a group's busiest tags today and its newest
 *  report; an outlet topic's newest report. */
function RowDetail({ row, thread }: { row: SceneRow; thread: boolean }) {
  const none: ReadonlySet<string> = new Set();
  if (thread) {
    const lead = storyLead(row.news, row.major)?.brief;
    return (
      <span className={styles.rowDetail}>
        {lead && <Byline brief={lead} />}
        {row.major?.length ? <ReportTags tags={row.major} keywords={new Set(row.major)} /> : null}
      </span>
    );
  }
  const latest = row.latest;
  if (!row.keywords?.length && !latest) return null;
  return (
    <span className={styles.rowDetail}>
      {row.keywords?.length ? <ReportTags tags={row.keywords} keywords={none} max={6} /> : null}
      {latest && (
        <span className={styles.latest}>
          <span className={styles.latestLabel}>最新</span>
          <Link prefetch={false} href={articleHref(latest)} className={styles.latestTitle}>
            {latest.title}
          </Link>
          <Byline brief={latest} recent={Date.now() - Date.parse(latest.publishedAt) < 3600e3} />
        </span>
      )}
    </span>
  );
}

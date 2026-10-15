'use client';

import Link from 'next/link';
import { articleHref } from '@/lib/reading.mts';
import { clock, type SceneEvent, type SceneRow, signed, storyHeadline } from './scenes';
import styles from './scenes.module.css';
import type { BoardLens, EventLens } from './settings';

// The simple board's scenes other than the keyword cloud (SimpleBoard plays
// them): an event a frame, with its score against the previous hour's
// snapshot and the articles collected for it in the last hour; or a
// leaderboard of the day's topics. Both put the lens's name on top with the
// ‹ › that step through the frames (and on to the next lens), and a bar that
// fills over the time the frame stays.

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
        <div className={styles.titleRow}>
          <Arrow by={-1} onStep={onStep} />
          <div>
            <h2 className={styles.title}>{lens.title}</h2>
            <p className={styles.note}>{lens.note}</p>
          </div>
          <Arrow by={1} onStep={onStep} />
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
      </header>
      <div key={`${lens.key}-${frame}`} className={styles.body}>
        {event && <EventFrame event={event} />}
        {rows && <Board rows={rows} lens={lens} />}
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

function EventFrame({ event }: { event: SceneEvent }) {
  const moved = event.prevRank === null ? null : event.prevRank - event.rank;
  const headline = storyHeadline(event.news, event.major);
  return (
    <article className={styles.event}>
      <p className={styles.rank}>
        第 <b>{event.rank}</b> 名
        {moved === null ? (
          <span className={styles.change}>新上榜</span>
        ) : moved ? (
          <span className={styles.change} data-down={moved < 0 || undefined}>
            {moved > 0 ? `↑ ${moved}` : `↓ ${-moved}`}
          </span>
        ) : null}
      </p>
      <h3 className={styles.headline}>{event.href ? <Link href={event.href}>{headline}</Link> : headline}</h3>
      <p className={styles.tags}>
        {event.major.map((tag) => (
          <Link key={tag} href={`/tag/${encodeURIComponent(tag)}/`}>
            {tag}
          </Link>
        ))}
      </p>
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
          <dt>近一小時新報導</dt>
          <dd>
            <b>{event.counts.hour}</b> 篇
            <Change value={event.counts.hour - event.counts.previous} />
          </dd>
          <dd className={styles.sub}>前一小時 {event.counts.previous} 篇</dd>
        </div>
        <div>
          <dt>今天</dt>
          <dd>
            <b>{event.counts.today}</b> 篇
          </dd>
        </div>
      </dl>
      {event.articles.length ? (
        <ul className={styles.articles}>
          {event.articles.map((a) => (
            <li key={a.id}>
              <span className={styles.media}>{a.mediaTitle}</span>
              <Link href={articleHref(a)} className={styles.articleTitle}>
                {a.title}
              </Link>
              <time className={styles.time}>{clock(a.publishedAt)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>近一小時還沒有新報導</p>
      )}
    </article>
  );
}

function Board({ rows, lens }: { rows: SceneRow[]; lens: EventLens | BoardLens }) {
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
              {r.mediaTitle && <span className={styles.media}>{r.mediaTitle}</span>}
              <Link href={r.href}>{thread ? storyHeadline(r.news, r.major) : r.title}</Link>
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

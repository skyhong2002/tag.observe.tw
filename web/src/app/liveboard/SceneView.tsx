'use client';

import Link from 'next/link';
import MediaIcon from '@/components/MediaIcon';
import SafeImage from '@/components/SafeImage';
import { selectEventCover, selectEventLead } from '@/lib/event-presentation.mts';
import { isAllowedImage } from '@/lib/images';
import { articleHref } from '@/lib/reading.mts';
import { clock, type SceneArticle, type SceneEvent, type SceneRow, signed, storyHeadline } from './scenes';
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

/** Collection counts for each of the last hours as bars, the present one in full colour. */
function Trail({ hours, label }: { hours: number[]; label?: string }) {
  const top = Math.max(1, ...hours);
  return (
    <div className={styles.trail} role="img" aria-label={label ?? `近 ${hours.length} 小時每小時報導：${hours.join('、')}`}>
      {hours.map((n, i) => (
        <i key={i} data-now={i === hours.length - 1 || undefined} style={{ height: `${Math.max(n ? 6 : 0, (n / top) * 100)}%` }} />
      ))}
    </div>
  );
}

function EventFrame({ event }: { event: SceneEvent }) {
  const moved = event.prevRank === null ? null : event.prevRank - event.rank;
  const headline = storyHeadline(event.news, event.major);
  const cover = selectEventCover(event.news, selectEventLead(event.news, event.major), isAllowedImage);
  const recent = event.articles.filter((a) => a.recent);
  const earlier = event.articles.filter((a) => !a.recent);
  return (
    <article className={styles.event}>
      <div className={styles.lead}>
        {cover?.image && (
          <div className={styles.cover}>
            <SafeImage src={cover.image} alt="" width={640} height={360} />
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
        <div className={styles.trailBox}>
          <span className={styles.sub}>近 {event.counts.hours.length} 小時每小時新報導</span>
          <Trail hours={event.counts.hours} />
          <span className={styles.trailEnds}>
            <span>{event.counts.hours.length} 小時前</span>
            <span>現在</span>
          </span>
        </div>
      </div>
      <div className={styles.reports}>
        <h4 className={styles.section}>近一小時新報導</h4>
        {recent.length ? <Articles list={recent} /> : <p className={styles.empty}>這一小時還沒有新報導</p>}
        {earlier.length > 0 && (
          <>
            <h4 className={styles.section}>今天稍早</h4>
            <Articles list={earlier} />
          </>
        )}
      </div>
    </article>
  );
}

function Articles({ list }: { list: SceneArticle[] }) {
  return (
    <ul className={styles.articles}>
      {list.map((a) => (
        <li key={a.id}>
          <span className={styles.thumb}>
            {isAllowedImage(a.image) ? (
              <SafeImage src={a.image} alt="" width={192} height={108} />
            ) : (
              <MediaIcon media={a.media} size={28} />
            )}
          </span>
          <span className={styles.articleText}>
            <Link href={articleHref(a)} className={styles.articleTitle}>
              {a.title}
            </Link>
            <span className={styles.byline}>
              <MediaIcon media={a.media} size={14} />
              {a.mediaTitle}
              <time className={styles.time}>{clock(a.publishedAt)}</time>
            </span>
          </span>
        </li>
      ))}
    </ul>
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
                <Link href={r.href}>{thread ? storyHeadline(r.news, r.major) : r.title}</Link>
              </span>
            </td>
            <td className={styles.trailCell}>
              <Trail hours={r.counts.hours} />
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

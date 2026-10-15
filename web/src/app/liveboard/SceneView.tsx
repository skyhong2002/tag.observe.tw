'use client';

import Link from 'next/link';
import MediaIcon from '@/components/MediaIcon';
import SafeImage from '@/components/SafeImage';
import Sparkline from '@/components/Sparkline';
import { authorCreditParts } from '@/lib/author-display.mts';
import { selectEventCover, selectEventLead } from '@/lib/event-presentation.mts';
import { isAllowedImage } from '@/lib/images';
import { articleHref } from '@/lib/reading.mts';
import { clock, type SceneArticle, type SceneEvent, type SceneRow, signed, storyHeadline } from './scenes';
import styles from './scenes.module.css';
import type { BoardLens, EventLens } from './settings';

// The simple board's scenes other than the keyword cloud (SimpleBoard plays
// them): an event a frame, with its score against the previous hour's
// snapshot and the articles collected for it in the last hour; or a
// leaderboard of the day's topics. Both put the lens's name in a slim row on
// top with the ‹ › that step through the frames (and on to the next lens),
// and a bar that fills over the time the frame stays. Trends over the hours
// are lines, as the site's other sparklines.

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

/** The last hours' new reports as a line, oldest at the left; the busiest and the present hour named. */
function Trend({ hours, colour }: { hours: number[]; colour: string }) {
  const top = Math.max(...hours);
  return (
    <figure className={styles.trend} aria-label={`近 ${hours.length} 小時每小時新報導：${hours.join('、')}`}>
      <figcaption className={styles.sub}>
        近 {hours.length} 小時每小時新報導<span>最多 {top} 篇</span>
      </figcaption>
      <Sparkline values={hours} color={colour} className={styles.trendLine} />
      <span className={styles.trendEnds}>
        <span>{hours.length} 小時前</span>
        <span>
          這一小時 <b>{hours.at(-1)}</b> 篇
        </span>
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
  const recent = event.articles.filter((a) => a.recent);
  const earlier = event.articles.filter((a) => !a.recent);
  const tags = event.tags.length ? event.tags : event.major.map((tag) => ({ tag, burst: 1 }));
  const keywords = new Set(tags.map((t) => t.tag));
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
        </p>
        <h3 className={styles.headline}>{event.href ? <Link href={event.href}>{headline}</Link> : headline}</h3>
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
        <Trend hours={event.counts.hours} colour={colour} />
        <div className={styles.reports}>
          <h4 className={styles.section}>近一小時新報導</h4>
          {recent.length ? <Articles list={recent} keywords={keywords} /> : <p className={styles.empty}>這一小時還沒有新報導</p>}
          {earlier.length > 0 && (
            <>
              <h4 className={styles.section}>今天稍早</h4>
              <Articles list={earlier} keywords={keywords} />
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** Each report: its headline; outlet, reporters and the outlets it names as source or cites, and
 *  when; its site tags (the event's own keywords in the lens's colour); and who else ran it. */
function Articles({ list, keywords }: { list: SceneArticle[]; keywords: ReadonlySet<string> }) {
  return (
    <ul className={styles.articles}>
      {list.map((a) => {
        const credits = authorCreditParts(a.authors, a).filter((part) => part.text !== '未署名');
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
              <Link href={articleHref(a)} className={styles.articleTitle}>
                {a.title}
              </Link>
              <span className={styles.byline}>
                <MediaIcon media={a.media} size={14} />
                <span className={styles.outlet}>{a.mediaTitle}</span>
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
                <time className={styles.time}>{clock(a.publishedAt)}</time>
                {a.copies.length > 0 && (
                  <span className={styles.copies} title={a.copies.map((c) => c.mediaTitle).join('、')}>
                    {a.copies.slice(0, 3).map((c) => (
                      <MediaIcon key={c.media} media={c.media} title={c.mediaTitle} size={14} />
                    ))}
                    另有 {a.copies.length} 家刊出
                  </span>
                )}
              </span>
              {a.tags.length > 0 && (
                <span className={styles.reportTags}>
                  {a.tags.slice(0, 5).map((tag) => (
                    <Link key={tag} href={`/tag/${encodeURIComponent(tag)}/`} data-event={keywords.has(tag) || undefined}>
                      #{tag}
                    </Link>
                  ))}
                </span>
              )}
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
                <Link href={r.href}>{thread ? storyHeadline(r.news, r.major) : r.title}</Link>
                {thread && r.major?.length ? <span className={styles.rowTags}>{r.major.join('・')}</span> : null}
              </span>
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

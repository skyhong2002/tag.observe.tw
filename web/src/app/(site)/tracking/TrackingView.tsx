'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { taipei, taipeiDate } from '@/lib/api';
import {
  type Observation,
  type ObservationScope,
  observationHref,
  observationQuery,
  observationScope,
} from '../../../../../app/src/observation-scope.ts';
import styles from './tracking.module.css';

type Saved = { anchor: string; any: string[]; version: 1 };
const STORE = 'tag-observe:observations:v1';
const format = (n: number) => n.toLocaleString('zh-TW');
export function SavedObservations({ scope }: { scope?: ObservationScope }) {
  const [saved, setSaved] = useState<Saved[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORE) ?? '[]');
      if (Array.isArray(stored))
        setSaved(
          stored.slice(0, 30).flatMap((s) => {
            try {
              return s.version === 1 && Array.isArray(s.any) ? [observationScope(s.anchor, s.any.join(','))] : [];
            } catch {
              return [];
            }
          }),
        );
    } catch {
      setMessage('瀏覽器儲存空間無法使用；仍可將網址加入書籤。');
    }
  }, []);
  function update(next: Saved[]) {
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
      setSaved(next);
      setMessage('已更新此瀏覽器的觀察清單。');
    } catch {
      setMessage('無法儲存；請將網址加入書籤。');
    }
  }
  const exists = scope && saved.some((s) => observationHref(s) === observationHref(scope));
  return (
    <section className={styles.saved} aria-label="此瀏覽器的觀察清單">
      <div className={styles.formRow}>
        <strong>
          我的觀察 <small>此瀏覽器</small>
        </strong>
        {scope && (
          <button
            type="button"
            disabled={!exists && saved.length >= 30}
            onClick={() => {
              update(
                exists
                  ? saved.filter((s) => observationHref(s) !== observationHref(scope))
                  : [...saved, { version: 1, anchor: scope.anchor, any: scope.any }],
              );
            }}
          >
            {exists ? '移除此觀察' : '儲存此觀察'}
          </button>
        )}
      </div>
      {saved.length ? (
        <ul className={styles.savedList}>
          {saved.map((s) => (
            <li key={observationHref(s)}>
              <Link href={observationHref(s)}>
                {s.anchor}
                {s.any.length ? ` × (${s.any.join(' / ')})` : ''}
              </Link>
              <button
                type="button"
                aria-label={`移除 ${s.anchor} 的觀察`}
                onClick={() => update(saved.filter((item) => observationHref(item) !== observationHref(s)))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>儲存後可從這裡重開，持續取得最新資料。也可以直接收藏或分享網址。</p>
      )}
      <p role="status" className={styles.note}>
        {message}
      </p>
    </section>
  );
}

type Bin = { from: string; to: string; total: number | null };
export default function TrackingView({ data }: { data: Observation }) {
  const [span, setSpan] = useState<'day' | 'week' | 'month'>('week');
  const [cutoff, setCutoff] = useState(data.window.at);
  const [share, setShare] = useState('');
  const bins: Bin[] = [];
  for (const day of data.days) {
    const week = new Date(`${day.day}T00:00:00Z`);
    week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
    const key = span === 'day' ? day.day : span === 'month' ? day.day.slice(0, 7) : week.toISOString().slice(0, 10);
    const last = bins[bins.length - 1];
    if (last && (span === 'month' ? last.from.slice(0, 7) === key : span === 'week' ? last.from >= key : false)) {
      last.to = day.day;
      if (day.articles !== null) last.total = (last.total ?? 0) + day.articles;
    } else bins.push({ from: day.day, to: day.day, total: day.articles });
  }
  const max = Math.max(1, ...bins.map((b) => b.total ?? 0));
  const scopeInputs = (
    <>
      <input type="hidden" name="v" value="1" />
      <input type="hidden" name="anchor" value={data.scope.anchor} />
      {data.scope.any.length > 0 && <input type="hidden" name="with" value={data.scope.any.join(',')} />}
    </>
  );
  function href(at?: string) {
    const q = observationQuery(data.scope);
    q.set('from', data.window.from);
    q.set('to', data.window.to);
    if (at) q.set('at', at);
    return `/tracking/?${q}`;
  }
  const months = [...new Set(data.days.map((d) => d.day.slice(0, 7)))];
  return (
    <>
      <section className={styles.panel}>
        <div className={styles.formRow}>
          <div className={styles.grow}>
            <p className={styles.eyebrow}>固定條件 · 自動納入新資料</p>
            <h2>
              {data.scope.anchor}
              {data.scope.any.length > 0 && (
                <>
                  {' '}
                  × <span>（{data.scope.any.join(' 或 ')}）</span>
                </>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(new URL(href(data.window.at), window.location.origin).href);
                setShare('已複製目前日期與條件的連結');
              } catch {
                setShare('請直接複製瀏覽器網址分享');
              }
            }}
          >
            分享這個畫面
          </button>
        </div>
        <p role="status" className={styles.note}>
          {share}
        </p>
        <form action="/tracking/" className={styles.formRow}>
          {scopeInputs}
          <label>
            開始日期
            <input type="date" name="from" defaultValue={data.window.from} max={data.window.to} required />
          </label>
          <label>
            結束日期
            <input
              type="date"
              name="to"
              defaultValue={data.window.to}
              max={new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)}
              required
            />
          </label>
          <button type="submit">更新範圍</button>
          <span className={styles.note}>最多 366 天 · 日期皆為台北時間</span>
        </form>
      </section>
      <section className={styles.replay}>
        <div className={styles.formRow}>
          <div className={styles.grow}>
            <h2>{data.window.at < data.window.to ? '回看當時的報導' : '目前觀察範圍'}</h2>
            <p>
              統計與事件只顯示至 <strong>{data.window.at}</strong>
              {data.window.at === new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) ? ' 目前' : ' 當日結束'}。
            </p>
          </div>
          {data.window.at < data.window.to && <Link href={href()}>回到範圍末日 →</Link>}
        </div>
        <form action="/tracking/" className={styles.formRow}>
          {scopeInputs}
          <input type="hidden" name="from" value={data.window.from} />
          <input type="hidden" name="to" value={data.window.to} />
          <label>
            回看日期
            <input
              type="date"
              name="at"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              min={data.window.from}
              max={data.window.to}
              required
            />
          </label>
          <button type="submit">回看到這一天</button>
        </form>
      </section>
      <div className={styles.stats}>
        {[
          [data.totals.articles, '篇符合條件的報導'],
          [data.totals.media, '個收錄來源'],
          [data.totals.events, '段獨立事件'],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{format(value as number)}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section className={styles.panel}>
        <div className={styles.formRow}>
          <div className={styles.grow}>
            <h2>關注何時升起，又何時沉寂？</h2>
            <p className={styles.note}>各期符合條件的報導篇數；點選柱狀圖回看到該期末日。</p>
          </div>
          <fieldset className={styles.switcher} aria-label="圖表時間單位">
            {(
              [
                ['day', '日'],
                ['week', '週'],
                ['month', '月'],
              ] as const
            ).map(([key, label]) => (
              <button type="button" key={key} aria-pressed={span === key} onClick={() => setSpan(key)}>
                {label}
              </button>
            ))}
          </fieldset>
        </div>
        <div className={styles.chartScroll}>
          <div className={styles.chart} style={{ minWidth: span === 'day' ? Math.max(480, bins.length * 12) : 0 }}>
            {bins.map((b) => (
              <Link
                className={styles.barColumn}
                prefetch={false}
                key={b.from}
                href={href(b.to > data.window.at ? data.window.at : b.to)}
                title={`${b.from} 至 ${b.to}：${b.total === null ? '尚未回看' : `${format(b.total)} 篇`}`}
                aria-label={`${b.from} 至 ${b.to}，${b.total === null ? '尚未回看' : `${b.total} 篇，回看到期末`}`}
              >
                <span
                  className={styles.bar}
                  style={{
                    height: b.total === null ? '100%' : `${Math.max(b.total ? 2 : 0.6, (b.total / max) * 100)}%`,
                    opacity: b.total === null ? 0.12 : b.total ? 1 : 0.25,
                  }}
                />
                {(bins.length < 15 || bins.indexOf(b) % Math.ceil(bins.length / 9) === 0) && (
                  <small>{span === 'month' ? b.from.slice(0, 7) : b.from.slice(5)}</small>
                )}
              </Link>
            ))}
          </div>
        </div>
        <p className={styles.note}>
          {data.window.from} — {data.window.to} · 最高 {format(max === 1 && !data.totals.articles ? 0 : max)} 篇／
          {span === 'day' ? '日' : span === 'week' ? '週' : '月'} · 淡色區域尚未回看
        </p>
        {!data.totals.articles && <p>這個範圍尚無符合條件的收錄報導。可減少搭配詞或調整日期。</p>}
        <details>
          <summary>查看逐日數字</summary>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>報導篇數</th>
                  <th>來源數</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => (
                  <tr key={day.day}>
                    <th>{day.day}</th>
                    <td>{day.articles ?? '尚未回看'}</td>
                    <td>{day.media ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section className={styles.panel}>
        <h2>同一觀察裡的不同事件</h2>
        <p className={styles.note}>每段保留原有事件編號；須有同一小時的主要標籤符合條件才列入，不會把整段事件的所有文章算進上方篇數。</p>
        {!data.events.length && <p>此範圍沒有符合條件的事件快照。仍可由逐日統計與下方報導觀察。</p>}
        <ol className={styles.timeline}>
          {data.events.map((event, index) => {
            const older = data.events[index + 1];
            const gap = older ? Math.floor((Date.parse(event.firstAt) - Date.parse(older.lastAt)) / 86400000) : 0;
            return (
              <li key={event.id}>
                <p className={styles.note}>
                  {taipeiDate(event.firstAt)} — {taipeiDate(event.lastAt)} · {event.matchedHours} 個符合小時 · 事件 #{event.id}
                </p>
                <h3>
                  <Link href={`/eve/${event.id}/`}>{event.headline?.title ?? event.tags.join('、')} →</Link>
                </h3>
                <p className={styles.tags}>
                  {event.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </p>
                <p className={styles.note}>
                  <Link href={href(taipeiDate(event.lastAt))}>回看到這段事件</Link> · 開啟事件頁會顯示該事件的完整歷程
                </p>
                {gap > 3 && <p className={styles.gap}>與前段相隔 {gap} 天，仍由相同條件持續觀察</p>}
              </li>
            );
          })}
        </ol>
      </section>
      <section className={styles.panel}>
        <h2>哪些來源持續報導？</h2>
        <p className={styles.note}>
          各月份符合條件的篇數。顯示篇數最多的 20 個來源；下載資料包含全部來源。零筆代表收錄中沒有命中，不代表該媒體沒有報導。
        </p>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>收錄來源</th>
                <th>合計</th>
                {months.map((month) => (
                  <th key={month}>{month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.outlets.slice(0, 20).map((outlet) => (
                <tr key={outlet.media}>
                  <th>
                    <Link href={`/media/${encodeURIComponent(outlet.media)}/`}>{outlet.title}</Link>
                  </th>
                  <td>{format(outlet.articles)}</td>
                  {months.map((month) => {
                    const future = `${month}-01` > data.window.at;
                    const count = Object.entries(outlet.days)
                      .filter(([day]) => day.startsWith(month))
                      .reduce((n, [, count]) => n + count, 0);
                    return (
                      <td
                        key={month}
                        style={{
                          background:
                            future || !count ? undefined : `rgba(14, 165, 160, ${Math.min(0.5, 0.06 + Math.log2(count + 1) / 20)})`,
                        }}
                      >
                        {future ? '—' : format(count)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={styles.panel}>
        <h2>截至回看日的最新報導</h2>
        <p className={styles.note}>最多列出 60 篇，依刊登時間排序；同一文章編號只計一次，轉載稿仍各自計數。</p>
        <ul className={styles.articles}>
          {data.recent.map((a) => (
            <li key={a.id}>
              <span>
                {taipei(a.publishedAt)} · {data.outlets.find((o) => o.media === a.media)?.title ?? a.media}
              </span>
              <Link href={`/article/${a.id}/`}>{a.title}</Link>
            </li>
          ))}
        </ul>
      </section>
      <footer className={styles.panel}>
        <h2>這份觀察如何產生</h2>
        <p>
          以現存文章標籤逐字比對，包含歷史匯入資料。標籤有遺漏或不同寫法時，可能漏掉相關報導；這是一組可重複的觀察條件，不代表完整的議題範圍。
        </p>
        <p>
          事件快照始於 {data.eventHistoryFrom ? taipeiDate(data.eventHistoryFrom) : '尚無資料'}
          ；較早的報導可能只有篇數、沒有事件段落。空白期也可能來自收錄不足。
        </p>
        <p>
          回看依刊登日期及現存標籤、事件快照重建，並非當天實際已收錄內容的完整還原。條件保存在網址，觀察清單保存在此瀏覽器；重新開啟儲存的觀察會顯示最近
          180 天。
        </p>
        <p className={styles.note}>
          資料更新：{taipei(data.generatedAt)} · 快取最長 60 秒 ·{' '}
          <a
            href={`/api/v1/observations?${new URLSearchParams({ ...Object.fromEntries(observationQuery(data.scope)), from: data.window.from, to: data.window.to, at: data.window.at })}`}
          >
            下載本次 JSON 資料
          </a>
        </p>
      </footer>
    </>
  );
}

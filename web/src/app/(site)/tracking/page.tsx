import Link from 'next/link';
import { redirect } from 'next/navigation';
import { API_ORIGIN } from '@/lib/api';
import type { Observation } from '../../../../../app/src/observation-scope.ts';
import { observationHref, observationQuery } from '../../../../../app/src/observation-scope.ts';
import TrackingView, { SavedObservations } from './TrackingView';
import styles from './tracking.module.css';

export const metadata = { title: '長期觀察 · 新文易數', robots: { index: false, follow: true } };
type Search = Record<string, string | string[] | undefined>;
export default async function TrackingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const query = new URLSearchParams();
  let error = '';
  for (const key of ['v', 'anchor', 'with', 'from', 'to', 'at', 'seed']) {
    const value = search[key];
    if (Array.isArray(value)) error = '參數不可重複，請重新設定條件。';
    else if (value !== undefined) query.set(key, value);
  }
  let data: Observation | null = null;
  if (!error && (query.has('anchor') || query.has('seed'))) {
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/observations?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(25000) });
      const body = await response.json();
      if (response.ok) data = body;
      else error = body.error ?? '資料暫時無法取得';
    } catch {
      error = '資料暫時無法取得，請稍後重試。';
    }
  }
  if (data && query.has('seed')) {
    const canonical = observationQuery(data.scope);
    for (const key of ['from', 'to', 'at']) if (query.has(key)) canonical.set(key, query.get(key)!);
    redirect(`/tracking/?${canonical}`);
  }
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>事件之間，持續觀察</p>
          <h1>長期觀察</h1>
          <p>保存一組標籤條件，把分散在不同日期的報導與事件放在一起看。</p>
        </div>
        <Link href="/event/">← 事件表</Link>
      </header>
      <details className={styles.panel} open={!data || !!error}>
        <summary>{data ? '修改觀察條件' : '建立觀察'}</summary>
        <form key={data?.scope.id ?? query.get('anchor') ?? 'new'} action="/tracking/">
          <h2>觀察什麼？</h2>
          <div className={styles.formRow}>
            <input type="hidden" name="v" value="1" />
            <label>
              主標籤
              <input
                name="anchor"
                required
                maxLength={120}
                placeholder="例如：台積電"
                defaultValue={data?.scope.anchor ?? query.get('anchor') ?? ''}
              />
            </label>
            <label className={styles.grow}>
              同篇另須包含任一標籤（選填）
              <input name="with" placeholder="例如：台股,美股" defaultValue={data?.scope.any.join(',') ?? query.get('with') ?? ''} />
            </label>
            <button type="submit">開始觀察</button>
          </div>
          <p className={styles.note}>標籤完全相符才納入；逗號分隔最多 5 個搭配詞。條件會固定在網址中，不會隨事件名稱改變。</p>
        </form>
      </details>
      <SavedObservations scope={data?.scope} />
      {error && (
        <div role="alert" className={styles.panel}>
          <h2>這次查詢無法完成</h2>
          <p>{error}</p>
          <p>請調整上方條件，或縮短下方日期範圍後重試。</p>
          {query.has('anchor') && (
            <form action="/tracking/" className={styles.formRow}>
              <input type="hidden" name="v" value="1" />
              <input type="hidden" name="anchor" value={query.get('anchor')!} />
              {query.has('with') && <input type="hidden" name="with" value={query.get('with')!} />}
              <label>
                開始日期
                <input
                  type="date"
                  name="from"
                  required
                  defaultValue={query.get('from') ?? new Date(Date.now() - 29 * 86400000 + 8 * 3600000).toISOString().slice(0, 10)}
                />
              </label>
              <label>
                結束日期
                <input
                  type="date"
                  name="to"
                  required
                  defaultValue={query.get('to') ?? new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)}
                />
              </label>
              <button type="submit">調整範圍重試</button>
            </form>
          )}
        </div>
      )}
      {data ? (
        <TrackingView key={`${data.scope.id}:${data.window.from}:${data.window.to}:${data.window.at}`} data={data} />
      ) : (
        !error && (
          <section className={styles.panel}>
            <h2>從一個觀察開始</h2>
            <p>存下條件後，再次開啟就能看到新增報導，不需要每天歸類事件。</p>
            <div className={styles.examples}>
              {[
                ['台積電', ['台股']],
                ['Anthropic', ['IPO']],
                ['黃金', ['金價']],
              ].map(([anchor, any]) => {
                const scope = { version: 1 as const, anchor: anchor as string, any: any as string[] };
                return (
                  <Link key={scope.anchor} href={observationHref(scope)}>
                    {scope.anchor} × {scope.any.join(' / ')} →
                  </Link>
                );
              })}
            </div>
            <p className={styles.note}>或從任一事件頁按「長期觀察」，帶入該事件的標籤，再調整範圍。</p>
          </section>
        )
      )}
    </div>
  );
}

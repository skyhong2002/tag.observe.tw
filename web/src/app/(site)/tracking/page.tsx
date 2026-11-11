import Link from 'next/link';
import { redirect } from 'next/navigation';
import FormSuggestInput from '@/components/FormSuggestInput';
import MethodLink from '@/components/MethodLink';
import SectionTabs from '@/components/SectionTabs';
import { API_ORIGIN } from '@/lib/api';
import { formInput, formLabel, formSubmit } from '@/lib/form-styles';
import type { Observation } from '../../../../../app/src/observation-scope.ts';
import { observationHref, observationQuery } from '../../../../../app/src/observation-scope.ts';
import TrackingView, { SavedObservations } from './TrackingView';

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
    <div className="space-y-5">
      <SectionTabs here="/tracking/" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">長期觀察</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">保存標籤條件，持續查看不同日期的報導與獨立事件。</p>
        </div>
        <MethodLink className="text-sm" />
      </header>
      <details open={!data || !!error} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-medium">{data ? '修改觀察條件' : '建立觀察'}</summary>
        <form key={data?.scope.id ?? query.get('anchor') ?? 'new'} action="/tracking/" className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="v" value="1" />
          <label htmlFor="observation-anchor" className={formLabel}>
            主標籤
            <FormSuggestInput
              id="observation-anchor"
              source={{ kind: 'tags' }}
              submitOnPick={false}
              name="anchor"
              required
              maxLength={120}
              placeholder="例如：台積電"
              defaultValue={data?.scope.anchor ?? query.get('anchor') ?? ''}
              className={formInput}
            />
          </label>
          <label className={formLabel}>
            同篇另須包含任一標籤（選填）
            <input
              name="with"
              placeholder="例如：台股,美股"
              defaultValue={data?.scope.any.join(',') ?? query.get('with') ?? ''}
              className={formInput}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className={formSubmit}>
              開始觀察
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">逐字比對標籤，搭配詞以逗號分隔，最多 5 個。</p>
          </div>
        </form>
      </details>
      <SavedObservations scope={data?.scope} />
      {error && (
        <section role="alert" className="space-y-3">
          <h2 className="text-base font-semibold">這次查詢無法完成</h2>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">請調整上方條件，或縮短下方日期範圍後重試。</p>
          {query.has('anchor') && (
            <form action="/tracking/" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="v" value="1" />
              <input type="hidden" name="anchor" value={query.get('anchor')!} />
              {query.has('with') && <input type="hidden" name="with" value={query.get('with')!} />}
              <label className={formLabel}>
                開始日期
                <input
                  type="date"
                  name="from"
                  required
                  className={formInput}
                  defaultValue={query.get('from') ?? new Date(Date.now() - 29 * 86400000 + 8 * 3600000).toISOString().slice(0, 10)}
                />
              </label>
              <label className={formLabel}>
                結束日期
                <input
                  type="date"
                  name="to"
                  required
                  className={formInput}
                  defaultValue={query.get('to') ?? new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)}
                />
              </label>
              <button type="submit" className={formSubmit}>
                調整範圍重試
              </button>
            </form>
          )}
        </section>
      )}
      {data ? (
        <TrackingView key={`${data.scope.id}:${data.window.from}:${data.window.to}:${data.window.at}`} data={data} />
      ) : (
        !error && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">從一個觀察開始</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">存下條件後，再次開啟就能看到新增報導。也可以從事件頁帶入標籤。</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {(
                [
                  ['台積電', ['台股']],
                  ['Anthropic', ['IPO']],
                  ['黃金', ['金價']],
                ] as const
              ).map(([anchor, any]) => (
                <li key={anchor}>
                  <Link
                    href={observationHref({ version: 1, anchor, any: [...any] })}
                    className="text-brand-700 hover:underline dark:text-brand-400"
                  >
                    {anchor} × {any.join(' / ')} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}

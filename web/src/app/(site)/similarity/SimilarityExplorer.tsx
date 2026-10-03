'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { GraphSelection } from '@/components/SimilarityGraph';
import type { SimilarityArticle, SimilarityData, SimilarityEdge } from '@/lib/similarity';

const SimilarityGraph = dynamic(() => import('@/components/SimilarityGraph'), {
  ssr: false,
  loading: () => <p className="p-12 text-center text-sm text-zinc-500">正在載入關係圖；文章證據與文字列表可先使用。</p>,
});
const panel = 'rounded-xl border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-zinc-900';
const control = 'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';
const linkStyle = 'text-brand-700 hover:underline dark:text-brand-400';
const number = (value: number) => value.toLocaleString('zh-TW');
const taipei = (iso: string) => {
  const date = new Date(Date.parse(iso) + 8 * 3600_000);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}/${two(date.getUTCMonth() + 1)}/${two(date.getUTCDate())} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
};
const percent = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '—');
const wire = new Set(['cna', 'reuters', 'afp', 'ap', 'kyodo', 'yonhap', 'xinhua']);

function ArticleCard({ article, earlier }: { article: SimilarityArticle; earlier?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950/60">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <Link href={`/media/${encodeURIComponent(article.media)}/articles/`} className={`${linkStyle} font-medium`}>
          {article.mediaTitle}
        </Link>
        <span className="text-zinc-500">
          {article.country} · {article.countryCode}
        </span>
        {earlier && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">較早刊登</span>
        )}
      </div>
      <h3 className="text-sm font-medium leading-6">
        <Link href={`/article/${article.id}/`} className="hover:text-brand-700 dark:hover:text-brand-400">
          {article.title}
        </Link>
      </h3>
      <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        署名：{article.authors.length ? article.authors.join('、') : '未取得'}
        <br />
        <time dateTime={article.publishedAt}>{taipei(article.publishedAt)}</time>（台北） · 正規化 {number(article.bodyLength)} 字元
      </p>
      {article.attributions.length > 0 && (
        <p className="mt-2 text-xs leading-5 text-violet-700 dark:text-violet-400">
          明示引用：{article.attributions.map((source) => `${source.name}（${source.countryCode}）`).join('、')}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <Link href={`/article/${article.id}/`} className={linkStyle}>
          查看已保存內文
        </Link>
        <a href={article.url} target="_blank" rel="noopener noreferrer" className={linkStyle}>
          媒體原文 ↗
        </a>
      </div>
    </div>
  );
}

export default function SimilarityExplorer({ data }: { data: SimilarityData }) {
  const [media, setMedia] = useState('all');
  const [country, setCountry] = useState('all');
  const [kind, setKind] = useState('all');
  const [excludeWire, setExcludeWire] = useState(false);
  const [author, setAuthor] = useState<string | null>(null);
  const [selection, setSelection] = useState<GraphSelection>(null);
  const onSelect = useCallback((value: GraphSelection) => setSelection(value), []);
  const byId = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const countries = [...new Map(data.nodes.map((node) => [node.countryCode, node.country])).entries()];
  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setSelection(null);
  };

  const { basePairs, baseCitations, nodes, edges } = useMemo(() => {
    const matchesWireFilter = (article: SimilarityArticle) =>
      !excludeWire || (!article.attributions.some((source) => wire.has(source.media)) && !wire.has(article.media));
    const basePairs = data.pairs.filter(
      (pair) =>
        kind !== 'citation' &&
        (kind === 'all' || pair.kind === kind) &&
        (media === 'all' ||
          pair.a.media === media ||
          pair.b.media === media ||
          pair.a.attributions.some((source) => source.media === media) ||
          pair.b.attributions.some((source) => source.media === media)) &&
        (country === 'all' || pair.a.countryCode === country || pair.b.countryCode === country) &&
        (!author || pair.a.authors.includes(author) || pair.b.authors.includes(author)) &&
        matchesWireFilter(pair.a) &&
        matchesWireFilter(pair.b),
    );
    const baseCitations = data.citations.filter(
      (citation) =>
        (kind === 'all' || kind === 'citation') &&
        (media === 'all' || citation.article.media === media || citation.source.media === media) &&
        (country === 'all' || citation.article.countryCode === country || citation.source.countryCode === country) &&
        (!author || citation.article.authors.includes(author)) &&
        matchesWireFilter(citation.article),
    );
    const edgeMap = new Map<string, SimilarityEdge>();
    for (const pair of basePairs) {
      const [source, target] = [pair.a.media, pair.b.media].sort();
      const key = `similarity:${source}:${target}`;
      const edge = edgeMap.get(key) ?? { source, target, kind: 'similarity', count: 0, score: 0 };
      edge.count++;
      edge.score = Math.max(edge.score ?? 0, pair.score);
      edgeMap.set(key, edge);
    }
    for (const citation of baseCitations) {
      const source = citation.article.media,
        target = citation.source.media;
      const key = `citation:${source}:${target}`;
      const edge = edgeMap.get(key) ?? { source, target, kind: 'citation', count: 0, score: null };
      edge.count++;
      edgeMap.set(key, edge);
    }
    const edges = [...edgeMap.values()].sort((a, b) => b.count - a.count);
    const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
    const nodes = data.nodes.filter((node) => connected.has(node.id));
    return { basePairs, baseCitations, nodes, edges };
  }, [data, media, country, kind, author, excludeWire]);

  const selectedCitingIds = new Set(
    selection && 'edge' in selection && selection.edge.kind === 'citation'
      ? baseCitations
          .filter((citation) => citation.article.media === selection.edge.source && citation.source.media === selection.edge.target)
          .map((citation) => citation.article.id)
      : [],
  );
  const pairs = basePairs.filter((pair) => {
    if (!selection) return true;
    if ('node' in selection)
      return [pair.a, pair.b].some(
        (article) => article.media === selection.node || article.attributions.some((source) => source.media === selection.node),
      );
    const edge = selection.edge;
    if (edge.kind === 'citation') return selectedCitingIds.has(pair.a.id) || selectedCitingIds.has(pair.b.id);
    return [pair.a.media, pair.b.media].includes(edge.source) && [pair.a.media, pair.b.media].includes(edge.target);
  });
  const pairedIds = new Set(pairs.flatMap((pair) => [pair.a.id, pair.b.id]));
  const citations = baseCitations.filter((citation) => {
    if (!selection) return true;
    if ('node' in selection) return citation.article.media === selection.node || citation.source.media === selection.node;
    if (selection.edge.kind === 'similarity') return pairedIds.has(citation.article.id);
    return citation.article.media === selection.edge.source && citation.source.media === selection.edge.target;
  });
  const reporters = useMemo(() => {
    const articles = new Map<number, SimilarityArticle>();
    for (const pair of data.pairs) {
      articles.set(pair.a.id, pair.a);
      articles.set(pair.b.id, pair.b);
    }
    for (const citation of data.citations) articles.set(citation.article.id, citation.article);
    const similarIds = new Set(data.pairs.flatMap((pair) => [pair.a.id, pair.b.id]));
    const identicalIds = new Set(data.pairs.filter((pair) => pair.kind === 'identical').flatMap((pair) => [pair.a.id, pair.b.id]));
    const result = new Map<string, { name: string; media: string; outlet: string; count: number; similar: number; identical: number }>();
    for (const article of articles.values())
      for (const name of new Set(article.authors)) {
        const key = `${article.media}:${name}`;
        const row = result.get(key) ?? { name, media: article.media, outlet: article.mediaTitle, count: 0, similar: 0, identical: 0 };
        row.count++;
        row.similar += Number(similarIds.has(article.id));
        row.identical += Number(identicalIds.has(article.id));
        result.set(key, row);
      }
    return [...result.values()].sort((a, b) => b.similar - a.similar || b.count - a.count);
  }, [data]);
  const included = data.coverage.filter((row) => !row.excludedFromStatistics);
  const totals = included.reduce(
    (sum, row) => ({
      total: sum.total + row.total,
      usable: sum.usable + row.usable,
      missing: sum.missing + row.missing,
      pending: sum.pending + row.pending,
      authors: sum.authors + row.withAuthors,
    }),
    { total: 0, usable: 0, missing: 0, pending: 0, authors: 0 },
  );
  const sourceCounts = [
    ...citations
      .reduce((result, citation) => {
        const source = citation.source;
        const row = result.get(source.media) ?? { source, count: 0, publishers: new Set<string>() };
        row.count++;
        row.publishers.add(citation.article.mediaTitle);
        result.set(source.media, row);
        return result;
      }, new Map<string, { source: SimilarityData['citations'][number]['source']; count: number; publishers: Set<string> }>())
      .values(),
  ].sort((a, b) => b.count - a.count);
  const selectionLabel = selection
    ? 'node' in selection
      ? (byId.get(selection.node)?.name ?? selection.node)
      : `${byId.get(selection.edge.source)?.name ?? selection.edge.source} ${selection.edge.kind === 'citation' ? '→' : '↔'} ${byId.get(selection.edge.target)?.name ?? selection.edge.target}`
    : null;

  return (
    <div className="space-y-6">
      <form action="/similarity/" method="get" className={`${panel} grid items-end gap-4 p-4 sm:grid-cols-[1fr_1fr_auto]`}>
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          比較期間
          <select name="hours" defaultValue={data.hours} className={control}>
            {[24, 48, 72, 168].map((hours) => (
              <option value={hours} key={hours}>
                最近 {hours === 168 ? '7 天' : `${hours} 小時`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Dice 相似度門檻（0.50–1.00）
          <input name="threshold" type="number" min="0.5" max="1" step="0.01" defaultValue={data.threshold} required className={control} />
        </label>
        <button type="submit" className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-medium text-white hover:bg-brand-800">
          套用期間與門檻
        </button>
      </form>

      <section aria-labelledby="coverage-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="coverage-heading" className="text-lg font-semibold">
            先看內文覆蓋率
          </h2>
          <p className="text-xs text-zinc-500">更新於 {taipei(data.generatedAt)}（台北）</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['期間內文章', number(totals.total), '各媒體的收錄篇數'],
            ['可比較內文', percent(totals.usable, totals.total), `${number(totals.usable)} 篇通過內文門檻`],
            ['擷取缺漏／待處理', `${number(totals.missing)} / ${number(totals.pending)}`, '缺漏會限制觀測範圍'],
            ['取得作者署名', percent(totals.authors, totals.total), `${number(totals.authors)} 篇有署名資料`],
          ].map(([title, value, note]) => (
            <div className={`${panel} p-4`} key={title}>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{title}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{note}</p>
            </div>
          ))}
        </div>
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {number(data.sample.available)} 篇已擷取內文中，分析最新樣本 {number(data.sample.analyzed)} 篇；上限 {number(data.sample.limit)}{' '}
          篇。{data.sample.truncated ? '已達樣本上限，較早文章未全部納入。' : ''}
          {data.sample.pairsTruncated ? '配對超過 200 組，目前顯示分數最高的 200 組。' : `目前取得 ${data.pairs.length} 組配對。`}{' '}
          覆蓋率是整段期間的統計，關係圖與證據來自受限樣本。
        </p>
        <details className={panel}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            逐媒體覆蓋率與內文庫 <span className="font-normal text-zinc-500">（{data.coverage.length} 家）</span>
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-right text-xs">
              <caption className="px-4 pb-3 text-left leading-5 text-zinc-500">
                缺漏包含擷取失敗；已擷取但未達比較門檻的內文不計入可比較。蕃新聞排除於上方統計。
              </caption>
              <thead className="bg-zinc-50 dark:bg-zinc-950">
                <tr>
                  {['媒體／內文庫', '期間文章', '已擷取', '可比較', '有署名', '缺漏', '待處理'].map((title, index) => (
                    <th key={title} className={`px-4 py-3 ${index === 0 ? 'text-left' : ''}`}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.coverage.map((row) => (
                  <tr key={row.media}>
                    <td className="px-4 py-3 text-left">
                      <Link href={`/media/${encodeURIComponent(row.media)}/articles/`} className={linkStyle}>
                        {row.name}
                      </Link>
                      {row.excludedFromStatistics && <span className="ml-2 text-zinc-500">不納入統計</span>}
                      {!row.enabled && <span className="ml-2 text-zinc-500">未啟用擷取</span>}
                      <div
                        role="img"
                        className="mt-2 h-1.5 max-w-40 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                        aria-label={`可比較 ${percent(row.usable, row.total)}`}
                      >
                        <div className="h-full bg-brand-600" style={{ width: `${row.total ? (row.usable / row.total) * 100 : 0}%` }} />
                      </div>
                    </td>
                    {(['total', 'fetched', 'usable', 'withAuthors', 'missing', 'pending'] as const).map((field) => (
                      <td className="px-4 py-3 tabular-nums" key={field}>
                        {number(row[field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section aria-labelledby="relations-heading" className="space-y-3">
        <h2 id="relations-heading" className="text-lg font-semibold">
          媒體關係與文章證據
        </h2>
        <div className={`${panel} p-4`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium">
              媒體
              <select value={media} onChange={(event) => changeFilter(setMedia, event.target.value)} className={control}>
                <option value="all">全部媒體</option>
                {data.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                    {node.external ? '（被引用媒體）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              媒體國別
              <select value={country} onChange={(event) => changeFilter(setCountry, event.target.value)} className={control}>
                <option value="all">全部國別</option>
                {countries.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name} · {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              關係類型
              <select value={kind} onChange={(event) => changeFilter(setKind, event.target.value)} className={control}>
                <option value="all">相似與明示引用</option>
                <option value="identical">內文相同</option>
                <option value="high">高度相似</option>
                <option value="citation">明示引用</option>
              </select>
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={excludeWire}
              onChange={(event) => {
                setExcludeWire(event.target.checked);
                setSelection(null);
              }}
              className="accent-orange-700"
            />
            排除通訊社刊登或已標明引用通訊社的文章
          </label>
          {author && (
            <p className="mt-3 text-xs">
              署名篩選：{author}{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthor(null);
                  setSelection(null);
                }}
                className={`${linkStyle} ml-2`}
              >
                清除
              </button>
            </p>
          )}
        </div>
        <div className={panel}>
          <SimilarityGraph nodes={nodes} edges={edges} selection={selection} onSelect={onSelect} />
        </div>
        <details className={panel}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">關係文字列表 · 可用鍵盤篩選</summary>
          <div className="space-y-3 px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {nodes.map((node) => (
                <button
                  type="button"
                  key={node.id}
                  onClick={() => onSelect({ node: node.id })}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {node.name} · {node.countryCode}
                </button>
              ))}
            </div>
            <ul className="grid gap-2 text-xs sm:grid-cols-2">
              {edges.map((edge) => (
                <li key={`${edge.kind}:${edge.source}:${edge.target}`}>
                  <button
                    type="button"
                    onClick={() => onSelect({ edge })}
                    className="w-full rounded-lg bg-zinc-50 p-3 text-left hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                  >
                    {byId.get(edge.source)?.name ?? edge.source} {edge.kind === 'citation' ? '→' : '↔'}{' '}
                    {byId.get(edge.target)?.name ?? edge.target}
                    <span
                      className={`ml-2 ${edge.kind === 'citation' ? 'text-violet-700 dark:text-violet-400' : 'text-brand-700 dark:text-brand-400'}`}
                    >
                      {edge.kind === 'citation' ? '明示引用' : '相似配對'} {edge.count} {edge.kind === 'citation' ? '篇' : '組'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!edges.length && <p className="text-xs text-zinc-500">沒有符合目前條件的媒體關係。</p>}
          </div>
        </details>
        {selectionLabel && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 p-3 text-sm dark:bg-brand-950/30">
            <span>目前查看：{selectionLabel}</span>
            <button type="button" onClick={() => onSelect(null)} className={`${linkStyle} shrink-0 text-xs`}>
              清除圖表篩選
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="pairs-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="pairs-heading" className="text-lg font-semibold">
            內文配對
          </h2>
          <span aria-live="polite" className="text-xs text-zinc-500">
            {pairs.length} 組符合條件
          </span>
        </div>
        {!pairs.length && (
          <p className={`${panel} p-6 text-sm leading-6 text-zinc-500`}>
            {kind === 'citation'
              ? '已選擇明示引用，請查看下方引用證據。'
              : '目前樣本與篩選條件下沒有符合門檻的配對。擷取不足或樣本上限也會影響結果，可調整條件並核對覆蓋率。'}
          </p>
        )}
        {pairs.map((pair) => (
          <article key={pair.id} className={`${panel} p-4`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${pair.kind === 'identical' ? 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
                >
                  {pair.kind === 'identical' ? '內文相同' : '高度相似'}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {(pair.score * 100).toFixed(1)}
                  <span className="ml-0.5 text-xs font-normal text-zinc-500">% Dice</span>
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                共同五字片段 {number(pair.sharedShingles)} · 較短篇覆蓋比 {(pair.containment * 100).toFixed(1)}%
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ArticleCard article={pair.a} earlier={Date.parse(pair.a.publishedAt) < Date.parse(pair.b.publishedAt)} />
              <ArticleCard article={pair.b} earlier={Date.parse(pair.b.publishedAt) < Date.parse(pair.a.publishedAt)} />
            </div>
            <details className="mt-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <summary className="cursor-pointer text-xs font-medium">共同段落證據</summary>
              <blockquote className="mt-3 break-all border-l-2 border-brand-500 pl-3 text-sm leading-7">
                {pair.evidence || '未取得連續共同段落'}
              </blockquote>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                顯示正規化後的短段落，標點與空白已移除。較早刊登只描述時間；原始來源仍需由明示引用與原文確認。
              </p>
            </details>
          </article>
        ))}
      </section>

      <section aria-labelledby="citations-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="citations-heading" className="text-lg font-semibold">
            明示引用的媒體
          </h2>
          <span aria-live="polite" className="text-xs text-zinc-500">
            {citations.length} 筆文章引用
          </span>
        </div>
        <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          箭頭由刊登媒體指向被引用媒體。只呈現辨識到的明示引用；沒有標註的原始來源仍未知，無法以相似度補推。
        </p>
        {sourceCounts.length > 0 && (
          <div className={`${panel} space-y-4 p-4`}>
            {sourceCounts.map((row) => (
              <div key={row.source.media}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {row.source.name}{' '}
                    <span className="text-xs font-normal text-zinc-500">
                      {row.source.country} · {row.source.countryCode}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums">{row.count} 篇引用</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${(row.count / sourceCounts[0].count) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">引用方：{[...row.publishers].join('、')}</p>
              </div>
            ))}
          </div>
        )}
        {!citations.length && (
          <p className={`${panel} p-6 text-sm text-zinc-500`}>
            {kind === 'high' || kind === 'identical'
              ? '目前僅顯示相似配對；選擇「相似與明示引用」可一起查看引用證據。'
              : '目前篩選未找到可辨識的明示引用。原始來源未知。'}
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {citations.map((citation) => (
            <article className={`${panel} p-4`} key={`${citation.article.id}:${citation.source.media}`}>
              <p className="mb-3 text-xs font-medium text-violet-700 dark:text-violet-400">
                {citation.article.mediaTitle} → {citation.source.name} · {citation.source.countryCode}
              </p>
              <ArticleCard article={citation.article} />
              <blockquote className="mt-3 break-words border-l-2 border-violet-400 pl-3 text-xs leading-6">
                「{citation.source.evidence}」
              </blockquote>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="reporters-heading" className="space-y-3">
        <h2 id="reporters-heading" className="text-lg font-semibold">
          文章署名觀測
        </h2>
        <p className="text-xs leading-6 text-zinc-500">
          依本次回傳的配對及引用證據文章去重計數，並非作者全部產量。署名包含記者、編輯或通訊社，未做人物身分確認；點選署名可篩選上方證據。
        </p>
        <div className={`${panel} overflow-x-auto`}>
          <table className="w-full min-w-[540px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3">署名</th>
                <th className="px-4 py-3">媒體</th>
                <th className="px-4 py-3 text-right">證據篇數</th>
                <th className="px-4 py-3 text-right">相似配對篇數</th>
                <th className="px-4 py-3 text-right">內文相同篇數</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {reporters.map((row) => (
                <tr key={`${row.media}:${row.name}`}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthor(row.name);
                        setMedia(row.media);
                        setCountry('all');
                        setKind('all');
                        setSelection(null);
                        document.getElementById('relations-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={linkStyle}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{row.outlet}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.similar}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.identical}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reporters.length && <p className="p-6 text-sm text-zinc-500">回傳的文章證據尚無可用署名；請參考覆蓋率中的「有署名」欄位。</p>}
        </div>
      </section>
    </div>
  );
}

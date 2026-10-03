import Link from 'next/link';
import { fetchSimilarity } from '@/lib/similarity';
import SimilarityExplorer from './SimilarityExplorer';

export const metadata = {
  title: '新聞內文相似度與引用關係',
  description: '比較不同媒體新聞內文的文字重疊，查看明示引用、作者與擷取覆蓋率。',
};

export default async function SimilarityPage({ searchParams }: { searchParams: Promise<{ hours?: string; threshold?: string }> }) {
  const query = await searchParams;
  const hours = [24, 48, 72, 168].includes(Number(query.hours)) ? Number(query.hours) : 48;
  const requested = Number(query.threshold ?? 0.65);
  const threshold = Number.isFinite(requested) ? Math.min(1, Math.max(0.5, requested)) : 0.65;
  const data = await fetchSimilarity(hours, threshold).catch(() => null);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-medium tracking-widest text-brand-700 dark:text-brand-400">內文觀測 · 跨媒體比較</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">新聞相似度與引用關係</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            從文字重疊與文章明示引用，觀察新聞如何在媒體之間流動。相似度與刊登先後無法判定原始來源。
          </p>
        </div>
        <a href="#similarity-method" className="text-sm text-brand-700 hover:underline dark:text-brand-400">
          分析方法與限制 ↓
        </a>
      </div>
      {data ? (
        <SimilarityExplorer key={`${hours}-${threshold}-${data.generatedAt}`} data={data} />
      ) : (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="font-semibold">暫時無法取得內文分析</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            分析服務尚未就緒或連線逾時，請稍後重新載入。這不代表沒有相似文章。
          </p>
          <Link
            href={`/similarity/?hours=${hours}&threshold=${threshold}`}
            className="mt-4 inline-block text-sm text-brand-700 underline dark:text-brand-400"
          >
            重新載入
          </Link>
        </div>
      )}
      <section
        id="similarity-method"
        className="scroll-mt-24 rounded-xl border border-zinc-300 bg-zinc-50 p-5 text-sm leading-7 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="mb-2 text-base font-semibold">如何解讀這份分析</h2>
        <p>
          以成功擷取的內文為基礎，做 Unicode NFKC 正規化、轉小寫並移除標點及空白，再將文字切成五字片段。相似度使用 Dice：共同的不重複片段數
          × 2 ÷ 兩篇的片段數總和。至少需要 200 個正規化字元、100 個共同片段，且有可呈現的連續共同段落，才列為候選。
        </p>
        <p className="mt-2">
          「內文相同」代表正規化後完整文字一致；其他符合門檻的配對標為「高度相似」。覆蓋比是共同片段占較短一篇片段集合的比例，並非抄寫字數。只比較不同媒體，按選定期間中最新的至多
          1,200 篇已擷取內文計算，最多呈現 200 組配對。國別是媒體所屬地區，不是事件發生地或作者國籍。
        </p>
        <p className="mt-2">
          實線代表無方向的文字相似，虛線箭頭從刊登媒體指向內文明示引用的媒體。引用標註可能不完整；未辨識出明示來源時，原始來源仍未知。刊登時間較早不等於原始作者，通訊社轉載、共同稿件與模板也會產生重疊。
        </p>
        <p className="mt-2">
          擷取缺漏、付費牆及尚未處理的文章會影響結果。「無配對」只表示目前樣本未找到符合條件的組合。蕃新聞不納入統計；本頁作者依文章署名字串呈現，同名不代表同一人。分析資料只含短共同段落；可另開已保存內文或媒體原文核對。
        </p>
      </section>
    </div>
  );
}

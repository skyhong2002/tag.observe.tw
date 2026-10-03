import Link from 'next/link';
import { taipei } from '@/lib/api';
import { fetchJournalists, INDEX_HOURS, REPOSITORY_URL, SIMILARITY_CAVEAT } from '@/lib/journalists';
import JournalistTable from './JournalistTable';

export const revalidate = 120;
export const metadata = {
  title: '記者',
  description: '從各媒體文章署名整理出的記者與筆名：各自在哪些媒體刊登、寫了幾篇，以及文章與他站內文相近的對照。',
};
const number = (value: number) => value.toLocaleString('zh-TW');

export default async function JournalistIndexPage({ searchParams }: { searchParams: Promise<{ hours?: string }> }) {
  const query = await searchParams;
  const hours = (INDEX_HOURS as readonly number[]).includes(Number(query.hours)) ? Number(query.hours) : 48;
  const data = await fetchJournalists(hours);
  const periodLabel = (value: number) => (value < 48 ? `${value} 小時` : `${value / 24} 天`);
  return (
    <div className="pb-4">
      <header className="mb-4 border-b border-zinc-300 pb-4 dark:border-zinc-700">
        <h1 className="text-2xl font-semibold tracking-tight">記者</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          從文章署名整理出的人名與筆名，不含媒體、部門、通訊社、職稱與責任編輯。可看每個人在哪些媒體刊登、寫了幾篇，
          以及文章與其他媒體內文相近時的刊登先後。{SIMILARITY_CAVEAT}
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          這些頁面由公開署名自動整理，不是本人建立的檔案。本人不希望出現在記者頁，可在
          <a
            href={`${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('記者頁移除請求')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 hover:underline dark:text-brand-400"
          >
            GitHub 提出移除請求
          </a>
          ，或由個人頁的「關於這一頁」直接送出。Issue 是公開的，請勿填寫名字以外的個資；送出後約 15 分鐘內下架。
        </p>
        <nav aria-label="期間" className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">期間</span>
          {INDEX_HOURS.map((value) => (
            <Link
              key={value}
              href={value === 48 ? '/journalist/' : `/journalist/?hours=${value}`}
              aria-current={value === hours ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 ${
                value === hours
                  ? 'border-brand-600 bg-brand-50 font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300'
                  : 'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900'
              }`}
            >
              {periodLabel(value)}
            </Link>
          ))}
        </nav>
      </header>
      {data ? (
        <>
          <dl className="mb-4 flex flex-wrap gap-x-7 gap-y-3 text-xs text-zinc-500 dark:text-zinc-400">
            <div>
              <dt>具名記者</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {number(data.totals.journalists)}
              </dd>
            </div>
            <div>
              <dt>有人名署名的文章</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {number(data.totals.articles)}
                <span className="ml-1 text-[11px] font-normal">／{number(data.totals.credited)} 篇有署名欄位</span>
              </dd>
            </div>
            <div>
              <dt>相似度索引已比對</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {number(data.index.analyzed)}
                <span className="ml-1 text-[11px] font-normal">
                  篇，{taipei(data.index.from)} 之後刊登；每篇與前後 {data.index.windowDays} 天內其他媒體的文章逐篇比對
                </span>
              </dd>
            </div>
          </dl>
          <JournalistTable rows={data.journalists} />
        </>
      ) : (
        <p role="status" className="py-8 text-sm text-zinc-600 dark:text-zinc-400">
          暫時無法取得記者資料，請稍後重新整理。這不代表沒有具名文章。
        </p>
      )}
    </div>
  );
}

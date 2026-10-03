import Link from 'next/link';
import CountryFlag from '@/components/CountryFlag';
import MediaHoverLink from '@/components/MediaHoverLink';
import MediaTabs from '@/components/MediaTabs';
import { API_ORIGIN } from '@/lib/api';

export const revalidate = 120;
export const metadata = { title: '爬蟲資訊' };

interface MediaCrawler {
  media: string;
  title: string;
  country: string;
  countryCode: string;
  schedule: string;
  crawler?: {
    methods: string[];
    transport: string | null;
    body: string;
    lastVerifiedMethod: string | null;
    links: Array<{ label: string; url: string }>;
  };
}

export default async function CrawlersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const response = await fetch(`${API_ORIGIN}/api/v1/media-stats`, { next: { revalidate }, signal: AbortSignal.timeout(8000) }).catch(
    () => null,
  );
  const data = response?.ok ? ((await response.json()) as { media: MediaCrawler[] }) : null;
  const query = q.trim().toLocaleLowerCase();
  const rows =
    data?.media
      .filter((row) =>
        [row.title, row.media, row.country, ...(row.crawler?.methods ?? []), row.crawler?.transport ?? '']
          .join(' ')
          .toLocaleLowerCase()
          .includes(query),
      )
      .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant')) ?? [];
  return (
    <div className="space-y-5">
      <MediaTabs current="crawlers" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">爬蟲資訊</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">各媒體的抓取方式、下載工具與程式碼。收錄篇數請見「收錄概況」。</p>
      </header>
      <form action="/media/crawlers/" className="flex max-w-xl gap-2">
        <input
          name="q"
          defaultValue={q}
          aria-label="搜尋媒體或抓取方式"
          placeholder="搜尋媒體、國家或抓取方式"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
          搜尋
        </button>
        {q && (
          <Link href="/media/crawlers/" className="self-center text-sm underline">
            清除
          </Link>
        )}
      </form>
      {!data ? (
        <p>爬蟲資訊暫時無法取得，請稍後再試。</p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">{rows.length} 個來源</p>
          <div className="overflow-x-auto rounded-xl border border-zinc-300 dark:border-zinc-800">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-950">
                <tr>
                  {['媒體', '抓取方式', '工具', '收錄內容', '程式碼'].map((label) => (
                    <th key={label} scope="col" className="px-3 py-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((row) => (
                  <tr key={row.media}>
                    <td className="px-3 py-3 align-top">
                      <MediaHoverLink media={row.media} className="flex items-center gap-2 whitespace-nowrap font-medium hover:underline">
                        <CountryFlag code={row.countryCode} country={row.country} />
                        {row.title}
                      </MediaHoverLink>
                      <div className="mt-1 text-xs text-zinc-500">
                        {row.schedule === 'off' ? '未啟用' : row.schedule === 'hourly' ? '每小時' : '每 9 分鐘'}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-xs leading-5">
                      {row.crawler?.methods.join('、') ?? '尚無資料'}
                      {row.crawler?.lastVerifiedMethod && <div className="text-zinc-500">最近驗證：{row.crawler.lastVerifiedMethod}</div>}
                    </td>
                    <td className="max-w-52 px-3 py-3 align-top text-xs leading-5">{row.crawler?.transport ?? '—'}</td>
                    <td className="px-3 py-3 align-top text-xs leading-5">{row.crawler?.body ?? '—'}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex max-w-48 flex-wrap gap-x-3 gap-y-1 text-xs leading-5">
                        {row.crawler?.links.length
                          ? row.crawler.links.map((link) => (
                              <a
                                key={link.url}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${row.title}：${link.label}（另開視窗）`}
                                className="whitespace-nowrap text-brand-700 underline underline-offset-2 dark:text-brand-400"
                              >
                                {link.label} ↗
                              </a>
                            ))
                          : '未設定爬蟲'}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                      沒有符合的媒體或抓取方式。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs leading-6 text-zinc-500">
        HTML 解析是下載網頁後擷取內容；JSON 是讀取公開結構化資料。自動探索會依站點選用 RSS、Sitemap 或
        HTML；最近驗證方式不代表每次都採用相同路徑。🌐 表示跨國團隊，◇ 表示所在地待確認。
      </p>
    </div>
  );
}

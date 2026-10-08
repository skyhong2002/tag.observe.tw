import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eventThreadHeadline } from '@/lib/event-presentation.mts';
import { fetchThreadPart } from '@/lib/event-thread-api';
import type { CompareArticle, CompareCoverage } from '@/lib/headline-compare.mts';
import { mediaNames } from '@/lib/media-names.mts';
import { pageMetadata } from '@/lib/seo.mts';
import HeadlineComparison from './HeadlineComparison';
import styles from './headlines.module.css';

export const revalidate = 120;
interface ThreadData {
  thread: { id: number; majorTags: string[] };
  hours: Array<{
    hourStart: string;
    rank: number;
    major: string[];
    tags: Array<[string, number]>;
    news: Array<{ id: number | null; title: string; media: string; url: string }>;
  }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchThreadPart<ThreadData>(id, '');
  if (!data) return { title: '找不到事件', robots: { index: false } };
  return pageMetadata(
    `/eve/${data.thread.id}/headlines/`,
    `標題比較｜${eventThreadHeadline(data)}`,
    '藍、綠、其他媒體三欄比較，每家媒體先看一則標題，其他報導可個別展開。',
  );
}

export default async function HeadlinesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, coverage] = await Promise.all([fetchThreadPart<ThreadData>(id, ''), fetchThreadPart<CompareCoverage>(id, '/coverage')]);
  if (!data) notFound();
  // Use the event's complete coverage response, not the former two-headline
  // selector, which narrows the thread to one lead and a twelve-hour window.
  const coverageArticles: CompareArticle[] = (coverage?.byOutlet ?? []).flatMap((outlet) =>
    outlet.articles
      .filter((a) => a.title.trim() && /^https?:\/\//.test(a.url))
      .map((a) => ({
        id: a.id,
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt,
        media: outlet.media,
        mediaTitle: outlet.title,
        camp: outlet.camp,
      })),
  );
  // Keep all distinct snapshot reports when the coverage response is missing.
  const seen = new Set<string>();
  const fallback: CompareArticle[] = data.hours
    .flatMap((hour) => hour.news)
    .filter((n) => {
      const key = `${n.media}:${n.url}`;
      if (!n.title.trim() || !/^https?:\/\//.test(n.url) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((n, i) => ({
      id: n.id ?? -(i + 1),
      title: n.title,
      media: n.media,
      mediaTitle: mediaNames[n.media]?.name ?? n.media,
      camp: 'other',
      url: n.url,
      // Snapshot picks have no publication timestamp; don't present the hour as one.
      publishedAt: '',
    }));
  const articles = coverageArticles.length ? coverageArticles : fallback;
  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="麵包屑">
        <Link href="/event/">← 事件表</Link>
        <Link href={`/eve/${data.thread.id}/`}>完整事件頁 ↗</Link>
      </nav>
      <header className={styles.header}>
        <h1>各媒體標題比較</h1>
        <p className={styles.topic}>{eventThreadHeadline(data)}</p>
      </header>
      {articles.length ? (
        <HeadlineComparison articles={articles} focus={eventThreadHeadline(data)} />
      ) : (
        <p className={styles.empty}>這個事件目前沒有可比較的標題。請稍後再試，或返回事件表選擇其他事件。</p>
      )}
    </div>
  );
}

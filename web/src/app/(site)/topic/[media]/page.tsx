import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MediaIcon from '@/components/MediaIcon';
import TopicCard from '@/components/TopicCard';
import TopicCheckStatus from '@/components/TopicCheckStatus';
import { fetchTopicMedia } from '@/lib/pages';
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ media: string }> }): Promise<Metadata> {
  const { media } = await params;
  const data = await fetchTopicMedia(media, 1);
  return { title: data ? `${data.title}的專題` : '議題表' };
}

export default async function TopicMediaPage({ params }: { params: Promise<{ media: string }> }) {
  const { media } = await params;
  const data = await fetchTopicMedia(media, 200);
  if (!data) notFound();
  const recent = data.topics.filter((t) => !t.backlog);
  const backlog = data.topics.filter((t) => t.backlog);
  const covered = data.topics.filter((t) => t.coverage).length;
  return (
    <div className="space-y-5">
      <nav aria-label="breadcrumb" className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/topic/" className="hover:underline">
          議題表
        </Link>
        <span className="mx-2 text-zinc-300">/</span>
        {data.title}
      </nav>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MediaIcon media={data.media} title={data.title} size={24} />
          {data.title}的專題
          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-normal text-zinc-500 hover:text-brand-700"
          >
            官方專題入口 ↗
          </a>
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {data.title}官方專題入口上的議題，依本站首次發現時間排列。每個專題下方是本站近 3
          天從各家媒體抓到的相關報導：這家媒體把什麼做成專題，其他家又怎麼報。
        </p>
        <p className="mt-1 text-xs">
          <TopicCheckStatus check={data.check} />
          {data.count != null && <span className="text-zinc-500"> · 累計追蹤 {data.count} 個專題</span>}
          <span className="text-zinc-500"> · {covered} 個對應到站內標籤</span>
        </p>
      </div>
      {recent.length > 0 && (
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="flex items-baseline gap-2 border-b border-zinc-300 pb-1 font-semibold dark:border-zinc-800">
            近期新增
            <span className="text-xs font-normal text-zinc-500">{recent.length} 個</span>
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {recent.map((t) => (
              <TopicCard key={t.id} topic={t} media={data.media} mediaTitle={data.title} />
            ))}
          </ul>
        </section>
      )}
      {backlog.length > 0 && (
        <section aria-labelledby="backlog-heading">
          <h2 id="backlog-heading" className="flex items-baseline gap-2 border-b border-zinc-300 pb-1 font-semibold dark:border-zinc-800">
            開始追蹤前已上架
            <span className="text-xs font-normal text-zinc-500">{backlog.length} 個 · 長期專區或本站接入前就存在的專題</span>
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {backlog.map((t) => (
              <TopicCard key={t.id} topic={t} media={data.media} mediaTitle={data.title} />
            ))}
          </ul>
        </section>
      )}
      {data.topics.length === 0 && <p className="text-sm text-zinc-600">這家媒體目前沒有抓到專題。</p>}
    </div>
  );
}

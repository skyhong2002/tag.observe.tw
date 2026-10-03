import Link from 'next/link';
import { notFound } from 'next/navigation';
import SafeImage from '@/components/SafeImage';
import SourceLink from '@/components/SourceLink';
import TopicCheckStatus from '@/components/TopicCheckStatus';
import { taipei } from '@/lib/api';
import { isAllowedImage } from '@/lib/images';
import { fetchTopicMedia } from '@/lib/pages';
export const revalidate = 300;

export default async function TopicMediaPage({ params }: { params: Promise<{ media: string }> }) {
  const { media } = await params;
  const data = await fetchTopicMedia(media, 200);
  if (!data) notFound();
  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <Link href="/topic/" className="text-sm text-zinc-600 hover:underline">
          議題表
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
        <a href={data.link} target="_blank" rel="noopener" className="ml-auto text-xs text-zinc-500 hover:text-brand-700">
          來源 ↗
        </a>
      </div>
      <p className="text-xs">
        <TopicCheckStatus check={data.check} />
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.topics.map((t) => (
          <li
            key={t.id}
            id={`topic-${t.id}`}
            className="scroll-mt-32 rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-2">
              <SafeImage
                src={isAllowedImage(t.image) ? t.image : data.mediaImage}
                alt=""
                width={480}
                height={270}
                className="aspect-video w-full rounded-lg object-cover"
              />
              <h2 className="font-medium">{t.title}</h2>
              <span className="text-xs text-zinc-600">{t.time && !t.backlog ? `首次發現 ${taipei(t.time)}` : '開始追蹤前已上架'}</span>
              <SourceLink url={t.url} label="原站專題" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

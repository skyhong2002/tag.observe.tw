import Link from 'next/link';
import { notFound } from 'next/navigation';
import MediaIcon from '@/components/MediaIcon';
import TopicCard, { kindNoun } from '@/components/TopicCard';
import TopicCheckStatus from '@/components/TopicCheckStatus';
import { fetchTopicMedia, kindCount, type MediaTopic, ofKind, type TopicKind } from '@/lib/pages';

export async function topicMediaTitle(media: string, kind: TopicKind) {
  const data = await fetchTopicMedia(media, 1, kind);
  return data ? `${data.title}的${kindNoun(kind)}` : kind === 'feature' ? '專題' : '議題表';
}

/** One outlet's 議題 or 專題, child topics indented under their parent. */
export default async function TopicMediaView({ media, kind }: { media: string; kind: TopicKind }) {
  const noun = kindNoun(kind);
  const data = await fetchTopicMedia(media, 200, kind);
  if (!data) notFound();
  const all = data.topics.filter((t) => ofKind(t, kind));
  // Children belong under their parent, even if the API also lists them flat.
  const nestedIds = new Set(all.flatMap((t) => (t.children ?? []).map((c) => c.id)));
  const topics = all.filter((t) => !nestedIds.has(t.id));
  // 已停更 is a 議題 state; a 專題 never "stops".
  const ended = kind === 'topic' ? topics.filter((t) => t.status === 'ended') : [];
  const live = topics.filter((t) => !ended.includes(t));
  const sections = [
    { key: 'recent', label: '近期新增', note: '', items: live.filter((t) => !t.backlog) },
    {
      key: 'backlog',
      label: '開始追蹤前已上架',
      note: kind === 'topic' ? '本站接入前就存在、仍在更新的議題' : '本站接入前就存在的專題',
      items: live.filter((t) => t.backlog),
    },
    { key: 'ended', label: '已停更', note: '超過 90 天沒有新報導', items: ended },
  ].filter((s) => s.items.length);
  const covered = all.filter((t) => t.coverage).length;
  const count = kindCount(data, kind);
  const base = kind === 'feature' ? '/feature/' : '/topic/';
  const card = (t: MediaTopic) => (
    <TopicCard
      key={t.id}
      topic={t}
      media={data.media}
      mediaTitle={data.title}
      kind={kind}
      nested={
        t.children?.length ? (
          <ul className="mt-1 divide-y divide-zinc-100 border-l-2 border-zinc-200 pl-3 dark:divide-zinc-800 dark:border-zinc-800">
            {t.children.map(card)}
          </ul>
        ) : undefined
      }
    />
  );
  return (
    <div className="space-y-5">
      <nav aria-label="breadcrumb" className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href={base} className="hover:underline">
          {kind === 'feature' ? '專題' : '議題表'}
        </Link>
        <span className="mx-2 text-zinc-300">/</span>
        {data.title}
      </nav>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MediaIcon media={data.media} title={data.title} size={24} />
          {data.title}的{noun}
          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs font-normal text-zinc-500 hover:text-brand-700"
          >
            官方入口 ↗
          </a>
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {data.title}官方入口上的{noun}，依本站首次發現時間排列。每個{noun}下方是本站近 3 天從各家媒體抓到的相關報導：這家媒體把什麼做成
          {noun}，其他家又怎麼報。
        </p>
        {kind === 'feature' && (
          <p className="mt-1 text-xs text-zinc-500">
            專題：一次性的新聞包；持續更新的新聞串請見
            <Link href={`/topic/${encodeURIComponent(data.media)}/`} className="underline underline-offset-2">
              {data.title}的議題
            </Link>
            。
          </p>
        )}
        <p className="mt-1 text-xs">
          <TopicCheckStatus check={data.check} />
          {count != null && (
            <span className="text-zinc-500">
              {' '}
              · 累計追蹤 {count} 個{noun}
            </span>
          )}
          <span className="text-zinc-500"> · {covered} 個對應到站內標籤</span>
        </p>
      </div>
      {sections.map((s) => (
        <section key={s.key} aria-labelledby={`${s.key}-heading`}>
          <h2
            id={`${s.key}-heading`}
            className="flex items-baseline gap-2 border-b border-zinc-300 pb-1 font-semibold dark:border-zinc-800"
          >
            {s.label}
            <span className="text-xs font-normal text-zinc-500">
              {s.items.length} 個{s.note && ` · ${s.note}`}
            </span>
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{s.items.map(card)}</ul>
        </section>
      ))}
      {topics.length === 0 && <p className="text-sm text-zinc-600">這家媒體目前沒有抓到{noun}。</p>}
    </div>
  );
}

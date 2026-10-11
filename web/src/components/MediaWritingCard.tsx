import Link from 'next/link';
import Sparkline from '@/components/Sparkline';
import { type MediaWriting, ROLE_LABEL, ROLES, share, TITLE_TAG_LABEL, TITLE_TAGS } from '@/lib/writing';

// 寫法 in the media sidebar: how often this outlet's articles open by retelling
// a social-media post, who posted, and headline wording, over 90 days.
export default function MediaWritingCard({ data }: { data: MediaWriting | null }) {
  if (!data || data.totals.articles < 30) return null;
  const { totals } = data;
  // Days with few analysed articles (before full crawling began) would only add noise.
  const daily = data.daily.map((d) => (d.articles >= 20 ? d.social / d.articles : null));
  const roles = ROLES.filter((r) => totals.roles[r]).sort((a, b) => totals.roles[b] - totals.roles[a]);
  const href = `/writing/?media=${encodeURIComponent(data.media)}`;
  return (
    <section aria-label="寫法" className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800">
      <h2 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-semibold">
        寫法
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">近 {data.days} 天</span>
      </h2>
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-y-2.5 leading-5">
        <dt className="text-zinc-500 dark:text-zinc-400">轉述貼文</dt>
        <dd className="flex items-center justify-between gap-2">
          <span className="tabular-nums" title={`${totals.social.toLocaleString()}／${totals.articles.toLocaleString()} 篇`}>
            {share(totals.social, totals.articles)}
            <span className="ml-1 text-zinc-500">{totals.social.toLocaleString()} 篇</span>
          </span>
          <Sparkline values={daily} className="h-6 w-20" />
        </dd>
        {roles.length > 0 && (
          <>
            <dt className="text-zinc-500 dark:text-zinc-400">發文者</dt>
            <dd>
              {roles.slice(0, 4).map((r) => (
                <Link
                  key={r}
                  href={`${href}&role=${encodeURIComponent(r)}`}
                  className="mr-2 inline-block whitespace-nowrap hover:underline"
                >
                  {ROLE_LABEL[r]} <span className="tabular-nums text-zinc-500">{share(totals.roles[r], totals.social)}</span>
                </Link>
              ))}
            </dd>
          </>
        )}
        <dt className="text-zinc-500 dark:text-zinc-400">標題用詞</dt>
        <dd>
          {TITLE_TAGS.map((t) => (
            <span key={t} className="mr-2 inline-block whitespace-nowrap" title={TITLE_TAG_LABEL[t].hint}>
              {t} <span className="tabular-nums text-zinc-500">{share(totals.titleTags[t], totals.articles)}</span>
            </span>
          ))}
        </dd>
      </dl>
      <p className="mt-3">
        <Link href={href} className="text-brand-700 hover:underline dark:text-brand-400">
          看這家的轉述報導與各家比較 →
        </Link>
      </p>
    </section>
  );
}

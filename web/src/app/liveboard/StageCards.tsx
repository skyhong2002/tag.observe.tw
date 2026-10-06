import { getImageProps } from 'next/image';
import { FullBar } from '@/components/CampBar';
import { CAMP_LONG, CampDot } from '@/components/EventCampDot';
import { eventHeadline, eventHref, Movement } from '@/components/EventCard';
import MediaIcon from '@/components/MediaIcon';
import { topicHref } from '@/components/TopicCard';
import type { MediaInfo } from '@/lib/api';
import { authorCreditParts } from '@/lib/author-display.mts';
import { selectEventCover, selectEventLead } from '@/lib/event-presentation.mts';
import { type CompareArticle, headlineDiff, headlineSimilarity, type TextPart } from '@/lib/headline-compare.mts';
import { isAllowedImage } from '@/lib/images';
import {
  ago,
  type Card,
  COPY_TONE_LABEL,
  type CoverageReport,
  copyTone,
  eventReports,
  gapLabel,
  headlineExtras,
  headlineGrid,
  type LiveArticle,
  sharedText,
  type ThreadCoverage,
} from '@/lib/liveboard.mts';
import type { Camp } from '@/lib/pages';
import { articleHref } from '@/lib/reading.mts';
import { relationDetails, relationLabel } from '@/lib/relation-label.mts';
import BoardImage from './BoardImage';
import styles from './liveboard.module.css';

// The big rotating card on the left of /liveboard/, one view per card kind.
// The board shows no publisher URLs; headlines, outlets, tags and events open
// this site's own page in a new tab, so the board keeps running.

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' });

const CAMP_RULE: Record<Camp, string> = { blue: 'border-blue-500', green: 'border-emerald-500', other: 'border-zinc-500' };
export const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag)}/`;
export const mediaHref = (media: string) => `/media/${encodeURIComponent(media)}/`;

/** An internal link that opens in a new tab and leaves the board alone. */
export function Go({ href, className = '', children }: { href: string | null; className?: string; children: React.ReactNode }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener" className={`hover:underline ${className}`} onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  );
}

// Image sizes, shared by the cards and the preloader so both request the same optimized file.
const SIZES = { cover: '35vw', topic: '30vw', tile: '15vw', thumb: '10vw', reader: '12vw' } as const;

const preloaded = new Map<string, HTMLImageElement>();
/** Warm the browser cache with the same optimized image a card will render. */
export function preloadImage(src: string | null | undefined, size: keyof typeof SIZES) {
  if (typeof window === 'undefined' || !isAllowedImage(src)) return;
  const key = `${size}|${src}`;
  if (preloaded.has(key)) return;
  const { props } = getImageProps({ src, alt: '', fill: true, sizes: SIZES[size] });
  const img = new Image();
  img.sizes = SIZES[size];
  if (props.srcSet) img.srcset = props.srcSet;
  img.src = props.src;
  preloaded.set(key, img);
  // Keep the cache bounded on a page that runs for hours.
  if (preloaded.size > 200) preloaded.delete(preloaded.keys().next().value as string);
}

/** Every image a card will show, preloaded when it is queued. */
export function preloadCard(card: Card) {
  switch (card.kind) {
    case 'event':
      preloadImage(selectEventCover(card.event.news, selectEventLead(card.event.news, card.event.major), isAllowedImage)?.image, 'cover');
      break;
    case 'burst':
      for (const a of card.articles) preloadImage(a.image, 'tile');
      break;
    case 'topic':
      preloadImage(card.topic.image, 'topic');
      for (const st of card.topic.stories) preloadImage(st.article?.image, 'thumb');
      break;
    default:
  }
}

function Kicker({ children, tone = 'bg-brand-600' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`rounded-md px-2.5 py-1 text-base font-bold tracking-wide text-white ${tone}`}>{children}</span>;
}

/** An article's site tags as plain #tag text after its outlet or headline; each opens the tag page. */
export function TagChips({
  tags,
  max = tags.length,
  compact = false,
  inline = false,
  className = '',
}: {
  tags: readonly string[];
  max?: number;
  compact?: boolean;
  inline?: boolean;
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <span
      className={`${inline ? 'inline leading-tight' : `inline-flex min-w-0 items-center gap-x-2.5 gap-y-0.5 leading-tight ${compact ? 'shrink overflow-hidden' : 'shrink-0 flex-wrap'}`} ${className}`}
    >
      {tags.slice(0, max).map((t) => (
        <Go
          key={t}
          href={tagHref(t)}
          className={`font-medium text-orange-300 ${inline ? 'mr-2.5 inline-block max-w-full break-words last:mr-0' : compact ? 'shrink-0 whitespace-nowrap' : 'max-w-full break-words'}`}
        >
          #{t}
        </Go>
      ))}
    </span>
  );
}

/** Keep authors, source credits and explicit citations distinct. */
export function Reporters({ article, className = '' }: { article: LiveArticle; className?: string }) {
  const parts = authorCreditParts(article.authors, article);
  if (!parts.length) return null;
  return (
    <span
      className={`min-w-0 break-words ${className}`}
      title={parts.map((part) => part.evidence ?? `${part.label} ${part.text}`).join('\n')}
    >
      {parts.map((part, index) => (
        <span key={`${part.label}-${part.text}`}>
          {index > 0 && <span className="text-zinc-600"> · </span>}
          {part.label && `${part.label} `}
          <Go href={part.media ? mediaHref(part.media) : null}>{part.text}</Go>
        </span>
      ))}
    </span>
  );
}

function Diffed({ parts }: { parts: TextPart[] }) {
  // Diff fragments are immutable text positions, not reorderable items.
  return (
    <>
      {parts.map((p, i) =>
        p.different ? (
          <mark
            key={parts.slice(0, i).reduce((length, part) => length + part.text.length, 0)}
            className="rounded bg-amber-400/25 px-0.5 text-amber-100"
          >
            {p.text}
          </mark>
        ) : (
          <span key={parts.slice(0, i).reduce((length, part) => length + part.text.length, 0)}>{p.text}</span>
        ),
      )}
    </>
  );
}

function Byline({ media, title, camp, at, size = 26 }: { media: string; title: string; camp: Camp; at: string; size?: number }) {
  return (
    <div className="flex items-center gap-2 text-lg text-zinc-300">
      <MediaIcon rem media={media} title={title} size={size} />
      <Go href={mediaHref(media)} className="min-w-0 truncate font-semibold text-zinc-100">
        {title}
      </Go>
      <CampDot camp={camp} size="h-2.5 w-2.5" />
      <span className="sr-only">{CAMP_LONG[camp]}</span>
      <span className="ml-auto shrink-0 tabular-nums text-zinc-400">{clock(at)}</span>
    </div>
  );
}

/** One outlet's report on an event: photo, outlet, time, headline and summary. */
// Rows of reports that fit: a shorter stage drops the later pairs rather than
// squeeze them, and a narrow one (a single column) keeps the first two.
const REPORT_FIT = [
  '',
  '',
  '@max-xl:hidden [@container(max-height:32rem)]:hidden',
  '@max-xl:hidden [@container(max-height:32rem)]:hidden',
  '@max-xl:hidden [@container(max-height:38rem)]:hidden',
  '@max-xl:hidden [@container(max-height:38rem)]:hidden',
];
function ReportTile({ r, now, index }: { r: CoverageReport; now: number; index: number }) {
  return (
    <li
      className={`flex min-h-0 min-w-0 gap-3 overflow-hidden rounded-xl border-l-4 bg-zinc-900 p-2.5 ${CAMP_RULE[r.camp]} ${REPORT_FIT[index] ?? ''}`}
    >
      {isAllowedImage(r.image) && (
        <BoardImage
          src={r.image}
          frameClassName="relative aspect-[4/3] h-full max-w-[28%] shrink-0 overflow-hidden rounded-lg bg-zinc-800"
          sizes={SIZES.thumb}
          className="object-cover"
          loading="eager"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-400">
          <MediaIcon rem media={r.media} title={r.mediaTitle} size={16} />
          <Go href={mediaHref(r.media)} className="truncate">
            {r.mediaTitle}
          </Go>
          <span className="ml-auto shrink-0 tabular-nums">{ago(r.publishedAt, now)}</span>
        </div>
        <Go href={articleHref(r)} className={`shrink-0 text-base font-semibold leading-snug ${styles.clamp2}`}>
          {r.title}
        </Go>
        {r.description && <p className={`min-h-0 text-sm leading-snug text-zinc-400 ${styles.clamp2}`}>{r.description}</p>}
      </div>
    </li>
  );
}

function EventStage({
  card,
  media,
  now,
  coverage,
}: {
  card: Extract<Card, { kind: 'event' }>;
  media: MediaInfo;
  now: number;
  coverage: ThreadCoverage | null;
}) {
  const reports = coverage ? eventReports(coverage, 6) : [];
  const e = card.event;
  const cover = selectEventCover(e.news, selectEventLead(e.news, e.major), isAllowedImage);
  const kicker = card.reason === 'new' ? '新事件' : card.reason === 'climb' ? `排名竄升 → 第 ${e.rank} 名` : `熱門事件 第 ${e.rank} 名`;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Covers are landscape photos: keep them wide and short beside the headline, never a tall crop. */}
      <div className="flex shrink-0 gap-5">
        {cover?.image && (
          <BoardImage
            src={cover.image}
            frameClassName="relative aspect-video w-[34%] shrink-0 self-start overflow-hidden rounded-2xl bg-zinc-900"
            sizes={SIZES.cover}
            className="object-cover"
            priority
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Kicker tone={card.reason === 'new' ? 'bg-brand-600' : 'bg-zinc-700'}>{kicker}</Kicker>
            <Movement e={e} className="text-base" />
            {e.firstTime && <span className="text-base text-zinc-400">{ago(e.firstTime, now)}開始</span>}
          </div>
          <h2 className={`text-[1.7rem] font-bold leading-tight ${styles.clamp3}`}>
            <Go href={eventHref(e)}>{eventHeadline(e)}</Go>
          </h2>
          <div className="flex max-h-[4.75rem] flex-wrap gap-2 overflow-hidden">
            {e.major.map((t) => (
              <Go key={t} href={tagHref(t)} className="rounded-full bg-brand-700 px-3 py-1 text-base font-medium text-white">
                {t}
              </Go>
            ))}
            {e.tags
              .filter((t) => !e.major.includes(t.tag))
              .slice(0, 4)
              .map((t) => (
                <Go key={t.tag} href={tagHref(t.tag)} className="rounded-full bg-zinc-800 px-3 py-1 text-base text-zinc-300">
                  {t.tag}
                </Go>
              ))}
          </div>
        </div>
      </div>
      {e.coverage && (
        <div className="flex shrink-0 flex-col gap-2">
          <FullBar c={e.coverage} />
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
              {e.coverage.outlets.slice(0, 28).map((o) => (
                <Go key={o.media} href={mediaHref(o.media)} className="shrink-0">
                  <MediaIcon rem media={o.media} title={media[o.media]?.title} size={24} />
                </Go>
              ))}
            </div>
            <span className="shrink-0 text-base tabular-nums text-zinc-400">
              {e.coverage.outlets.length} 家 · {e.coverage.articles} 篇
            </span>
          </div>
        </div>
      )}
      {reports.length > 0 && (
        <ul className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2.5 overflow-hidden @max-xl:grid-cols-1 [@container(max-height:23rem)]:hidden">
          {reports.map((r, i) => (
            <ReportTile key={r.id} r={r} now={now} index={i} />
          ))}
        </ul>
      )}
      {/* One line per report: shown without report tiles, or when the stage is too short for them (a landscape phone). */}
      <ul
        className={`min-h-0 flex-1 flex-col gap-2.5 overflow-hidden border-t border-zinc-800 pt-3 ${reports.length ? 'hidden [@container(max-height:23rem)]:flex' : 'flex'}`}
      >
        {e.news.slice(0, 7).map((n) => (
          <li key={n.url} className="flex min-w-0 shrink-0 items-center gap-2 text-lg">
            <MediaIcon rem media={n.media} title={media[n.media]?.title} size={20} />
            <Go href={mediaHref(n.media)} className="shrink-0 text-zinc-400">
              {media[n.media]?.title ?? n.media}
            </Go>
            <Go href={articleHref(n)} className="truncate">
              {n.title}
            </Go>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeadlineTile({ a, parts, first }: { a: CompareArticle; parts: TextPart[]; first: boolean }) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden rounded-xl border-t-4 bg-zinc-900 p-4 [@container(max-height:26rem)]:gap-1 [@container(max-height:26rem)]:p-3 ${CAMP_RULE[a.camp]}`}
    >
      <Byline media={a.media} title={a.mediaTitle} camp={a.camp} at={a.publishedAt} size={22} />
      <Go
        href={articleHref(a)}
        className={`text-[1.15rem] font-bold leading-snug [@container(max-height:26rem)]:text-[1.05rem] [@container(max-height:26rem)]:[-webkit-line-clamp:3]! ${styles.clamp4} ${first ? '' : 'text-zinc-100'}`}
      >
        <Diffed parts={parts} />
      </Go>
    </div>
  );
}

function HeadlineStage({ card }: { card: Extract<Card, { kind: 'headline' }> }) {
  const { compare } = card;
  const grid = headlineGrid(compare);
  const extras = headlineExtras(compare, grid);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Kicker tone="bg-violet-600">同一件事・{grid.length + extras.length} 種標題</Kicker>
        <Go href={eventHref(card.event)} className="text-xl font-semibold text-zinc-200">
          {compare.label}
        </Go>
        <span className="text-base text-zinc-500">標示處為與第一則不同的用字</span>
      </div>
      {/*
        Every tile keeps room for its outlet and three lines of headline; a stage
        too short for three rows keeps the first six, a narrow one the first four.
        The one-line list below gets only what is left.
      */}
      <div
        className={`grid flex-1 auto-rows-[minmax(9.5rem,1fr)] gap-3 ${grid.length > 4 ? 'grid-cols-3' : 'grid-cols-2'} @max-xl:grid-cols-2 @max-xl:[&>*:nth-child(n+5)]:hidden [@container(max-height:40rem)]:[&>*:nth-child(n+7)]:hidden [@container(max-height:26rem)]:auto-rows-[minmax(7.5rem,1fr)]`}
      >
        {grid.map((g, i) => (
          <HeadlineTile key={g.article.id} a={g.article} parts={g.parts} first={i === 0} />
        ))}
      </div>
      {extras.length > 0 && (
        <ul
          className={`grid max-h-[30%] min-h-0 auto-rows-min grid-cols-2 gap-x-4 gap-y-1 overflow-hidden @max-xl:grid-cols-1 [@container(max-height:26rem)]:hidden ${styles.fadeOut}`}
        >
          {extras.map((a) => (
            <li key={a.id} className="flex min-w-0 shrink-0 items-center gap-2 text-base">
              <MediaIcon rem media={a.media} title={a.mediaTitle} size={18} />
              <Go href={mediaHref(a.media)} className="shrink-0 text-zinc-400">
                {a.mediaTitle}
              </Go>
              <Go href={articleHref(a)} className="truncate text-zinc-200">
                {a.title}
              </Go>
              <span className="ml-auto shrink-0 text-sm tabular-nums text-zinc-500">{clock(a.publishedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Body text with the passages both articles share tinted. */
function SharedBody({ parts }: { parts: TextPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.different ? (
          <span key={parts.slice(0, i).reduce((length, part) => length + part.text.length, 0)} className="text-zinc-400">
            {p.text}
          </span>
        ) : (
          <mark key={parts.slice(0, i).reduce((length, part) => length + part.text.length, 0)} className="bg-sky-500/20 text-sky-50">
            {p.text}
          </mark>
        ),
      )}
    </>
  );
}

function CopyColumn({ a, side, title, body }: { a: LiveArticle; side: string; title: TextPart[] | null; body: TextPart[] | null }) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border-t-4 bg-zinc-900 p-4 ${CAMP_RULE[a.camp]}`}
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tracking-widest text-zinc-500">{side}</span>
        <div className="min-w-0 flex-1">
          <Byline media={a.media} title={a.mediaTitle} camp={a.camp} at={a.publishedAt} size={22} />
        </div>
      </div>
      <Go href={articleHref(a)} className={`shrink-0 text-[1.3rem] font-bold leading-snug ${styles.clamp2}`}>
        {title ? <Diffed parts={title} /> : a.title}
      </Go>
      <div className="flex min-w-0 shrink-0 flex-col items-start gap-1 text-sm">
        <Reporters article={a} className="font-medium text-zinc-300" />
        <TagChips tags={a.tags} />
      </div>
      <p
        className={`min-h-0 flex-1 overflow-hidden whitespace-pre-line text-[0.95rem] leading-relaxed ${styles.fadeOut} ${styles.paragraphs}`}
      >
        {body ? <SharedBody parts={body} /> : <span className="text-zinc-400">{a.text ?? '（尚未取得內文）'}</span>}
      </p>
    </div>
  );
}

function CopyStage({ card }: { card: Extract<Card, { kind: 'copy' }> }) {
  const { story, featured } = card;
  const tone = copyTone(featured);
  const sameTitle = headlineSimilarity(story.lead.title, featured.article.title) >= 0.95;
  const [lt, ft] = sameTitle ? [null, null] : headlineDiff(story.lead.title, featured.article.title);
  const bodies = story.lead.text && featured.article.text ? sharedText(story.lead.text, featured.article.text) : null;
  const others = story.followers.filter((f) => f !== featured);
  const pct = Math.round(featured.score * 100);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
        <Kicker tone="bg-sky-700">{relationLabel(featured.relation)}</Kicker>
        <span
          className={`rounded-md px-2.5 py-1 text-base font-bold ${tone === 'same' ? 'bg-sky-700 text-white' : 'bg-zinc-700 text-zinc-100'}`}
        >
          {COPY_TONE_LABEL[tone]}
        </span>
        <span className="text-lg text-zinc-300">
          內文相似 <b className="tabular-nums text-zinc-100">{pct}%</b> ·{' '}
          {featured.relation?.publication === 'unknown'
            ? '刊登時間未確認'
            : featured.relation?.publication === 'same' || featured.gapMinutes === 0
              ? '兩站標示同時刊登'
              : `標示刊登${gapLabel(featured.gapMinutes)}`}
        </span>
        <span className="text-base text-zinc-500">
          {bodies ? <mark className="bg-sky-500/20 px-1 text-sky-50">藍底</mark> : null}
          {bodies ? '為兩篇相同的文字' : `共同段落：…${featured.evidence}…`}
          {sameTitle ? '，標題相同' : '，黃底為標題不同處'}
        </span>
        {others.length + story.more > 0 && (
          <span className="ml-auto flex items-center gap-1 text-sm text-zinc-500">
            另 {others.length + story.more} 篇
            {others.slice(0, 6).map((f) => (
              <Go key={f.article.id} href={articleHref(f.article)} className="shrink-0">
                <MediaIcon rem media={f.article.media} title={f.article.mediaTitle} size={20} />
              </Go>
            ))}
          </span>
        )}
      </div>
      {relationDetails(featured.relation, story.lead.mediaTitle, featured.article.mediaTitle) && (
        <p className="shrink-0 text-base text-zinc-300">
          {relationDetails(featured.relation, story.lead.mediaTitle, featured.article.mediaTitle)}
        </p>
      )}
      <div className="flex min-h-0 flex-1 gap-3 @max-xl:flex-col">
        <CopyColumn a={story.lead} side="刊登平台" title={lt} body={bodies?.[0] ?? null} />
        <CopyColumn a={featured.article} side="刊登平台" title={ft} body={bodies?.[1] ?? null} />
      </div>
    </div>
  );
}

function BurstStage({ card, now }: { card: Extract<Card, { kind: 'burst' }>; now: number }) {
  const outlets = new Set(card.articles.map((a) => a.media)).size;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Kicker>剛讀完 {card.total} 篇內文</Kicker>
        <span className="text-lg text-zinc-400">{outlets} 家媒體的最新報導</span>
      </div>
      <ul className="grid min-h-0 flex-1 grid-cols-4 grid-rows-[repeat(2,minmax(0,1fr))] gap-3 @max-xl:grid-cols-2 @max-xl:[&>li:nth-child(n+5)]:hidden">
        {card.articles.map((a) => (
          <li
            key={a.id}
            className={`flex min-h-0 min-w-0 flex-col gap-1.5 overflow-y-auto rounded-xl border-t-4 bg-zinc-900 p-3 ${CAMP_RULE[a.camp]}`}
          >
            {isAllowedImage(a.image) && (
              <BoardImage
                src={a.image}
                frameClassName="relative aspect-video min-h-0 max-h-[35%] shrink overflow-hidden rounded-lg bg-zinc-800 [@container(max-height:26rem)]:hidden"
                sizes={SIZES.tile}
                className="object-cover"
                loading="eager"
              />
            )}
            <div className="flex shrink-0 items-center gap-1.5 text-sm text-zinc-400">
              <MediaIcon rem media={a.media} title={a.mediaTitle} size={18} />
              <Go href={mediaHref(a.media)} className="truncate">
                {a.mediaTitle}
              </Go>
              <span className="ml-auto shrink-0 tabular-nums">{ago(a.publishedAt, now)}</span>
            </div>
            <Go href={articleHref(a)} className={`shrink-0 text-base font-semibold leading-snug ${styles.clamp3}`}>
              {a.title}
            </Go>
            <Reporters article={a} className="shrink-0 text-sm text-zinc-400" />
            <TagChips tags={a.tags} className="text-sm" />
            {a.text && (
              <p className={`min-h-0 flex-1 overflow-hidden whitespace-pre-line text-sm leading-relaxed text-zinc-400 ${styles.fadeOut}`}>
                {a.text}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopicStage({ card, now }: { card: Extract<Card, { kind: 'topic' }>; now: number }) {
  const t = card.topic;
  const label = `${t.isNew ? '新' : ''}${t.kind === 'feature' ? '專題' : '議題'}${t.isNew ? '上架' : '更新'}`;
  const href = topicHref(t.media, String(t.id), t.kind);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 gap-4">
        {isAllowedImage(t.image) && (
          <BoardImage
            src={t.image}
            frameClassName="relative aspect-video w-[30%] shrink-0 self-start overflow-hidden rounded-2xl bg-zinc-900"
            sizes={SIZES.topic}
            className="object-cover"
            priority
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Kicker tone="bg-teal-700">{label}</Kicker>
            <span className="text-base text-zinc-400">{ago(t.at, now)}</span>
            {t.storyCount !== null && <span className="text-base text-zinc-400">頁面上 {t.storyCount} 篇報導</span>}
          </div>
          <div className="flex items-center gap-2 text-lg text-zinc-300">
            <MediaIcon rem media={t.media} title={t.mediaTitle} size={24} />
            <Go href={mediaHref(t.media)} className="font-semibold text-zinc-100">
              {t.mediaTitle}
            </Go>
          </div>
          <h2 className={`text-[2.1rem] font-bold leading-tight ${styles.clamp2}`}>
            <Go href={href}>{t.title}</Go>
          </h2>
        </div>
      </div>
      {t.stories.length > 0 && (
        <ul className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3 overflow-hidden @max-xl:grid-cols-1 @max-xl:[&>li:nth-child(n+3)]:hidden">
          {t.stories.map((st) => {
            const a = st.article;
            return (
              <li key={st.url ?? st.title} className="flex min-h-0 min-w-0 gap-3 overflow-y-auto rounded-xl bg-zinc-900 p-3">
                {a && isAllowedImage(a.image) && (
                  <BoardImage
                    src={a.image}
                    frameClassName="relative aspect-[4/3] w-[32%] shrink-0 self-start overflow-hidden rounded-lg bg-zinc-800"
                    sizes={SIZES.thumb}
                    className="object-cover"
                    loading="eager"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="shrink-0 text-sm text-zinc-400">
                    {st.date && <span className="tabular-nums">{ago(st.date, now)}</span>}
                  </div>
                  <Go href={a ? articleHref(a) : href} className={`shrink-0 text-base font-semibold leading-snug ${styles.clamp2}`}>
                    {st.title}
                  </Go>
                  {a && <Reporters article={a} className="shrink-0 text-sm text-zinc-400" />}
                  {a && <TagChips tags={a.tags} className="text-sm" />}
                  {a?.text && (
                    <p
                      className={`min-h-0 flex-1 overflow-hidden whitespace-pre-line text-sm leading-relaxed text-zinc-400 ${styles.fadeOut}`}
                    >
                      {a.text}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function StageCard({
  card,
  media,
  now,
  coverage,
}: {
  card: Card;
  media: MediaInfo;
  now: number;
  /** Coverage fetched so far, by thread id. */
  coverage: ReadonlyMap<string, ThreadCoverage>;
}) {
  switch (card.kind) {
    case 'event':
      return <EventStage card={card} media={media} now={now} coverage={coverage.get(card.event.relatedEventPk ?? '') ?? null} />;
    case 'headline':
      return <HeadlineStage card={card} />;
    case 'copy':
      return <CopyStage card={card} />;
    case 'burst':
      return <BurstStage card={card} now={now} />;
    case 'topic':
      return <TopicStage card={card} now={now} />;
  }
}

export const CARD_LABEL: Record<Card['kind'], string> = {
  event: '事件',
  headline: '標題對照',
  copy: '跨站對照',
  topic: '議題',
  burst: '新稿',
};
export const CARD_DOT: Record<Card['kind'], string> = {
  event: 'bg-brand-500',
  headline: 'bg-violet-500',
  copy: 'bg-sky-500',
  topic: 'bg-teal-500',
  burst: 'bg-zinc-400',
};
export { SIZES as IMAGE_SIZES };

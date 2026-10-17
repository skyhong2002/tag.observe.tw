import type { Metadata } from 'next';
import SectionTabs, { TabRow } from '@/components/SectionTabs';
import AdminGate from '../AdminGate';
import AvatarReview from '../avatars/AvatarReview';
import TagGroupEditor from '../tag-groups/TagGroupEditor';
import TagVisualReview from '../tag-visuals/TagVisualReview';
import WritingPeople from '../writing/WritingPeople';
import SubmissionSummary from './SubmissionSummary';
import TagArticles from './TagArticles';
import TagSubmissions from './TagSubmissions';

export const metadata: Metadata = { title: '標籤管理 · 管理後台', robots: { index: false } };
const VIEWS = [
  ['groups', '分類與群組'],
  ['submissions', '關係投稿'],
  ['relations', '文章關係'],
  ['pictures', '標籤配圖'],
] as const;
// One picture per tag: a person's sketch or any other tag's image are the same
// thing to readers and reviewers. Older links still land on the merged view.
const ALIASES: Record<string, string> = { avatars: 'pictures', visuals: 'pictures' };

export default async function TagsPage({ searchParams }: { searchParams: Promise<{ view?: string; tag?: string }> }) {
  const query = await searchParams;
  const requested = ALIASES[query.view ?? ''] ?? query.view;
  const view = VIEWS.some(([key]) => key === requested) ? requested : 'groups';
  const tag = query.tag?.trim().slice(0, 60) ?? '';
  return (
    <div className="min-w-0">
      <SectionTabs here="/admin/tags/" />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">標籤管理</h1>
      <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        統一管理人物、機構、地點、事件與概念的分類、圖像，以及它們和文章的關係。一個標籤可屬於多個分類，分類也可以有上下層。
      </p>
      <SubmissionSummary />
      <TabRow
        label="標籤管理功能"
        className="mt-4"
        tabs={VIEWS.map(([key, label]) => ({
          href: `/admin/tags/?${new URLSearchParams({ view: key, ...(tag ? { tag } : {}) })}`,
          label,
          current: view === key,
        }))}
      />
      {view === 'submissions' && <TagSubmissions kind="relation" next="/admin/tags/?view=submissions" />}
      {view === 'groups' && <TagGroupEditor key={tag} initialTag={tag} />}
      {view === 'relations' && (
        <AdminGate next={`/admin/tags/?${new URLSearchParams({ view: 'relations', ...(tag ? { tag } : {}) })}`}>
          <TagArticles initialTag={tag} />
          <WritingPeople />
        </AdminGate>
      )}
      {view === 'pictures' && (
        <>
          <TagSubmissions kind="picture" next="/admin/tags/?view=pictures" />
          <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
            人物標籤（對到 Wikidata 的人）的圖會轉成素描，其他標籤的圖轉成單色；由系統依標籤自動判斷，不必手動分類。
          </p>
          <h2 className="mt-6 text-lg font-semibold">人物標籤的配圖（素描）</h2>
          <AvatarReview />
          <h2 className="mt-10 text-lg font-semibold">其他標籤的配圖</h2>
          <TagVisualReview />
        </>
      )}
    </div>
  );
}

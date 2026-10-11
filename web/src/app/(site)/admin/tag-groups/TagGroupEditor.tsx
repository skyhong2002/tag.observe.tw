'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import AdminGate, { adminFetch, note } from '../AdminGate';

// Tag groups (docs/tag-groups.md): look a tag up and tick its groups, or
// open a group and confirm or reject what the rules filed there. A tag can
// sit in any number of groups. Rejected rows stay rejected through later
// automatic runs.

type Status = 'review' | 'auto' | 'confirmed' | 'rejected';
type Group = { id: number; label: string; kind: 'group' | 'topic'; counts: Partial<Record<Status, number>> };
type Member = {
  tag: string;
  groupId: number;
  source: string;
  status: Status;
  score: number | null;
  note: string | null;
  reviewedBy: string | null;
};
type GroupPage = { groupId: number; status: Status; offset: number; next: number | null; members: Member[] };
type TagPage = {
  tag: string;
  members: Member[];
  wikidata: {
    wikidataId: string | null;
    label: string | null;
    description: string | null;
    types: { id: string; label: string }[] | null;
  } | null;
};

const TABS: [Status, string][] = [
  ['review', '待確認'],
  ['auto', '自動'],
  ['confirmed', '已確認'],
  ['rejected', '已排除'],
];
const SOURCE: Record<string, string> = {
  legacy: '舊站',
  admin: '手動',
  person: '人物資料',
  wikidata: 'Wikidata',
  section: '版別',
  ai: 'AI 建議',
};
const shown = (s: Status | undefined) => s === 'auto' || s === 'confirmed';
const pill = 'min-h-9 rounded-full px-3 text-sm';
const pillOff = 'border border-zinc-300 dark:border-zinc-700';
const pillOn = 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900';
const input = 'min-h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export default function TagGroupEditor() {
  return (
    <AdminGate next="/admin/tag-groups/">
      <p className={note}>
        群組沿用舊站的 28 個身分／類型群組與主題大類，一個標籤可以同時屬於多個群組。自動判斷的來源有舊站標記、人物的 Wikidata
        資料（國籍、現任職位、政黨）、Wikidata 項目類型與各媒體的版別。「待確認」的不會公開；排除後，之後自動重跑也不會再加回來。
      </p>
      <Editor />
    </AdminGate>
  );
}

function Editor() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState('');
  const [tag, setTag] = useState('');
  const [groupId, setGroupId] = useState<number | null>(null);
  const loadGroups = useCallback(() => {
    adminFetch<{ groups: Group[] }>('/auth/admin/tag-groups')
      .then((r) => setGroups(r.groups))
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(loadGroups, [loadGroups]);
  const decide = async (group: number, name: string, status: 'confirmed' | 'rejected') => {
    try {
      await adminFetch(`/auth/admin/tag-groups/${group}/tags/${encodeURIComponent(name)}`, { method: 'PUT', body: { status } });
      setError('');
      loadGroups();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  return (
    <>
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <TagLookup groups={groups} tag={tag} setTag={setTag} decide={decide} />
      {groups && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">群組</h2>
          {(['group', 'topic'] as const).map((kind) => (
            <div key={kind} className="mt-3 flex flex-wrap gap-1">
              {groups
                .filter((g) => g.kind === kind)
                .map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGroupId(g.id === groupId ? null : g.id)}
                    className={`${pill} ${g.id === groupId ? pillOn : pillOff}`}
                  >
                    {g.label}
                    <span className="ml-1 tabular-nums opacity-70">{(g.counts.auto ?? 0) + (g.counts.confirmed ?? 0)}</span>
                    {!!g.counts.review && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-xs tabular-nums text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                        {g.counts.review}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          ))}
          <NewGroup onAdded={loadGroups} onError={setError} />
          {groupId !== null && (
            <GroupMembers
              key={groupId}
              group={groups.find((g) => g.id === groupId) as Group}
              decide={decide}
              openTag={(t) => {
                setTag(t);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </section>
      )}
    </>
  );
}

type Decide = (group: number, tag: string, status: 'confirmed' | 'rejected') => Promise<boolean>;

function TagLookup({ groups, tag, setTag, decide }: { groups: Group[] | null; tag: string; setTag: (t: string) => void; decide: Decide }) {
  const [draft, setDraft] = useState(tag);
  const [page, setPage] = useState<TagPage | null>(null);
  const load = useCallback(() => {
    if (!tag) return setPage(null);
    adminFetch<TagPage>(`/auth/admin/tag-groups/tags/${encodeURIComponent(tag)}`).then(setPage, () => setPage(null));
  }, [tag]);
  useEffect(load, [load]);
  useEffect(() => setDraft(tag), [tag]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTag(draft.trim());
  };
  const byGroup = new Map(page?.members.map((m) => [m.groupId, m]));
  const toggle = async (g: Group) => {
    if (await decide(g.id, tag, shown(byGroup.get(g.id)?.status) ? 'rejected' : 'confirmed')) load();
  };
  const types = page?.wikidata?.types?.map((t) => t.label).join('、');
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">查標籤</h2>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={60}
          placeholder="例如 川普"
          className={`${input} w-56`}
        />
        <button type="submit" className={`${pill} ${pillOff}`}>
          查詢
        </button>
      </form>
      {page && groups && (
        <div className="mt-3">
          <p className="text-sm">
            <a href={`/tag/${encodeURIComponent(page.tag)}/`} className="font-medium underline">
              {page.tag}
            </a>
            {page.wikidata?.wikidataId && (
              <a
                href={`https://www.wikidata.org/wiki/${page.wikidata.wikidataId}`}
                className="ml-2 text-xs text-zinc-500 underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                {page.wikidata.wikidataId}
              </a>
            )}
            {types && <span className="ml-2 text-zinc-600 dark:text-zinc-400">{types}</span>}
          </p>
          <p className={note}>點群組加入或移出；橘框是待確認，刪除線是已排除。</p>
          {(['group', 'topic'] as const).map((kind) => (
            <div key={kind} className="mt-2 flex flex-wrap gap-1">
              {groups
                .filter((g) => g.kind === kind)
                .map((g) => {
                  const m = byGroup.get(g.id);
                  const on = shown(m?.status);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(g)}
                      title={
                        m
                          ? `${SOURCE[m.source] ?? m.source}${m.note ? `：${m.note}` : ''}${m.reviewedBy ? `（${m.reviewedBy}）` : ''}`
                          : undefined
                      }
                      className={`${pill} ${on ? pillOn : pillOff} ${m?.status === 'review' ? 'border-2 border-amber-500' : ''} ${m?.status === 'rejected' ? 'line-through opacity-60' : ''}`}
                    >
                      {g.label}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GroupMembers({ group, decide, openTag }: { group: Group; decide: Decide; openTag: (tag: string) => void }) {
  const [status, setStatus] = useState<Status>(group.counts.review ? 'review' : 'auto');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<GroupPage | null>(null);
  const [adding, setAdding] = useState('');
  const load = useCallback(() => {
    adminFetch<GroupPage>(`/auth/admin/tag-groups/${group.id}?status=${status}&offset=${offset}`).then(setPage, () => setPage(null));
  }, [group.id, status, offset]);
  useEffect(load, [load]);
  const act = async (tag: string, to: 'confirmed' | 'rejected') => {
    if (await decide(group.id, tag, to)) load();
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const tag = adding.trim();
    if (tag && (await decide(group.id, tag, 'confirmed'))) {
      setAdding('');
      load();
    }
  };
  return (
    <div className="mt-6">
      <h3 className="font-semibold">{group.label}</h3>
      <form onSubmit={add} className="mt-2 flex gap-2">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          maxLength={60}
          placeholder="加入標籤"
          className={`${input} w-56`}
        />
        <button type="submit" className={`${pill} ${pillOff}`}>
          加入
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setStatus(key);
              setOffset(0);
            }}
            className={`${pill} ${key === status ? pillOn : pillOff}`}
          >
            {label}
            <span className="ml-1 tabular-nums opacity-70">{group.counts[key] ?? 0}</span>
          </button>
        ))}
      </div>
      {!page ? (
        <p className={note}>載入中…</p>
      ) : !page.members.length ? (
        <p className={note}>沒有標籤。</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {page.members.map((m) => (
            <li key={m.tag} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <button type="button" onClick={() => openTag(m.tag)} className="font-medium underline">
                {m.tag}
              </button>
              <span className="text-xs text-zinc-500">{SOURCE[m.source] ?? m.source}</span>
              {m.note && <span className="text-zinc-600 dark:text-zinc-400">{m.note}</span>}
              {m.reviewedBy && <span className="text-xs text-zinc-500">{m.reviewedBy}</span>}
              <span className="ml-auto flex gap-1">
                {m.status !== 'confirmed' && (
                  <button type="button" onClick={() => act(m.tag, 'confirmed')} className={`${pill} ${pillOff} hover:border-brand-600`}>
                    {m.status === 'rejected' ? '加回' : '確認'}
                  </button>
                )}
                {m.status !== 'rejected' && (
                  <button type="button" onClick={() => act(m.tag, 'rejected')} className={`${pill} ${pillOff} hover:border-red-600`}>
                    排除
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {page && (page.offset > 0 || page.next !== null) && (
        <div className="mt-4 flex gap-2 text-sm">
          <button
            type="button"
            disabled={page.offset === 0}
            onClick={() => setOffset(Math.max(0, page.offset - 100))}
            className={`${pill} ${pillOff} disabled:opacity-40`}
          >
            上一頁
          </button>
          <button
            type="button"
            disabled={page.next === null}
            onClick={() => page.next !== null && setOffset(page.next)}
            className={`${pill} ${pillOff} disabled:opacity-40`}
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}

function NewGroup({ onAdded, onError }: { onAdded: () => void; onError: (message: string) => void }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'group' | 'topic'>('group');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      await adminFetch('/auth/admin/tag-groups', { method: 'POST', body: { label: label.trim(), kind } });
      setLabel('');
      onAdded();
    } catch (err) {
      onError((err as Error).message);
    }
  };
  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={32} placeholder="新群組名稱" className={`${input} w-40`} />
      <select value={kind} onChange={(e) => setKind(e.target.value as 'group' | 'topic')} className={input}>
        <option value="group">身分／類型群組</option>
        <option value="topic">主題大類</option>
      </select>
      <button type="submit" className={`${pill} ${pillOff}`}>
        新增群組
      </button>
    </form>
  );
}

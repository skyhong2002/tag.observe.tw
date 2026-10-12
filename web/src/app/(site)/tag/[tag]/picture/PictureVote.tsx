'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loginHref, useSession } from '@/lib/session';

// Vote for a tag's picture or upload one (docs/tag-pictures.md). The most
// voted candidate is the tag's picture unless an admin locked one; admins
// lock or unlock here too. Explanations live in the footer's method notes.

type Candidate = {
  rank: number;
  kind: 'sketch' | 'place' | 'flag' | 'logo' | 'emoji';
  value: string | null;
  note: string | null;
  pageUrl: string | null;
  image: string | null;
  large: string | null;
  votes: number;
  uploaded: boolean;
  mine: boolean;
};
type State = {
  tag: string;
  kind: 'avatar' | 'visual';
  locked: boolean;
  hidden: boolean;
  shownRank: number | null;
  myVote: number | null;
  admin: boolean;
  uploadsLeft: number;
  candidates: Candidate[];
};

const note = 'mt-3 text-sm text-zinc-600 dark:text-zinc-400';
const button = 'min-h-9 rounded-full border border-zinc-300 px-3 text-sm hover:border-brand-600 dark:border-zinc-700';

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    ...(init.body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(body.error ?? `HTTP ${response.status}`);
  return body as T;
}

export default function PictureVote({ tag }: { tag: string }) {
  const session = useSession();
  if (!session) return <p className={note}>載入中…</p>;
  if (!session.enabled) return <p className={note}>登入功能尚未開放。</p>;
  if (!session.user)
    return (
      <p className={note}>
        <a href={loginHref(`/tag/${encodeURIComponent(tag)}/picture/`)} className="text-brand-700 underline dark:text-brand-400">
          登入
        </a>
        後可以投票選這個標籤的圖，或上傳一張。
      </p>
    );
  return <Board tag={tag} />;
}

function Board({ tag }: { tag: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const latest = useRef(0);
  const path = `/auth/pictures/${encodeURIComponent(tag)}`;
  const load = useCallback(() => {
    const id = ++latest.current;
    call<State>(path)
      .then((s) => {
        if (id !== latest.current) return;
        setState(s);
        setError('');
      })
      .catch((e: Error) => setError(e.message));
  }, [path]);
  useEffect(load, [load]);
  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (!state) return <p className={note}>{error || '載入中…'}</p>;
  const vote = (rank: number | null) => act(() => call(`${path}/vote`, { method: 'PUT', body: { rank } }));
  const lock = (rank: number | null) => act(() => call(`${path}/lock`, { method: 'PUT', body: { rank } }));
  return (
    <>
      <p className={note}>
        {state.hidden
          ? '管理員目前隱藏了這個標籤的圖；票數照算。'
          : state.locked
            ? '管理員選定了目前的圖；票數照算，解除選定後由票數決定。'
            : '票數最多的那張就是這個標籤的圖。每人一票，可以改投。'}
      </p>
      {state.admin && state.kind === 'avatar' && (
        <div className={note}>
          <p>如果這個標籤指的是品牌、組織或其他事物，可以更正種類後上傳 logo。</p>
          <button
            type="button"
            className={`${button} mt-2`}
            onClick={() => act(() => call(`${path}/kind`, { method: 'PUT', body: { kind: 'visual' } }))}
          >
            這不是人物，改用一般圖片
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {state.candidates.length ? (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {state.candidates.map((c) => (
            <Card key={c.rank} c={c} state={state} onVote={vote} onLock={lock} />
          ))}
        </div>
      ) : (
        <p className={note}>還沒有任何圖，上傳第一張吧。</p>
      )}
      {state.admin && state.locked && (
        <button type="button" className={`${button} mt-4`} onClick={() => lock(null)}>
          解除選定，改由票數決定
        </button>
      )}
      <Upload key={state.kind} tag={tag} kind={state.kind} left={state.uploadsLeft} onDone={load} />
    </>
  );
}

function Card({
  c,
  state,
  onVote,
  onLock,
}: {
  c: Candidate;
  state: State;
  onVote: (rank: number | null) => void;
  onLock: (rank: number | null) => void;
}) {
  const shown = state.shownRank === c.rank && !state.hidden;
  const mine = state.myVote === c.rank;
  return (
    <div className={`w-36 rounded-lg border-2 p-1.5 text-xs ${shown ? 'border-brand-600' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <span className="flex h-[120px] items-center justify-center overflow-hidden">
        {c.kind === 'emoji' ? (
          <span className="text-6xl leading-none">{c.value}</span>
        ) : c.image ? (
          <img src={c.large ?? c.image} alt="" className="max-h-[120px] max-w-full object-contain" />
        ) : null}
      </span>
      <span className="mt-1 block tabular-nums">
        {c.votes} 票{shown && ' · 使用中'}
      </span>
      <span className="block truncate text-zinc-500" title={c.note ?? undefined}>
        {c.uploaded ? (c.mine ? '你上傳的' : '讀者上傳') : (c.note ?? '自動找到')}
      </span>
      <button
        type="button"
        onClick={() => onVote(mine ? null : c.rank)}
        aria-pressed={mine}
        className={`mt-1.5 w-full rounded-full px-2 py-1 ${mine ? 'bg-brand-600 text-white' : 'border border-zinc-300 hover:border-brand-600 dark:border-zinc-700'}`}
      >
        {mine ? '已投（再按取消）' : '投這張'}
      </button>
      {state.admin && !(state.locked && shown) && (
        <button type="button" onClick={() => onLock(c.rank)} className="mt-1 w-full rounded-full px-2 py-1 text-zinc-500 underline">
          管理員選定
        </button>
      )}
    </div>
  );
}

function Upload({ tag, kind, left, onDone }: { tag: string; kind: State['kind']; left: number; onDone: () => void }) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const path = `/auth/pictures/${encodeURIComponent(tag)}`;
  const upload = async (file: File) => {
    setMessage('');
    setBusy('上傳中…');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const sent = await call<{ jobId?: string }>(`${path}/upload`, { method: 'POST', body: { image: btoa(binary), agree: true } });
      if (sent.jobId) {
        setBusy('轉素描中…（通常一兩分鐘內）');
        for (;;) {
          await new Promise((r) => setTimeout(r, 3000));
          const job = await call<{ state: string; error: string | null }>(`/auth/pictures/jobs/${encodeURIComponent(sent.jobId)}`);
          if (job.state === 'completed' || job.state === 'failed') {
            if (job.error) throw Error(`沒有用上：${job.error}`);
            break;
          }
        }
      }
      setMessage('已加入候選，並算你投它一票。');
      onDone();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="mt-6 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
      <h2 className="font-semibold">上傳一張</h2>
      <p className={note}>
        {kind === 'avatar' ? '人物的照片會轉成素描；請用只有這個人、臉清楚的照片。' : '圖會去背、裁邊並轉成網站的單色。'}
        今天還能上傳 {left} 張。
      </p>
      <label className="mt-3 flex items-start gap-2">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
        <span>我有權使用這張圖（自己拍的、官方提供的，或允許改作的開放授權）。</span>
      </label>
      <label
        className={`${button} mt-3 inline-flex items-center ${agree && !busy && left > 0 ? 'cursor-pointer' : 'pointer-events-none opacity-50'}`}
      >
        {busy || '選擇圖片'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="sr-only"
          disabled={!agree || !!busy || left <= 0}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />
      </label>
      {message && <p className="mt-2 text-zinc-600 dark:text-zinc-400">{message}</p>}
    </section>
  );
}

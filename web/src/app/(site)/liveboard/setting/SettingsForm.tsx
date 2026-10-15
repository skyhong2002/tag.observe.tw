'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { button, field, note, primary } from '@/app/(site)/my/ReaderGate';
import { EVENT_FRAMES, stayOf } from '@/app/liveboard/scenes';
import { DEFAULTS, INTERVALS, LENSES, LIMITS, type LiveboardSettings, settingsQuery } from '@/app/liveboard/settings';
import { saveSettings, useSavedSettings } from '@/app/liveboard/useSettings';
import { loginHref, useSession } from '@/lib/session';

// /liveboard/setting/: which board /liveboard/ opens on, and how the simple
// one plays. Saved to the account when signed in, else on this device.

const lensOf = (key: string) => LENSES.find((l) => l.key === key);
/** "18 小時", or days and hours past a day: "1 天 12 小時". */
const span = (hours: number) => (hours < 24 ? `${hours} 小時` : `${Math.floor(hours / 24)} 天${hours % 24 ? ` ${hours % 24} 小時` : ''}`);
const section = 'mt-8';
const heading = 'text-lg font-semibold';
const box = 'rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';

export default function SettingsForm() {
  const saved = useSavedSettings();
  const session = useSession();
  const [draft, setDraft] = useState<LiveboardSettings | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** What the board uses now: the saved settings, until the next save. */
  const [stored, setStored] = useState<LiveboardSettings | null>(null);
  useEffect(() => {
    if (!saved) return;
    setDraft(saved);
    setStored(saved);
  }, [saved]);
  if (!draft) return <p className={note}>載入中…</p>;

  const set = (change: Partial<LiveboardSettings>) => {
    setDraft({ ...draft, ...change });
    setStatus(null);
  };
  const toggle = (key: string) =>
    set({ lenses: draft.lenses.includes(key) ? draft.lenses.filter((k) => k !== key) : [...draft.lenses, key] });
  const move = (key: string, by: number) => {
    const at = draft.lenses.indexOf(key);
    const to = at + by;
    if (at < 0 || to < 0 || to >= draft.lenses.length) return;
    const lenses = [...draft.lenses];
    [lenses[at], lenses[to]] = [lenses[to], lenses[at]];
    set({ lenses });
  };
  const save = async () => {
    if (!draft.lenses.length) return setStatus({ tone: 'error', text: '至少要選一個鏡頭。' });
    setBusy(true);
    try {
      const where = await saveSettings(draft);
      setStored(draft);
      setStatus({ tone: 'ok', text: where === 'account' ? '已存到帳號，登入的裝置都會用這組設定。' : '已存在這台裝置。' });
    } catch (error) {
      setStatus({ tone: 'error', text: `存檔失敗：${(error as Error).message}` });
    } finally {
      setBusy(false);
    }
  };
  const off = LENSES.filter((l) => !draft.lenses.includes(l.key));
  // A cloud: about 1.5 s to fade in and 4 s for each hour's animation, plus the stays.
  // A scene: a second to fade each frame in, plus its stay; events show EVENT_FRAMES of them.
  const perLens = Math.round(1.5 + draft.history * (4 + draft.step) + draft.hold);
  const perScene = (scene: 'events' | 'board') => (scene === 'events' ? EVENT_FRAMES : 1) * (1 + stayOf(scene, true, draft));
  const round = draft.lenses.reduce((n, key) => {
    const lens = lensOf(key);
    return n + (!lens ? 0 : lens.scene === 'cloud' || lens.scene === 'compare' ? perLens : perScene(lens.scene));
  }, 0);
  const user = session?.user;
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);

  return (
    <>
      <section className={section}>
        <h2 className={heading}>看板</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['simple', '精簡版', '文字雲、事件與議題排行，一個鏡頭接一個鏡頭播放（預設）'],
              ['full', '完整版', '新進新聞、事件、標題對照與轉載比對輪流顯示'],
            ] as const
          ).map(([mode, label, text]) => (
            <label
              key={mode}
              className={`cursor-pointer rounded-lg border px-4 py-3 ${
                draft.mode === mode
                  ? 'border-brand-600 bg-white ring-1 ring-brand-600 dark:bg-zinc-900'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
              }`}
            >
              <input type="radio" name="mode" className="sr-only" checked={draft.mode === mode} onChange={() => set({ mode })} />
              <span className="block font-semibold">{label}</span>
              <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">{text}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <Link href="/liveboard/" className={primary}>
            開啟看板 →
          </Link>
          {/* The draft as query parameters, in a new tab, so it can be tried without saving. */}
          <a href={`/liveboard/?${settingsQuery(draft)}`} target="_blank" rel="noopener" className={button}>
            預覽目前設定 ↗
          </a>
          {dirty && (
            <span className="text-amber-700 dark:text-amber-400">有尚未存檔的變更：「開啟看板」用存檔的設定，「預覽」用目前的設定。</span>
          )}
        </div>
      </section>

      <section className={section}>
        <h2 className={heading}>設定</h2>
        {draft.mode === 'full' ? (
          <p className={note}>
            完整版輪流顯示新進新聞、新事件、各家標題對照與轉載比對，目前沒有可以調整的項目。選「精簡版」可以調整播放的鏡頭、時間跨度、變化量與大小。
          </p>
        ) : (
          <>
            <h3 className="mt-4 text-sm font-semibold">鏡頭（依序播放）</h3>
            <ol className={`mt-2 divide-y divide-zinc-200 text-sm dark:divide-zinc-800 ${box}`}>
              {draft.lenses.map((key, i) => {
                const lens = lensOf(key);
                if (!lens) return null;
                return (
                  <li key={key} className="flex items-center gap-3 px-3 py-2">
                    <input type="checkbox" checked onChange={() => toggle(key)} aria-label={`不播「${lens.title}」`} />
                    <span className="w-1.5 self-stretch rounded-full dark:hidden" style={{ background: lens.accent }} aria-hidden />
                    <span className="hidden w-1.5 self-stretch rounded-full dark:block" style={{ background: lens.dark }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{lens.title}</span>
                      <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">{lens.note}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => move(key, -1)}
                      disabled={i === 0}
                      className="px-1 text-zinc-500 hover:text-brand-700 disabled:opacity-30 dark:text-zinc-400 dark:hover:text-brand-400"
                      aria-label="往前"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(key, 1)}
                      disabled={i === draft.lenses.length - 1}
                      className="px-1 text-zinc-500 hover:text-brand-700 disabled:opacity-30 dark:text-zinc-400 dark:hover:text-brand-400"
                      aria-label="往後"
                    >
                      ↓
                    </button>
                  </li>
                );
              })}
              {off.map((lens) => (
                <li key={lens.key} className="flex items-center gap-3 px-3 py-2 text-zinc-500 dark:text-zinc-400">
                  <input type="checkbox" checked={false} onChange={() => toggle(lens.key)} aria-label={`播放「${lens.title}」`} />
                  <span className="w-1.5 self-stretch rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{lens.title}</span>
                    <span className="ml-2 text-xs">{lens.note}</span>
                  </span>
                </li>
              ))}
            </ol>

            <h3 className="mt-6 text-sm font-semibold">時間跨度</h3>
            <fieldset className="mt-2 flex flex-wrap gap-2">
              <legend className="sr-only">每格間隔</legend>
              {INTERVALS.map((hours) => (
                <label
                  key={hours}
                  className={`${button} cursor-pointer ${draft.interval === hours ? 'border-brand-600 bg-brand-50 font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300' : ''}`}
                >
                  <input
                    type="radio"
                    name="interval"
                    className="sr-only"
                    checked={draft.interval === hours}
                    onChange={() => set({ interval: hours })}
                  />
                  每格 {hours % 24 ? `${hours} 小時` : `${hours / 24} 天`}
                </label>
              ))}
            </fieldset>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {draft.history ? `從 ${span(draft.history * draft.interval)}前播到現在，共 ${draft.history + 1} 格。` : '只看現在。'}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <NumberField
                label="往前幾格"
                note="從幾格前開始播到現在；0 只看現在"
                value={draft.history}
                limits={LIMITS.history}
                unit="格"
                onChange={(history) => set({ history })}
              />
              <NumberField
                label="每小時停留"
                note="動畫播完後，過去每一格再停幾秒"
                value={draft.step}
                limits={LIMITS.step}
                unit="秒"
                onChange={(step) => set({ step })}
              />
              <NumberField
                label="現在停留"
                note="播到現在、動畫播完後再停幾秒才換鏡頭"
                value={draft.hold}
                limits={LIMITS.hold}
                unit="秒"
                onChange={(hold) => set({ hold })}
              />
            </div>

            <h3 className="mt-6 text-sm font-semibold">變化量</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              換到下一格時，在字旁邊（有圖的標在名字旁邊）標出和上一格相比的變化；每個鏡頭的第一格沒有上一格可比，不顯示。
            </p>
            <fieldset className="mt-2 flex flex-wrap gap-2">
              <legend className="sr-only">變化量</legend>
              {(
                [
                  ['off', '不顯示'],
                  ['rank', '名次變化（▲3 ▼2 New）'],
                  ['value', '分數變化（+12% −8% New）'],
                ] as const
              ).map(([change, label]) => (
                <label
                  key={change}
                  className={`${button} cursor-pointer ${draft.change === change ? 'border-brand-600 bg-brand-50 font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300' : ''}`}
                >
                  <input
                    type="radio"
                    name="change"
                    className="sr-only"
                    checked={draft.change === change}
                    onChange={() => set({ change })}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <h3 className="mt-6 text-sm font-semibold">大小</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              平板和手機不能用瀏覽器縮放時，在這裡調：畫面調小、關鍵字調多，就能放進更多內容。
            </p>
            <div className="mt-3 grid gap-5 sm:grid-cols-2">
              <RangeField
                label="畫面大小"
                value={draft.scale}
                limits={LIMITS.scale}
                step={5}
                show={(v) => `${v}%`}
                hint="字、標題、頁首一起縮放"
                onChange={(scale) => set({ scale })}
              />
              <RangeField
                label="關鍵字數量"
                value={draft.words}
                limits={LIMITS.words}
                step={4}
                show={(v) => `${v} 個`}
                hint="放不下的詞會略過"
                onChange={(words) => set({ words })}
              />
            </div>

            <label className="mt-6 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={draft.pictures} onChange={(e) => set({ pictures: e.target.checked })} />
              <span>
                <span className="font-medium">顯示圖片</span>
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">人物、國旗、地圖和 logo 畫成圖；關掉只剩文字</span>
              </span>
            </label>

            <p className={note}>
              每個關鍵字鏡頭約 {perLens} 秒，事件約 {Math.round(perScene('events'))} 秒（{EVENT_FRAMES} 個事件），每張排行約{' '}
              {Math.round(perScene('board'))} 秒；{draft.lenses.length} 個鏡頭一輪約 {Math.round(round / 6) / 10} 分鐘。按 ↑ ↓
              或上下滑動換時間點，按 ← → 或左右滑動換鏡頭。
            </p>
          </>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={busy} className={primary}>
          {busy ? '存檔中…' : '存檔'}
        </button>
        <button type="button" onClick={() => set(DEFAULTS)} className={button}>
          恢復預設
        </button>
        {status && (
          <p
            role="status"
            className={`text-sm ${status.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}
          >
            {status.text}
          </p>
        )}
      </div>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {session === null ? null : user ? (
          `已登入 ${user.email}：設定存到帳號，在其他裝置登入也適用。`
        ) : (
          <>
            未登入：設定只存在這台裝置。
            {session.enabled && (
              <>
                {' '}
                <a href={loginHref('/liveboard/setting/')} className="text-brand-700 underline underline-offset-2 dark:text-brand-400">
                  登入
                </a>
                後可存到帳號。
              </>
            )}
          </>
        )}
      </p>
    </>
  );
}

function NumberField({
  label,
  note: hint,
  value,
  limits: [min, max],
  unit,
  onChange,
}: {
  label: string;
  note: string;
  value: number;
  limits: readonly [number, number];
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-semibold">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Math.round(e.target.valueAsNumber || min))))}
          className={`${field} w-20 tabular-nums`}
        />
        <span className="text-zinc-600 dark:text-zinc-400">{unit}</span>
      </span>
      <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
    </label>
  );
}

function RangeField({
  label,
  value,
  limits: [min, max],
  step,
  show,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  limits: readonly [number, number];
  step: number;
  show: (value: number) => string;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="flex items-baseline justify-between">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{show(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand-700 dark:accent-brand-500"
      />
      <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
    </label>
  );
}

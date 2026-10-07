'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

export default function EventRecovery() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (pending || attempt >= 3) return;
    const timer = setTimeout(
      () => {
        setAttempt((value) => value + 1);
        startTransition(() => router.refresh());
      },
      3000 * 2 ** attempt,
    );
    return () => clearTimeout(timer);
  }, [attempt, pending, router]);

  return (
    <>
      <p role="status">{pending || attempt < 3 ? '事件資料載入中，正在自動重試…' : '事件資料暫時無法載入，請稍後再試。'}</p>
      <button
        type="button"
        disabled={pending}
        className="mb-4 rounded border border-current px-4 py-2 text-sm disabled:opacity-50"
        onClick={() => {
          setAttempt(0);
          startTransition(() => router.refresh());
        }}
      >
        {pending ? '載入中…' : '重新載入事件'}
      </button>
      <br />
    </>
  );
}

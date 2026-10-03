'use client';

import { useState } from 'react';
import { readingParagraphs } from '@/lib/reading.mts';

const sizes = [
  { label: '標準', size: 18 },
  { label: '大', size: 20 },
  { label: '特大', size: 22 },
];

export default function ArticleBody({ body }: { body: string }) {
  const [size, setSize] = useState(18);
  const paragraphs = readingParagraphs(body);
  return (
    <section aria-label="文章正文">
      <div className="mb-8 flex items-center justify-between gap-3 border-y border-zinc-200 py-3 dark:border-zinc-800">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">本站保存版本</span>
        <fieldset aria-label="閱讀字級" className="flex items-center gap-1">
          <span className="mr-2 text-xs text-zinc-500 dark:text-zinc-400">字級</span>
          {sizes.map((option) => (
            <button
              key={option.size}
              type="button"
              aria-pressed={size === option.size}
              onClick={() => setSize(option.size)}
              className={`min-h-9 min-w-10 rounded px-2 text-xs ${size === option.size ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      </div>
      <div
        data-article-body
        className="space-y-6 break-words text-zinc-800 dark:text-zinc-200"
        style={{ fontSize: size, lineHeight: 1.95 }}
      >
        {paragraphs.map((paragraph, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Paragraphs keep their original immutable source order.
          <p key={index} className="whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

import Link from 'next/link';
import MethodLink from '@/components/MethodLink';
import { type ArticleWriting as Data, postPhrase, TITLE_TAG_LABEL } from '@/lib/writing';

// 寫法 on the article page: what the article's own text shows about how it was
// written. Shown only when there is something to say.
export default function ArticleWriting({ data }: { data: Data | null }) {
  if (!data || (!data.social && !data.titleTags.length)) return null;
  const post = data.social ? postPhrase(data.social) : null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">寫法</h2>
      <ul className="space-y-3 text-sm">
        {data.social && post && (
          <li className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
            <p className="font-medium">
              本篇開頭轉述{post.who ? <>「{post.who}」</> : '他人'}的{post.platform}貼文
            </p>
            {data.social.evidence && (
              <p className="mt-1 break-words leading-7 text-zinc-600 dark:text-zinc-400">判斷依據：「{data.social.evidence}」</p>
            )}
            <p className="mt-1 text-xs">
              <Link
                href={`/writing/?${new URLSearchParams(data.social.poster ? { poster: data.social.poster } : { role: data.social.role ?? '未知' })}`}
                className="text-brand-700 hover:underline dark:text-brand-400"
              >
                {data.social.poster ? `其他轉述「${data.social.poster}」的報導` : '其他轉述社群貼文的報導'}
              </Link>
            </p>
          </li>
        )}
        {data.titleTags.length > 0 && (
          <li className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-700">
            <p className="font-medium">標題用詞：{data.titleTags.map((t) => TITLE_TAG_LABEL[t].label).join('、')}</p>
            <ul className="mt-1 leading-7 text-zinc-600 dark:text-zinc-400">
              {data.titleTags.map((t) => (
                <li key={t}>{TITLE_TAG_LABEL[t].hint}</li>
              ))}
            </ul>
          </li>
        )}
      </ul>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        只描述文字本身，不評斷報導好壞。 <MethodLink />
      </p>
    </section>
  );
}

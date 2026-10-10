import type { Metadata } from 'next';
import LoginPanel from './LoginPanel';

export const metadata: Metadata = { title: '登入', robots: { index: false } };

// The gateway sends failed sign-ins here with ?error= (app/src/auth/google-login.ts).
const errors: Record<string, string> = {
  state: '登入流程逾時或已在其他分頁完成，請重新登入。',
  cancelled: '已取消 Google 登入。',
  invalid: '無法確認這個 Google 帳號（需要已驗證的 Email），請換個帳號再試。',
  failed: '暫時無法連上 Google，請稍後再試。',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold">登入新文易數</h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        使用 Google 帳號登入。我們只取得你的名字與 Email，不會讀取其他 Google 資料。
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {errors[error] ?? '登入失敗，請重新登入。'}
        </p>
      )}
      <LoginPanel next={next} />
    </div>
  );
}

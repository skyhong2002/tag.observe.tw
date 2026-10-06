import Link from 'next/link';
import OptOutToggle from './OptOutToggle';

export const metadata = {
  title: { absolute: '不計入統計 · 新文易數' },
  description: '讓這個瀏覽器的造訪不送到 Google Analytics，也不列入網站觀測與線上讀者；可隨時恢復。',
  robots: { index: false, follow: true },
};

export default function OptOutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">不計入統計</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          給測試或自己使用的瀏覽器：關閉後，這個瀏覽器在本站的瀏覽、點擊與使用體驗回報都不會送到 Google Analytics，也不會出現在
          <Link href="/observe/" className="text-brand-700 hover:underline dark:text-brand-400">
            網站觀測
          </Link>
          ，也不計入看板的線上讀者數。
        </p>
      </header>
      <OptOutToggle />
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li>設定只存在這個瀏覽器的本站資料中。換瀏覽器、使用無痕視窗，或清除網站資料後，需要再設定一次。</li>
        <li>Safari 可能在 7 天沒有造訪本站後清除網站資料；測試用的 Safari 請定期確認狀態。</li>
        <li>自動化測試工具（Playwright、Puppeteer、Selenium、Lighthouse 等）預設不送統計，不需設定。</li>
        <li>此設定不會回溯排除已送出的紀錄。</li>
      </ul>
    </div>
  );
}

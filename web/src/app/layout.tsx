import type { Metadata, Viewport } from 'next';
import SiteAnalytics from '@/components/SiteAnalytics';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://tag.observe.tw'),
  title: { default: '新文易數：同一件事，各家怎麼說', template: '%s · 新文易數' },
  description: '同一件事，各家怎麼說。台灣新聞總覽、媒體標題對照與關鍵字排行，追蹤熱門事件與議題趨勢',
  applicationName: '新文易數',
  openGraph: { siteName: '新文易數', locale: 'zh_TW' },
  twitter: { card: 'summary_large_image' },
  appleWebApp: { capable: true, title: '新文易數', statusBarStyle: 'default' },
  alternates: { types: { 'application/rss+xml': [{ url: '/feeds/events.xml', title: '新文易數｜新聞事件' }] } },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

// Runs before first paint: a saved choice wins, otherwise follow the system and keep following it.
// Also keeps Chrome's install prompt (it can fire before hydration) for the footer's 安裝 Web App.
const themeScript = `addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e});(function(){try{var m=matchMedia('(prefers-color-scheme: dark)');function a(){var s=localStorage.getItem('theme');document.documentElement.dataset.theme=s==='dark'||s==='light'?s:m.matches?'dark':'light'}a();m.addEventListener('change',a)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className="h-full" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline theme bootstrap, no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}

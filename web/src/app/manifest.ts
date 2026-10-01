import type { MetadataRoute } from 'next';

// Makes the site installable as a Web App (icons from tools/gen-pwa-icons.py).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '新文易數：同一件事，各家怎麼說',
    short_name: '新文易數',
    description: '台灣新聞總覽、各家標題對照、事件與關鍵字排行',
    lang: 'zh-Hant-TW',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#ffffff',
    categories: ['news'],
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '事件表', url: '/event/' },
      { name: '關鍵字排行', url: '/ranking/' },
      { name: '議題表', url: '/topic/' },
    ],
  };
}

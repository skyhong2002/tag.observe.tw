import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// The font stays on the server, never in the page's JS/downloads. No remote
// fonts, publisher images, browser process or chart rendering is needed.
let font: Promise<Buffer> | undefined;
export async function shareCard(title: string, kind: string, description: string) {
  font ??= readFile(join(process.cwd(), 'assets/NotoSansTC-Share.woff'));
  const data = await font;
  const heading = Array.from(title).slice(0, 58).join('') + (Array.from(title).length > 58 ? '…' : '');
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#faf8f4',
        color: '#20201e',
        padding: '54px 64px',
        fontFamily: 'Noto Sans TC',
        fontWeight: 700,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid #d8d2c8',
          paddingBottom: 24,
        }}
      >
        <div style={{ display: 'flex', fontSize: 32, color: '#a54414' }}>新文易數</div>
        <div style={{ display: 'flex', fontSize: 24, color: '#66635e' }}>{kind}</div>
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          fontSize: heading.length > 30 ? 48 : 64,
          lineHeight: 1.45,
          overflow: 'hidden',
        }}
      >
        {heading}
      </div>
      <div style={{ display: 'flex', fontSize: 26, color: '#66635e', marginBottom: 24 }}>{description}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '6px solid #b84f1a', paddingTop: 18, fontSize: 22 }}>
        <span>同一件事，各家怎麼說</span>
        <span>tag.observe.tw</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Noto Sans TC', data, weight: 700, style: 'normal' }],
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400' },
    },
  );
}

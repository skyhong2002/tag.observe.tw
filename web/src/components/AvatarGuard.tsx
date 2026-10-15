'use client';

import { type ReactNode, useState } from 'react';

/**
 * CSS-mask avatars give no signal when their image fails and leave an empty
 * box (and a credit for a picture nobody sees). Probe the same URL once and
 * drop the children if it does not load.
 */
export default function AvatarGuard({ url, children }: { url: string; children: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <>
      {/* biome-ignore lint/performance/noImgElement: a hidden load probe, not a displayed picture */}
      <img src={`${url}${url.includes('?') ? '&' : '?'}layer=fill`} alt="" hidden onError={() => setFailed(true)} />
      {children}
    </>
  );
}

import type React from 'react';
import type { TagVisual as Visual } from '@/lib/api';
import { LICENSE } from './TagPerson';

// The picture of a non-person tag (docs/tag-visuals.md): a place's outline
// and where it is, an organisation's or work's logo in the site's orange, an
// emoji that is exactly the thing, or a line icon. Persons get TagPerson.

const PLACE_CREDIT = '地圖：內政部國土測繪中心（taiwan-atlas）、Natural Earth（world-atlas）';

/** A Lucide icon as a mask, painted the site's orange on light and dark pages. */
export function TagIcon({ url, size = 40 }: { url: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 bg-brand-600 [mask-image:var(--icon)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
      style={{ width: size, height: size, '--icon': `url("${url}")` } as React.CSSProperties}
    />
  );
}

export function VisualPicture({ visual: v, size = 56 }: { visual: Visual; size?: number }) {
  if (v.kind === 'emoji' && v.emoji)
    return (
      <span aria-hidden="true" className="shrink-0 leading-none" style={{ fontSize: size * 0.8 }}>
        {v.emoji}
      </span>
    );
  if (v.kind === 'icon' && v.image) return <TagIcon url={v.image} size={size * 0.75} />;
  const src = v.kind === 'place' ? (v.large ?? v.image) : v.image;
  if (!src) return null;
  // Wordmarks are wide: let them run to 3.5× the height rather than shrink to a sliver.
  if (v.kind === 'logo')
    return <img src={src} alt="" aria-hidden="true" className="h-auto w-auto shrink-0" style={{ maxHeight: size, maxWidth: size * 3.5 }} />;
  return <img src={src} alt="" aria-hidden="true" width={size} height={size} className="shrink-0 object-contain" />;
}

export default function TagVisual({ visual: v }: { visual: Visual }) {
  const s = v.source;
  return (
    <div className="flex items-center gap-3">
      <VisualPicture visual={v} />
      {(v.kind === 'place' || s) && (
        <div className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">
          {v.kind === 'place' && v.label && <p className="text-zinc-800 dark:text-zinc-200">{v.label}</p>}
          <p className="text-xs">
            {v.kind === 'place' && PLACE_CREDIT}
            {s && (
              <>
                標誌取自
                <a href={s.pageUrl} className="mx-0.5 underline" rel="noopener noreferrer" target="_blank">
                  {s.artist ?? 'Wikimedia Commons'}
                </a>
                {s.license &&
                  (s.licenseUrl ? (
                    <a href={s.licenseUrl} className="ml-1 underline" rel="noopener noreferrer license" target="_blank">
                      {LICENSE[s.license] ?? s.license}
                    </a>
                  ) : (
                    <span className="ml-1">{LICENSE[s.license] ?? s.license}</span>
                  ))}
                ，轉為單色
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

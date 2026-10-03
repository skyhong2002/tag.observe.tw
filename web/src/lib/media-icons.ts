import manifest from '../../../app/data/favicon-local.json';

export const mediaIcons = manifest as Record<string, { revision?: string; dark?: 'invert' | 'outline' }>;

export function localMediaIcon(id: string): string | null {
  if (!Object.hasOwn(mediaIcons, id)) return null;
  const revision = mediaIcons[id].revision;
  return `/favicons/${encodeURIComponent(id)}.png${revision ? `?v=${revision}` : ''}`;
}

// Only reviewed monochrome marks are inverted. Colored marks retain their
// colors and get a small light outline when their dark strokes need contrast.
export function mediaIconClass(id: string): string {
  const appearance = mediaIcons[id]?.dark;
  return appearance === 'invert' ? 'dark:invert' : appearance === 'outline' ? 'dark:drop-shadow-[0_0_1px_#fff]' : '';
}

export function graphMediaIcon(image: HTMLImageElement, id: string, dark: boolean): string {
  const appearance = mediaIcons[id]?.dark;
  if (!dark || !appearance) return image.src;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) return image.src;
  if (appearance === 'invert') context.filter = 'invert(1)';
  else {
    context.shadowColor = '#fff';
    context.shadowBlur = 3;
  }
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

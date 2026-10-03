import manifest from '../../../app/data/favicon-local.json';
import { graphBoundaryDiameter } from './graph-edge-boundary.mts';

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

export function graphMediaIcon(image: HTMLImageElement, id: string, dark: boolean, logoSize?: number): string {
  const appearance = mediaIcons[id]?.dark;
  if (!logoSize && (!dark || !appearance)) return image.src;
  const canvas = document.createElement('canvas');
  const padding = logoSize ? (graphBoundaryDiameter(logoSize) / logoSize - 1) / 2 : 0;
  const size = Math.max(image.naturalWidth, image.naturalHeight);
  canvas.width = canvas.height = Math.ceil(size * (1 + 2 * padding));
  const context = canvas.getContext('2d');
  if (!context) return image.src;
  if (dark && appearance === 'invert') context.filter = 'invert(1)';
  else if (dark && appearance === 'outline') {
    context.shadowColor = '#fff';
    context.shadowBlur = 3;
  }
  const scale = canvas.width / (size * (1 + 2 * padding));
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  return canvas.toDataURL('image/png');
}

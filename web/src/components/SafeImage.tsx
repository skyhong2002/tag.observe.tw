import Image, { type ImageProps } from 'next/image';
import { isAllowedImage } from '@/lib/images';

// Outlet favicons stored on this site (tools/fetch-favicons.ts); the API
// returns them as absolute URLs. They are already small PNGs, served as-is.
const FAVICON_BASE = 'https://tag.observe.tw/favicons/';

// next/image restricted to the generated host allowlist; unknown hosts render nothing.
export default function SafeImage({ src, alt = '', ...props }: Omit<ImageProps, 'src'> & { src: string | null | undefined }) {
  if (src?.startsWith(FAVICON_BASE)) return <Image src={`/favicons/${src.slice(FAVICON_BASE.length)}`} alt={alt} unoptimized {...props} />;
  if (!isAllowedImage(src)) return null;
  return <Image src={src} alt={alt} {...props} />;
}

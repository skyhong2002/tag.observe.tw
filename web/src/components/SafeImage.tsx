import Image, { type ImageProps } from 'next/image';
import { isAllowedImage } from '@/lib/images';
import { localMediaIcon, mediaIconClass } from '@/lib/media-icons';

// Outlet favicons stored on this site (tools/fetch-favicons.ts); the API
// returns them as absolute URLs. They are already small PNGs, served as-is.
const FAVICON_BASE = 'https://tag.observe.tw/favicons/';

// next/image restricted to the generated host allowlist; unknown hosts render nothing.
export default function SafeImage({ src, alt = '', ...props }: Omit<ImageProps, 'src'> & { src: string | null | undefined }) {
  if (src?.startsWith(FAVICON_BASE)) {
    const id = src.slice(FAVICON_BASE.length).split('.png')[0];
    return (
      <Image
        {...props}
        src={localMediaIcon(id) ?? `/favicons/${src.slice(FAVICON_BASE.length)}`}
        alt={alt}
        unoptimized
        className={`${props.className ?? ''} ${mediaIconClass(id)}`}
      />
    );
  }
  if (!isAllowedImage(src)) return null;
  return <Image src={src} alt={alt} {...props} />;
}

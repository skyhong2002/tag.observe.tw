import Image, { type ImageProps } from 'next/image';
import { isAllowedImage } from '@/lib/images';

// next/image restricted to the generated host allowlist; unknown hosts render
// nothing. Outlet logos go through MediaIcon, not here.
export default function SafeImage({ src, alt = '', ...props }: Omit<ImageProps, 'src'> & { src: string | null | undefined }) {
  if (!isAllowedImage(src)) return null;
  return <Image src={src} alt={alt} {...props} />;
}

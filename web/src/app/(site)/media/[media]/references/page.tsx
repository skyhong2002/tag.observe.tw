import SourceProfile from '@/components/SourceProfile';
import { outletIdentity } from '../../../../../../../app/src/similarity/attribution';

export const revalidate = 60;
type Props = { params: Promise<{ media: string }>; searchParams: Promise<Record<string, string | undefined>> };
export async function generateMetadata({ params }: Props) {
  return { title: `${outletIdentity((await params).media).name}的來源／引用關係`, robots: { index: false, follow: true } };
}
export default async function ReferencesPage({ params, searchParams }: Props) {
  return <SourceProfile media={(await params).media} query={await searchParams} />;
}

import type { Metadata } from 'next';
import NotFoundContent from '@/components/NotFoundContent';

export const metadata: Metadata = { title: '找不到這個頁面', robots: { index: false } };

export default function NotFound() {
  return <NotFoundContent />;
}

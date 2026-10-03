import type { Metadata } from 'next';
import NotFoundContent from '@/components/NotFoundContent';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';

// Unknown URLs outside the (site) layout land here, so this one brings its own
// header and footer; (site)/not-found.tsx covers notFound() inside the site.

export const metadata: Metadata = { title: '找不到這個頁面', robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <NotFoundContent />
      </main>
      <div className="mx-auto max-w-6xl px-4">
        <SiteFooter />
      </div>
    </>
  );
}

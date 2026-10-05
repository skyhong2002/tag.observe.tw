import ScrollReset from '@/components/ScrollReset';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';

export default function SiteLayout({ children, notes }: { children: React.ReactNode; notes: React.ReactNode }) {
  return (
    <>
      <ScrollReset />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <div className="mx-auto max-w-6xl px-4">
        <SiteFooter notes={notes} />
      </div>
    </>
  );
}

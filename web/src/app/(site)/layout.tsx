import ScrollReset from '@/components/ScrollReset';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';

export default function SiteLayout({ children, notes }: { children: React.ReactNode; notes: React.ReactNode }) {
  // A full-height column so short pages still keep 資料來源與計算方式 and the footer at the bottom.
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollReset />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <div className="mx-auto w-full max-w-6xl px-4">
        <SiteFooter notes={notes} />
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import MyTabs from './MyTabs';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-4">
      <h1 className="text-2xl font-semibold tracking-tight">我的新文易數</h1>
      <MyTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}

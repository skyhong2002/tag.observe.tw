import type { Metadata } from 'next';
import MyFeed from './MyFeed';
import ReaderGate from './ReaderGate';

export const metadata: Metadata = { title: '我的動態' };

export default function Page() {
  return (
    <ReaderGate next="/my/">
      <MyFeed />
    </ReaderGate>
  );
}

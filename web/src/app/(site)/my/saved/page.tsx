import type { Metadata } from 'next';
import ReaderGate from '../ReaderGate';
import Saved from './Saved';

export const metadata: Metadata = { title: '我的收藏' };

export default function Page() {
  return (
    <ReaderGate next="/my/saved/">
      <Saved />
    </ReaderGate>
  );
}

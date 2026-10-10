import type { Metadata } from 'next';
import ReaderGate from '../ReaderGate';
import Following from './Following';

export const metadata: Metadata = { title: '追蹤清單' };

export default function Page() {
  return (
    <ReaderGate next="/my/following/">
      <Following />
    </ReaderGate>
  );
}

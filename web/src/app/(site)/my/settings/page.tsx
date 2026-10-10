import type { Metadata } from 'next';
import ReaderGate from '../ReaderGate';
import Settings from './Settings';

export const metadata: Metadata = { title: '設定' };

export default function Page() {
  return (
    <ReaderGate next="/my/settings/">
      <Settings />
    </ReaderGate>
  );
}

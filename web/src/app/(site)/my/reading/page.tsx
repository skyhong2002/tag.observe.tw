import type { Metadata } from 'next';
import ReaderGate from '../ReaderGate';
import Reading from './Reading';

export const metadata: Metadata = { title: '閱讀報告' };

export default function Page() {
  return (
    <ReaderGate next="/my/reading/">
      <Reading />
    </ReaderGate>
  );
}

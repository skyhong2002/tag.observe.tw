import type { Metadata } from 'next';
import AdminPanel from './AdminPanel';

export const metadata: Metadata = { title: '管理後台', robots: { index: false } };

export default function AdminPage() {
  return (
    <div className="py-4">
      <h1 className="text-2xl font-bold">管理後台</h1>
      <AdminPanel />
    </div>
  );
}

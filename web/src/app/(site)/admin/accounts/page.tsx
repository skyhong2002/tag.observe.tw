import type { Metadata } from 'next';
import SectionTabs from '@/components/SectionTabs';
import AdminGate from '../AdminGate';
import Accounts from './Accounts';

export const metadata: Metadata = { title: '帳號 · 管理後台', robots: { index: false } };

export default function AdminAccountsPage() {
  return (
    <div className="space-y-5">
      <SectionTabs here="/admin/accounts/" />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">帳號</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          登入過的帳號，以及各自在站上的互動與貢獻。對方先用 Google
          登入一次，就能在這裡設為管理員；下一次載入頁面即生效。標「管理員＊」的寫在伺服器的 TAG_ADMIN_EMAILS，這裡不能取消。
        </p>
      </header>
      <AdminGate next="/admin/accounts/">
        <Accounts />
      </AdminGate>
    </div>
  );
}

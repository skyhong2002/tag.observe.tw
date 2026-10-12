import { pageMetadata } from '@/lib/seo.mts';
import SettingsForm from './SettingsForm';

export const metadata = {
  ...pageMetadata('/liveboard/setting/', '即時看板設定', '選擇即時看板顯示精簡版或完整版，以及精簡版播放的鏡頭與速度。', true),
  robots: { index: false, follow: false },
};

export default function LiveboardSettingPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">即時看板設定</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        即時看板是給常駐螢幕用的全螢幕頁面。在這裡選它顯示精簡版或完整版，以及精簡版播放哪些鏡頭、每一格停多久。
      </p>
      <SettingsForm />
    </div>
  );
}

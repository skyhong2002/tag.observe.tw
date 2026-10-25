import { methodHeading } from './styles';

export function LiveboardMethod() {
  return (
    <>
      <h3 className={methodHeading}>即時看板</h3>
      <p>
        即時看板已移至 <a href="https://live.observe.tw/">臺灣觀測站</a>，提供文字雲、事件、標題對照、內文關聯與多來源輪播。
        新文易數繼續提供新聞、排行、事件與爬蟲狀態的公開 API；看板設定與 Web App 安裝請至新站操作。
      </p>
    </>
  );
}

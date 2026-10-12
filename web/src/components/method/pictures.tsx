import { inlineLink, methodHeading, methodList, methodTerm } from './styles';

// 標籤的圖 (the picture beside a tag's title and in the home page cloud).
// Pipelines: app/src/avatars/ (sketches), app/src/tag-visuals/ (places,
// logos, emoji), votes: app/src/pictures/. Write-ups: docs/tag-avatars.md,
// docs/tag-visuals.md, docs/tag-pictures.md. Keep the numbers here in step.

export function PictureMethod() {
  return (
    <>
      <h3 className={methodHeading}>標籤的圖</h3>
      <dl className={methodList}>
        <dt className={methodTerm}>人物</dt>
        <dd>
          標籤正好是 Wikidata 上的人物時，從 Wikimedia Commons
          找照片，認出本人的臉、去背、轉成鉛筆素描，自動用分數最高的一張；只用允許改作的照片，並標示原作者與授權。
        </dd>
        <dt className={methodTerm}>其他標籤</dt>
        <dd>
          台灣縣市鄉鎮畫輪廓與位置（內政部國土測繪中心），國家用國旗、城市畫定位點（Natural Earth）；組織與作品用 Wikidata
          的標誌，去背、裁邊後只保留明暗、轉成網站橘的單色。Wikidata 的項目只靠名稱比對，常撞到同名的東西，所以要先由 AI
          依近期標題確認是新聞裡這個才顯示。只有某個 emoji 正好就是這個東西時才用 emoji。
        </dd>
        <dt className={methodTerm}>讀者上傳與投票</dt>
        <dd>
          登入的讀者都能替任何標籤上傳圖（人物的照片一樣轉成素描，其他標籤轉成單色），上傳後先交管理員審核，通過才公開成為候選。也能投票選已公開的圖；每人每個標籤一票、可以改投，每人每天最多上傳
          20
          張。票數最多的那張就是標籤的圖，同票時維持目前那張。管理員可以鎖定某一張或隱藏，鎖定時票數照算但不換圖；解除鎖定就回到依票數決定。換圖後首頁與標籤頁會立刻更新。上傳的原圖不保存。
        </dd>
        <dt className={methodTerm}>授權</dt>
        <dd>
          上傳者須確認自己有權使用這張圖（自己拍的、官方提供的或允許改作的開放授權）。素描與單色圖是原圖的衍生作品；有問題的圖請用
          <a
            href="https://github.com/skyhong2002/tag.observe.tw/issues/new"
            className={inlineLink}
            rel="noopener noreferrer"
            target="_blank"
          >
            聯絡與移除請求
          </a>
          告訴我們。
        </dd>
      </dl>
    </>
  );
}

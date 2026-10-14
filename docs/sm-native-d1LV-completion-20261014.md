# d1LV native smoke 與新產物截圖綁定

APP `aff5c0289c4863fedb37368b4942884ccc068d77`，BUILD_ID `d1LVsC3sk6p04uOyWUx5T`；build control OPS `2d71092132bcb4433c1041c01563132e4a31c7c1`，remote base `a89908a650c42a1224d657e6c908d5fd3c7be5a0`。未部署。

使用者核可 packet `6f813e6cc8d25422c84e8558669b338fd1fea16675334b1364ceac25751059e9` 後，實際 native child exit 0，結果 UTC `2026-10-14T05:42:49.194Z`。12 個 ELF 的最高 GLIBC 需求 2.30、RPATH／RUNPATH 均在產物內；8 個 .node 與 ONNX 載入成功（不執行模型）。root 與 standalone Sharp 各在記憶體編解碼 16×12 WebP（44 bytes）、AVIF（276 bytes），解碼尺寸吻合。無 HTTP、DB、瀏覽器或 artifact 寫入。

私有原件根目錄 `/home/deck/tag-analysis-private/f1-release/simple-native-d1LVsC3sk6p04uOyWUx5T-001`：`result.json` SHA256 `e114b52d1bfa0bc9c8c3db59f7fed40e42fe7aafb9070985b36f750d3a3494c4`；`elf-results.json` SHA256 `5151f6cb6034ff62cb2b3a7b4523625c7f22d55c7efc1ca44d105fce043969cb`。執行前後 canonical inventory 都是 `103b9e671f66c6fe8af530db40fb9e0e9f5b8a38c0822af30404b398e26ac9fc`。原 prepared manifest 保持原 bytes／native-pending 歷史欄位，完成證據另存，不覆寫。

既有非作者 `/root/unfreeze_independent_review`／GPT-6.1 Sol 實際離線複核 36 段 readelf raw、14 份 job hash、8 個載入路徑及四項 codec 結果：`/home/deck/tag-analysis-private/f1-release/sm-native-d1LV-actual-independent-20261014.json` SHA256 `0cebb6188736e9d1954d784c94ddc33ee3ab11d505e5fdc474276440e01dff0c`；同名 txt transcript SHA256 `1513116111b9554faa48df12fd09d5f6a727bc56e41a6d10391227c56c212d16`。這是 native 證據，不是 UI、B0／SSR／RSC 或 GA 收件證據。

009 僅把既有 007／008 candidate 與 capture 工具換成真實 aff5／d1LV 產物、prepared manifest schema／controlOpsSha／canonical inventory，以及新的 exclusive job。未新增 guard，保留匿名 SELECT、DNT、啟動前 proxy 網路阻擋、HAR、有限期限及清理順序。source freeze SHA256 `0dd1034ae5ab56c618647c18d02164a54ccb2f33912c42bf5913633f0f538a11`；既有非作者本人 79 項純測試與 4 項 syntax 通過。review JSON `/home/deck/tag-analysis-private/f1-release/sm-batch009-new-artifact-independent-v1-20261014.json` SHA256 `c19a1e0f16719c6a94a653bc5f1bded712319baa76edda5534c795af658411a0`、同名 txt SHA256 `a4c8c42ce1b6c9befccdd7c28ee33f6e8598cbaa5cc67e4f0f037b6d4486569a`。

依使用者預先放行：fresh probe 的 MemAvailable 至少 2.5 GiB、load <12，三站各三次中位數 tag≤2／blog≤6.17／YT≤2 秒、所有 trials 200／curl0，瀏覽器全站不超過2。四匿名頁 1280／390 × light／dark 共16張，待實際擷取及獨立逐張 review。65個主 routes 仍 0 完整 UI pass／65 完整 scope pending。fixture prerender 內容不能直接公開；部署前仍須隱私／no-store SSR／RSC 回歸與防 fixture 外露，及 exact 部署／回滾命令的核可。

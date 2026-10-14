# API-only 002：失敗證據與 RSS 掃描修正

使用者／babysit UTC03:35 條件式放行既有範圍後，控制 OPS `86bb30a2e38ab5d6c8ba6972ed8a4a1a90426da7` 重新產生期限與真實 probe，並於03:39:36.036 UTC啟動 API-only guard controller。new web APP仍 `aff5c0289c4863fedb37368b4942884ccc068d77`，loaded API仍APP677；沒有新產品程式或正式設定變更。

## 實際執行與收尾

packet：`/tmp/babysit/mint-queue/tag-sm-api-only-admission-20261014T033855Z/packet.json`，SHA `86bb38c196d9fc42fb801c5cc468a8f40f0b5bc404da68980c122e799397c3e4`。probe SHA `d4a2b633b1dfe7bb0cc5c4a9311bb9c5c6b20fdf02e6ae69ae3be19247dee0c7`：三站各三筆200／curl0，中位數tag0.308295／blog2.256595／YT0.165162秒，MemAvailable3.502GiB、load3.11、disk56.00GiB，本機0build／0browser。原始 pinned-host SSH probe確認skyhong-blog為0build，stdout先保存再解析；沒有用手填remote receipt。

| UTC 2026-10-14 | 原始紀錄 |
| --- | --- |
| 03:39:36.036 | owner在tag.md寫入已啟動controller時間與probe hash；不宣稱API ready。 |
| 03:39:46.452 | parent-19保存resource：MemAvailable3,997,286,400 bytes、ownRSS0（尚未起worker）、九筆HTTP健康。 |
| 03:39:46.457 | parent-21啟worker群組3776207。 |
| 03:39:46.708 | parent-22記api-only-fatal／cause=operation；CONT／TERM自身worker群組。 |
| 03:39:46.711 | parent-26 finished，exitCode130／code1／SIGTERM。 |

parent3775865、lock holder3775984、worker3776207均已退出；18197–18199沒有listener，own kernel holder已無。`api-started.json`不存在，`build-aa-aff5c028-002`未建立，沒有archive、copy、Next、BUILD_ID、PNG、HAR或部署；worker log0 bytes。不能把001的partial copy寫成002的結果，也不能用起worker前ownRSS0宣稱短生命週期worker的實際峰值為0。

poststop原件：`/home/deck/tag-analysis-private/f1-release/api-only-aa-aff5c028-002/owner-poststop.json`，SHA `83c1b00224c9ae6354752724831d664191eba7ba58f7f8c6e316f510cc5bce16`。owner重新完整核對原 runtime inventory `f1660cad5f25347416054a7f21bacfb1b3583e442bdad292e18008170f7b1ad7`／manifest `76142c7930cbd2e471f02cf68130fa01acbfb54d2c6a4309fc8198185987e7e0`未變。所有失敗資料、原產物與舊目錄保留；沒有owner手動SIGTERM，controller按guard自行收尾。名額已交回babysit。

18196在此輪之前，已依新的範圍授權停止本thread的舊sprint frontdoor，見[舊fixture停止紀錄](owned-idle-fixtures-stop-20261014.md)；它不是002停止的程序。不能套用001／008過去的legacy-preserved assertion到這份新snapshot，也沒有回寫舊receipt。

## 能證明的根因界線

舊`ownRss`在篩PGID前，對所有/proc PID呼叫完整`readChildIdentity`，因此會讀無關root程序的exe／cwd。owner從exact Git86抽出原函式做真唯讀重現，得到EACCES、stat、`/proc/1/exe`；原始碼控制流亦支持自有worker群組一啟動就走到這個不必要的掃描。

**原parent fatal只保存operation，沒有errno、path或stack。** 上述是同碼的唯讀重現與強烈根因線索，不把它倒填成已記錄的original syscall，也不聲稱這次是OOM／schema／權限帳號缺漏。修正不需要新增系統權限。

既有非作者GPT-6.1 Sol已離線核對原始input／raw／event／poststop鏈：`/home/deck/tag-analysis-private/f1-release/sm-api-only-002-failure-independent-20261014.json` SHA `3ac79f13ee8e599efdd7a4b64ee2c78ffee57f6e02369ce8091e049d9c7c40b0`，同名txt transcript SHA `2e16d4f9fa59b937d6b4c2609896709e1c59cfcf5bd1ba9d3bcad5a39e3f0f61`；prior-stop補充JSON SHA `0e9b6fa305ab139013cee324a889de585cb6ad80a2f1c54aa6bf56a1939577f2`。reviewer沒有重新起API／建置或live探測。

## Source修正與獨審

RSS先读stat判斷自有PGID，再讀自己的UID／identity／RSS，最後重核PID／ticks／PGID。無關PID的exe／cwd不碰；自有成員EACCES、消失、PID／ticks／group／UID變動仍拒絕，不用忽略所有權限錯誤的方法繞過guard。有限整數RSS及加總有界檢查維持。

v4獨審另發現把R↔S的正常調度誤判identity race，以及README把002誤寫partial copy，v4 ISSUES原件保留。v5改成明確單字元live／terminal類別，允許正常live狀態變換，拒未知／多字元與live↔terminal；stable terminal可計0RSS。新增固定phase／errno／procClass診斷，不保存任意path、message、SQL或env。

新嘗試固定003 namespace，不覆寫001／002。APP、port、fixture DB、原子鎖、時間上限、3GiB開始／1.5GiB執行中／2GiB own RSS、median3／disk40→30／load12與no-store／DNT guard全部不變。

v5 freeze SHA `9a1cb83fc77ee03c8020e795e74c2c9606b8c759984cd3d85685a87a9a6819a0`。既有非作者GPT-6.1 Sol本人核七檔hash、58／58 pure/mock（55主＋3歷史plan）及四syntax，source PASS。JSON `/home/deck/tag-analysis-private/f1-release/sm-api-only-build-independent-v5-20261014.json` SHA `601c58eb46d7a9e101a54e320aa64610812432cf97bd35347c81e5bdc13caf03`，txt SHA `5fe1405a6fcd468e937b9255fd9ed6c8311c03f06b9e1828faff0a9a5c1b7a44`。

這是source／mock，不是API readiness、build、native、B0／SSR／RSC或UI驗收。下一次仍記exact新OPS／命令／freshprobe並遵守外部條件式範圍與全站名額；本文件不自授權部署。65主route／0完整pass／65完整scope pending，F1未部署。

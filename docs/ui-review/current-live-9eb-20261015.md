# Current9eb formal UI review — 2026-10-15 Taipei

Current production web `9eb733706f70dccfa5b9ea5ebf59be7b3cbab0a4`, BUILD_ID `VhzeqqvJy2S0rYlvetwKX`; API `dc7b814e220606202a408d21e73b1d6e7c61fe16`. Production only, separate from the candidate batches. Source base `origin/main=d23e6b2b3b5d502fffe2187adac11e3559f61d7c` fetched before builds; shared main checkout unchanged.

Private evidence root `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015`. The native DNT1 Playwright tool starts a tag-only transport proxy before Chromium and aborts all other origins before navigation; GPC/webdriver recorded without modification. Anonymous fresh profiles, no account/login, no synthetic GA or property receipt. Original viewport/full PNGs1280×800 and390×844 in light/dark; HAR/request/transport kept per batch. Private screenshot/HAR files are not committed.

Batch001–002 actual independent review completed, **8 current observed routes reviewed /57 awaiting**, and **0 full-route/state complete /65 pending**. Candidate eight cases and historical7dc eight cases do not count as current formal passes. Admin only existing authorized session or existing isolated fixtures; no accounts/privileges created.


## Batch001 — homepage, tag, ranking, daily events

Actual production manifest and32PNG in private `batch001/`, 1280/390 and light/dark viewport/full. Existing non-author GPT-6.1 Sol personally reviewed32 originals plus4 bound crops; report `batch001-independent-ui-review.{json,txt}`, SHA256 `5f30cc4b8eba683441301c9fe51de1382dcff9953f9fd22ff3926a4af4e86958`. New9eb was independently viewed; candidate PASS was not transferred. Source-base/layout comparison references and per-image viewedUTC/hash are in the JSON. NativeDNT1/GPCnull/webdrivertrue;978HAR/requests allDNT1, GoogleURL0 and transportGoogle outgoing0. Blocked Chrome background CONNECT attempts are retained;970HTTP200/8HAR-1 does not prove every resource succeeded or GA receipt. Pre/monitor probes passed. Mainroute65/full0complete/65pending; four observed-case passes only.

| Route | Current observed case | Pending |
| --- | --- | --- |
| 001 | 四viewport/theme首頁字雲、焦點事件、rank、camp差異、對照新聞、新聞關係與五議題cards載入，與舊7dc loading有實際差異；desktop三欄mobile順序合理，未見wholepage溢位。 | SSR失敗client recovery／持續error retry／空議題另states；搜尋／menu／登入／rank與cardnavigation實際操作；source notes展開／其他dynamic |
| 002 | 政治人物上位關係有資料，related與alias顯示尚未收錄；32文章、sidebar stats、趨勢與keyword history正常。正式追蹤與登入入口呈現，但未操作。不把欠資料當正向relations全通。 | 關係投稿／圖片提供／authenticated follow；其他related/alias有資料及空/error states；圖表與history操作／時間filter／notes展開 |
| 004 | 500匹配、50列排行、wordcloud有資料；snapshot metadata/theads深色改善。手機table與分類列局部橫捲不等整頁overflow，長頁footer及notes存在。 | 正在發酵tab／qualification/filter/sort；橫捲未見欄位實際操作；unavailable／true empty／notes展開 |
| 005 | 每日60事件、前三hero、次tier與10–60compact完整呈現；每日卡上榜時段深色實測改善，mobileindex收合顯示正常，source/footer無截斷。 | 每小時tab／日期導航／keywordfilter／mobileindex展開；空日／error／loading；外部報導/來源notes操作 |

- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/001-1280-light-viewport.png` — `7a2d4cbb5040deb2cfc7f09fe4c83f2e0f3aa9f840b9b8652107009095d29650`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/001-1280-light-full.png` — `2591b142f79e730ff48fb09f38179c3be822e050d6fc5b11308762dff9a18bc7`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/001-1280-dark-viewport.png` — `e6a8bd1b43a73726a704ee520c9c7444e677ec2089392b4dee41799d41a5a9f9`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/001-1280-dark-full.png` — `f65c397af1b6f22fdd4f4eb79018322e40ab8d0496fb74f02c381eb65d3cd60c`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/002-1280-light-viewport.png` — `58a15aace9e6a329281774ca20fc1e3450f6d189d90f37d434086a12f3c40d90`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/002-1280-light-full.png` — `b66ca51826677cad19d718b5d57448180e68a2e827c9f99b95ee6d36e77c3436`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/002-1280-dark-viewport.png` — `e8cd7057a75e8614649caf605a4c1aa075b6b4641ce883687f7d49aed3953e56`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/002-1280-dark-full.png` — `94c00005dcd4f2bb620c343586ce0d8c66efa44d06fa46e77b9c9b95b7e300c9`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/004-1280-light-viewport.png` — `a18a51c68df1daf41b59e92ab796e9c81dc8fd975fe23fa8f7a18c18cf7d4046`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/004-1280-light-full.png` — `5a6d7baa409a08ecd79785e8eab5717974b6765f8974f2c194828e7f72a6f907`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/004-1280-dark-viewport.png` — `cf23f2cadf79e99be6a999f06b31ab228673817f621636ab86840d1df6e0b7ab`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/004-1280-dark-full.png` — `b7408dcd4273f3675265b24711b3ce64289b48de2d44fae33bc512f3dc8a8ae0`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/005-1280-light-viewport.png` — `fcd6e15251423b70f846d9015a2ded337949eb46eb0078248cee218e9ac42f11`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/005-1280-light-full.png` — `1ffdac2c1082d118a2f87ab1b8c3c81ac9b31751c69be80bafc24e14aa208a77`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/005-1280-dark-viewport.png` — `e1fe872a610cef42cc390b32e8609385df5fc7eb7b76b702df528c410acb440b`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/005-1280-dark-full.png` — `c81390314949a10bd2e2bc695b2d04b1f49893097b632d284f17d4c3dee0d69f`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/001-390-light-viewport.png` — `b13891d6c49c0e6cf1183a01bb19b6a4bb038584a41737512781a9fdd0c894a9`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/001-390-light-full.png` — `3187f600c9e1b7bc30af26cfaebc547f423e49a4928b972e8c5a05d8ac22d6e2`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/001-390-dark-viewport.png` — `3f2b85479668c92e15745703e01415a1480338ba3a8122d5d48114307915d46f`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/001-390-dark-full.png` — `7ef8cac0ea8dcd861bddc2739cb9452c5d1a8fbe068920ef579399bc3f50874c`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/002-390-light-viewport.png` — `53adebeeec0eccf96d0e06c6fe83c8ad39348a5db3333b221ca991ad5ae7f0d8`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/002-390-light-full.png` — `99992fbd52281f55474f8b73005ce22375d539c120175f9edcf046da82636545`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/002-390-dark-viewport.png` — `d7581561b273d3a7ed6de87a48adac1a3efb3b84419c46e37707070badde225c`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/002-390-dark-full.png` — `6636f8ca0d32c0169f39355ca89f64c2096c5f8f0124539ff68f55be124775cb`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/004-390-light-viewport.png` — `a054d0ee924da2542fb715cd415f7fb9ec4add23e55faa38f5d4cbca42bb0173`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/004-390-light-full.png` — `348e6652c238d1834f9b242be4656dd2d6a76ed9873c9d0f9ea10973c6507ad2`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/004-390-dark-viewport.png` — `36cb567db9dfe5e4561b63481586a1b4b2e4dd7cbbc578e4c2df8085f70454f7`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/004-390-dark-full.png` — `742d22791376b8583a86b210064f1bfcae68de1c77531806b81fe80766085f1a`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/005-390-light-viewport.png` — `488333af7630d1b477d41939a541fe9b49515da677ea77c71d123cc6cc736cc1`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/005-390-light-full.png` — `d7358474e2ddf861e0b572e0adbd53e53b1a6ee0ebbca808a3d7c29fabe0c02e`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/005-390-dark-viewport.png` — `0f87cd27591fa807c03f49e205822aa7142076c0320af48705fb396144470930`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch001/005-390-dark-full.png` — `7e8c4cc6fbce81761cbc0f6530600f947cce14c293aef1ac1a0d2a781c57a192`


## Batch002 — media, article listing/detail, topics

Actual production32 originalPNG plus4 bound crops personally reviewed by the same non-author, matching9eb/Vhze. Report `batch002-independent-ui-review.{json,txt}` SHA256 `7f77896a183b64a0956a5448dc99a8f7992d0936eb1cdc135d0832600f58cdf9`. PeriodEvents main-event hashtags and ArticleTags counts now6.75:1.1358HAR/request allDNT1 andGoogleURL0;1006HTTP200/352HAR-1 (344sameoriginimages/8CFinsights). Do not infer failure cause, all images loaded, or GA receipt. Pre/monitor gates passed. Dynamic/auth/interactive/missing-image cases remain pending.

| Route | Current observed case | Pending |
| --- | --- | --- |
| 010 | 四viewport/theme媒體KPI/table載入；1550今日/18775過去24h/227media/100%標籤，dark KPI與thead清楚；長頁表格含無favicon列仍可讀name，notes/footer無截斷，mobiletable局部橫捲不溢wholepage。 | filter/sort/流量排行tab實際操作；手機橫捲其餘欄；empty/error/loading／notes展開 |
| 011 | hero+6desktop次卡/3mobile次卡、文章列表/facet實際載入，深色hero hashtags6.75:1；手機標題換行與圖片正常，公開動態新聞不可要求等舊candidate。 | 進階查詢/時間filter/媒體facet操作；empty/error/loading/retry；source-notes展開/更多文章navigation |
| 012 | 28今天更新+歷史議題、35媒體summary與搜尋呈現；desktop右sidebar/mobile收合，來源摘要/coverage清楚，圖片有些missing/placeholder照實保留，不宣稱每張必載入。 | search/更多關鍵字/依媒體瀏覽展開；topicdetail/來源navigation；no-data/error/loading/retry及缺圖狀態原因 |
| 008 | ASML標題/作者/摘要/原圖/正文excerpt/來源、延伸閱讀與相似1篇皆呈現；正式收藏/回報錯誤入口存在未操作。ArticleTags家/篇數6.75:1，手機按鈕與標題未碰撞；notes/footer正常。 | 收藏/回報錯誤登入流程；相似報導詳細與canonical原文navigation；missing/少資料/error states及notes展開 |

- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/010-1280-light-viewport.png` — `a65b49ef4b4feb0b0475564a071cec9f7c619d01e6ab2b5bcdec3e61f97b47db`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/010-1280-light-full.png` — `3c7512bc6e4acfedaa3c62fa20cab78052eebefc51b1febe17dd01345bd6f713`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/010-1280-dark-viewport.png` — `daa5d9a52b0593546470238f13ebb6f68fa1e05648416c955a0a5076ce1bd65c`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/010-1280-dark-full.png` — `6566a17bd2dc0633bb4af65ed062ad0e4d264f16139ac450c5464ac147ad796f`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/011-1280-light-viewport.png` — `567bbf7684d77e24762d9f83ef5bd71582de03dcc57a584f035df5756335d645`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/011-1280-light-full.png` — `0db632cac14fff0086df896c3390d568f897ac7cbcb7e3e3adcd7bf3e52a8b63`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/011-1280-dark-viewport.png` — `6e02e15b09871d4cbec82116fc8501900809e3ef29e50a0aca6c1439a25accb8`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/011-1280-dark-full.png` — `44635a9eeba7bb0ff278f19cf5dbb113f97db9dc08f987a359283bed9d6455d8`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/012-1280-light-viewport.png` — `1c44f66309ed8a41ff0ebf2ec2db989d3f5940598bb8538a9ebd7170da4db227`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/012-1280-light-full.png` — `e83d03bf3654e77b921d3184933f72166e9f4c54addd81ee73df471518af879d`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/012-1280-dark-viewport.png` — `a36a1e65d6c9704a07abd06c6088f0f88a72053194605298040d3991670a1474`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/012-1280-dark-full.png` — `68b7ebd5ae56c9a38f6ba8676b9bca03a68b7efb3e9fd90622616d047de94fd4`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/008-1280-light-viewport.png` — `e21c3dd63bb4042638bf1e06264a338b778c1935bfacc4fa945b18a1b3dd662f`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/008-1280-light-full.png` — `1cd6a9b5bfab098e9154f551efe0bfb2b2aab410acd1bf928078c263947fc658`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/008-1280-dark-viewport.png` — `90029f5215f203a00f78b90746f2e00220a6419f5f4b167d5b1c4313f9b70a0d`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/008-1280-dark-full.png` — `de9ade04d1f381f05ea3184e1358d76162a8d75c83d4cb7e456e4811bdb466b6`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/010-390-light-viewport.png` — `3284dfc3de6d48d3a2d9b7bc4c0e22d28e649f95254d991397e924959dc539b3`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/010-390-light-full.png` — `a3885a249b6e1adf7e223d42c30764c95aeb12e65d9c1b4938b3e66f753337bd`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/010-390-dark-viewport.png` — `c8070a47a7e799a264c9a6181add9917d8868073178f3892d1fe0b58cb41bca3`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/010-390-dark-full.png` — `de93a4d3f5f876d7ad9d4b89930ca692c7f7263c70683d545a58e2564129b529`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/011-390-light-viewport.png` — `d4897df8d59ba924d77c8b601704ce66092a80d8d2c334c83c00cd1f37db819c`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/011-390-light-full.png` — `e8e1999fd1e61e70ecb2bdb9e798fc2ff0bc06268da6067f48b755a433a3ea8a`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/011-390-dark-viewport.png` — `39762afb535948236da65e579b0d410a25af5411d8adb35900e3ddbcf0928de3`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/011-390-dark-full.png` — `e207091dd09f162f648f0dbcfb5f5794ac8e8228adfc0a5dfe6c39e35cdd2837`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/012-390-light-viewport.png` — `04fa2a4946537a6265bdf614325c4140c3240d2d1680ff44ed0592fc6d2432e9`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/012-390-light-full.png` — `bac2138c9ac7d0486b0029e2547fad68249eced628b6029bdc0b7405d9ed19cb`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/012-390-dark-viewport.png` — `4d9e4e72231eefbb0e5dad2003ea952d27d56f514803c3905c221c12e0acedfa`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/012-390-dark-full.png` — `797edf65df9f5bc88625c06dda7b2e188efc39f07674ec99cf5ae7fc54511891`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/008-390-light-viewport.png` — `ea0b55a3efa5a963c0eaa4dc00b912067ea91f4349a02adafd7d88ed63375967`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/008-390-light-full.png` — `d17092ccd89727707e62b8ae9fa3387ab2fd5e988d82d82ce497fd6d3a28813e`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/008-390-dark-viewport.png` — `d5dae4f2db0f93e345f220442fe00ccd7d6d396cd655dffd61309eda48a97519`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch002/008-390-dark-full.png` — `20ae41ae490e07c4df064261d36e3ba2ab5a4bec042a957d4855507cbe475163`

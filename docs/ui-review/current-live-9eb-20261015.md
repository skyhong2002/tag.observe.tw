# Current9eb formal UI review — 2026-10-15 Taipei

Current production web `9eb733706f70dccfa5b9ea5ebf59be7b3cbab0a4`, BUILD_ID `VhzeqqvJy2S0rYlvetwKX`; API `dc7b814e220606202a408d21e73b1d6e7c61fe16`. Production only, separate from the candidate batches. Source base `origin/main=d23e6b2b3b5d502fffe2187adac11e3559f61d7c` fetched before builds; shared main checkout unchanged.

Private evidence root `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015`. The native DNT1 Playwright tool starts a tag-only transport proxy before Chromium and aborts all other origins before navigation; GPC/webdriver recorded without modification. Anonymous fresh profiles, no account/login, no synthetic GA or property receipt. Original viewport/full PNGs1280×800 and390×844 in light/dark; HAR/request/transport kept per batch. Private screenshot/HAR files are not committed.

Batch001–004 actual independent review completed, **16 current observed routes reviewed /49 awaiting** (13 observed-case partial PASS,3 ISSUES), and **0 full-route/state complete /65 pending**. Candidate eight cases and historical7dc eight cases do not count as current formal passes. Admin only existing authorized session or existing isolated fixtures; no accounts/privileges created.


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

## batch003 — actual production independent review

Report `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003-independent-ui-review.json` SHA256 `7c7701b0ac4b6fc8b225ee6daacfc527786a43ac5c17357739ddc2168241d97d`; model GPT-6.1 Sol, UTC2026-10-14T23:02:15.608921+00:00; actual32original PNGs plus3 bound crops viewed. `ISSUES：034 group深色小字AA；003/013/026僅所拍匿名permission/loaded/redirect呈現PASS`. APP9eb / BUILD Vhze only; source8cf is not a reshoot or deployed repair.

| Route | Observed review | Remaining |
| --- | --- | --- |
| 003 | 四尺寸/主題只呈柯文哲的圖標題與登入後可投票/上傳管理員審核說明。沒有gallery/upload表單，不冒稱loaded image data或上傳成功；留白是此匿名提示scope，notes/footer完整。 | 登入/選圖投票/上傳/管理員審核；有圖/空圖/錯誤/loading；source-notes展開/登入連結navigation |
| 013 | 昨日1、本週24專題與歷史列表/46媒體摘要有實際資料；desktop sidebar/mobile收合合理，sourceURLs換行，圖片部分placeholder保留，不宣稱每圖成功；notes/footer存在。 | search/更多關鍵字/媒體summary展開；detailnavigation/更多專題；error/empty/loading及所有圖片載入 |
| 026 | requested /cat/news/，actual https://tag.observe.tw/ranking/?category=news；畫面新聞媒體selected、41媒體8725篇、500匹配50列，手機局部表格橫捲不wholepageoverflow。不是原URL獨立category模板。 | 其他category/sort/filter/正在發酵；空/Unavailable/loading；table其餘欄/notes展開 |
| 034 | 身份/主題群組卡與bars載入，desktop三欄/mobile一欄、長頁notes/footer完整；卡活躍標籤數/總數深色fg113,113,123 on10,10,10=4.10，需dark override。 | 修正後新artifact實圖AA；1/30天/群組detail操作；空群組/error/loading/notes展開 |

Network: `{"requests": 817, "dnt1": 817, "googleUrlCount": 0, "harEntries": 817, "harDnt1": 817, "harGoogleUrlCount": 0, "harStatuses": {"200": 792, "-1": 21, "404": 2, "308": 2}, "transportEvents": {"denied-http": 2, "denied-connect": 92, "admitted-connect": 6}, "blockedGoogleConnect": 88}`. Browser GoogleURL0 / transport admittedGoogle0; blocked background attempts preserved; not GA receipt or all-images success.

- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/003-1280-light-viewport.png` — `f5e2aea4168b800ada646c7250f367ec70b2b70db0328ca97cca88aff39806db`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/003-1280-light-full.png` — `5905becf94728fff33014ea2b107d0c6787fc2adff60a96e18b2eeaa8fddc4e4`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/003-1280-dark-viewport.png` — `1521269ceeac443cd34d31100d1b4c95f45727fc54c6918b8ac23c0f2bbbe3ea`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/003-1280-dark-full.png` — `1521269ceeac443cd34d31100d1b4c95f45727fc54c6918b8ac23c0f2bbbe3ea`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/013-1280-light-viewport.png` — `bd2d884718189a793d092c186c7b837fab2b2002d568b13584477ef17dc18b8e`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/013-1280-light-full.png` — `19bf6881117c3ee0e6fe6513f2e74d076836ef63508c211bc7fceb2a5a9e4167`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/013-1280-dark-viewport.png` — `a15b3097273ea6bdd24db788142d555e646e5db0b8d0c29dd7278a3e4d54fb58`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/013-1280-dark-full.png` — `7e8c43e82b092bd08d185718f20bd6fdfd491fde5429233b6e5842283bd5f351`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/026-1280-light-viewport.png` — `e2aca3283a4c4b65fe6ed6b16a6327c120d7e55755ecb2c2f2366c06747c63a3`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/026-1280-light-full.png` — `ce4710b1fb7e9bea4b6d49ce248f40decf3e45fe6b09892f1679c5cfceb72161`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/026-1280-dark-viewport.png` — `34454fa94f47aa167fcfeecd50db2faec073ee2c85c2ead25d86f21906c933c3`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/026-1280-dark-full.png` — `26086aadfa480e34e8e10e01e8e210471ec5675e3080221f2d54b411089b13b1`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/034-1280-light-viewport.png` — `700d305174527300fb21c07b3b5add0e69db59aa01c285edc3c760d90d5c659d`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/034-1280-light-full.png` — `b31ae77f9599996d491b367e09c2f3078eb2764fe09eae3cfd1137d7bbd29d13`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/034-1280-dark-viewport.png` — `dd7840dcbee59578827813e0627a80a92e21f3491965af7883053ab4c51d8605`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/034-1280-dark-full.png` — `92146b66328d3989c4b17eaeec50a63e34abb4f1ba7a2805320e2e7789f10d89`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/003-390-light-viewport.png` — `5d1b50b18bf6a5aab67dea6259fb6d16947133a3f2937d024910b3afc5b630e6`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/003-390-light-full.png` — `162331d4ba0bcddd1ac068b1291d37e6339c1ab0579b9f1f4561d7cbacc7bb5d`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/003-390-dark-viewport.png` — `5cab5ec78788edcc770c15f454af46570c9d36a9f8352c25a1aba66114bf0335`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/003-390-dark-full.png` — `161c7154af7be6748b53a085f5abe30ecd8b7e140be2f02b06bd8c860abfcde0`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/013-390-light-viewport.png` — `0fa7d1f0b037ff62a0aceb3a25c3ccdf00341bc7161776af9ca0c52d52f428a7`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/013-390-light-full.png` — `f4b349c2a0a847abc5656df54dc1e43fb4552ac3e2e09d7ab94fc3aa4dbbbc52`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/013-390-dark-viewport.png` — `c62c343b30aa8bc0460a34dc03c8eac238c94bf70610fe3b8c85400df0a388dd`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/013-390-dark-full.png` — `bfc09a4b6659a935f464c193414b5456978b3079c0c7bde4b9f8f5cce597b012`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/026-390-light-viewport.png` — `52fbc017c3a71a1ab932e86d26bba99196f2234da4c5234a5ac3651eb7326590`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/026-390-light-full.png` — `706cea61cff314b9b04c52f0a8b95212d12a68583c2ac1b54d56612d587ffe08`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/026-390-dark-viewport.png` — `7922446c34987fccab8862fb4b682b154bd0a16956654243fade04d02dfa0486`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/026-390-dark-full.png` — `052d53866ffd475f1111b0100d77142d371f258d754cbda740e43188c709cb6f`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/034-390-light-viewport.png` — `7fb41d7e00252ec3af4d484982fb51fd317a36eccca1d3770e3b69b8e8a3e910`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/034-390-light-full.png` — `ddedf9c2d9296ad9130d3363d486f2f93c9f7d4579a38abc3adaf2251705956d`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/034-390-dark-viewport.png` — `9d312d4bc7a470d5e3d3a72cb576cd07c0f8c81ad4cf52b8d0f82bdc0398001f`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch003/034-390-dark-full.png` — `7408383b31be0a822ceca9d048f76b025a6c2923b0900d8c53f7543b6aa4339b`

## batch004 — actual production independent review

Report `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004-independent-ui-review.json` SHA256 `a642814641980877908394fe088289089e5e71f86571288deb444b6d7464811b`; model GPT-6.1 Sol, UTC2026-10-14T23:19:19.098910+00:00; actual32original PNGs plus3 bound crops viewed. `ISSUES：027 crawler與046域名小字AA；036/024就實拍匿名loaded呈現PASS`. APP9eb / BUILD Vhze only; source8cf is not a reshoot or deployed repair.

| Route | Observed review | Remaining |
| --- | --- | --- |
| 036 | 個人/筆名4077 desktop、4075 mobile隨capture時段更新；記者名、media、首見/相近/引用實際table載入。desktop寬表，mobile局部橫捲；label159/placeholderneutralgrey約128，未誤判偏暗。notes/footer完整。 | search/media/filter/百分比與detail操作；手機横捲其餘欄；其餘byline types/空/error/loading |
| 024 | requested /byline/，實際與journalist記者table相同，原pagesURL明列在本report。未將alias視為新增獨立資料模板；表格/notes/footer正常。 | 其他署名類型與查詢操作；完整alias跳轉/歷史URL coverage；empty/error/loading |
| 027 | 297source爬蟲table含抓取方式/tools/頻率/失敗metadata載入；已有失敗次數是業務資料，不當此pageHTTPerror。mobilefilterwrap/table局部橫捲；sourcescount與更新時間低對比。 | 修正新artifact實圖；filter/sort/流量tab與source detail；empty/error/loading/notes展開 |
| 046 | Similarweb/Radar估算流量、月變化/數值/月選單與媒體table載入；域名小字3.67。手機名稱ellipsis/局部橫捲是既有設計，未驗hover或更多欄可讀；非全table操作PASS。 | 修正新artifact實圖；數值tab/月選單/search/sort/各欄；空/無估算/error/loading/notes展開 |

Network: `{"requests": 1827, "dnt1": 1827, "googleUrlCount": 0, "harEntries": 1827, "harDnt1": 1827, "harGoogleUrlCount": 0, "harStatuses": {"200": 1514, "-1": 311, "308": 2}, "transportEvents": {"denied-http": 2, "denied-connect": 132, "admitted-connect": 6}, "blockedGoogleConnect": 128}`. Browser GoogleURL0 / transport admittedGoogle0; blocked background attempts preserved; not GA receipt or all-images success.

- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/036-1280-light-viewport.png` — `cf89ebff877a162297ccff0aa1d7acbf49d75cb7d456e17f10fbf2dc9c275e4b`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/036-1280-light-full.png` — `ec38fc84c60d8009fa2055957359d9f6625f0bb65b1cbfaae8e46ef12cb499c2`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/036-1280-dark-viewport.png` — `19adb6093ffc23359e71b26e0e1ad9e0d968faac9decc47ccb3cd5d536dd3455`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/036-1280-dark-full.png` — `27dbbf72f7fa73780d8f79a1a246784506c01dc49b505e2a0bb67b48322e6242`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/024-1280-light-viewport.png` — `fafc0b6efe4d5ba0eed14200016d6bf27c57a1619caf921bb04f6e2ec7839b7d`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/024-1280-light-full.png` — `c8c9989ac78f5851fed488f9345bb6114de0ff36e667d33089208bd1c5ea3d98`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/024-1280-dark-viewport.png` — `cc3beea779f92f211fe52f41c9b0dd8d300c6d41af4d5c41786206a514c4f4f7`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/024-1280-dark-full.png` — `d36f953e7e0d8e9edcc4cf562baae1a483532edcdb7b5b8c1ee509df016cfc92`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/027-1280-light-viewport.png` — `f6905fc4c94a58dfa97d25f0a15d064b45acb8e1c69e7354e6657d7c8e23f417`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/027-1280-light-full.png` — `da61a33670e173b70a6f08693332b87ec244cf2dfd9ac0837d6836322edb0922`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/027-1280-dark-viewport.png` — `00dd2dccb01aeae9db4e59c0cfd48cb9ab274d518a1b534d705c5a10632a0d33`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/027-1280-dark-full.png` — `f47de7d8cf1aaedcb41167e390e3e9566bb2cd44e76e60473083adb5f9a3c380`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/046-1280-light-viewport.png` — `8e6ebb4690d7b9ad95b84b4af527d7e2e5547ce047087d8962b6c4a955ef6136`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/046-1280-light-full.png` — `e7e1e6ca991f12281194513e70468f5f5817326bd8f81697a1f1151286447be3`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/046-1280-dark-viewport.png` — `2aaf13ab4a215867062cac2771de2df83e3e81ece6b55ab248f70c9546c667e8`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/046-1280-dark-full.png` — `3a41a2ae35528cae2a6e3bba8762d6a4d0828d918c9bce81f7de79122e751ee7`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/036-390-light-viewport.png` — `bd5f4f1dcf95ccc1600aa74b3b54f4be68e77e699a6e921fdebfc850c46661c2`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/036-390-light-full.png` — `d4591d4107c3eaa160a5d3e9964b936235311e13fae68d3dbfad440254259c2b`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/036-390-dark-viewport.png` — `ede8e8c8c189c0cf86a2248a196a9cf7887e203e35fc94166cc828ecc0725e0f`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/036-390-dark-full.png` — `8419044d0da516ebc0d6e8f9f6001fd4bf82c6186892c30d153a836224891a9c`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/024-390-light-viewport.png` — `bd5f4f1dcf95ccc1600aa74b3b54f4be68e77e699a6e921fdebfc850c46661c2`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/024-390-light-full.png` — `147beb2004a7ea42d2d3de4b8386cf09e357c47576fdfbd35a2c97f3690152ff`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/024-390-dark-viewport.png` — `ede8e8c8c189c0cf86a2248a196a9cf7887e203e35fc94166cc828ecc0725e0f`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/024-390-dark-full.png` — `8419044d0da516ebc0d6e8f9f6001fd4bf82c6186892c30d153a836224891a9c`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/027-390-light-viewport.png` — `7927a9c2b6393a0d9c38bfb9135033bf050050657a0653c7eb780de5a66ecfe6`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/027-390-light-full.png` — `c4fa26b340b06255146741d29d89a22d39a3a85e6457ed6b29f9abf4feebc436`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/027-390-dark-viewport.png` — `1862548d4869500f66102b8aa8b85d1f123f01f1579c6806b02af245c6f3ede6`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/027-390-dark-full.png` — `dd66e841120b8e55c519ded0cb1b80efed186e4318f5a868b1a5d0a5274c0028`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/046-390-light-viewport.png` — `600382fa6800840b21a553c5bd1428ce6e06f483b144e240b5e61d406543dc2a`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/046-390-light-full.png` — `1d64a227ac1bfc1af5ad75cdd84fd1688a41b56bafbc8bdd97fa1a15d91242d6`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/046-390-dark-viewport.png` — `b3120069e1f11acac84fd5396773076a7818852be115e56b51acd9b3ab704a0b`
- `/home/deck/tag-analysis-private/ui-review/current-live-9eb-20261015/batch004/046-390-dark-full.png` — `8cd83eff7359253080afaf4fd9174018385c01c5999275c592f101bdc69b3c69`

Batch004 postprobe was recorded at23:17UTC, after capture ended23:06UTC; no mid-batch probe is available. Do not infer continuous resource-gate compliance from pre/post samples. Original captures/raw artifacts retained.

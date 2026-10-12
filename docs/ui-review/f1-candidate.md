# F1 candidate 獨立審查（末段 reviewer）

Reviewer：GPT-6.1 Sol，`/root/ui_review_last`。文件記錄 UTC：2026-10-12T20:04:02.549023+00:00。產品 UI／後端作者均不是此 reviewer。

基底 `430cc01`；F1 最初後端唯讀版本 `e786635`，去重修補及實際受審候選為 **`3d96f612ad1f032e94f2e7835195f834f35ad096`**。此候選透過隔離 frontdoor `http://127.0.0.1:18178` 連接 Next 18171、fixture API 18170／test DB 18306。這是主機內部稽核入口，不是使用者預覽連結，也不是正式部署證據。基準圖為既有正式版本 `48083b58c4ee3d16f2072206f1da3df332f34143` 的同版本內部擷取，沒有重新大量存取正式頁面。

受審後端首次發現 stable group ID 與合法字面標籤 `group:811` 的去重鍵碰撞。主 agent 改為 typed identity `['group', id]`／`['tag', label]`；reviewer 獨立執行 6 項純程式 assertion 通過，無 DB／網路操作。管理員／同源權限、私人圖片候選、審核鎖與循環防護、來源／作者／時間／review log 保存、0038 additive migration 均已唯讀審查。新關係的 private actor metadata 完整；舊分類缺建立者／建立時間時不補造。SQL 成長與既有 avatar queue admission 限制另列於私有 log，未宣稱已修。

## 實際視覺／互動覆蓋

共 **74 筆狀態／寬度檢查**：首批 25 個狀態 × 1280／390 = 50 張 focus 圖；補批 12 個狀態 × 1280／390 = 24 張。每張均真正經 `view_image` 判讀，沒有用 HTTP、DOM、抽樣頁面代替。部分重複狀態是不同角色、資料量或前後互動。首批另保存 50 張完整頁面原圖；不宣稱每份重複長頁裡的無關圖表與全部文章列均已完整審完。admin 長圖另保留不修改原圖的 readable view crops；首批 sticky header 長截圖 artefact 以補批 scroll-to-top／viewport 圖核對。

所有新圖片均為明示 `F1 Fixture` 的程式產生測試圖；這不驗證真人 portrait／worker 處理品質。使用既有 fixture 身分 701／702／703，沒有真實登入、新建帳號或改權限；所有投稿／審核／上傳僅寫隔離 DB。實際審核專用 ID 18 通過、19 未採納、20 圖片通過；reader 新增隔離關係 21、圖片 22。未修改原基準 pending／rejected fixtures。

兩批均使用真 Chromium profile `enable_do_not_track=true`、`channel: chromium`，沒有 navigator／UA 覆寫；`navigator.doNotTrack='1'`、webdriver true、GA disabled true、commands 0。Google transport 與所有非 frontdoor origin 在首頁前 route abort；actor header 只加於內部 frontdoor request。兩批 Google attempted／completed 均 0。DNT／automation／環境 guard 同時作用，這不是 opt-out 單一因果證明。

|角色／狀態|1280／390 實際觀察與結果|
|---|---|
|anonymous／many-gate|真看6語義關係：4上位(2direct/2ancestor)、related台北/alias柯P；desktop3欄mobile直排chip自然wrap，標題/説明/link/anonymous展開登入gate清楚。|
|anonymous／picture-gate|anonymouspicturegate清楚導登入，未暴露candidateimage或操作。|
|anonymous／admin-gate|anonymousadmintab可見，但只登入提示無queue。desktop五tab/mobilewrap2列可讀。|
|reader／many-relations|真看6關係、3類清楚；direct/inherited標示與link讀得清楚、collapsed投稿可見。|
|reader／few-relations|真看僅related台北，其餘分類尚未收錄；兩寬空白區可辨不是失敗。|
|reader／empty-relations|真看3類皆尚未收錄，提出關係仍提供入口、空狀態正常。|
|reader／relation-form|desktop2欄fields/mobile垂直label、textarea/disabledsubmit；文字説明可查證而非共現，control大44px。focus長图stickyoverlay總標題，屬截圖scrollartifact；初始panel圖有總標題。|
|reader／relation-self-error|真操作selftarget400，紅色rolealert在form末，保留欄位可更正；mobile紅字兩行無溢位。|
|reader／relation-approved-duplicate|真操作approveddup回200且毋須重複投稿status，target/reason清空submitdisabled，原relations未變。|
|reader／relation-rejected-duplicate|真操作rejecteddup status明列未採納既有紀錄、沒有新投稿，mobile自然兩行。|
|reader／relation-pending-success|真操作新增private21，status已送管理員、原公開panel不新增詞，清空formdisable。|
|reader／admin-reader-permission|reader只見管理員permissiongate，無私有queue/圖片。|
|reader／many-pictures|3張明示fixtureimage圖載入、displayedthird橘框/一票/已投，mobile2+1排；rightsuncheckedfiledisabled，今天12額度。人物名稱此fixture走visual，不替代portraitworker驗收。|
|reader／few-pictures|1張fixture使用中橘框/已投，沒有多卡擠壓；uploadrights與額度説明可讀。|
|reader／empty-pictures|還沒任何圖可上傳第一張審核說明清楚，rightsuncheckeddisabledfile。|
|reader／picture-upload-pending|真上傳fixtureWebP新增private22，額度12→11、確認待審，publiccandidates仍0；mobileconfirmation兩行，無未審圖片public。|
|admin／queue-pending|實際pending11items完整看並以12readableviewcrops補讀；source/userpseudonym/time/target/reason明確，圖片#22/#20可見，#15/#12初圖lazy未載需scroll補。#1原fixtureimage404，未宣稱此圖可審；UI未提供明確圖片載入錯誤placeholder。空reviewreason兩buttondisabled、手機wrap正常。|
|admin／review-18-approved|真UI填reason並approve18，pending移除此row；其他private內容保存，未看公開源tag同步（需補）。|
|admin／review-19-rejected|真UI填reasonreject19，pending移除此row，laterrejectedtab有reason；未影響其他seed。|
|admin／review-20-approved|真UI填reasonapprovepicture20，pending移除，latertabapprovedpreview/理由明示；公開picture同步尚待補。|
|admin／queue-approved|完整圖真看：12approved including20/18及既有relations/pictures，沒有reviewcontrols、reason正確；兩寬仍可读。長圖需croprelevant新rows，證據保留。|
|admin／queue-rejected|完整3rows含19+13picture+7relation，未採納理由、image/wordlink可讀，沒有可再審control。|
|admin／queue-error-fixture|明標503UI故障注入，紅alert+重新載入，手機無溢位；非實際backend503證據。|
|admin／queue-retry|真click重新載入恢復實際pending8rows；data刷新，未修改投稿。|
|admin／queue-empty-fixture|明標emptyUIfixture：沒有已通過投稿與selectedtab顯示清楚；不是正式DB空清單證據。|
|admin／queue-loading-fixture|browserroute延後6秒實際component載入中狀態；桌/手機status與selected待審正常、沒有舊data誤保留。|
|admin／queue-real-loaded|延遲完成真資料載入，第一row與全部controls可讀，角色/假使用者ID/時間清楚。|
|admin／queue-all-lazy-loaded|逐張scroll讓lazyimg載入後真全頁圖；pending8rows全部排版正常，#15/#12fixture圖已實載，#1已知錯誤fixture返回404顯示alt/破圖，無明確errorplaceholder，不假pass該preview。fullscreen從scroll0開始避免sticky中段截圖artifact。|
|admin／queue-pagination-latest-fixture|browserresponsefixture 1row+next777，非31rows容量證據；最新標題/row/更早的投稿button兩寬全頁正常。|
|admin／queue-pagination-older-fixture|真click更早送before777，fixture較早row與回到最新button出現，nextnull不再更早，兩寬自然wrap。|
|admin／queue-pagination-return-fixture|真click回到最新清cursor，最新row及更早button恢復；footerdesktopcolumns/mobile堆疊。|
|reader／relation-busy-fixture|攔住實際duplicatePOST transport等待，兩寬顯示送出中及全部fieldsdisabled，沒有重複按鈕提交；純delayfixture非慢formalAPI證明。|
|reader／relation-busy-complete|release後duplicateapproved真response200，form清空/confirmation，fields恢復可用submit因空值disabled；mobile文字可讀。|
|reader／new-group-method|真expandedfooter新dt標籤關係與投稿完整讀：is-a多重祖先/related/alias區別、共現不自動轉語義、登入投稿審核。桌dt/dd及手機垂直排正常，90pxoffset避免sticky遮新段。|
|reader／approved-picture-visible|reserved20真核准後台北市pictureboard明示F1review192pxfixture，1vote使用中，reader看讀者上傳/投這張非自己的，未approve前private到candidate轉換成功；两寬全footer正常。不是真人avatarpipe驗收。|
|reader／new-picture-method|picturepage真expandedfooter讀者上傳先交admin通過才候選+原投票與20quota/rights完整可讀，兩寬文字正常；其後授權/完整方法link與footer不溢位。|
|reader／picture-to-tag-navigation|真clickpictureheading台北市link回tag，relationpanelrelated柯文哲/蔣萬安與分類未收錄可讀，舊picturefooter未留首屏；完整parallelnotes清除/替換仍非此次截圖證明。|

新 F1 UI 在已覆蓋範圍沒有 blocking issue：多／少／空語義關係、登入與管理員 gate、真實投稿／去重／錯誤、管理審核與公開圖片轉換均有圖片與互動證據。表單 busy、queue loading／503／empty／pagination 使用明標瀏覽器 response／delay fixture；不冒充正式 API 故障或 31 筆容量測試。圖片壞 fixture ID 1 的 404 會呈現 broken image／alt，目前沒有明確圖片錯誤 placeholder；未把該圖列為可成功審查。

基準圖實際看過：`playwright-internal-current-live/002-tag-{1280,390}.png`、`003-tag-picture-{1280,390}.png`。候選沿用既有字型、導航、卡片、橘色連結；新增關係面板位於原排行／趨勢之前。圖片登入說明明確補上須管理員審核。資料方法新增的語義／共現區別與圖片先審段落已展開並實際看對應 footer，不用首屏替代。

## 原始證據與資源閘門

私有根目錄：`/home/deck/tag-analysis-private/ui-review/f1/`。

- `candidate-ui-2026-10-12T19-49-35-204Z/`：capture script 的 report.json、每 actor network.har、50 focus／50 fullpage 原圖、readable crops、independent-review.log。
- `candidate-ui-extra-2026-10-12T19-56-35-147Z/`：report.json、network.har、24 圖、independent-review.log。
- `candidate-f1-review.log`：後端／安全／migration、namespace 修補與 UI scope。
- `candidate-f1-dedupe-reviewed.diff`：第一次 follow-up exact reviewed diff。

逐圖 log 均記實際 review UTC、model、SHA、URL、tool、viewport、screenshot path、具體觀察及覆蓋界線；report.network 保存原始 request／response 事件。HAR 原檔未覆寫。首次 preflight 誤把 Chromium children 計成多個 parents，未 launch；失敗資料仍留在 `candidate-ui-2026-10-12T19-47-50-540Z/`。主 agent 修正 global gate 後才執行，未繞過 2-browser 限制或終止其他 session。

|gate stage|load1|blog TTFB 秒|artifact|
|---|---:|---:|---|
|before-f1-anonymous|3.044|0.022355|`/home/deck/tag-analysis-private/f1-release/resource-gates/2026-10-12T19-49-35-232095+00-00-before-f1-anonymous.json`|
|after-f1-anonymous|2.956|0.024043|`/home/deck/tag-analysis-private/f1-release/resource-gates/2026-10-12T19-49-49-410019+00-00-after-f1-anonymous.json`|
|before-f1-reader|2.956|0.021237|`/home/deck/tag-analysis-private/f1-release/resource-gates/2026-10-12T19-49-50-929802+00-00-before-f1-reader.json`|
|after-f1-reader|2.756|0.022355|`/home/deck/tag-analysis-private/f1-release/resource-gates/2026-10-12T19-50-37-077440+00-00-after-f1-reader.json`|
|before-f1-admin|2.776|0.024715|`/home/deck/tag-analysis-private/f1-release/resource-gates/2026-10-12T19-50-39-033974+00-00-before-f1-admin.json`|
|after-f1-admin|2.388|0.022126|`/home/deck/tag-analysis-private/f1-release/resource-gates/2026-10-12T19-50-57-602054+00-00-after-f1-admin.json`|
|before-f1-extra|2.568|0.022034|`/home/deck/tag-analysis-private/f1-release/resource-gates/2026-10-12T19-56-35-176265+00-00-before-f1-extra.json`|
|after-f1-extra|3.295|0.024115|`/home/deck/tag-analysis-private/f1-release/resource-gates/2026-10-12T19-57-01-881583+00-00-after-f1-extra.json`|

每個 gate 也保存 raw pgrep、實際 browser parent 判讀、uptime 及 tag／blog／youtube 三站 status／TTFB。tag 僅一個串行 capture browser；各 profile／batch 後已關閉。所有上述 gate 都可用且未超過 load／blog 門檻。

## 預取修補的獨立 source review

受審 commit **`225fa38a08fb4c3ecd4733b75266a0dbf11830e8`**，作者是另一 agent。reviewer 的 TypeScript AST 對比 18 個 TSX 檔：移除新增 `prefetch={false}` 與 whitespace-only JSX formatting 後，全部結構相同，48 個新增属性；href、aria、callbacks／tooltip fetch 邏輯沒有改動。證據：`prefetch-ast-review.cjs`、`prefetch-independent-source-review.json`。沒有因 AST 相同而宣告 candidate 視覺／navigation 通過。

獨立核對既有正式 privacy HAR：867 entries、365 帶 Next prefetch header（42.1%）；869 request event 與 1882 request＋response event 不可混當相同計數。來源分頁／元件歸因和降低幅度均不能從 raw counts 直接推論。225fa38 新 build 的同流程網路量／實際點擊／畫面仍待後續；本文件的 74 檢查來自 3d96，不能宣稱預取已修或降低百分比已測。

## 待覆蓋與交接

- 新語義 API failure、truncated／超長 label／極大量關係、31+ queue 真實容量。
- 真人 avatar worker／job failed、圖片錯誤 placeholder、所有 vote／admin lock 狀態。
- 所有 parallel notes client navigation 的清除／替換、無關長頁圖表與全 F1 ledger 未覆蓋狀態。
- 225fa38 新候選實際 UI／navigation／同流程 request A/B；目前 source review 通過不等於已部署。
- 既有 avatar jobs 加工前沒有 durable daily reservation：1200/min global web limit 與 worker concurrency 2 無法保證 queued 20/day。SQL `uploadsToday` 的相關 NOT EXISTS 成長成本未做正式 DB EXPLAIN。0038 三新表 DDL partial failure 需檢查 journal／表狀態後處理；未跑會 TRUNCATE 的 DB 套件，避免與 fixture 建立競爭。

提交：此 review 文件未自行 commit，交主 agent 整合；產品候選 SHA 如上。部署：F1／225fa38 尚未部署，本地候選 review 不構成正式上線。

補充：部署前 reviewed migrator 已獨立唯讀審查（未執行）。目前標準 Drizzle runner 具有 dedicated connection advisory lock、最後 0037 hash／timestamp、只允許一筆 0038、三新表必須不存在及磁碟／備份還原守衛。獨立重算實際 gzip 備份 hash 與 manifest 相符（backup UTC 20:03:54.722、restore 20:04:14.885）；沒有讀寫正式 DB。建議 runner 執行時釘住已審 0038 exact SHA-256 `65b1a1195598e7f497ecd59f4ba5745782a455326bc3bbb1023e65dc3699bd07` 並重算備份 hash；SQL prefix allowlist 本身不等於 exact reviewed SQL。當前版本無 blocking，DDL partial failure 的檢查／修復界線仍須保留。

## 225fa38 independent actual UI recheck (append-only)
Reviewer GPT-6.1 Sol / ui_review_last; UTC 2026-10-12T20:23:43.528037+00:00; SHA 225fa38a08fb4c3ecd4733b75266a0dbf11830e8. Tool Playwright Chromium true-profile DNT1 + view_image. Internal fixture frontdoor18180; no production writes; Google attempted/completed0; actorheader confined sameorigin. Three guards are jointly active, not sole opt-out causality proof.
- prefetch-ui-2026-10-12T20-11-25-457Z: 12 state/width actual focus screenshots plus mobile menu screenshot viewed. Semantic panel, submission, target navigation and approved picture visually match prior3d96 at1280/390. Actual client tag/picture/desktopmedia/mobileobserve navigation retains document. Desktop media hover no destination prefetch in this specific step. Strict homepage logo selector matched two links: test failed, original partial report/HAR retained, context closed.
- prefetch-ui-2026-10-12T20-13-17-082Z: six actual screenshots viewed. Correct banner logo navigates same document. Home data fallback and admin approved Failed to fetch are NOT pass. HAR failures at20:13:31.952–33.525 are sameorigin net::ERR_CONNECTION_REFUSED, absent bridge-v2 access after20:13:29.319; cannot attribute to auth/SQL/seed. Original12image previously200 and decoded. Parent confirmed listeners disappeared, no original process stderr; cause not inferred. Context closed.
- prefetch-ui-stable-2026-10-12T20-18-51-304Z: all10 state/width screenshots actually view_image reviewed,1280×800/390×844. Systemd supervised v3 prepared gateway. Home primary ranking/hero recovered. Admin pending private12/15/22 decoded; approvedtab and reserved20 image/reason recovered; mobile cards/text wrap without horizontal clipping. Known malformed seed1 remains broken and is not claimed valid-image pass. Header logo actual same-document navigation passes.
- Stable home wordcloud has real sameorigin HTTP500 on10avatar/visual-image GETs; not external-image abort. Paraguay image200. This existing pipeline state remains unresolved, home image cleanpass withheld. Google0. Gates before/after load7.01/7.57, blogTTFB.023/.022, allsites200; before/after otheragent browser one parent, own contextclosed beforepostgate. Exact raw gates and network.har/report.json live inside each artifact directory under /home/deck/tag-analysis-private/ui-review/f1.
New relation data=null/error and truncated-long are still awaiting v4 fixture and actual screenshots. Admin capacity30row visual is UI-only syntheticresponse fixture, not31row database validation. No product code changed; review uncommitted, parent integrates. F1 not deployed by reviewer.

## v4 long/capacity actual review 2026-10-12T20:26:53.427013+00:00
Reviewer GPT-6.1 Sol; candidate225fa38, Playwright Chromium + view_image, internal18180; trueDNT1/webdrivertrue/disabledtrue/commands0/Google0. Full raw network/HAR and resource gates in /home/deck/tag-analysis-private/ui-review/f1/relations-v4-ui-2026-10-12T20-25-25-717Z. Ten viewport shots and two full capacity shots actually viewed. DOM asserted truncated text and ASCII60 beforecapture. BLOCKING: desktop1280 ASCII chip crosses first column and overlaps related CJK chip; mobile390 both long chips exceed panel/viewport and text clips. Truncated notice and submission disclosure render correctly. Synthetic GET-only capacity30 rows visually wrap; next toone row900030 and return30 actually clicked, no synthetic approve/reject/DBwrites. Fullpage gives entire30row page but microscopic scaled text is supported by readable top/bottom viewport captures; not DB31row test. Browserclosed. Error branch attempted next but preflight slot unavailable, browser never launched; awaiting slot/new fixedbuild. Product/review uncommitted here, F1notdeployed.

## 020 duplicate gate independent source review 2026-10-12T20:28:44.774208+00:00
GPT-6.1 Sol reviewer, ui_ledger-authored uncommitted admin/tags/page.tsx diff read directly. Only relations view wraps TagArticles/WritingPeople in one outer AdminGate. Nonadmin children do not mount, so duplicate loading/login/permission notes collapse; admin keeps existing children and their inner/backend guards. next constructed with URLSearchParams preserves view=relations/nonemptytag and safely encodes values. No source blocking. NewSHA two-width screenshot single gate and authorized content still required; no browser launch. Reviewer changed no productcode, review uncommitted, F1notdeployed.

## 027 crawler empty source review 2026-10-12T20:31:04.459079+00:00
GPT-6.1 Sol independent reviewer; activeWT HEAD4788514 + root-authored uncommitted MediaCrawlersTable.tsx diff. Empty message moves from wide table colSpan tbody cell to sibling paragraph following TableScroller, constrained by parent page width. Condition !rows.length and original text preserved; headers/rows/filter/sort unchanged. Text-sm/zinc600/dark400 appropriate for readable empty notice. No source blocking; new candidate mobile/desktop empty and normal actual screenshots to be independently reviewed by middle, not inferred from code. No productcode by reviewer; uncommitted review, F1notdeployed.

Retrospective recordedAt 2026-10-12T20:44:03.461314+00:00; original actual review UTC remains in the appended entry below. Source log /home/deck/tag-analysis-private/f1-release/candidate-f1-review.log. Final source SHA821711c corresponds to reviewed parent e0eb4dd + exact config diff hash stated below; no browser/build executed by reviewer.

## Build resource guard / bridge-v5 source review 2026-10-12T20:40:38.472412+00:00
Independent GPT-6.1 Sol; reviewedHEAD e0eb4dd5286385d373c5118e49764a988a98c832 plus uncommitted next.config.ts diff SHA256 e60ffac274b96bbdf148ce4539fc5100bc53d6e6b2b34a7a3fec49188b050ea5. Local installed Next16.3.6 only, no externalservices/browser/build. config-schema.js supports experimental.cpus number and staticGenerationMaxConcurrency int; build/index.js getNumberOfWorkers honors explicit cpus2, export/index.js caps batchworkers to requested workers, export/worker.js chunks exportPaths by maxConcurrency1. Thus <=2 concurrent static exportpages, not bound on per-page parallelfetch or runtimeAPI pool; longer totalbuild and unchanged60second perpage timeout remain. isrFlushToDiskfalse preserved, no sourceblocking. bridge-v5.mjs health accepts formatchecked F1_UI_SHA separately from startup apiSourceHead/tree; no launch-env/buildartifact yet, so actualUI-SHA correctness not established. Fixture still inherited:false for both longrows atreview, root notified to set ASCII60 inheritedtrue and verifybadge in actual newcandidate. Review only, no product edits/commit/deployment by reviewer.

RecordedAt 2026-10-12T20:44:14.601674+00:00 GPT-6.1 Sol follow-up: git show821711c:web/next.config.ts exactcontent SHA256 c2a73fd9477bea7471f4f5e90fc44eafca100d7a53dd0d2ebf24527f0048641f equals current reviewed config. bridge-v5 reread confirms ASCII first row inherited:i===0/depth2; otherrow depth1. No browser/build launch.

## v5 public read semaphore independent review 2026-10-12T20:47:10.888102+00:00
GPT-6.1 Sol, productcandidate dba9325, privatebridge SHA256 73e8b2ff8fe8a24ad8530985f4bc58258ee676a77aea5af4780d5f10d6fad516. Exactdiff vsbridge-v5-before-read-limit.mjs examined. Four slots held until fetch+arrayBuffer finish; waiter receives released slot without decrement/increment race, FIFO handoff. Finally releases on fetcherror/bodyerror. Redirectmanual retained,302 deniedbycaller, no credential forwarding; localisolated handlers unchanged. Singleprocess sharedacrossbrowser limit, notdistributed global; queue has no deadline/sizecap and disconnectedclient may occupy slot until25second abort, nonblocking for current serialcapture. Pure VM extracts actualfunction and mockedfetch only:21jobs maxactive4 throughbodyread,2errorpaths released,finalactive0/queued0,manualredirect and DNT/GPC verified. Artifact /home/deck/tag-analysis-private/ui-review/f1/read-limit-pure-review.cjs andjson UTC20:46:51.369. No actualnetwork/browser/build. Fixturecondition changed, subsequent captures must state throttle and cannot be sameconditionAB. No productedits/commit/deploy byreviewer.

## Build guard independent review 2026-10-12T20:53:39.483781+00:00
GPT-6.1 Sol; parentdba9325 uncommitted tools/guard-next-build.js SHA256 a5138be59dd32ede24edd3e1470b4e0106b0217ffada51d8ee27c7d99d6b01cb, testhash9e1217fb1fa9f37ddfa56f14e7bc19c98e32b7d981c3f494eef046d834f9f356, install-service diffhash80aa43c8124c59339d58259d7060d530d412ce27e913b0bb52ee93fc978b164d. Existingtwo localtests pass; decision load>16/5xx/transportpause andpausedload>=10wait correct, detached ownPGID STOP/CONT nice19/ioniceidle wrapper appropriate. BLOCKING cleanup: resultparentclose disables signalGroup and finallykill; orphanworker survives normalparentexit or TERM parentexitsfirst. Actualnetwork-free fakeparent/worker reproducer /home/deck/tag-analysis-private/ui-review/f1/build-guard-orphan-review.mjs/json UTC20:53:15.387 reports guardexit0 workerAliveAfterControllerExittrue. Runnerfinally killed onlyownPGID, no orphanleft by reviewer. Recommend unconditional owngroup cleanup evenafterparentresult, with ESRCH handling andtests descendant-survivesparent/ignoresTERM. Currentprovidedtest parentexplicitlykillworker hidesthispath. No actualnetwork/browser/Nextbuild/productedit. Guard notapproved untilfixretest. Reviewuncommitted, F1notdeployed.

## Build guard cleanup fixed review 2026-10-12T20:56:10.559342+00:00
GPT-6.1 Sol; sourcehash e2f746e86288bbbd18ff5654ee1472da9846a0139a6637a8ae09674ba57a846f testhash50ad7fc67cbdc504a9ec6edb1c9576be5629919f172ed0fcc20e072a9a93f05c. Finally unconditional ownPGID SIGKILL fixes survivingleader workerpath; interrupt auditfailure catch also ownkill. All3tests pass1.83s, nodecheck/bashsyntax pass. Originalreproducer immediate kill(pid,0) returns true transiently evenfixed because terminatedworker can brieflyexist; followup samefakeparent with50ms /procstate (Z treatedterminated) UTC20:55:53.578 shows pidabsent/workerAlivefalse. Private build-guard-orphan-fixed-review.mjs/json saved. Originalrunner overwritten itsownJSON on rerun20:55:39.891; originalfailure result UTC20:53:15.387 remains exact prior tooloutput/reviewlog, notclaim originalJSON untouched. No realnetwork/build. No blocking remaining for reviewedguard scope. Historicaldoc explicitly states e0lastlog20:36:42 precedes20:39blog500 anddba usednice15withoutSTOP; cannot causalattribute/retroactiveprotect. Timeline sourcefields not allindependently reread rawlogs, document internallyconsistent with suppliedobservations. Reviewuncommitted, F1notdeployed.

Final formattedsource reviewhash update 2026-10-12T20:56:37.303191+00:00 GPT-6.1 Sol: guardSHA256356023e44b070fa461f0b207664a6fed7c75eea0afa78ea8a7be345143a5dcbb; testSHA2560140c6ff88a6b4f02a24c72b801179907b524e021debabf5a3278b55e29baa65; installer diffhash80aa43c8124c59339d58259d7060d530d412ce27e913b0bb52ee93fc978b164d. Finallykill and interruptcleanup retained; explicit noUnsafeFinally reason correctly failsguard if nonESRCH cleanupfails instead ofreporting success. No browser/build launch.

## Frozen capture budget independent review 2026-10-12T21:35:03.000190+00:00
GPT-6.1 Sol sourceonly; helperhash83dbc7d667e6b2b87d04390e6f9d6dcab718141ce2b984c17bad36a4a81a3152 testhash66dd4734f936cf37ed526a05f32c7f1d13fc14f3a08711d10d79b3a029d0dc55; nextadapter0d0414b8651d0e7404929e557a66d1b2cac9144edfb099b10b3148c082319284 middle3c7896d36d88a6bf47b6a3efaaff71892f559ca2fa2bea2affe06ca01bfcad32 matchmanifestcapture-freeze-script-change-20261012T2134.json, originals preserved.2tests/nodechecksallpass. Count1–16/estimate96MiB/load<=12/free113GiB pluspreplanned/flush reserve implemented; allcaptures usebudget wrapper and serviceworkersblocked, GA+externalrouting installedbeforefirstnav. BLOCKING middle actioncatch swallows budget/load errors fromcapture and proceeds remainingactions; fill/select/wait/uncheckAll lackpre-action budgetcheck, so stop condition doesnot endbatch. Need dedicatedfatalbudgeterror rethrow andchecksallactionphases. Actual100MiB cap notstrict: PNGwritten beforepostcheck could overshoot92/100, 4MiBestimate notenforced; finallyHARplusduplicatefullnetworkJSON canexceed8MiBreserve, unflushedHARnotcounted. Require explicitbuffer/remainingbound or honestsoftcap withcoordinatorapproval, noassertstrictsize. Evidenceversion includesSHA is weakprovenance butrootprovidedexternalproofstillrequired; middleadapter lacksownscript snapshot unlike next. No browser/build/network/export/delete/productedit, sourcefindingnotUIpass. Uncommittedreview/F1notdeployed.

## Budget fix re-review 2026-10-12T21:38:25.064514+00:00
GPT-6.1 Sol offline only. Helper nowbuffer-first4MiB PNG cap/pixel8m cap/pendingdisk+batch prewrite/wx countlimit; mock actualextractedhelper fakeFS/page verifies oversize noPNGwrite, pixelcap preventscreenshot, countcap preventscreenshot,wx. Private capture-budget-mock-review-20261012T2141.cjs actualrunUTC21:38:01.558 (filename label notrun timestamp),2existingtests pass. Originalbefore-freeze twofiles hashes match2134manifest, retained. Adapters nowCAPTURE_BUDGET_STOP rethrow/actionprecheck/uncheckprecheck, raw2MiB bounded andHARdisabled explicitincomplete; version exactuiSha/PIDcwd/BUILD_ID checks andmiddle sourcesnapshot. Remainingblocking found plainmidsegment load Error canstill be swallowedbyactioncatch ifloadrises betweenbudgetcheck andsecondoscheck; rootnotified to usefatalcode/remove redundantcheck. Rawnewline countnotincluded, profilecacheflags do notboundentireprofile, finalactualsize shouldbe recorded ratherthanabsolutehard100MiBclaim. Sourcehashes atinventory helper9abf55333c46a190476b3b9bb9a462bded4823dff8398bff7025880093c6edd7,next81af590787f71bb7cef2ec90558a8c5d921c5ebcb64fe6728ea4aeecbced3ac9,middle21e62d9d4aeeb0000c643f9d106cbd4350069635c1e6d69cc6d51ab047932d43. Noactualbrowser/network/build/artifactoverwrite. Revieweruncommitted/F1notdeployed.

## Final frozen budget re-review 2026-10-12T21:41:35.624059+00:00
GPT-6.1 Sol: helper3745974d6932e27a662bf9e75adf509801d0822f0c7aff3ef945faa290ad458a,nexta8ccaa8bc8379d1123f6b3bee7b3472e709a82fa2ad7d46d2134bb9a09164024,middle07cd67f1ac695f6ea4cabbe3ee32838a12b710cc9f711c1676615219d9eacf09. Checkstatfs/directory/log failuresandPNGwx failures nowfatalCAPTURE_BUDGET_STOP; networkcallback appendfailure setsfatal/truncatedandcontextclose, no escapingcallbackthrow. Midloadfatal andnewlinelogcap retained. Originaloversize/count/pixel/wxmock rerunstdout21:41:14.259; newexclusive finalmockfile capture-budget-final-mock-review-20261012T2141.cjs additionallyinjectsstatfs/writefailure verifiesfatal UTC21:41:24.863.2repo tests andbothadaptersnodecheck pass. No sourceblocking remains for reviewedstop/errorpath scope. Operational limitation retained: profileflags limitcaches notentireprofile, finalbytesmustbe checked/reported; noHARunderfreeze, truncation/error forbidscompleteevidenceclaim. Noactualbrowser/network/build/overwrittenartifact; uncommittedreview/F1notdeployed.

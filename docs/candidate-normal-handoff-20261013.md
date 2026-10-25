# F1 / PSI 正常節奏交接（2026-10-13）

**最新授權 supersedes 本文件舊排隊/窗口：**18:50 截止取消，持續到原 scope 全部完成。SM 不開新 build/capture/restore，tag 改為第一個等待 Mint 的建置；原本 blog→YT→tag 的 SM 名額已取消。Mint 固定 APP_SHA／環境／fixture／傳回同份產物見 [mint-tag-handoff-20261013.md](mint-tag-handoff-20261013.md)。下面正常節奏紀錄保留為歷史，不是 SM 開跑許可；既有實圖和未完成範圍不變。

15:10衝刺期限已由使用者取消；18:50仍是工作窗口，以品質為主。使用者最後**明確**批准首頁相對閘門 `max(2秒,目前基準×2)`：blog基準3.085秒／上限6.17秒，tag及YT上限2秒；不得自行把慢速的新量測上調成新基準。全站**1個build**（任何遠端建置，包含skyhong-blog，都算）、2個capturebrowser，load>12或任何5xx即停止新build/capture；/home≥40GiB開始、<30GiB暫停自己buildgroup。nice19/ionice3/Next≤2。建置順序blog→YT→tag，下一輪tag等明確通知。沒有以期限豁免或以local /proc 0推論remote已停止。

## 已執行與目前來源

- 本輪candidate在UTC05:13:35.002開始guarded archive/dependency/build；05:15:10.863完成。compiled SHA **ae9e18e581ec274b756995edbfe3c8cb9533ee5b**，BUILD_ID **gNEog_mFcTUWnCAhMbI0C**，目錄 `/home/deck/.local/share/tag-analysis/releases/.candidate-f1-sprint-ae9e18e`。包含F1、PSI及前4issues sourcefix。没有正式切換。
- 該次使用的blog6秒／本機2build設定出自當時的協調訊息，之後協調者明確撤回並說是其推論；本文件保留這個政策歷程，不把後來使用者明確同意的相對門檻當成追溯授權。實際guard記錄blog最大6.984722秒時SIGSTOP，下一健康樣本4.013999秒SIGCONT；新批必須以目前已批准閘門與新slot交接重驗。
- 四個成功tag loaded capture批有48張實圖，只有1route的loaded scope雙寬亮暗色完成看圖，**0完整route pass、65完整pending**。dark共現摘要/trend文字中度可讀性issue，已在產品source **49cdad0bd1000fe69d2281fd312fc18d89fab2bc** 修正（未建置）。sourcePASS與tests不替代新版UI。
- `49cdad0`：dark摘要/日期zinc400、trend label/zinc300與data-theme同步。新regression2項、既有home3項、webtypecheck/biome通過；獨立GPT-6.1 Sol log `/home/deck/tag-analysis-private/f1-release/sprint-tag-dark-source-review.log`。正式current仍是前次核對的0dd38b6；沒有新deployment。source分支 `feat/shared-tag-submissions`，共享main未改。

## Source / API / runtime 證據界線

`/home/deck/tag-analysis-private/f1-release/candidate-fixtures/api-workflow-ae9e18e.json`：ae9 runtime app.inject 17checks，reader relation pending公API不可見，existing fixtureadmin703理由必填與reader無review權限，批准後typed/provenance公開；四credential含空值private/no-store、errorsno-store及圖片授權限制。另offlinecontract/noise15tests通過。沒有新帳號/權限、production user資料查詢。

`picture-flow-a9e6a51.json` / `.log` 在同private資料夾：**受測source是a9e6a51，不是ae9**。14項actual一般visual圖片flow（待審private、批准後candidate、拒絕不發布）通過；僅existing隔離18306/tag_f1_semantic_test、fixture701/703。該source的app/src tree須由artifact實核對才能判斷同碼相容，不移成ae9收件。Avatar `avatars/run.ts:addPhoto` 真ONNX模型可能下載外部且child預設createDb，所以未跑；不得把一般visual結果當真人物模型處理完驗證。既有integrationtests會TRUNCATE，未強行執行。此缺口待可隔離mock模型/DB策略，不新增正式權限。

候選readAPI與web：private transient units `tag-f1-sprint-candidate-api` (18188)，`tag-f1-sprint-candidate-web` (18190)，`tag-f1-sprint-candidate-frontdoor` (18196)；loopback隔離入口不是使用者preview連結。version-evidence `/home/deck/tag-analysis-private/f1-release/sprint-candidate-ae9e18e/version-evidence.json` 綁PID/cwd/BUILD_ID與app tree。下一SHA必須新產物及真圖；保持ae9所有artifact與evidence。

## 剩餘驗收與切換

1. 新global slot交接後fetch/祖先/clean/disk與三站健康重新檢；新工具拒絕舊2buildsprint授权，要求新privateglobal-slot-confirmed證據。等待中只source/mock/review，不把sourcePASS當開始許可。
2. 新source只有暗色變更也要重新建置並綁完整candidateSHA/BUILD_ID；舊ae9不跨SHA搬pass。至少先新F1tag/圖片/投稿/adminqueue、四issues與首頁PSI，仍繼續所有65routes與適用states，未done保持pending。
3. 新capture用UUIDexclusive私有目錄，原生DNT1、webdriver/bot/GPC/optout不變；prelaunch單candidateoriginproxy及firstnavigation前routeGoogledeny，完整rawlogs及前後uptime三站TTFB/total。相同毫秒碰撞的05:22批已排除，05:24因load>12停止兩批保留incomplete，均不算完整pass。readonlyactor或隔離mutation要分scope並保持existingfixture，不是realaccountadminacceptance。
4. Lighthouse runner已準備source＋purechecks（尚未跑新報告），只在新candidate三次取median score/FCP/LCP/CLS/TBT；runtimeError/非finite metric/容量或cleanupfailure即incomplete不median。保留nativeUA，所以與adf47ee的舊mobileUA或PSI69/LCP7.8只方向比較，不宣稱同設定。INP不作lab指標。script `/home/deck/tag-analysis-private/performance/sprint-ae9e18e/run-lighthouse.mjs` 舊身份不能代表新candidate。
5. review通過後沿用該build產物，不重新build已通過版本。local精確OUTPUT18130→18194 route planner source已review；先runtime小備份+既有0038gzverifiedhash、old worker active0/exit0排空（40秒timeout exit1不可當成功）、新pendingimageworker安全政策確認才admit。old pool保留、exactownrule rollback；不CF/WAF/不碰backup/timer/不刪oldreleases/backups/worktrees。詳見f1-local-route-handoff.md。

本文件只整合已存在證據與待辦，沒有新增build/capture/LH/backup/productionmutation；目前所有F1/PSI仍未上正式站。

正式baseline來自babysit2026-10-13T05:47:30Z–05:48:30Z五次HTML median（DNT1，Accept:text/html），三站0.256/3.085/0.289秒，上限2.0/6.17/2.0秒。原receipt與副本hash見gate-baseline-20261013.md；guard/buildreceipt寫同一不可自動漂移metadata。

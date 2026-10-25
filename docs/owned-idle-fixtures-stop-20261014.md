# 停止本 thread 已不用的 fixture 程序

依使用者／babysit 最新的明確範圍授權，只停止確認屬於本 thread、已不需保留執行中的舊 fixture 程序；沒有刪除原始碼、artifact、證據、release、回滾版本、備份或 worktree，未修改服務設定。控制 source 為已推送 `bd28bd7483f65091ea27f777572ae0ed5c787294`，基底 `origin/main a89908a650c42a1224d657e6c908d5fd3c7be5a0` 已重新 fetch 核對。

## 身分與停止範圍

對照本 repo 的 `docs/candidate-normal-handoff-20261013.md`、`docs/ui-review/f1-candidate.md` 與既有 sprint version-evidence，並核對實際 PID／startTicks／UID1000／canonical Node／cwd／argv、systemd cgroup、MainPID、Transient=yes、Description 與 loopback listener。這六個是舊候選的 transient units，已由新 API-only／SM candidate 方案取代。使用 exact `systemctl --user stop UNIT`，沒有 kill 範圍不明的 PGID，也沒有 disable、reset-failed、改 unit 或清理檔案。

| unit | PID | 原 loopback port | 停止後 |
| --- | ---: | ---: | --- |
| tag-f1-fixture-frontdoor.service | 436183 | 18180 | PID／listener 已無 |
| tag-f1-sprint-candidate-frontdoor.service | 1353412 | 18196 | PID／listener 已無 |
| tag-f1-fixture-web-dba9325.service | 531340 | 18179 | PID／listener 已無 |
| tag-f1-sprint-candidate-web.service | 1353406 | 18190 | PID／listener 已無 |
| tag-f1-fixture-api-v5.service | 531338 | 18170 | PID／listener 已無 |
| tag-f1-sprint-candidate-api.service | 1353404 | 18188 | PID／listener 已無 |

先停自己的 frontdoors，再停自己的 web，最後停自己的 fixture API。每次 stop 前重新核對 PID／ticks 與 unit，避免沿用已被重用的 PID；原始 stop 開始／結束 UTC 與 exit code 個別保存。

**未停止 PID435074。** 它的 cwd 是 blog release `42711cf18c452b406904af6000ccbf88a1ff6102`，在 `blog-observe-web@blue.service` cgroup，MainPID435063，正式 Next child435074／port18172。它不是 tag fixture next-server。停止後該 child 的 startTicks／cgroup 不變、blog blue仍 active。來源不明的18162 next dev亦未操作。

18196 此前被新 candidate 認為是 legacy listener，所有歷史收尾 receipt 的「當時保留18196」仍正確。本次根據新的條件授權與既有 owner 證據停止本 thread 的舊 sprint frontdoor；沒有回寫或修飾舊 receipt，不再把它列為仍在運作的 listener。

## 原始證據與資源結果

目錄：`/home/deck/tag-analysis-private/f1-release/owned-idle-fixtures-stop-20261014T032724Z/`。`before.json` 保存身分、units、原 TCP 與來源；六份 `stop-PID.json` 保存 exact unit／UTC／exit0；`completion.json` 保存停止後 PID／listener、原始 TCP、保護的 blog unit 身分。completion SHA-256：`40a9f35619d9f6bf168c7d9d1c358b43f5596c4a93875d28af0813981db87e06`。全部為 private 0600；沒有读取環境變數、DB credentials 或使用者資料。

`gate-before.json`／`gate-after.json` 及各自 `.raw.jsonl` 保存實際三站各三筆的原始 start/end、exit、bytes、cf-cache-status。兩批共18筆 HTTP200／curl0：

| 項目 | 停止前 | 停止後 |
| --- | ---: | ---: |
| tag time_total 中位數 | 0.086357s | 0.067786s |
| blog time_total 中位數 | 2.058146s | 1.972999s |
| YT time_total 中位數 | 0.059686s | 0.056733s |
| MemAvailable | 2.7301 GiB | 2.7354 GiB |

停止後 load1為3.41、/home剩56.11 GiB。可用記憶體會隨其他服務變動；不能用停止前各程序的 RSS 加總宣稱實際釋放了相同數量的 RAM，也不能拿幾分鐘前的3.9 GiB當本次閘門已通過。

仍維持新建置3 GiB開始門檻，這次 sample不足，因此未取鎖、啟新API、建置、capture或部署。全站建置名額仍已交回babysit／YT；新的API-only exact命令與freshprobe必須另核對，不沿用先前已過期的申請。65主route／0完整pass／65完整scope pending，F1仍未部署。

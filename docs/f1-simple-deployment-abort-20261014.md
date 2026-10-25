# d1LV 簡化部署：首頁暖機停止，正式版未切換

核可 packet `8ea5bd3a0144a3772567406d1e2ff6d5f27ba9982cbc172487c51f3511ba7b9b`，執行 OPS `61fd537c0f8bc91c687ea2fe875cf0bd79215a77`／APP `aff5c0289c4863fedb37368b4942884ccc068d77`／BUILD_ID `d1LVsC3sk6p04uOyWUx5T`。來源基底 `origin/main a89908a650c42a1224d657e6c908d5fd3c7be5a0`。照核可命令執行一次，exit1，沒有自行續跑或修改部署程式。

失敗在切換前 `warm-home`：UTC `12:15:26.311823455Z` → `12:15:46.324575536Z`，新 web18232 的匿名 DNT1 `/` GET 超過20秒，curl28／HTTP000／0bytes。這只確認暖機沒有在期限內完成，不能推定為 SQL、權限或 OOM 問題。

腳本 error handler 停用／停止新 API 與 web；尚未到 worker 或 gateway 切換階段。

| 要求的回報 | 實際結果 |
|---|---|
| 重啟→第一200秒數 | 不適用：gateway從未重啟，沒有製造秒數 |
| Origin/public 六個 GET | 全部未執行，停在前置暖機 |
| `deployed-units.txt` | 成功階段未到；提供同格式的實際 `aborted-units.txt` |
| Formal gateway | active，原 PID114409，仍0dd38b6 |
| Legacy web18132 | active，原 PID325597，始終沒有停止 |
| Worker | active，原 PID114174，未寫F1 override／未切換 |
| 新 API18230 | inactive／MainPID0／exit0 |
| 新 web18232 | MainPID0／停止後exit143，systemd顯示failed；這不是OOM證據 |
| Gateway/worker新override | 都未建立；current仍0dd |
| Rollback | 未呼叫；正式版從未離開0dd，無須切回 |

後驗證 UTC `12:17:42.042Z` → `12:17:54.657Z`：九筆全200／curl0，time_total三次中位數 tag `0.932118`／blog `5.063242`／YT `1.001206` 秒；caps2.0／6.17／2.0通過。SM load3.85、disk47.347GiB、MemAvailable4.202GiB，本機0build／0browser。每筆UTC／bytes／CF cache／exit與原始stdout/stderr保留，不是GA收件或完整封包停機測量。

私有執行紀錄：

- `/home/deck/tag-analysis-private/f1-release/deploy-backup-d1LV-simple-001/execution-aborted.json`，SHA `4ea496acfb408b86e540881df31b97ec1835a6e389659eb9d5e71ab8309c1dc6`。
- 同目錄 `aborted-units.txt`、`aborted-listeners.txt`、`aborted-exit-status.txt`、`http.tsv`、`startup-journal.private.jsonl`；各自hash在上述receipt。
- `/home/deck/tag-analysis-private/f1-release/deploy-d1LV-simple-001.log`；保留全部原件，不覆寫。
- `/tmp/babysit/mint-queue/tag-deploy-simple-d1LV-20261014/post-execution-probe.json` SHA `de5d36e31da509a07a96bf28bbd40afb8df2c6012d0339bd33ff09881200b6e8`；raw SHA `9538ee4e78f748b73073705a3b67901aa2eee8f997be6887686d8ad50ad5163b`。

新release、backup、unit來源、原artifact與失敗資料全部保留。沒有重建、瀏覽器／capture、合成GA、CF/WAF、migration或backup.timer操作。部署名額交回babysit；再次啟動需先查明暖機原因、提出最小調整與exact指令，不盲目重試、不覆寫exclusive目錄。

15個source/mock通過不代表production冷啟SSR通過。正式站仍 `0dd38b629621e27ccb40260a27b27cf2d7202519`；F1未上線，65主route仍0完整pass／65完整scope pending。

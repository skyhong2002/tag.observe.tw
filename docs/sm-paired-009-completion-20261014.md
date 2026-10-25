# SM009 啟動失敗及收尾

APP `aff5c0289c4863fedb37368b4942884ccc068d77`／BUILD `d1LVsC3sk6p04uOyWUx5T`，control OPS `55a8a83f4b6e1960ab78aac9ba24b3bae660aa48`（已推送），remote base `a89908a650c42a1224d657e6c908d5fd3c7be5a0`。未部署。

依使用者 d1LV native 通過後的 candidate＋capture 預先放行，真 fresh probe 九筆皆 200／curl0，中位數 tag0.070482／blog3.172573／YT0.062694 秒；MemAvailable2.775GiB、磁碟52.35GiB、load4.97、SM及遠端無build/browser。packet `/tmp/babysit/mint-queue/tag-sm-paired-009-admission-20261014T055231Z/packet.json` SHA256 `52d8fcd2ca597e721f2db8d3fe383be0fef44c7aabc497f13fb718ac2f837a1c`，probe `83fe7385e7d7a7995f455442a760f1524f9bba33b417d6758faf9be7f0a0e8eb`。

candidate owner PID4004171，lock holder4004361，worker4004737於UTC05:53:09.600開始，05:53:32.964進入cleanup（無API／Next／frontdoor child）；candidate exit1，pair exit1。沒有candidate-started成功receipt、沒有Chromium／HAR／PNG／UI review。pair stage的candidate-started.json僅表示已spawn owner，不是服務就緒。

只有health generation1：開始05:52:57.597、完成05:53:09.574；worker啟動時age12.003秒有效，cleanup時age35.367秒，現有30秒validator拒絕。原worker-failed只記generic類別，不能倒填首個throw的唯一根因。離線只用原時序／純validator，另一次nice19／ionice3唯讀verifyRuntime耗7.514秒並確認產物一致；該耗時不能當成歷史執行時間。診斷原件 `/home/deck/tag-analysis-private/f1-release/sm009-frozen-health-readonly-diagnosis-20261014.json`。

UTC05:55:12.609後驗證原件 `/home/deck/tag-analysis-private/f1-release/paired-sm-batch-009/owner-poststop-kernel-inventory.json`：三自有PID全無、18197–18199無listener、holder無kernel鎖；inventory前後 `103b9e671f66c6fe8af530db40fb9e0e9f5b8a38c0822af30404b398e26ac9fc`，manifest仍 `f50f8fcd1a25fc775c9261c41ecdc08cc4d973b42d92bca4ff46718a0b091914`。全部失敗原件保留。

最新 babysit 明確預先放行最小啟動前fresh量測修正與同產物重試，不另加機制／不放寬30秒。source／測試／非作者審查通過後，fresh gates符合才執行010，hash記入tag.md。若再被工具本身擋住，停止自行修wrapper並具體回報babysit。65主routes仍0完整pass／65完整scope pending。

010 最小 source：worker 完成原 startup proof 後，首次 current(true) 直接用既有 sample 重新量九筆；後續 current 仍用原 parent cache／30秒限制。沒有新 guard、diagnostic 或期限放寬。v1 author 誤報80/80，實際79/80（shell後續syntax成功掩蓋test exit）；原 log／freeze／ISSUES全保留。v2只修過時implementation字串assert，獨立本人80/80 process0＋2syntax通過。freeze `a3ecf097ac412cdc2b8d0231009af863c24678241f573e155dec2e2358390536`；review `/home/deck/tag-analysis-private/f1-release/sm010-startup-fresh-independent-v2-20261014.json` SHA256 `c73fc23e9c9f737ba62a362bf3215dcbbc22aa6b595a16fd410e474a7f142b8f`，同名txt `1ff4d1e7614530b2beba9c02b901726043670a16349b48205a77761f39966dce`。這只是 source/mock，不是實際010成功。

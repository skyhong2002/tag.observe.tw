# 標籤的圖：讀者上傳與投票

每個標籤的圖（人物的素描頭像見 [tag-avatars.md](tag-avatars.md)，其他標籤的地方、標誌與 emoji 見 [tag-visuals.md](tag-visuals.md)）都可以由登入的讀者上傳、投票決定。程式在 `app/src/pictures/`。

## 規則

- **誰可以**：任何登入的帳號（讀者或管理員）。標籤頁標題旁有「換圖」（還沒有圖時是「加圖」），連到 `/tag/{tag}/picture/`。
- **候選**：人物標籤是 `tag_avatar_candidates`，其他標籤是 `tag_visual_candidates`，自動找到的與讀者上傳的放在一起，依編號排列。
- **上傳**：人物標籤的照片和 Commons 照片一樣找臉、去背、轉素描（閘道縮到 1200px 後排進 worker 的 `tag-avatar-photo` 工作，頁面每 3 秒查一次結果）；其他標籤的圖在閘道去背、裁邊、轉單色。上傳者要勾選「我有權使用這張圖」，每人每天最多 20 張。上傳的原圖不保存，候選記上傳者（`uploaded_by`）與時間。
- **投票**：`tag_picture_votes` 每人每個標籤一票，可以改投或取消。上傳算上傳者投給自己上傳的那張。
- **哪張顯示**：票數最多的那張；同票時維持目前那張；完全沒有票時維持自動挑的那張。狀態改為 `voted`，之後每天重跑不會覆蓋（和 `chosen`、`hidden` 一樣）。
- **管理員覆蓋**：管理員在投票頁按「管理員選定」或在 `/admin/avatars/`、`/admin/tag-visuals/` 點候選，狀態變成 `chosen`（鎖定）；隱藏是 `hidden`。鎖定時票數照算、照樣顯示，但不換圖；「解除選定」改回 `voted`，立刻依票數決定。
- 先公開：讀者上傳後立刻成為候選、可以被投票，不必等管理員審核。

## API（登入後）

| 路由 | 用途 |
| --- | --- |
| `GET /auth/pictures/:tag` | 種類（avatar／visual）、狀態、是否鎖定、目前顯示的編號、自己的票、今天還能上傳幾張、每張候選的票數 |
| `GET /auth/pictures/:tag/candidates/:rank` | 候選圖（人物為已上色的素描） |
| `PUT /auth/pictures/:tag/vote` | `{ rank }` 投票，`{ rank: null }` 取消 |
| `POST /auth/pictures/:tag/upload` | `{ image: base64, agree: true }`；人物回 202 與 `jobId` |
| `GET /auth/pictures/jobs/:id` | 自己的照片工作狀態（管理員可看全部） |
| `PUT /auth/pictures/:tag/lock` | 管理員：`{ rank }` 鎖定、`{ rank: null }` 解除 |

寫入都要同站（Origin）請求。

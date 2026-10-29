<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UI consistency

- 新增或修改頁面前，先對照站內相近頁面，沿用現有共用元件與品牌色、字級、表格和表單樣式。不要另寫一套獨立視覺風格或頁面 CSS。
- 相同介面若目前放在個別路由，先抽出共用並讓原頁面一起使用；不要複製一份再改外觀。

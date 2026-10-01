// Renders docs/api.md from the OpenAPI description in app/src/v1/openapi.ts.
// Run after changing the spec: node tools/gen-api-docs.ts
// (app/test/api-docs.spec.ts fails while docs/api.md is out of date.)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API_REPLACEMENTS } from '../app/src/legacy-redirects.js';
import { API_INTRO, API_TAGS, buildOpenApi, ENDPOINTS, examplePath } from '../app/src/v1/openapi.ts';
import { type Schema, schemaTools } from '../web/src/lib/openapi-fields.mts';

const ORIGIN = 'https://tag.observe.tw';
const { merge, typeLabel, fieldRows } = schemaTools(buildOpenApi().components.schemas as Record<string, Schema>);
const cell = (s: string) => s.replace(/\|/g, '\\|');

const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const anchor = (path: string) =>
  path
    .replace(/^\/api\/v1\/?/, 'api-v1-')
    .replace(/[{}]/g, '')
    .replace(/[/.]/g, '-')
    .replace(/-+$/, '');

export function renderApiMarkdown() {
  const out: string[] = [];
  out.push(`# ${API_INTRO.title}`, '', API_INTRO.summary, '');
  out.push(
    `本文件由 \`tools/gen-api-docs.ts\` 依 \`app/src/v1/openapi.ts\` 產生，請勿手改。網站上的版本：<${ORIGIN}/api/>；機器可讀規格：<${ORIGIN}/api/v1/openapi.json>；端點索引：<${ORIGIN}/api/v1>。`,
    '',
  );
  out.push('## 使用規則', '', ...API_INTRO.rules.map((r) => `- ${r}`), '');
  out.push('## 快速開始', '');
  for (const { label, lang, code } of API_INTRO.quickstart) out.push(`${label}：`, '', `\`\`\`${lang}`, code, '```', '');
  out.push('## 端點一覽', '');
  out.push(
    table(
      ['端點', '說明'],
      ENDPOINTS.map((e) => [`[\`GET ${e.path}\`](#${anchor(e.path)})`, e.summary]),
    ),
    '',
  );
  for (const tag of API_TAGS) {
    const list = ENDPOINTS.filter((e) => e.tag === tag.name);
    if (!list.length) continue;
    out.push(`## ${tag.description}`, '');
    for (const e of list) {
      out.push(`<a id="${anchor(e.path)}"></a>`, '', `### \`GET ${e.path}\``, '', `**${e.summary}**`, '');
      if (e.description) out.push(e.description, '');
      if (e.params?.length)
        out.push(
          table(
            ['參數', '位置', '型別', '說明'],
            e.params.map((p) => {
              const s = p.schema as Schema;
              const range = s.minimum !== undefined && s.maximum !== undefined ? `，${s.minimum}–${s.maximum}` : '';
              const dflt = s.default !== undefined ? `，預設 \`${s.default}\`` : '';
              const ex = p.example !== undefined ? `，例：\`${p.example}\`` : '';
              return [
                `\`${p.name}\``,
                p.in === 'path' ? '路徑' : 'query',
                cell(typeLabel(s)),
                cell(`${p.description}${range}${dflt}${ex}`),
              ];
            }),
          ),
          '',
        );
      out.push('範例：', '', '```sh', `curl -s '${ORIGIN}${examplePath(e)}'`, '```', '');
      const variants = e.response.oneOf ? (e.response.oneOf as Schema[]) : [e.response as Schema];
      for (const v of variants) {
        const rows = fieldRows(v);
        if (!rows.length) continue;
        out.push(variants.length > 1 ? `回應（${merge(v).description ?? ''}）：` : '回應欄位：', '');
        out.push(
          table(
            ['欄位', '型別', '說明'],
            rows.map((r) => [`\`${r.field}\``, cell(r.type), cell(r.description)]),
          ),
          '',
        );
      }
      if (e.errors)
        out.push(
          `錯誤：${Object.entries(e.errors)
            .map(([c, m]) => `\`${c}\` ${m}`)
            .join('；')}。`,
          '',
        );
      if (e.cache) out.push(`快取：${e.cache}。`, '');
    }
  }
  out.push(
    '## 舊站 API 對照',
    '',
    '舊站 tag.analysis.tw 的 `/api/*.php` 是舊網頁自己用的 AJAX 端點，從未公開文件化；新站不再提供，呼叫會回 `410 Gone`，JSON 的 `replacement` 欄位指向下表的替代端點（舊 API 仍在舊網域運作）。',
    '',
    table(
      ['舊端點', '替代'],
      Object.entries(API_REPLACEMENTS as Record<string, string | null>).map(([k, v]) => [
        `\`${k}\``,
        v ? `\`${v}\`` : '已淘汰（資料來源已不存在）',
      ]),
    ),
    '',
  );
  return `${out.join('\n').trimEnd()}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../docs/api.md', import.meta.url), renderApiMarkdown());
  console.log('wrote docs/api.md');
}

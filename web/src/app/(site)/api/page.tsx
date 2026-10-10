import { connection } from 'next/server';
import ApiTabs from '@/components/ApiTabs';
import PageOutline, { type OutlineEntry } from '@/components/PageOutline';
import { API_ORIGIN } from '@/lib/api';
import { type Schema, schemaTools } from '@/lib/openapi-fields.mts';
import { pageMetadata } from '@/lib/seo.mts';
import { table } from '@/lib/table-styles';

// Human-readable API docs, rendered from the gateway's own OpenAPI document
// (app/src/v1/openapi.ts) so this page never drifts from the endpoints.

// Rendered per request (the spec fetch itself is cached for an hour): a build
// prerender runs against the previous gateway, and a cached fallback would stick.
const revalidate = 3600;
export const metadata = pageMetadata(
  '/api/',
  '新文易數 API',
  '免費取用新聞關鍵字、事件、議題、媒體與相似度資料，查閱 API 端點、參數與回傳格式。',
  true,
);

const ORIGIN = 'https://tag.observe.tw';
const GITHUB_DOC = 'https://github.com/skyhong2002/tag.observe.tw/blob/main/docs/api.md';

interface Param {
  name: string;
  in: 'query' | 'path';
  description: string;
  schema: Schema;
  example?: unknown;
}
interface Operation {
  operationId: string;
  tags: string[];
  summary: string;
  description?: string;
  parameters: Param[];
  responses: Record<string, { description: string; content?: Record<string, { schema: Schema }> }>;
}
interface OpenApi {
  info: {
    title: string;
    summary: string;
    description: string;
    'x-quickstart': Array<{ label: string; lang: string; code: string }>;
  };
  tags: Array<{ name: string; description: string }>;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
}
interface IndexEntry {
  path: string;
  example: string;
}

async function load(): Promise<{ spec: OpenApi; examples: Record<string, string> } | null> {
  try {
    const [spec, index] = await Promise.all(
      ['/api/v1/openapi.json', '/api/v1'].map(async (p) => {
        const res = await fetch(API_ORIGIN + p, { next: { revalidate }, headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`${p} -> ${res.status}`);
        return res.json();
      }),
    );
    return {
      spec: spec as OpenApi,
      examples: Object.fromEntries((index.endpoints as IndexEntry[]).map((e) => [e.path, e.example])),
    };
  } catch {
    return null;
  }
}

// `code` spans in the spec's prose become <code>.
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="break-all whitespace-normal rounded bg-zinc-100 px-1 py-0.5 text-[0.85em] dark:bg-zinc-800">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

const anchor = (path: string) =>
  path
    .replace(/^\/api\/v1\/?/, 'api-v1-')
    .replace(/[{}]/g, '')
    .replace(/[/.]/g, '-')
    .replace(/-+$/, '');
const endpointAnchor = (method: string, path: string) => `${anchor(path)}-${method.toLowerCase()}`;
const h2Class = 'scroll-mt-24 text-lg font-semibold';
const cellClass = 'border-b border-zinc-200 px-2 py-1.5 align-top dark:border-zinc-800';
const linkClass = 'text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600 dark:text-brand-400';

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-zinc-900 p-3 text-[13px] leading-relaxed text-zinc-100 dark:bg-zinc-900/80">
      <code>{code}</code>
    </pre>
  );
}

function Endpoint({
  path,
  method,
  op,
  example,
  tools,
}: {
  path: string;
  method: string;
  op: Operation;
  example: string;
  tools: ReturnType<typeof schemaTools>;
}) {
  const successCode = Object.keys(op.responses).find((code) => code.startsWith('2')) ?? '200';
  const success = op.responses[successCode];
  const ok = success?.content?.['application/json']?.schema ?? success?.content?.['application/gzip']?.schema;
  const variants = ok?.oneOf ?? (ok ? [ok] : []);
  const errors = Object.entries(op.responses).filter(([code]) => code !== successCode && code !== '429');
  return (
    <section id={endpointAnchor(method, path)} className="scroll-mt-24 border-t border-zinc-300 pt-5 dark:border-zinc-800">
      <h3 className="flex flex-wrap items-baseline gap-2 font-mono text-[15px]">
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          {method}
        </span>
        <span className="break-all font-semibold">{path}</span>
      </h3>
      <p className="mt-1 font-medium">{op.summary}</p>
      {op.description && (
        <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <Prose text={op.description} />
        </p>
      )}
      {op.parameters.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className={`w-full text-left text-sm sm:min-w-[36rem] ${table.stack}`}>
            <thead className="text-xs text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className={cellClass}>參數</th>
                <th className={cellClass}>型別</th>
                <th className={cellClass}>說明</th>
              </tr>
            </thead>
            <tbody>
              {op.parameters.map((p) => {
                const s = p.schema;
                return (
                  <tr key={`${p.in}:${p.name}`}>
                    <td className={`${cellClass} whitespace-nowrap font-mono`} data-label="參數">
                      {p.name}
                      {p.in === 'path' && <span className="ml-1 font-sans text-xs text-zinc-500">（路徑）</span>}
                    </td>
                    <td className={`${cellClass} font-mono text-xs text-zinc-600 dark:text-zinc-400`} data-label="型別">
                      {tools.typeLabel(s)}
                    </td>
                    <td className={cellClass} data-label="說明">
                      {p.description}
                      {s.minimum !== undefined && s.maximum !== undefined && `，${s.minimum}–${s.maximum}`}
                      {s.default !== undefined && (
                        <>
                          ，預設 <code className="font-mono">{String(s.default)}</code>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 space-y-1">
        <CodeBlock code={`curl -s '${ORIGIN}${example}'`} />
        <a href={example} target="_blank" rel="noopener" className={`text-sm ${linkClass}`}>
          在瀏覽器開啟這個範例 ↗
        </a>
      </div>
      {variants.map((v) => {
        const rows = tools.fieldRows(v);
        if (!rows.length) return null;
        const label = variants.length > 1 ? `回應欄位（${tools.merge(v).description ?? ''}）` : '回應欄位';
        return (
          <details key={label} className="mt-3 rounded-md border border-zinc-300 dark:border-zinc-800">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              {label}
              <span className="ml-2 text-xs font-normal text-zinc-500">{rows.length} 個</span>
            </summary>
            <div className="overflow-x-auto px-3 pb-3">
              <table className={`w-full text-left text-sm sm:min-w-[36rem] ${table.stack}`}>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.field}>
                      <td className={`${cellClass} whitespace-nowrap font-mono text-[13px]`}>{r.field}</td>
                      <td className={`${cellClass} font-mono text-xs text-zinc-600 dark:text-zinc-400`}>{r.type}</td>
                      <td className={cellClass}>{r.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
      {errors.length > 0 && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          錯誤：
          {errors.map(([code, r], i) => (
            <span key={code}>
              {i > 0 && '；'}
              <code className="font-mono">{code}</code> <Prose text={r.description} />
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

export default async function ApiDocsPage() {
  await connection();
  const data = await load();
  if (!data)
    return (
      <div className="space-y-3">
        <ApiTabs current="docs" />
        <h1 className="text-2xl font-semibold tracking-tight">新文易數 API</h1>
        <p className="text-zinc-600">
          文件暫時無法載入。規格檔：
          <a href="/api/v1/openapi.json" className={linkClass}>
            /api/v1/openapi.json
          </a>
          ，或見{' '}
          <a href={GITHUB_DOC} className={linkClass}>
            docs/api.md ↗
          </a>
          。
        </p>
      </div>
    );
  const { spec, examples } = data;
  const tools = schemaTools(spec.components.schemas);
  const ops = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({ path, method: method.toUpperCase(), op })),
  );
  const rules = spec.info.description.split('\n').map((l) => l.replace(/^- /, ''));
  const groups = spec.tags
    .map((tag) => ({ tag, list: ops.filter(({ op }) => op.tags.includes(tag.name)) }))
    .filter(({ list }) => list.length > 0);
  // The outline lists each group's endpoints by path (without /api/v1), the summary on hover.
  const outline: OutlineEntry[] = [
    { id: 'rules', title: '使用規則' },
    { id: 'quickstart', title: '快速開始' },
    { id: 'endpoints', title: '端點一覽' },
    ...groups.map(({ tag, list }) => ({
      id: `tag-${tag.name}`,
      title: tag.description,
      children: list.map(({ path, method, op }) => ({
        id: endpointAnchor(method, path),
        title: `${method} ${path.replace(/^\/api\/v1(?=\/)/, '')}`,
        hint: op.summary,
        mono: true,
      })),
    })),
  ];
  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-x-12 lg:gap-y-6 lg:space-y-0">
      <div className="lg:col-span-2">
        <ApiTabs current="docs" />
      </div>
      <div className="min-w-0 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{spec.info.title}</h1>
          <p className="text-zinc-700 dark:text-zinc-300">{spec.info.summary}</p>
          <div className="flex flex-wrap gap-2 pt-1 text-sm">
            {[
              ['/api/v1/openapi.json', 'OpenAPI 3.1 規格'],
              ['/api/v1', '端點索引 JSON'],
              [GITHUB_DOC, 'Markdown 版文件'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full border border-zinc-300 px-3 py-1 hover:border-brand-400 dark:border-zinc-700"
              >
                {label}
              </a>
            ))}
          </div>
        </header>

        <section className="space-y-2">
          <h2 id="rules" className={h2Class}>
            使用規則
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            {rules.map((r) => (
              <li key={r}>
                <Prose text={r} />
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 id="quickstart" className={h2Class}>
            快速開始
          </h2>
          {spec.info['x-quickstart'].map((q) => (
            <div key={q.label} className="space-y-1">
              <p className="text-sm font-medium">{q.label}</p>
              <CodeBlock code={q.code} />
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 id="endpoints" className={h2Class}>
            端點一覽
          </h2>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {ops.map(({ path, method, op }) => (
              <li key={`${method}:${path}`} className="flex min-w-0 gap-2">
                <a href={`#${endpointAnchor(method, path)}`} className={`truncate font-mono ${linkClass}`}>
                  {method} {path}
                </a>
                <span className="shrink-0 text-zinc-600 dark:text-zinc-400">{op.summary}</span>
              </li>
            ))}
          </ul>
        </section>

        {groups.map(({ tag, list }) => (
          <section key={tag.name} className="space-y-5">
            <h2 id={`tag-${tag.name}`} className={h2Class}>
              {tag.description}
            </h2>
            {list.map(({ path, method, op }) => (
              <Endpoint key={`${method}:${path}`} path={path} method={method} op={op} example={examples[path] ?? path} tools={tools} />
            ))}
          </section>
        ))}
      </div>
      <PageOutline entries={outline} />
    </div>
  );
}

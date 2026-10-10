import { connection } from 'next/server';
import { API_ORIGIN } from '@/lib/api';
import { pageMetadata } from '@/lib/seo.mts';
import { table } from '@/lib/table-styles';

export const metadata = pageMetadata('/api/status/', 'API 狀態', '查看公開 API 與 Nearline 的可用狀態及各端點用途。');

interface ApiStatus {
  status: 'ok' | 'degraded';
  description: string;
  services: Array<{ name: string; status: 'ok' | 'unavailable'; description: string }>;
  endpoints: Array<{ path: string; method: string; description: string }>;
}

async function loadStatus(): Promise<ApiStatus | null> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/status`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    return response.ok ? ((await response.json()) as ApiStatus) : null;
  } catch {
    return null;
  }
}

const cellClass = 'border-b border-zinc-200 px-2 py-1.5 align-top dark:border-zinc-800';
const pillClass = 'rounded-full border border-zinc-300 px-3 py-1 hover:border-brand-400 dark:border-zinc-700';

export default async function ApiStatusPage() {
  await connection();
  const data = await loadStatus();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">API 狀態</h1>
        <p className="text-zinc-700 dark:text-zinc-300">{data?.description ?? '查看公開 API 與 Nearline 的可用狀態及各端點用途。'}</p>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          <a href="/api/" className={pillClass}>
            API 文件
          </a>
          <a href="/api/v1/openapi.json" className={pillClass}>
            OpenAPI 3.1 規格
          </a>
          <a href="/api/status/" className={pillClass}>
            重新整理狀態
          </a>
        </div>
      </header>

      {data ? (
        <>
          <section aria-labelledby="availability" className="space-y-3">
            <h2 id="availability" className="text-lg font-semibold">
              服務狀態
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {data.status === 'ok' ? 'API 與 Nearline 目前皆可使用。' : '部分服務目前無法使用。'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.services.map((service) => (
                <div key={service.name} className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{service.name}</h3>
                    <span
                      className={
                        service.status === 'ok'
                          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                      }
                    >
                      {service.status === 'ok' ? '正常' : '無法使用'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{service.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="endpoints" className="space-y-3">
            <h2 id="endpoints" className="text-lg font-semibold">
              端點用途
            </h2>
            <table className={`w-full text-left text-sm ${table.stack}`}>
              <thead className="text-xs text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className={cellClass}>方法</th>
                  <th className={cellClass}>端點</th>
                  <th className={cellClass}>用途</th>
                </tr>
              </thead>
              <tbody>
                {data.endpoints.map((endpoint) => (
                  <tr key={`${endpoint.method}:${endpoint.path}`}>
                    <td className={`${cellClass} font-mono text-xs`} data-label="方法">
                      {endpoint.method}
                    </td>
                    <td className={`${cellClass} font-mono break-all`} data-label="端點">
                      {endpoint.path}
                    </td>
                    <td className={cellClass} data-label="用途">
                      {endpoint.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <p className="rounded-xl border border-zinc-300 bg-white p-4 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          暫時無法取得 API 狀態，請稍後重新整理。
        </p>
      )}
    </div>
  );
}

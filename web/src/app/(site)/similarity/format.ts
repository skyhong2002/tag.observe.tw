import type { SimilarityData } from '@/lib/similarity';

export const number = (value: number) => value.toLocaleString('zh-TW');
export const taipei = (iso: string) => {
  const date = new Date(Date.parse(iso) + 8 * 3600_000);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}/${two(date.getUTCMonth() + 1)}/${two(date.getUTCDate())} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
};
export const hoursLabel = (hours: number) => (hours === 168 ? '7 天' : `${hours} 小時`);
export function periodLabel(data: SimilarityData) {
  if (!data.days) return `最近 ${hoursLabel(data.hours ?? 48)}`;
  const { from, to } = data.days;
  return from === to ? from.replaceAll('-', '/') : `${from.replaceAll('-', '/')}–${to.replaceAll('-', '/')}`;
}

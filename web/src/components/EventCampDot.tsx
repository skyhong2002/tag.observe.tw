import { CAMP_FILL } from '@/components/CampBar';
import type { Camp } from '@/lib/event-thread.mts';

export const CAMP_TEXT: Record<Camp, string> = {
  blue: 'text-blue-700 dark:text-blue-300',
  green: 'text-emerald-700 dark:text-emerald-300',
  other: 'text-zinc-600 dark:text-zinc-400',
};
export const CAMP_LONG: Record<Camp, string> = { blue: '藍營傾向媒體', green: '綠營傾向媒體', other: '其他媒體' };
export function CampDot({ camp, size = 'h-2 w-2' }: { camp: Camp; size?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${size} ${CAMP_FILL[camp]}`} title={CAMP_LONG[camp]} aria-hidden />;
}

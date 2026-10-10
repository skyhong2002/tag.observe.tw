import WordCloud from '@/components/WordCloud';
import { taipeiHour } from '@/lib/api';
import type { TagStat } from '@/lib/event-thread.mts';

// Every tag an event carried, as a word cloud sized by peak score. Hovering
// or focusing a word opens a small card with the numbers the old list showed
// (peak, when, how many hours); clicking goes to the tag page.

// Viewbox units are about CSS pixels at the page width, so fonts stay modest and the cloud low.
const compact = { width: 340, height: 220, sizes: { min: 11, max: 26 } };
const wide = { width: 1120, height: 240, sizes: { min: 13, max: 40, budget: 0.7 } };

export default function EventTagCloud({ stats, hours }: { stats: TagStat[]; hours: number }) {
  return (
    <WordCloud
      compact={compact}
      wide={wide}
      label="事件標籤文字雲"
      title="事件標籤文字雲"
      words={stats.map((s) => ({
        label: s.tag,
        // A major tag that never made an hour's top list still belongs in the cloud, at the smallest size.
        count: Math.max(s.peak, 0.5),
        href: `/tag/${encodeURIComponent(s.tag)}/`,
        ariaLabel: `${s.tag}，最高 ${s.peak.toFixed(1)} 分，出現 ${s.hours} 小時`,
        tone: s.major ? 'brand' : 'muted',
        fontWeight: s.major ? 700 : 500,
        card: {
          badge: s.major ? { text: '主要標籤', tone: 'brand' } : { text: '相關標籤', tone: 'muted' },
          rows: [
            ['最高分', s.peak > 0 ? `${s.peak.toFixed(1)}（${taipeiHour(s.peakAt)}）` : '未進入任何小時的前 12 名'],
            ['出現', `${s.hours} / ${hours} 小時`],
          ],
        },
      }))}
    />
  );
}

'use client';

import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, useState } from 'react';
import type { SimilarityEdge, SimilarityNode } from '@/lib/similarity';

echarts.use([GraphChart, TooltipComponent, CanvasRenderer]);
export type GraphSelection = { node: string } | { edge: SimilarityEdge } | null;
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export default function SimilarityGraph({
  nodes,
  edges,
  selection,
  onSelect,
}: {
  nodes: SimilarityNode[];
  edges: SimilarityEdge[];
  selection: GraphSelection;
  onSelect: (selection: GraphSelection) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(false);
  const [layout, setLayout] = useState<'circular' | 'force'>('circular');
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ref.current || !nodes.length) return;
    const chart = echarts.init(ref.current);
    const ink = dark ? '#d4d4d8' : '#3f3f46';
    const byId = new Map(nodes.map((node) => [node.id, node]));
    chart.setOption({
      animation: false,
      tooltip: {
        confine: true,
        formatter: (item: { dataType: string; dataIndex: number }) => {
          if (item.dataType === 'edge') {
            const edge = edges[item.dataIndex];
            const source = byId.get(edge.source),
              target = byId.get(edge.target);
            const output = Math.min(source?.articles ?? 0, target?.articles ?? 0);
            return `${escapeHtml(source?.name ?? edge.source)} ${edge.kind === 'citation' ? '→' : '↔'} ${escapeHtml(target?.name ?? edge.target)}<br/>${edge.kind === 'citation' ? '明示引用' : '相似配對'}：${edge.count}${edge.kind === 'similarity' && output ? `<br/>配對數／較少方樣本篇數：${(edge.count / output).toFixed(2)}` : ''}<br/>點選查看文章證據`;
          }
          const node = nodes[item.dataIndex];
          return `${escapeHtml(node.name)} · ${escapeHtml(node.country)}<br/>${node.external ? '被引用的外部媒體' : `分析樣本 ${node.articles} 篇`}<br/>點選查看相關證據`;
        },
      },
      series: [
        {
          type: 'graph',
          layout,
          roam: true,
          draggable: true,
          left: '13%',
          right: '13%',
          top: 50,
          bottom: 50,
          circular: { rotateLabel: false },
          force: { repulsion: 230, edgeLength: [90, 170], gravity: 0.1 },
          label: { show: true, color: ink, fontSize: 11, position: 'right', formatter: '{b}' },
          emphasis: { focus: 'adjacency', label: { fontWeight: 'bold' } },
          data: nodes.map((node) => ({
            id: node.id,
            name: node.name,
            symbolSize: Math.min(40, 15 + Math.sqrt(node.articles) * 2),
            itemStyle: {
              color: node.external ? (dark ? '#a78bfa' : '#7c3aed') : dark ? '#fb923c' : '#c2410c',
              borderColor: selection && 'node' in selection && selection.node === node.id ? (dark ? '#fff' : '#18181b') : 'transparent',
              borderWidth: 3,
            },
          })),
          links: edges.map((edge) => {
            const output = Math.min(byId.get(edge.source)?.articles ?? 0, byId.get(edge.target)?.articles ?? 0);
            const intensity = edge.kind === 'similarity' ? edge.count / Math.max(1, output) : Math.log2(edge.count + 1) / 5;
            const active =
              selection &&
              'edge' in selection &&
              selection.edge.kind === edge.kind &&
              selection.edge.source === edge.source &&
              selection.edge.target === edge.target;
            return {
              source: edge.source,
              target: edge.target,
              symbol: edge.kind === 'citation' ? ['none', 'arrow'] : ['none', 'none'],
              symbolSize: 10,
              lineStyle: {
                width: Math.min(7, 1 + intensity * 5) + (active ? 2 : 0),
                color: edge.kind === 'citation' ? (dark ? '#a78bfa' : '#7c3aed') : dark ? '#fb923c' : '#c2410c',
                type: edge.kind === 'citation' ? 'dashed' : 'solid',
                curveness: edge.kind === 'citation' ? 0.18 : -0.08,
                opacity: active ? 1 : 0.7,
              },
            };
          }),
        },
      ],
    });
    chart.on('click', (event: { dataType?: string; dataIndex?: number }) => {
      if (event.dataIndex === undefined) return;
      if (event.dataType === 'edge') onSelect({ edge: edges[event.dataIndex] });
      else if (event.dataType === 'node') onSelect({ node: nodes[event.dataIndex].id });
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [nodes, edges, dark, layout, selection, onSelect]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 text-xs">
        <p className="text-zinc-600 dark:text-zinc-400">
          <span className="text-brand-700 dark:text-brand-400">━ 內文相似</span>
          <span className="ml-4 text-violet-700 dark:text-violet-400">⇢ 明示引用</span>
        </p>
        <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {(['circular', 'force'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={layout === value}
              onClick={() => setLayout(value)}
              className={`rounded-md px-3 py-1 ${layout === value ? 'bg-white shadow-sm dark:bg-zinc-700' : ''}`}
            >
              {value === 'circular' ? '環形' : '力導向'}
            </button>
          ))}
        </div>
      </div>
      {nodes.length ? (
        <div
          ref={ref}
          className="h-80 w-full sm:h-[420px]"
          role="img"
          aria-label={`媒體關係圖，${nodes.length} 個媒體、${edges.length} 條關係。下方文字列表可執行相同的篩選。`}
        />
      ) : (
        <p className="p-10 text-center text-sm text-zinc-500">目前篩選沒有可呈現的關係。</p>
      )}
      <p className="px-4 pb-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        可拖曳、縮放及點選節點或連線。相似連線粗細依配對數／較少方樣本篇數；同篇可出現在多組配對，這不是轉載率。
      </p>
    </div>
  );
}

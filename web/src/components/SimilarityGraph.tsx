'use client';

import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, useState } from 'react';
import { bindGraphNavigation, GRAPH_ZOOM_MAX, GRAPH_ZOOM_MIN } from '@/lib/graph-navigation.mts';
import {
  displayedGraphEdges,
  edgeWeightWidth,
  type MediaCamps,
  mainGraphEdges,
  mediaGraphPositions,
  mediaIconSizes,
  mediaLabelColor,
  mediaVisibleLabels,
  nodeArticleCounts,
} from '@/lib/media-graph.mts';
import { graphMediaIcon, localMediaIcon } from '@/lib/media-icons';
import type { SimilarityData, SimilarityEdge, SimilarityNode } from '@/lib/similarity';

echarts.use([GraphChart, TooltipComponent, CanvasRenderer, LabelLayout]);
export type GraphSelection = { node: string } | { edge: SimilarityEdge } | null;
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function fallbackIcon(node: SimilarityNode) {
  const label = escapeHtml(/^[a-z]/i.test(node.name) ? node.name.slice(0, 3).toUpperCase() : node.name.slice(0, 2));
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#fff" stroke="#d4d4d8"/><text x="32" y="39" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="#3f3f46">${label}</text></svg>`)}`;
}
export default function SimilarityGraph({
  nodes,
  edges,
  layoutEdges,
  camps,
  data,
  showAll,
  onSelect,
  fullscreen,
  onToggleFullscreen,
}: {
  nodes: SimilarityNode[];
  edges: SimilarityEdge[];
  layoutEdges: SimilarityEdge[];
  camps: MediaCamps;
  data: SimilarityData;
  showAll: boolean;
  onSelect: (selection: GraphSelection) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onSelect);
  const density = useRef(showAll);
  const activeEdges = useRef(edges);
  const refresh = useRef<(() => void) | null>(null);
  const navigate = useRef<((action: 'in' | 'out' | 'reset') => void) | null>(null);
  const camera = useRef<{ key: string; zoom: number; center: number[] | null } | null>(null);
  useEffect(() => {
    activeEdges.current = edges;
    density.current = showAll;
    refresh.current?.();
  }, [edges, showAll]);
  callback.current = onSelect;
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ref.current || !nodes.length) return;
    let disposed = false;
    const chart = echarts.init(ref.current);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const counts = nodeArticleCounts(data);
    let edges = activeEdges.current;
    let overview = mainGraphEdges(edges);
    let focused: string | null = null;
    let neighbors = new Set<string>();
    let visibleEdges = displayedGraphEdges(edges, overview, density.current, focused);
    let connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
    const symbols = new Map(nodes.map((n) => [n.id, fallbackIcon(n)]));
    const maxWeight = Math.max(1, ...data.edges.map((edge) => edge.count));
    const ink = dark ? '#d4d4d8' : '#52525b';
    const relationships = (id: string, incoming: boolean) =>
      data.edges
        .filter((e) => e.kind === 'citation' && (incoming ? e.target : e.source) === id)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((e) => `${escapeHtml(data.nodes.find((n) => n.id === (incoming ? e.source : e.target))?.name ?? '')} ${e.count} 篇`)
        .join('、');
    let width = chart.getWidth(),
      height = chart.getHeight();
    let positions = mediaGraphPositions(nodes, layoutEdges, width, Math.max(100, height - 58));
    const layoutBounds = () => ({
      left: Math.min(...positions.map((p) => p.x)),
      right: chart.getWidth() - Math.max(...positions.map((p) => p.x)),
      top: Math.min(...positions.map((p) => p.y)),
      bottom: chart.getHeight() - Math.max(...positions.map((p) => p.y)),
    });
    const cameraKey = nodes.map((node) => node.id).join('|');
    const savedCamera = camera.current?.key === cameraKey ? camera.current : null;
    const rememberCamera = () => {
      const series = (chart.getOption().series as { zoom: number; center: number[] | null }[])[0];
      camera.current = { key: cameraKey, zoom: series.zoom, center: series.center };
    };
    let zoom = savedCamera?.zoom ?? 1;
    let navigating = false;
    const nodeData = () => {
      const sizes = mediaIconSizes(nodes, chart.getWidth());
      const labels = mediaVisibleLabels(nodes, positions, sizes, chart.getWidth(), zoom);
      return nodes.map((n, i) => ({
        ...positions[i],
        id: n.id,
        name: n.name,
        symbol: `image://${symbols.get(n.id)}`,
        symbolSize: sizes.get(n.id),
        symbolKeepAspect: true,
        itemStyle: { opacity: !focused || neighbors.has(n.id) ? 1 : 0.12 },
        label: {
          show: focused === n.id || labels.has(n.id),
          color: mediaLabelColor(camps[n.id], dark),
          opacity: !focused || neighbors.has(n.id) ? 1 : 0.4,
        },
      }));
    };
    const linkData = () =>
      visibleEdges.map((e) => ({
        source: e.source,
        target: e.target,
        relationship: e,
        symbol: e.kind === 'citation' ? ['none', 'arrow'] : ['none', 'none'],
        symbolSize: 6,
        lineStyle: {
          width: edgeWeightWidth(e.count, maxWeight),
          color: e.kind === 'citation' ? (dark ? '#a78bfa' : '#8b5cf6') : dark ? '#fb923c' : '#ea580c',
          type: e.kind === 'citation' ? 'dashed' : 'solid',
          opacity: focused ? (e.source === focused || e.target === focused ? 0.85 : 0.035) : 0.26,
          curveness: e.kind === 'citation' ? 0.1 : -0.05,
        },
      }));
    const updateFocus = (id: string | null, force = false) => {
      if (disposed || (!force && focused === id)) return;
      focused = id;
      neighbors = new Set(id ? [id, ...edges.filter((e) => e.source === id || e.target === id).flatMap((e) => [e.source, e.target])] : []);
      visibleEdges = displayedGraphEdges(edges, overview, density.current, focused);
      chart.setOption({ series: [{ id: 'media-network', data: nodeData(), links: linkData() }] });
    };
    refresh.current = () => {
      edges = activeEdges.current;
      overview = mainGraphEdges(edges);
      connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
      chart.dispatchAction({ type: 'hideTip' });
      updateFocus(null, true);
    };
    const render = () => {
      if (disposed) return;
      const small = chart.getWidth() < 600;
      chart.setOption({
        animation: false,
        tooltip: {
          confine: true,
          borderWidth: 0,
          padding: 14,
          backgroundColor: dark ? '#18181b' : '#fff',
          textStyle: { color: ink, fontSize: 12 },
          extraCssText: 'max-width:280px;white-space:normal;line-height:1.8;box-shadow:0 8px 30px #0002;border-radius:12px;',
          formatter: (item: { dataType: string; dataIndex: number; data?: { relationship?: SimilarityEdge } }) => {
            if (item.dataType === 'edge') {
              const e = item.data?.relationship ?? visibleEdges[item.dataIndex];
              if (!e) return '';
              return `${escapeHtml(byId.get(e.source)?.name ?? e.source)} ${e.kind === 'citation' ? '→' : '↔'} ${escapeHtml(byId.get(e.target)?.name ?? e.target)}<br/><b>${e.count} ${e.kind === 'citation' ? '篇文章明示引用' : '組相似內文'}</b><br/>點選查看文章`;
            }
            const node = nodes[item.dataIndex],
              c = counts.get(node.id);
            const outgoing = relationships(node.id, false),
              incoming = relationships(node.id, true);
            const status = connected.has(node.id) ? '' : '<br/><span style="opacity:.7">本期樣本未偵測到目前顯示的關係</span>';
            return `<b>${escapeHtml(node.name)}</b> · ${escapeHtml(node.country)}${status}${!node.external ? `<br/>納入樣本：<b>${node.articles} 篇</b>（圖示大小依據）` : '<br/>僅作為引用來源，未收錄本期內文<br/>圖示採固定大小'}<br/>引用其他媒體：<b>${c?.outgoing ?? 0} 篇</b>${outgoing ? `<br/><span style="opacity:.7">→ ${outgoing}</span>` : ''}<br/>被其他媒體引用：<b>${c?.incoming ?? 0} 篇</b>${incoming ? `<br/><span style="opacity:.7">← ${incoming}</span>` : ''}<br/>內文相近：${c?.similar ?? 0} 篇<br/><span style="opacity:.6">本期樣本，文章去重計數 · 點選看證據</span>`;
          },
        },
        series: [
          {
            id: 'media-network',
            type: 'graph',
            layout: 'none',
            // Pixel bounds match the layout: fitting must not shrink collision gaps.
            preserveAspect: 'contain',
            roam: false,
            // Like map markers, keep logos readable as the camera zooms.
            nodeScaleRatio: 0,
            draggable: false,
            scaleLimit: { min: GRAPH_ZOOM_MIN, max: GRAPH_ZOOM_MAX },
            zoom: savedCamera?.zoom ?? 1,
            center: savedCamera?.center ?? null,
            ...layoutBounds(),
            emphasis: { disabled: true },
            blur: { itemStyle: { opacity: 0.18 }, lineStyle: { opacity: 0.04 }, label: { opacity: 0.2 } },
            label: {
              show: true,
              silent: true,
              color: ink,
              position: 'bottom',
              distance: 7,
              fontSize: small ? 9 : 11,
              formatter: '{b}',
              width: small ? 70 : 100,
              overflow: 'truncate',
            },
            labelLayout: { hideOverlap: true },
            data: nodeData(),
            links: linkData(),
          },
        ],
      });
    };
    render();
    const gestures = bindGraphNavigation(ref.current, {
      zoom: () => zoom,
      scale: (next, origin) => {
        chart.dispatchAction({ type: 'graphRoam', seriesId: 'media-network', zoom: next / zoom, originX: origin.x, originY: origin.y });
        zoom = next;
      },
      pan: (dx, dy) => chart.dispatchAction({ type: 'graphRoam', seriesId: 'media-network', dx, dy }),
      reset: () => {
        zoom = 1;
        chart.setOption({ series: [{ id: 'media-network', zoom: 1, center: null }] });
      },
      moving: (value) => {
        if (value && !navigating) {
          updateFocus(null);
          chart.dispatchAction({ type: 'hideTip' });
        }
        navigating = value;
      },
      settled: () => {
        rememberCamera();
        chart.setOption({ series: [{ id: 'media-network', data: nodeData() }] });
      },
    });
    navigate.current = gestures.navigate;
    // All icons are same-origin cached assets; an unavailable image keeps its
    // letter tile, never an invisible node or a circular placeholder.
    for (const node of nodes) {
      const src = localMediaIcon(node.id);
      if (!src) continue;
      const img = new Image();
      img.onload = () => {
        if (disposed) return;
        symbols.set(node.id, graphMediaIcon(img, node.id, dark));
        chart.setOption({ series: [{ id: 'media-network', data: nodeData() }] });
      };
      img.src = src;
    }
    let leaveTimer: ReturnType<typeof setTimeout>;
    chart.on('mouseover', (event: { dataType?: string; dataIndex?: number }) => {
      clearTimeout(leaveTimer);
      if (!navigating && event.dataType === 'node' && event.dataIndex !== undefined) updateFocus(nodes[event.dataIndex].id);
    });
    chart.on('mouseout', () => {
      leaveTimer = setTimeout(() => updateFocus(null), 180);
    });
    chart.getZr().on('globalout', () => {
      clearTimeout(leaveTimer);
      updateFocus(null);
    });
    chart.on('click', (event) => {
      if (navigating || event.dataIndex === undefined) return;
      if (event.dataType === 'edge') {
        const edge = (event.data as { relationship?: SimilarityEdge } | null)?.relationship ?? visibleEdges[event.dataIndex];
        if (edge) callback.current({ edge });
      } else if (event.dataType === 'node') callback.current({ node: nodes[event.dataIndex].id });
    });
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!disposed) {
          chart.resize();
          const nextWidth = chart.getWidth(),
            nextHeight = chart.getHeight();
          if (width === nextWidth && height === nextHeight) return;
          const series = (chart.getOption().series as { center: number[] | null }[])[0];
          const center = series.center ? [(series.center[0] * nextWidth) / width, (series.center[1] * nextHeight) / height] : null;
          width = nextWidth;
          height = nextHeight;
          positions = mediaGraphPositions(nodes, layoutEdges, width, Math.max(100, height - 58));
          chart.setOption({
            series: [
              {
                id: 'media-network',
                ...layoutBounds(),
                center,
                data: nodeData(),
                label: { fontSize: width < 600 ? 9 : 11, width: width < 600 ? 70 : 100 },
              },
            ],
          });
          rememberCamera();
        }
      });
    });
    observer.observe(ref.current);
    return () => {
      gestures.dispose();
      rememberCamera();
      disposed = true;
      navigate.current = null;
      clearTimeout(leaveTimer);
      refresh.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      chart.dispose();
    };
  }, [nodes, layoutEdges, camps, data, dark]);
  return nodes.length ? (
    <div className="relative h-full w-full">
      <div
        ref={ref}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        role="img"
        aria-label={`媒體關係圖，${nodes.length} 家媒體。可拖曳整張圖、滾輪或雙指縮放；媒體相對位置固定。點選圖示查看文章。`}
      />
      <fieldset
        aria-label="圖表視野"
        className="absolute right-3 bottom-3 flex overflow-hidden rounded-lg border border-zinc-200 bg-white/95 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/95"
      >
        {(
          [
            ['out', '縮小', '−'],
            ['in', '放大', '＋'],
            ['reset', '重設視野', '重設'],
          ] as const
        ).map(([action, label, text]) => (
          <button
            key={action}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => navigate.current?.(action)}
            className="min-h-11 min-w-11 px-3 text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-zinc-800"
          >
            {text}
          </button>
        ))}
        <button
          type="button"
          aria-label={fullscreen ? '退出全螢幕' : '全螢幕'}
          aria-pressed={fullscreen}
          onClick={onToggleFullscreen}
          className="min-h-11 min-w-11 border-l border-zinc-200 px-3 text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {fullscreen ? '退出全螢幕' : '全螢幕'}
        </button>
      </fieldset>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-500">
      目前樣本沒有這類關係，可切換其他關係或期間查看。
    </div>
  );
}

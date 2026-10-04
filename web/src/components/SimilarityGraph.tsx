'use client';

import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, useState } from 'react';
import MediaGraphLoading from '@/components/MediaGraphLoading';
import { graphBoundaryDiameter, graphEdgeHasRoom } from '@/lib/graph-edge-boundary.mts';
import { type GraphSelection, highlightedRelationship, sameGraphSelection } from '@/lib/graph-evidence.mts';
import { bindGraphNavigation, GRAPH_ZOOM_MAX, GRAPH_ZOOM_MIN } from '@/lib/graph-navigation.mts';
import { createGraphTooltip } from '@/lib/graph-tooltip.mts';
import {
  displayedGraphEdges,
  edgeWeightWidth,
  type MediaCamps,
  mainGraphEdges,
  mediaGraphPositions,
  mediaIconSizes,
  mediaLabelColor,
  mediaVisibleLabels,
} from '@/lib/media-graph.mts';
import { graphMediaIcon, localMediaIcon } from '@/lib/media-icons';
import type { SimilarityEdge, SimilarityNode } from '@/lib/similarity';

echarts.use([GraphChart, TooltipComponent, CanvasRenderer, LabelLayout]);

export type { GraphSelection } from '@/lib/graph-evidence.mts';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function fallbackIcon(node: SimilarityNode, logoSize: number) {
  const pad = ((graphBoundaryDiameter(logoSize) / logoSize - 1) * 64) / 2;
  const label = escapeHtml(/^[a-z]/i.test(node.name) ? node.name.slice(0, 3).toUpperCase() : node.name.slice(0, 2));
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="${-pad} ${-pad} ${64 + 2 * pad} ${64 + 2 * pad}"><rect x="1" y="1" width="62" height="62" rx="14" fill="#fff" stroke="#d4d4d8"/><text x="32" y="39" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="#3f3f46">${label}</text></svg>`)}`;
}
export default function SimilarityGraph({
  nodes,
  edges,
  layoutEdges,
  camps,
  data,
  showAll,
  onSelect,
  selection,
  fullscreen,
  onToggleFullscreen,
}: {
  nodes: SimilarityNode[];
  edges: SimilarityEdge[];
  layoutEdges: SimilarityEdge[];
  camps: MediaCamps;
  /** Period-wide edges: line widths share one scale across filters and modes. */
  data: { edges: SimilarityEdge[] };
  showAll: boolean;
  onSelect: (selection: GraphSelection) => void;
  selection: GraphSelection;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const callback = useRef(onSelect);
  const density = useRef(showAll);
  const activeEdges = useRef(edges);
  const pinned = useRef(selection);
  const refresh = useRef<(() => void) | null>(null);
  const navigate = useRef<((action: 'in' | 'out' | 'reset') => void) | null>(null);
  const camera = useRef<{ key: string; zoom: number; center: number[] | null } | null>(null);
  useEffect(() => {
    pinned.current = selection;
    activeEdges.current = edges;
    density.current = showAll;
    refresh.current?.();
  }, [edges, showAll, selection]);
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
    let edges = activeEdges.current;
    let overview = mainGraphEdges(edges);
    let focused: GraphSelection = null;
    let neighbors = new Set<string>();
    let visibleEdges = displayedGraphEdges(edges, overview, density.current, null);
    const images = new Map<string, HTMLImageElement>();
    const symbols = new Map<string, { size: number; url: string }>();
    const nodeSymbol = (node: SimilarityNode, size: number) => {
      const cached = symbols.get(node.id);
      if (cached?.size === size) return cached.url;
      const image = images.get(node.id);
      const url = image ? graphMediaIcon(image, node.id, dark, size) : fallbackIcon(node, size);
      symbols.set(node.id, { size, url });
      return url;
    };
    const maxWeight = Math.max(1, ...data.edges.map((edge) => edge.count));
    const tooltipContent = createGraphTooltip(nodes, camps);
    const ink = dark ? '#d4d4d8' : '#52525b';
    // Midpoint of the panel's background gradient.
    const paper = dark ? [17, 17, 19] : [254, 254, 254];
    const flatten = (hex: string, opacity: number) =>
      `rgb(${[1, 3, 5].map((i, c) => Math.round(parseInt(hex.slice(i, i + 2), 16) * opacity + paper[c] * (1 - opacity))).join(',')})`;
    let width = chart.getWidth(),
      height = chart.getHeight();
    let positions = mediaGraphPositions(nodes, layoutEdges, width, Math.max(100, height - 58), true);
    const layoutBounds = () => ({
      left: Math.min(...positions.map((p) => p.x)) - (nodes.length === 1 ? 1 : 0),
      right: chart.getWidth() - Math.max(...positions.map((p) => p.x)) - (nodes.length === 1 ? 1 : 0),
      top: Math.min(...positions.map((p) => p.y)) - (nodes.length === 1 ? 1 : 0),
      bottom: chart.getHeight() - Math.max(...positions.map((p) => p.y)) - (nodes.length === 1 ? 1 : 0),
    });
    const cameraKey = nodes.map((node) => node.id).join('|');
    const savedCamera = camera.current?.key === cameraKey ? camera.current : null;
    const rememberCamera = () => {
      const series = (chart.getOption().series as { zoom: number; center: number[] | null }[])[0];
      camera.current = { key: cameraKey, zoom: series.zoom, center: series.center };
    };
    let zoom = savedCamera?.zoom ?? 1;
    let navigating = false;
    let tooltipSuppressed = false;
    const hideTooltip = () => {
      tooltipSuppressed = true;
      // setOption can restore ECharts' last tooltip after a click. Keep content
      // disabled until a real mouse/pen movement, not a chart redraw, resumes it.
      chart.setOption({ tooltip: { showContent: false } });
      chart.dispatchAction({ type: 'hideTip' });
    };
    const resumeTooltip = (event: PointerEvent) => {
      if (!tooltipSuppressed || navigating || event.buttons || event.pointerType === 'touch') return;
      tooltipSuppressed = false;
      chart.setOption({ tooltip: { showContent: true } });
    };
    const element = ref.current;
    element.addEventListener('pointermove', resumeTooltip, true);
    const nodeData = () => {
      const sizes = mediaIconSizes(nodes, chart.getWidth());
      const labels = mediaVisibleLabels(nodes, positions, sizes, chart.getWidth(), zoom);
      return nodes.map((n, i) => ({
        ...positions[i],
        id: n.id,
        name: n.name,
        symbol: `image://${nodeSymbol(n, sizes.get(n.id)!)}`,
        symbolSize: graphBoundaryDiameter(sizes.get(n.id)!),
        symbolKeepAspect: true,
        itemStyle: { opacity: !focused || neighbors.has(n.id) ? 1 : 0.12 },
        label: {
          distance: 7 - (graphBoundaryDiameter(sizes.get(n.id)!) - sizes.get(n.id)!) / 2,
          show:
            (!!focused && ('node' in focused ? focused.node === n.id : focused.edge.source === n.id || focused.edge.target === n.id)) ||
            labels.has(n.id),
          color: mediaLabelColor(camps[n.id], dark),
          opacity: !focused || neighbors.has(n.id) ? 1 : 0.4,
        },
      }));
    };
    const linkData = () => {
      const sizes = mediaIconSizes(nodes, chart.getWidth());
      const points = new Map(nodes.map((node, i) => [node.id, positions[i]]));
      return (
        visibleEdges
          .filter((edge) => {
            const a = points.get(edge.source)!,
              b = points.get(edge.target)!;
            return graphEdgeHasRoom(Math.hypot(a.x - b.x, a.y - b.y), zoom, sizes.get(edge.source)!, sizes.get(edge.target)!, 14);
          })
          .map((e) => ({
            e,
            opacity: focused ? (highlightedRelationship(e, focused) ? 0.95 : 0.035) : 0.5,
            width: edgeWeightWidth(e.count, maxWeight),
          }))
          // Opaque edges occlude each other: faded ones first, thin over thick.
          .sort((a, b) => a.opacity - b.opacity || b.width - a.width)
          .map(({ e, opacity, width }) => ({
            source: e.source,
            target: e.target,
            relationship: e,
            // Edges run from the later or citing outlet to its source; the head
            // sits on the source end so arrows follow the text's flow, source
            // to follower. ECharts points a start symbol away from the line.
            // ECharts puts the built-in arrow's tip on the line end, so a thick
            // line's square end pokes out beside the tip. A path symbol is
            // centred on the line end instead: the line stops halfway into
            // the head, where the head is at least as wide as the line.
            symbol: ['path://M5 0L10 10L5 8L0 10Z', 'circle'],
            symbolSize: [[Math.max(12, 2 * width + 6), 14], 0],
            lineStyle: {
              width,
              // ECharts draws the line and its arrowhead as two shapes sharing one
              // opacity; translucency would darken where they overlap.
              color: flatten(e.kind === 'citation' ? (dark ? '#a78bfa' : '#8b5cf6') : dark ? '#fb923c' : '#ea580c', opacity),
              type: 'solid',
              opacity: 1,
              curveness: e.kind === 'citation' ? 0.1 : -0.05,
            },
          }))
      );
    };
    const updateFocus = (value: GraphSelection, force = false) => {
      if (disposed || (!force && sameGraphSelection(focused, value))) return;
      focused = value;
      neighbors = new Set(value && 'node' in value ? [value.node] : []);
      for (const edge of edges)
        if (highlightedRelationship(edge, focused)) {
          neighbors.add(edge.source);
          neighbors.add(edge.target);
        }
      visibleEdges = displayedGraphEdges(edges, overview, density.current, value && 'node' in value ? value.node : null);
      if (value && 'edge' in value)
        visibleEdges = edges.filter((edge) => visibleEdges.includes(edge) || highlightedRelationship(edge, value));
      chart.setOption({ series: [{ id: 'media-network', data: nodeData(), links: linkData() }] });
    };
    refresh.current = () => {
      edges = activeEdges.current;
      overview = mainGraphEdges(edges);
      hideTooltip();
      updateFocus(pinned.current, true);
    };
    const render = () => {
      if (disposed) return;
      const small = chart.getWidth() < 600;
      chart.setOption({
        animation: false,
        tooltip: {
          trigger: 'item',
          triggerOn: 'mousemove',
          confine: true,
          enterable: false,
          showDelay: 80,
          hideDelay: 100,
          transitionDuration: 0,
          borderWidth: 0,
          padding: 12,
          backgroundColor: dark ? '#18181b' : '#fff',
          textStyle: { color: ink, fontSize: 12 },
          extraCssText:
            'max-width:320px;white-space:normal;overflow-wrap:anywhere;line-height:1.7;box-shadow:0 4px 20px #0003;border-radius:10px;pointer-events:none;',
          formatter: (item: { dataType: string; dataIndex: number; data?: { relationship?: SimilarityEdge } }) => {
            if (item.dataType === 'edge') {
              const edge = item.data?.relationship ?? visibleEdges[item.dataIndex];
              return edge ? tooltipContent({ edge }, edges) : '';
            }
            const node = nodes[item.dataIndex];
            return node ? tooltipContent({ node: node.id }, edges) : '';
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
            // Keep logos fixed in pixels. ECharts 6 treats exactly zero as a
            // missing value (ratio 1); epsilon avoids that fallback.
            nodeScaleRatio: Number.EPSILON,
            // Non-'none' endpoint symbols activate ECharts' circle clipping.
            // Zero-size circles are invisible; padded images keep logos unchanged.
            edgeSymbol: ['circle', 'circle'],
            edgeSymbolSize: [0, 0],
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
    updateFocus(pinned.current, true);
    setReady(true);
    const gestures = bindGraphNavigation(ref.current, {
      zoom: () => zoom,
      scale: (next, origin) => {
        chart.dispatchAction({ type: 'graphRoam', seriesId: 'media-network', zoom: next / zoom, originX: origin.x, originY: origin.y });
        zoom = next;
        chart.setOption({ series: [{ id: 'media-network', links: linkData() }] });
      },
      pan: (dx, dy) => chart.dispatchAction({ type: 'graphRoam', seriesId: 'media-network', dx, dy }),
      reset: () => {
        zoom = 1;
        chart.setOption({ series: [{ id: 'media-network', zoom: 1, center: null, links: linkData() }] });
      },
      moving: (value) => {
        if (value && !navigating) {
          hideTooltip();
          updateFocus(pinned.current);
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
        images.set(node.id, img);
        symbols.delete(node.id);
        chart.setOption({ series: [{ id: 'media-network', data: nodeData() }] });
      };
      img.src = src;
    }
    let leaveTimer: ReturnType<typeof setTimeout>;
    chart.on('mouseover', (event) => {
      clearTimeout(leaveTimer);
      if (navigating || event.dataIndex === undefined || pinned.current) return;
      // A pinned selection owns the highlights. ECharts still shows hover
      // cards for other nodes/edges without changing the graph or evidence.
      if (event.dataType === 'node') updateFocus({ node: nodes[event.dataIndex].id });
      else if (event.dataType === 'edge') {
        const edge = (event.data as { relationship?: SimilarityEdge } | null)?.relationship ?? visibleEdges[event.dataIndex];
        if (edge) updateFocus({ edge });
      }
    });
    chart.on('mouseout', () => {
      leaveTimer = setTimeout(() => updateFocus(pinned.current), 180);
    });
    chart.getZr().on('globalout', () => {
      clearTimeout(leaveTimer);
      updateFocus(pinned.current);
    });
    chart.on('click', (event) => {
      hideTooltip();
      if (navigating || event.dataIndex === undefined) return;
      if (event.dataType === 'edge') {
        const edge = (event.data as { relationship?: SimilarityEdge } | null)?.relationship ?? visibleEdges[event.dataIndex];
        if (edge) callback.current(sameGraphSelection(pinned.current, { edge }) ? null : { edge });
      } else if (event.dataType === 'node') {
        const value = { node: nodes[event.dataIndex].id };
        callback.current(sameGraphSelection(pinned.current, value) ? null : value);
      }
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
          positions = mediaGraphPositions(nodes, layoutEdges, width, Math.max(100, height - 58), true);
          chart.setOption({
            series: [
              {
                id: 'media-network',
                ...layoutBounds(),
                center,
                data: nodeData(),
                links: linkData(),
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
      element.removeEventListener('pointermove', resumeTooltip, true);
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
  return (
    <div className="relative h-full w-full" aria-busy={nodes.length > 0 && !ready}>
      {nodes.length ? (
        <div
          key="graph-canvas"
          ref={ref}
          className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`媒體關係圖，${nodes.length} 家媒體。可拖曳整張圖、滾輪或雙指縮放；媒體相對位置固定。點選圖示固定高亮相關連線，文章可在圖表下方瀏覽。`}
        />
      ) : (
        <div key="graph-empty" className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-500">
          目前沒有符合媒體篩選的資料，請調整上方藍綠分類或媒體 tag。
        </div>
      )}
      {!!nodes.length && !ready && (
        <div className="absolute inset-0">
          <MediaGraphLoading />
        </div>
      )}
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
            disabled={!nodes.length}
            onClick={() => navigate.current?.(action)}
            className="min-h-11 min-w-11 px-3 text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            {text}
          </button>
        ))}
        <button
          type="button"
          aria-label={fullscreen ? '退出全螢幕' : '全螢幕'}
          title={fullscreen ? '退出全螢幕' : '全螢幕'}
          aria-pressed={fullscreen}
          onClick={onToggleFullscreen}
          className="min-h-11 min-w-11 border-l border-zinc-200 px-3 text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={fullscreen ? 'M3 9h6V3m6 0v6h6M3 15h6v6m6 0v-6h6' : 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6'} />
          </svg>
        </button>
      </fieldset>
    </div>
  );
}

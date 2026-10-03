import type { SimilarityData, SimilarityEdge, SimilarityNode } from '../../../app/src/similarity/types.ts';

export function nodeArticleCounts(data: Pick<SimilarityData, 'citations' | 'pairs'>) {
  const counts = new Map<string, { outgoing: Set<number>; incoming: Set<number>; similar: Set<number> }>();
  const get = (id: string) => {
    if (!counts.has(id)) counts.set(id, { outgoing: new Set(), incoming: new Set(), similar: new Set() });
    return counts.get(id)!;
  };
  for (const { article, source } of data.citations) {
    get(article.media).outgoing.add(article.id);
    get(source.media).incoming.add(article.id);
  }
  for (const { a, b } of data.pairs) {
    get(a.media).similar.add(a.id);
    get(b.media).similar.add(b.id);
  }
  return new Map(
    [...counts].map(([id, count]) => [
      id,
      {
        outgoing: count.outgoing.size,
        incoming: count.incoming.size,
        similar: count.similar.size,
      },
    ]),
  );
}

// Settle a deterministic spring/repulsion layout before painting. This keeps
// the whole graph in frame and prevents selections/theme changes from moving it.
export function forcePositions(
  nodes: SimilarityNode[],
  edges: SimilarityEdge[],
  width: number,
  height: number,
  sizes?: Map<string, number>,
) {
  const byId = new Map(nodes.map((node, i) => [node.id, i]));
  const points = nodes.map((node, i) => {
    const angle = i * 2.399963229728653;
    const radius = Math.sqrt((i + 1) / Math.max(1, nodes.length));
    return { id: node.id, x: Math.cos(angle) * radius * width * 0.35, y: Math.sin(angle) * radius * height * 0.35 };
  });
  const links = edges.flatMap((edge) => {
    const a = byId.get(edge.source),
      b = byId.get(edge.target);
    return a === undefined || b === undefined ? [] : [{ a, b, weight: 1 + Math.log2(edge.count + 1) * 0.15 }];
  });
  const spacing = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.72;
  for (let step = 0; step < 240; step++) {
    const delta = points.map((p) => ({ x: -p.x * 0.045, y: -p.y * 0.045 }));
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x,
          dy = points[i].y - points[j].y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = (spacing * spacing * 0.08) / distance;
        delta[i].x += (dx / distance) * force;
        delta[i].y += (dy / distance) * force;
        delta[j].x -= (dx / distance) * force;
        delta[j].y -= (dy / distance) * force;
      }
    }
    for (const { a, b, weight } of links) {
      const dx = points[b].x - points[a].x,
        dy = points[b].y - points[a].y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const force = (distance - spacing * 1.2) * 0.08 * weight;
      delta[a].x += (dx / distance) * force;
      delta[a].y += (dy / distance) * force;
      delta[b].x -= (dx / distance) * force;
      delta[b].y -= (dy / distance) * force;
    }
    const temperature = 12 * (1 - step / 240) + 0.1;
    for (let i = 0; i < points.length; i++) {
      const length = Math.max(1, Math.hypot(delta[i].x, delta[i].y));
      points[i].x += (delta[i].x / length) * Math.min(length, temperature);
      points[i].y += (delta[i].y / length) * Math.min(length, temperature);
      points[i].x = Math.max(-width * 0.45, Math.min(width * 0.45, points[i].x));
      points[i].y = Math.max(-height * 0.45, Math.min(height * 0.45, points[i].y));
    }
  }
  // Resolve icon collisions after the springs settle, including dense hubs.
  // The chart fits these bounds to its viewport with room for labels.
  const gap = Math.min(width < 600 ? 58 : 82, Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.8);
  for (let step = 0; step < 120; step++) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x,
          dy = points[j].y - points[i].y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const iconGap = sizes ? ((sizes.get(points[i].id)! + sizes.get(points[j].id)!) / 2 + 6) * 1.12 : 0;
        const separation = Math.max(gap, iconGap);
        if (distance >= separation) continue;
        const push = (separation - distance) / 2;
        const ux = distance === 0.001 ? 1 : dx / distance,
          uy = dy / distance;
        points[i].x -= ux * push;
        points[i].y -= uy * push;
        points[j].x += ux * push;
        points[j].y += uy * push;
      }
    }
    for (const point of points) {
      point.x = Math.max(-width * 0.45, Math.min(width * 0.45, point.x));
      point.y = Math.max(-height * 0.45, Math.min(height * 0.45, point.y));
    }
  }
  return points;
}

/** Log scaling keeps low counts visible without flattening heavily cited links. */
export function edgeWeightWidth(count: number, maximum: number) {
  const safeCount = Math.max(1, Number.isFinite(count) ? count : 1);
  const safeMax = Math.max(2, safeCount, Number.isFinite(maximum) ? maximum : 2);
  return 1 + (7 * Math.log(safeCount)) / Math.log(safeMax);
}

/** Nodes remain eligible based on all edges in the chosen relationship mode,
 * never on the thinned overview. Real isolated outlets are hidden. */
export function connectedMedia(nodes: SimilarityNode[], edges: SimilarityEdge[]) {
  const known = new Set(nodes.map((node) => node.id));
  const connected = new Set(
    edges.filter((edge) => known.has(edge.source) && known.has(edge.target)).flatMap((edge) => [edge.source, edge.target]),
  );
  return nodes.filter((node) => connected.has(node.id));
}
const edgeKey = (edge: SimilarityEdge) => `${edge.kind}:${edge.source}:${edge.target}`;

/** Union of each outlet's strongest two links. A hub may have more than two
 * visible links because other outlets also select it. No relationship is lost. */
export function mainGraphEdges(edges: SimilarityEdge[], perMedia = 2) {
  const ranked = [...edges].sort((a, b) => b.count - a.count || edgeKey(a).localeCompare(edgeKey(b)));
  const chosen = new Set<string>();
  const counts = new Map<string, number>();
  for (const edge of ranked) {
    for (const id of [edge.source, edge.target]) {
      const count = counts.get(id) ?? 0;
      if (count < perMedia) chosen.add(edgeKey(edge));
      counts.set(id, count + 1);
    }
  }
  return edges.filter((edge) => chosen.has(edgeKey(edge)));
}
export function displayedGraphEdges(edges: SimilarityEdge[], overview: SimilarityEdge[], all: boolean, focused: string | null) {
  if (all) return edges;
  const keys = new Set(overview.map(edgeKey));
  return edges.filter((edge) => keys.has(edgeKey(edge)) || edge.source === focused || edge.target === focused);
}

/** Deterministic weighted modularity communities. Direction is ignored only
 * for placement; citation arrows and evidence retain their original direction. */
export function mediaCommunities(nodes: SimilarityNode[], edges: SimilarityEdge[]) {
  const ids = nodes.map((node) => node.id).sort();
  const adjacency = new Map(ids.map((id) => [id, new Map<string, number>()]));
  for (const edge of [...edges].sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)))) {
    if (edge.source === edge.target || !adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    const weight = Math.log1p(Math.max(1, edge.count));
    for (const [a, b] of [
      [edge.source, edge.target],
      [edge.target, edge.source],
    ]) {
      adjacency.get(a)!.set(b, (adjacency.get(a)!.get(b) ?? 0) + weight);
    }
  }
  const degree = new Map(ids.map((id) => [id, [...adjacency.get(id)!.values()].reduce((a, b) => a + b, 0)]));
  const total = [...degree.values()].reduce((a, b) => a + b, 0) || 1;
  const labels = new Map(ids.map((id) => [id, id]));
  const volumes = new Map(degree);
  for (let pass = 0; pass < 30; pass++) {
    let changed = false;
    for (const id of ids) {
      const own = labels.get(id)!,
        d = degree.get(id)!;
      volumes.set(own, volumes.get(own)! - d);
      const weights = new Map<string, number>([[own, 0]]);
      for (const [neighbor, weight] of adjacency.get(id)!) {
        const label = labels.get(neighbor)!;
        weights.set(label, (weights.get(label) ?? 0) + weight);
      }
      let best = own,
        gain = (weights.get(own) ?? 0) - (d * (volumes.get(own) ?? 0)) / total;
      for (const [label, weight] of [...weights].sort(([a], [b]) => a.localeCompare(b))) {
        const candidate = weight - (d * (volumes.get(label) ?? 0)) / total;
        if (candidate > gain + 1e-9) {
          best = label;
          gain = candidate;
        }
      }
      labels.set(id, best);
      volumes.set(best, (volumes.get(best) ?? 0) + d);
      if (best !== own) changed = true;
    }
    if (!changed) break;
  }
  // Canonical membership labels, independent of the seed that won a move.
  const members = new Map<string, string[]>();
  for (const id of ids) {
    const label = labels.get(id)!;
    members.set(label, [...(members.get(label) ?? []), id]);
  }
  return new Map([...members.values()].flatMap((group) => group.map((id) => [id, group[0]] as const)));
}

/** Pack communities in separate regions, then settle a force layout inside
 * each region. Hover and line-density changes reuse these exact positions. */
export function mediaGraphPositions(nodes: SimilarityNode[], edges: SimilarityEdge[], width: number, height: number) {
  const visible = connectedMedia(nodes, edges);
  const labels = mediaCommunities(visible, edges);
  const sizes = mediaIconSizes(nodes, width);
  const groups = [...new Set(labels.values())]
    .map((id) => ({ id, nodes: visible.filter((node) => labels.get(node.id) === id).sort((a, b) => a.id.localeCompare(b.id)) }))
    .sort((a, b) => b.nodes.length - a.nodes.length || a.id.localeCompare(b.id));
  const points = new Map<string, { id: string; x: number; y: number }>();
  type Group = (typeof groups)[number];
  const weight = (group: Group) => group.nodes.length + 2;
  const place = (items: Group[], x: number, y: number, w: number, h: number) => {
    if (!items.length) return;
    if (items.length === 1) {
      const group = items[0];
      const ids = new Set(group.nodes.map((node) => node.id));
      const inset = width < 600 ? 12 : 22;
      const innerW = Math.max(1, w - inset * 2),
        innerH = Math.max(1, h - inset * 2);
      const local = forcePositions(
        group.nodes,
        edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
        innerW,
        innerH,
        sizes,
      );
      for (const point of local) points.set(point.id, { id: point.id, x: x + w / 2 + point.x, y: y + h / 2 + point.y });
      return;
    }
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let split = 1,
      first = weight(items[0]);
    while (split < items.length - 1 && Math.abs(first + weight(items[split]) - total / 2) < Math.abs(first - total / 2))
      first += weight(items[split++]);
    const ratio = first / total;
    if (w >= h) {
      place(items.slice(0, split), x, y, w * ratio, h);
      place(items.slice(split), x + w * ratio, y, w * (1 - ratio), h);
    } else {
      place(items.slice(0, split), x, y, w, h * ratio);
      place(items.slice(split), x, y + h * ratio, w, h * (1 - ratio));
    }
  };
  place(groups, 0, 0, width, height);
  return visible.map((node) => points.get(node.id)!);
}

/** Icon area encodes sampled article volume, with a legible minimum and a
 * bounded maximum. Citation-only sources have unknown volume, not zero output. */
export function mediaIconSizes(nodes: SimilarityNode[], width: number): Map<string, number> {
  const small = width < 600;
  const min = small ? 16 : 20,
    max = small ? 28 : 46;
  const count = (node: SimilarityNode) => (Number.isFinite(node.articles) ? Math.max(0, node.articles) : 0);
  const maximum = Math.max(1, ...nodes.filter((node) => !node.external).map(count));
  return new Map(
    nodes.map((node) => [
      node.id,
      node.external ? (small ? 18 : 24) : Math.sqrt(min * min + ((max * max - min * min) * count(node)) / maximum),
    ]),
  );
}

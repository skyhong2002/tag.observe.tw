import type { SimilarityEdge, SimilarityNode } from '../../../app/src/similarity/types.ts';

import type { OriginData } from './story-origins.mts';

export function nodeArticleCounts(data: Pick<OriginData, 'citations' | 'pairs' | 'origins'>) {
  const counts = new Map<
    string,
    { outgoing: Set<number>; incoming: Set<number>; similar: Set<number>; earliest: Set<number>; later: Set<number> }
  >();
  const get = (id: string) => {
    if (!counts.has(id))
      counts.set(id, { outgoing: new Set(), incoming: new Set(), similar: new Set(), earliest: new Set(), later: new Set() });
    return counts.get(id)!;
  };
  for (const { article, source } of data.citations) {
    get(article.media).outgoing.add(article.id);
    get(source.media).incoming.add(article.id);
  }
  if (data.origins)
    for (const { article, source } of data.origins) {
      get(article.media).similar.add(article.id);
      get(article.media).later.add(article.id);
      get(source.media).similar.add(source.id);
      get(source.media).earliest.add(source.id);
    }
  else
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
        // Origins only: which side of a similar story group this outlet published on.
        earliest: count.earliest.size,
        later: count.later.size,
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

/** Keep every connected outlet, regardless of viewport size or article count. */
export function selectGraphMedia(nodes: SimilarityNode[], edges: SimilarityEdge[]) {
  const eligible = connectedMedia(nodes, edges);
  const ids = new Set(eligible.map((node) => node.id));
  return { nodes: eligible, edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
}

export type MediaCamps = Record<string, 'blue' | 'green'>;
export function mediaLabelColor(camp: 'blue' | 'green' | undefined, dark: boolean) {
  if (camp === 'blue') return dark ? '#60a5fa' : '#1d4ed8';
  if (camp === 'green') return dark ? '#4ade80' : '#15803d';
  return dark ? '#d4d4d8' : '#52525b';
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

/** Seed by relationship community, then fit and separate in actual screen pixels.
 * Only viewport/data changes affect geometry; relationship tabs share this layout. */
export function mediaGraphPositions(
  nodes: SimilarityNode[],
  edges: SimilarityEdge[],
  width: number,
  height: number,
  includeIsolated = false,
) {
  const visible = includeIsolated ? nodes : connectedMedia(nodes, edges);
  if (!visible.length) return [];
  if (visible.length === 1) return [{ id: visible[0].id, x: width / 2, y: height / 2 }];
  const labels = mediaCommunities(visible, edges);
  // The same sizes are used by the renderer and the collision solver.
  const sizes = mediaIconSizes(visible, width);
  const groups = [...new Set(labels.values())]
    .map((id) => ({ id, nodes: visible.filter((node) => labels.get(node.id) === id).sort((a, b) => a.id.localeCompare(b.id)) }))
    .sort((a, b) => b.nodes.length - a.nodes.length || a.id.localeCompare(b.id));
  const placed: { x: number; y: number; radius: number }[] = [];
  const points = new Map<string, { id: string; x: number; y: number }>();
  for (const group of groups) {
    const ids = new Set(group.nodes.map((node) => node.id));
    const span = Math.sqrt(group.nodes.length) * 110;
    const local = forcePositions(
      group.nodes,
      edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).sort((a, b) => edgeKey(a).localeCompare(edgeKey(b))),
      span,
      span,
      sizes,
    );
    const cx = local.reduce((sum, p) => sum + p.x, 0) / local.length;
    const cy = local.reduce((sum, p) => sum + p.y, 0) / local.length;
    const radius = Math.max(...local.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 55;
    let x = 0,
      y = 0;
    for (let step = 0; placed.some((p) => Math.hypot(x - p.x, y - p.y) < radius + p.radius + 30); step++) {
      const angle = step * 2.399963229728653;
      const distance = 24 * Math.sqrt(step + 1);
      x = Math.cos(angle) * distance;
      y = Math.sin(angle) * distance;
    }
    placed.push({ x, y, radius });
    for (const p of local) points.set(p.id, { id: p.id, x: x + p.x - cx, y: y + p.y - cy });
  }
  const all = [...points.values()];
  // Orient the settled world horizontally; keep this independent of viewport size.
  const spreadX = Math.max(...all.map((p) => p.x)) - Math.min(...all.map((p) => p.x));
  const spreadY = Math.max(...all.map((p) => p.y)) - Math.min(...all.map((p) => p.y));
  if (spreadY > spreadX) for (const p of all) [p.x, p.y] = [p.y, -p.x];
  const minX = Math.min(...all.map((p) => p.x)),
    maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)),
    maxY = Math.max(...all.map((p) => p.y));
  const small = width < 600;
  const padding = 12;
  // Reserve label boxes when they fit. On dense small screens labels may hide,
  // but every logo still gets its complete square footprint plus a clear gap.
  const footprints = visible.map((node) => {
    const size = sizes.get(node.id)!;
    const font = small ? 9 : 11;
    const textWidth = Math.min(
      small ? 70 : 100,
      [...node.name].reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? font : font * 0.65), 0),
    );
    return { id: node.id, size, width: Math.max(size, textWidth) + 10, height: size + font + 17 };
  });
  const roomForLabels = footprints.reduce((sum, box) => sum + box.width * box.height, 0) < width * height * 0.65;
  const boxes = new Map(
    footprints.map((box) => [
      box.id,
      {
        width: roomForLabels ? box.width : box.size + 4,
        height: roomForLabels ? box.height : box.size + 4,
        offset: roomForLabels ? (box.height - box.size - 10) / 2 : 0,
      },
    ]),
  );
  const marginX = Math.max(...[...boxes.values()].map((box) => box.width / 2)) + padding;
  const marginY = Math.max(...[...boxes.values()].map((box) => box.height / 2)) + padding;
  const fitted = all
    .map((p) => ({
      id: p.id,
      x: marginX + ((p.x - minX) / Math.max(1, maxX - minX)) * Math.max(1, width - 2 * marginX),
      y: marginY + ((p.y - minY) / Math.max(1, maxY - minY)) * Math.max(1, height - 2 * marginY),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const clamp = (p: { id: string; x: number; y: number }) => {
    const box = boxes.get(p.id)!;
    p.x = Math.max(padding + box.width / 2, Math.min(width - padding - box.width / 2, p.x));
    p.y = Math.max(padding + box.height / 2, Math.min(height - padding - box.height / 2, p.y));
  };
  // Axis-aligned rectangles account for square logos and labels below them.
  // Do not shrink the result afterwards: that would reintroduce collisions.
  for (let pass = 0; pass < 600; pass++) {
    let overlap = 0;
    for (let i = 0; i < fitted.length; i++) {
      for (let j = i + 1; j < fitted.length; j++) {
        const a = fitted[i],
          b = fitted[j],
          ab = boxes.get(a.id)!,
          bb = boxes.get(b.id)!;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const ox = (ab.width + bb.width) / 2 - Math.abs(dx);
        const oy = (ab.height + bb.height) / 2 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        overlap = Math.max(overlap, Math.min(ox, oy));
        if (ox < oy) {
          const push = ((ox + 0.1) / 2) * (dx < 0 ? -1 : 1);
          a.x -= push;
          b.x += push;
        } else {
          const push = ((oy + 0.1) / 2) * (dy < 0 ? -1 : 1);
          a.y -= push;
          b.y += push;
        }
        clamp(a);
        clamp(b);
      }
    }
    if (overlap < 0.1) break;
  }
  // Dense hubs can trap the relaxation between neighbours and the viewport.
  // Place remaining collisions in the nearest free space, largest marks first.
  const packed: typeof fitted = [];
  for (const p of [...fitted].sort((a, b) => sizes.get(b.id)! - sizes.get(a.id)! || a.id.localeCompare(b.id))) {
    const box = boxes.get(p.id)!;
    const free = (x: number, y: number) =>
      packed.every((other) => {
        const ob = boxes.get(other.id)!;
        return Math.abs(x - other.x) >= (box.width + ob.width) / 2 - 0.1 || Math.abs(y - other.y) >= (box.height + ob.height) / 2 - 0.1;
      });
    if (!free(p.x, p.y)) {
      let best = Infinity,
        target = null;
      for (let y = padding + box.height / 2; y <= height - padding - box.height / 2; y += 3) {
        for (let x = padding + box.width / 2; x <= width - padding - box.width / 2; x += 3) {
          const distance = (x - p.x) ** 2 + (y - p.y) ** 2;
          if (distance < best && free(x, y)) {
            best = distance;
            target = { x, y };
          }
        }
      }
      if (target) Object.assign(p, target);
    }
    packed.push(p);
  }
  const result = new Map(fitted.map((p) => [p.id, { ...p, y: p.y - boxes.get(p.id)!.offset }]));
  return visible.map((node) => result.get(node.id)!);
}

/** Icon area encodes sampled article volume, with a legible minimum and a
 * bounded maximum. Citation-only sources have unknown volume, not zero output. */
export function mediaIconSizes(nodes: SimilarityNode[], width: number): Map<string, number> {
  const small = width < 600;
  const min = small ? 16 : 20,
    max = small ? 44 : 72;
  const count = (node: SimilarityNode) => (Number.isFinite(node.articles) ? Math.max(0, node.articles) : 0);
  const maximum = Math.max(1, ...nodes.filter((node) => !node.external).map(count));
  return new Map(
    nodes.map((node) => [
      node.id,
      node.external ? (small ? 18 : 24) : Math.sqrt(min * min + ((max * max - min * min) * count(node)) / maximum),
    ]),
  );
}

/** Labels must avoid logos too, not just other labels. Zoom reveals more names. */
export function mediaVisibleLabels(
  nodes: SimilarityNode[],
  positions: { id: string; x: number; y: number }[],
  sizes: Map<string, number>,
  width: number,
  zoom = 1,
) {
  const byId = new Map(positions.map((p) => [p.id, p]));
  const font = width < 600 ? 9 : 11;
  const logos = positions.map((p) => {
    const half = sizes.get(p.id)! / 2 + 2;
    return { left: p.x * zoom - half, right: p.x * zoom + half, top: p.y * zoom - half, bottom: p.y * zoom + half };
  });
  const placed: typeof logos = [];
  const visible = new Set<string>();
  const intersects = (a: (typeof logos)[number], b: (typeof logos)[number]) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const node of [...nodes].sort((a, b) => sizes.get(b.id)! - sizes.get(a.id)! || a.id.localeCompare(b.id))) {
    const p = byId.get(node.id)!;
    const labelWidth = Math.min(
      width < 600 ? 70 : 100,
      [...node.name].reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? font : font * 0.65), 0),
    );
    const top = p.y * zoom + sizes.get(node.id)! / 2 + 7;
    const label = { left: p.x * zoom - labelWidth / 2 - 2, right: p.x * zoom + labelWidth / 2 + 2, top, bottom: top + font + 2 };
    if (logos.some((logo) => intersects(label, logo)) || placed.some((other) => intersects(label, other))) continue;
    visible.add(node.id);
    placed.push(label);
  }
  return visible;
}

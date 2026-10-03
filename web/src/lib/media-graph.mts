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
export function forcePositions(nodes: SimilarityNode[], edges: SimilarityEdge[], width: number, height: number) {
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
        if (distance >= gap) continue;
        const push = (gap - distance) / 2;
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

/// <reference lib="dom" />

export const GRAPH_ZOOM_MIN = 0.2;
export const GRAPH_ZOOM_MAX = 20;
export const clampGraphZoom = (zoom: number) => Math.min(GRAPH_ZOOM_MAX, Math.max(GRAPH_ZOOM_MIN, zoom));

/** Wheel pixels stay proportional, including tiny trackpad movements. */
export function wheelZoomFactor(delta: number, mode: number, height: number, pinch = false) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? height : 1);
  return Math.exp(-Math.max(-240, Math.min(240, pixels)) * (pinch ? 0.01 : 0.002));
}

type Point = { x: number; y: number };
type Camera = {
  zoom: () => number;
  scale: (zoom: number, origin: Point) => void;
  pan: (dx: number, dy: number) => void;
  reset: () => void;
  moving: (moving: boolean) => void;
  settled: () => void;
};

/** Own camera gestures so touch zoom follows distance, not event frequency.
 * Nodes remain static; every operation changes only the view transform. */
export function bindGraphNavigation(element: HTMLElement, camera: Camera) {
  const pointers = new Map<number, Point>();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0,
    targetZoom = camera.zoom(),
    lastTime = 0;
  let anchor: Point = { x: 0, y: 0 };
  let start: Point | null = null,
    dragged = false,
    multiTouch = false;
  let vx = 0,
    vy = 0,
    lastMove = 0;
  const point = (event: { clientX: number; clientY: number }): Point => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    targetZoom = camera.zoom();
  };
  const settle = () => {
    frame = 0;
    camera.moving(false);
    camera.settled();
  };
  const animateZoom = (time: number) => {
    const dt = Math.min(50, time - lastTime || 16);
    lastTime = time;
    const current = camera.zoom();
    const remaining = Math.log(targetZoom / current);
    const done = Math.abs(remaining) < 0.001 || reducedMotion.matches;
    camera.scale(done ? targetZoom : current * Math.exp(remaining * (1 - Math.exp(-dt / 65))), anchor);
    if (done) settle();
    else frame = requestAnimationFrame(animateZoom);
  };
  const zoomTo = (zoom: number, origin: Point) => {
    targetZoom = clampGraphZoom(zoom);
    anchor = origin;
    camera.moving(true);
    if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(animateZoom);
    }
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // An incoming wheel cancels drag inertia but accumulates unfinished zoom.
    const target = targetZoom;
    stop();
    zoomTo(target * wheelZoomFactor(event.deltaY, event.deltaMode, element.clientHeight, event.ctrlKey), point(event));
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    stop();
    pointers.set(event.pointerId, point(event));
    if (pointers.size === 1) {
      start = point(event);
      dragged = false;
      multiTouch = false;
      vx = vy = 0;
      lastMove = performance.now();
    } else {
      multiTouch = dragged = true;
      camera.moving(true);
    }
  };
  const move = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    const before = [...pointers.values()];
    const previous = pointers.get(event.pointerId)!;
    const next = point(event);
    pointers.set(event.pointerId, next);
    if (!dragged && start && Math.hypot(next.x - start.x, next.y - start.y) < 4) return;
    dragged = true;
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
    camera.moving(true);
    if (pointers.size === 1) {
      const now = performance.now(),
        dt = Math.max(8, now - lastMove);
      const dx = next.x - previous.x,
        dy = next.y - previous.y;
      camera.pan(dx, dy);
      vx = Math.max(-2, Math.min(2, dx / dt));
      vy = Math.max(-2, Math.min(2, dy / dt));
      lastMove = now;
    } else if (pointers.size === 2) {
      const after = [...pointers.values()];
      const midpoint = (p: Point[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const distance = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const oldCenter = midpoint(before),
        newCenter = midpoint(after);
      if (distance(before) > 1) camera.scale(clampGraphZoom((camera.zoom() * distance(after)) / distance(before)), oldCenter);
      camera.pan(newCenter.x - oldCenter.x, newCenter.y - oldCenter.y);
    }
    targetZoom = camera.zoom();
  };
  const coast = (time: number) => {
    const dt = Math.min(32, time - lastTime);
    lastTime = time;
    const decay = Math.exp(-dt / 160);
    camera.pan(vx * 160 * (1 - decay), vy * 160 * (1 - decay));
    vx *= decay;
    vy *= decay;
    if (Math.hypot(vx, vy) < 0.015) settle();
    else frame = requestAnimationFrame(coast);
  };
  const up = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId) || pointers.size) return;
    start = null;
    if (
      event.type === 'pointerup' &&
      dragged &&
      !multiTouch &&
      !reducedMotion.matches &&
      performance.now() - lastMove < 80 &&
      Math.hypot(vx, vy) > 0.08
    ) {
      lastTime = performance.now();
      frame = requestAnimationFrame(coast);
    } else settle();
  };
  const lostCapture = (event: PointerEvent) => {
    // Touch starts with implicit capture on the canvas. Transferring capture
    // to this container must not end that same gesture.
    if (event.target === element) up(event);
  };
  const click = (event: MouseEvent) => {
    if (dragged) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const doubleClick = (event: MouseEvent) => {
    event.preventDefault();
    stop();
    zoomTo(camera.zoom() * (event.shiftKey ? 0.5 : 2), point(event));
  };
  const options = { capture: true, passive: false };
  element.addEventListener('wheel', wheel, options);
  element.addEventListener('pointerdown', down, options);
  element.addEventListener('pointermove', move, options);
  element.addEventListener('pointerup', up, options);
  element.addEventListener('pointercancel', up, options);
  element.addEventListener('lostpointercapture', lostCapture, options);
  element.addEventListener('click', click, true);
  element.addEventListener('dblclick', doubleClick, true);
  return {
    navigate(action: 'in' | 'out' | 'reset') {
      const target = targetZoom;
      stop();
      if (action === 'reset') {
        camera.reset();
        targetZoom = camera.zoom();
        settle();
      } else zoomTo(target * (action === 'in' ? 1.5 : 1 / 1.5), { x: element.clientWidth / 2, y: element.clientHeight / 2 });
    },
    dispose() {
      stop();
      element.removeEventListener('wheel', wheel, true);
      element.removeEventListener('pointerdown', down, true);
      element.removeEventListener('pointermove', move, true);
      element.removeEventListener('pointerup', up, true);
      element.removeEventListener('pointercancel', up, true);
      element.removeEventListener('lostpointercapture', lostCapture, true);
      element.removeEventListener('click', click, true);
      element.removeEventListener('dblclick', doubleClick, true);
    },
  };
}

/** A circle enclosing all four logo corners, plus a four-pixel clear gap. */
export function graphBoundaryDiameter(logoSize: number): number {
  return Math.SQRT2 * logoSize + 8;
}

/** Hide a connection when zoomed-out logos leave no room for its line/arrow. */
export function graphEdgeHasRoom(distance: number, zoom: number, sourceSize: number, targetSize: number, arrowSize: number): boolean {
  return distance * zoom > (graphBoundaryDiameter(sourceSize) + graphBoundaryDiameter(targetSize)) / 2 + arrowSize + 2;
}

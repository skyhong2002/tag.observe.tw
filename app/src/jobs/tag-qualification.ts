/** The two cross-outlet thresholds from the original tag suggestion system. */
export function qualifyTagMedia(media: Record<string, number>) {
  const counts = Object.values(media).filter((n) => Number.isFinite(n) && n > 0);
  const twice = counts.filter((n) => n >= 2).length;
  return {
    early: twice >= 2,
    broad: counts.length >= 3 && twice >= 2 && counts.some((n) => n >= 3),
  };
}

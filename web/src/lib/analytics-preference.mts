/** Account sync may strengthen privacy, but never silently undo a browser's
 * opt-out. Only the explicit restore button may clear the local choice. A
 * choice made while the account request is in flight beats that stale reply. */
export function reconcileAnalyticsPreference(local: boolean, saved: boolean | undefined, changedSinceRequest: boolean) {
  if (changedSinceRequest) return {};
  if (local) return saved === true ? {} : { upload: true };
  if (saved === true) return { apply: true };
  if (saved === undefined) return { upload: false };
  return {};
}

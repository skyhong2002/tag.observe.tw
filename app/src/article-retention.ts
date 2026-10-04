// Normal SSD cache lifetime since acquisition, restore, or last use.
// Disk pressure can shorten this to seven idle days, outside the public window.
// Eviction additionally requires verified NAS archival; failure keeps the cache.
export const BODY_RETENTION_MS = 90 * 86400e3;

// Readers only get the body for this long after publication. Storage keeps it
// normally for BODY_RETENTION_MS so similarity and journalist comparisons still work;
// every public response masks the body, its length and its status outside the
// window, so the API cannot tell a hidden body from a deleted one.
export const PUBLIC_BODY_WINDOW_MS = 7 * 86400e3;
/** When the body stops being shown to readers. */
export function publicBodyUntil(publishedAt: Date): Date {
  return new Date(publishedAt.getTime() + PUBLIC_BODY_WINDOW_MS);
}
/** True while readers may see the body of an article published at `publishedAt`. */
export function bodyIsPublic(publishedAt: Date, now = new Date()): boolean {
  return now.getTime() < publicBodyUntil(publishedAt).getTime();
}

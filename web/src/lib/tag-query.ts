/** The tag page's chart window in hours (6 to 336, default 72); its footer notes read the same value. */
export const tagHours = (sp: { hours?: string }) => Math.min(336, Math.max(6, Number(sp.hours) || 72));

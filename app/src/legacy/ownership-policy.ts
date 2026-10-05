// Reported by the running worker so the one-time importer can fail closed
// before importing recent historical rows into an older worker deployment.
export const LEGACY_OWNERSHIP_POLICY = 'own-indexed-v2';

/**
 * Foerderantraege-Seeds: Legacy-Cleanup-Helfer.
 *
 * Ab v2 (Flag `seed-complete-v2`) kommen die Seed-Antraege aus echten
 * anonymisierten CSVs unter `docs/fixtures/` (siehe `fixture-loader.ts`).
 * Die alten handgeschriebenen Snake-Case-Antraege existieren nicht mehr.
 *
 * Diese Datei haelt nur noch die Aktenzeichen-Liste der ehemaligen Pre-v2-
 * Seeds, damit `clearSeedData()` bei einem manuellen Storage-Reset auf einer
 * Pre-v2-IDB die alten Antraege saeubern kann. Nach einem Round von
 * Storage-Resets in allen Dev-Maschinen kann das Array geloescht werden.
 *
 * Beim Re-Seed auf einer IDB ohne Pre-v2-Daten ist der Cleanup ein No-Op.
 */

/** @deprecated Aktenzeichen der ehemaligen handgeschriebenen Pre-v2 Seed-Antraege. */
export const LEGACY_PRE_V2_AKTENZEICHEN: readonly string[] = [
  'FA-2026-001', 'FA-2026-002', 'FA-2026-003', 'FA-2026-004', 'FA-2026-005',
  'FA-2026-006', 'FA-2026-007', 'FA-2026-008', 'FA-2026-009', 'FA-2026-010',
  'FA-2026-011', 'FA-2026-012', 'FA-2026-013', 'FA-2026-014', 'FA-2026-015',
  'FA-2026-016', 'FA-2026-017', 'FA-2026-018', 'FA-2026-019', 'FA-2026-020',
];

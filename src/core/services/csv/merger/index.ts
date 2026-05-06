/**
 * Merger-Modul: Multi-CSV-Merge für Antrag/Verbund + Akronym-Index-Pflege.
 *
 * Public API. Sub-Module sind:
 * - helpers.ts  — pure Helper (coerceValue, resolveFieldKey, findJoinColumn)
 * - loader.ts   — Schema- und Row-Loading aus IDB
 * - single.ts   — Klassischer Single-Antrag-Pfad (Detail-Edit, kleine Updates)
 * - batched.ts  — Bulk-Pfad mit pre-indexierten Caches und Multi-Store-Tx
 *
 * Faustregel:
 * - >100 Antraege → recomputeMultipleBatched
 * - Einzelne Updates / Detail-View → recomputeAntrag / recomputeMultiple
 */

export type { SchemaWithRows } from './loader';
export { discoverAktenzeichen, loadAllSchemasWithRows } from './loader';
export {
  recomputeAntrag,
  recomputeMultiple,
  removeAntragAndCleanup,
} from './single';
export type { BatchedRecomputeArgs } from './batched';
export { recomputeMultipleBatched } from './batched';

/**
 * Aggregat-Cache-Schlüssel + Invalidierung. Liegt isoliert, damit die
 * Schreibschicht (Phase 2) den Cache invalidieren kann, ohne die Leseschicht
 * (Phase 3) zu importieren (kein Zyklus). Cache lebt im generischen IDB-`kv`-Store
 * (Pitfall #29 — KEIN eigener Object-Store, kein Versions-Bump).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';

/** IDB-`kv`-Key des aggregierten Lese-Ergebnisses. */
export const AGGREGATE_CACHE_KEY = 'skill-feedback:aggregate-cache';

/**
 * Verwirft den Aggregat-Cache (nach jedem Write + beim Sync). Der nächste
 * `readAggregate` rechnet frisch über alle Nutzer-Dateien. Best-effort — ein
 * fehlschlagendes Delete darf den aufrufenden Pfad nie kippen.
 */
export async function invalidateAggregateCache(idb: IDBStore): Promise<void> {
  try {
    await idb.delete(AGGREGATE_CACHE_KEY);
  } catch (err) {
    console.warn('[skill-feedback] cache invalidation failed:', err);
  }
}

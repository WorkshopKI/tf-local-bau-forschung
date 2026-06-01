/**
 * Gemeinsame IDB-Key-Builder fuer das Snapshot-Sync-Tracking.
 *
 * Bewusst aus snapshot-sync.ts herausgezogen, damit der Schreibpfad
 * (`writeProgrammSnapshot` in snapshot.ts) exakt dasselbe Key-Format nutzt wie
 * der Lese-/Sync-Pfad — kein dupliziertes String-Literal, kein Drift. Der
 * Import von `SnapshotStoreName` ist `import type` (zur Laufzeit geloescht),
 * daher kein Runtime-Zyklus snapshot.ts ↔ snapshot-keys.ts.
 */

import type { SnapshotStoreName } from './snapshot';

/** Lokal zuletzt gesyncte Snapshot-Version (ISO-String) je Programm. */
export const SYNC_VERSION_KEY = (programmId: string): string =>
  `snapshot-version-${programmId}`;

/** Lokal zuletzt gesyncter Hash je (Programm, Store). */
export const SYNC_STORE_HASH_KEY = (programmId: string, store: SnapshotStoreName): string =>
  `snapshot-store-hash-${programmId}-${store}`;

/** Day-Throttle-Marker (YYYY-MM-DD) des 1x/Tag-Sync je Programm. */
export const SYNC_LAST_CHECK_DAY_KEY = (programmId: string): string =>
  `snapshot-last-check-day-${programmId}`;

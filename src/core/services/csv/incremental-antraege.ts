/**
 * Inkrementeller Snapshot-Sync des (großen) ANTRAEGE-Stores.
 *
 * Hintergrund (Messung v2.95, ~14k Anträge, neuer Snapshot): der Voll-Reload
 * via `replaceStore` (clear + put aller Records) kostete **idbWrite 18 s +
 * listView 5 s**. Ein neuer Snapshot ändert aber typischerweise nur wenige
 * Records — der Rest ist identisch. Statt alles neu zu schreiben, vergleichen
 * wir die rohen JSONL-Zeilen des neuen Snapshots gegen die zuletzt gesehenen
 * Per-Record-Hashes (`murmurhash3` je Zeile) und schreiben **nur geänderte**
 * Records + löschen entfernte.
 *
 * Korrektheits-Invariante: Der Diff schreibt IMMER jede Zeile, deren Hash vom
 * gespeicherten abweicht — also nie zu wenig. Wird der Store außerhalb (Merger
 * beim CSV-Import) verändert, ist die Hash-Map veraltet → der nächste Diff
 * re-schreibt die betroffenen Records (idempotent, selbstheilend), überspringt
 * aber nie eine nötige Schreibung. Fehlt die Map (Cold-Start, „clear site
 * data", Varianten-DB frisch) → Aufrufer fällt auf Voll-`replaceStore` zurück.
 *
 * Speicher: parst die Zeilen, behält aber nur GEÄNDERTE Objekte (unveränderte
 * werden nach dem Hash-Vergleich verworfen → Peak deutlich unter dem
 * Voll-Parse aller 14k Records, vgl. OOM-Klasse v2.61.5).
 */

import type { IDBStore } from '../storage/idb-store';
import type { Antrag } from './types';
import { murmurhash3 } from './hash';
import { toAntragListItem } from './list-view';
import type { FbStatusFeld } from './fb-status-felder';
import {
  putAntraege,
  deleteAntraegeByKeys,
  putAntraegeListView,
  deleteAntraegeListViewByKeys,
} from './idb-csv';

/** Lokal gespeicherte Per-Record-Hashes (aktenzeichen → Zeilen-Hash) je Programm.
 *  Basis des inkrementellen Diffs; bewusst getrennt vom Per-STORE-Hash
 *  (`SYNC_STORE_HASH_KEY`, der nur „Store gesamt unverändert?" beantwortet). */
export const SNAPSHOT_RECORD_HASHES_KEY = (programmId: string): string =>
  `snapshot-record-hashes-${programmId}`;

export interface AntraegeDiff {
  /** Geänderte/neue Records (geparst) — zum Schreiben + List-View-Projektion. */
  changed: Antrag[];
  /** aktenzeichen, die im neuen Snapshot fehlen (zu löschen). */
  removedKeys: string[];
  /** Vollständige neue Hash-Map (aktenzeichen → Zeilen-Hash) zum Persistieren. */
  newHashes: Record<string, string>;
  /** Anzahl unveränderter Zeilen (Logging). */
  unchanged: number;
}

/**
 * Pure Diff: vergleicht die rohen JSONL-Zeilen gegen die gespeicherten Hashes.
 * Parst jede Zeile (für den aktenzeichen-Key), behält aber nur geänderte
 * Objekte. `storedHashes` leer → alle Zeilen gelten als „changed".
 */
export function diffAntraegeLines(
  lines: string[],
  storedHashes: Record<string, string>,
): AntraegeDiff {
  const newHashes: Record<string, string> = {};
  const changed: Antrag[] = [];
  const seen = new Set<string>();
  let unchanged = 0;

  for (const line of lines) {
    const h = murmurhash3(line);
    const obj = JSON.parse(line) as Antrag;
    const key = typeof obj.aktenzeichen === 'string' ? obj.aktenzeichen : '';
    if (!key) continue; // ohne Key nicht indexierbar (keyPath aktenzeichen)
    newHashes[key] = h;
    seen.add(key);
    if (storedHashes[key] !== h) {
      changed.push(obj);
    } else {
      unchanged++;
    }
  }

  const removedKeys: string[] = [];
  for (const key of Object.keys(storedHashes)) {
    if (!seen.has(key)) removedKeys.push(key);
  }

  return { changed, removedKeys, newHashes, unchanged };
}

/** Wendet den Diff auf den ANTRAEGE-Store an: geänderte put, entfernte delete. */
export async function applyAntraegeDiff(idb: IDBStore, diff: AntraegeDiff): Promise<void> {
  if (diff.changed.length > 0) await putAntraege(idb, diff.changed);
  if (diff.removedKeys.length > 0) await deleteAntraegeByKeys(idb, diff.removedKeys);
}

/** Inkrementelle Pflege der Slim-Projektion: geänderte projizieren + put,
 *  entfernte aus der List-View löschen. Nur aufrufen, wenn die Projektion
 *  bereits auf aktueller Schema-Version liegt (sonst Voll-Rebuild).
 *  `fbFelder` (pro Programm aufgelöst) speist den FB-Status in die Projektion —
 *  ohne den Param verlören geänderte Records ihr FB-Status-Badge bis zum
 *  nächsten Voll-Rebuild. */
export async function applyListViewDiff(
  idb: IDBStore,
  diff: AntraegeDiff,
  fbFelder?: readonly FbStatusFeld[],
): Promise<void> {
  if (diff.changed.length > 0) {
    await putAntraegeListView(idb, diff.changed.map(a => toAntragListItem(a, fbFelder)));
  }
  if (diff.removedKeys.length > 0) {
    await deleteAntraegeListViewByKeys(idb, diff.removedKeys);
  }
}

/** Baut die volle Hash-Map aus den Zeilen (für den Voll-Replace-Pfad: danach
 *  ist die Map konsistent mit dem komplett ersetzten Store). */
export function buildAntraegeHashes(lines: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of lines) {
    const obj = JSON.parse(line) as Antrag;
    const key = typeof obj.aktenzeichen === 'string' ? obj.aktenzeichen : '';
    if (key) map[key] = murmurhash3(line);
  }
  return map;
}

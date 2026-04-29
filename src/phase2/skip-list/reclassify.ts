/**
 * Versions-basiertes Reset der Skip-Liste.
 *
 * Wenn der Klassifikator verbessert wurde und alte Entscheidungen revidiert
 * werden sollen, wird `classifier_version` global hochgezählt und alle
 * Einträge unter diesem Threshold gelöscht — beim nächsten Scan werden die
 * Dateien neu klassifiziert.
 */

import type { IDBStore } from '../../core/services/storage/idb-store';
import { listAllSkipEntries, deleteSkipEntry } from './store';

/**
 * Löscht alle Skip-Einträge mit `classifier_version < threshold`.
 * Gibt die Anzahl der gelöschten Einträge zurück.
 */
export async function resetSkipListByVersion(idb: IDBStore, threshold: number): Promise<number> {
  const all = await listAllSkipEntries(idb);
  const stale = all.filter(e => e.classifier_version < threshold);
  for (const e of stale) {
    await deleteSkipEntry(idb, e.filename);
  }
  return stale.length;
}

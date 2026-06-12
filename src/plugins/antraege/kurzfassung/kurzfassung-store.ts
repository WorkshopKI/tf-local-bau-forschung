/**
 * Persistenz der Kurzfassung-Ergebnisse. Pro Antrag ein Record im generischen
 * `kv`-Store unter dem Präfix-Key `gutachten-kurzfassung:<aktenzeichen>` — analog
 * zum Dokumente-Store (`doc:*`). Bewusst KEIN dedizierter Object-Store/Version-
 * Bump: der Record ist ein einzelnes Objekt mit Exact-Key-Lookup (kein Range-
 * Query/Index nötig), und ein Version-Bump triggert unter `file://` mit parallel
 * offenen Varianten ein `onblocked`-Upgrade (siehe recurring-bug-classes.md §3).
 *
 * Schreib-Disziplin: nur nach abgeschlossenem Statuswechsel persistieren, NIE
 * während der Generierung (Pitfall #16/#20-Geist).
 */
import type { IDBStore } from '@/core/services/storage';
import { kurzfassungPath } from '@/core/services/personal-storage/personal-layout';
import {
  mirrorJsonToPersonal, hydrateJsonFromPersonal, removePersonalMirror,
} from '@/core/services/personal-storage/state-mirror';
import type { KurzfassungRecord } from './types';

const keyFor = (key: string): string => `gutachten-kurzfassung:${key}`;

// IDB ist Primary; JSON-Spiegel im persönlichen Ordner macht den Stand browser-
// wechsel-fest (Mirror beim Put, Hydrate bei IDB-Miss). Best-effort.
export async function getKurzfassung(idb: IDBStore, key: string): Promise<KurzfassungRecord | null> {
  const fromIdb = await idb.get<KurzfassungRecord>(keyFor(key));
  if (fromIdb) return fromIdb;
  const fromDisk = await hydrateJsonFromPersonal<KurzfassungRecord>(idb, kurzfassungPath(key));
  if (fromDisk) {
    await idb.set(keyFor(key), fromDisk);
    return fromDisk;
  }
  return null;
}

export async function putKurzfassung(idb: IDBStore, record: KurzfassungRecord): Promise<void> {
  await idb.set(keyFor(record.key), record);
  await mirrorJsonToPersonal(idb, kurzfassungPath(record.key), record);
}

export async function deleteKurzfassung(idb: IDBStore, key: string): Promise<void> {
  await idb.delete(keyFor(key));
  await removePersonalMirror(idb, kurzfassungPath(key));
}

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
import type { KurzfassungRecord } from './types';

const keyFor = (aktenzeichen: string): string => `gutachten-kurzfassung:${aktenzeichen}`;

export async function getKurzfassung(idb: IDBStore, aktenzeichen: string): Promise<KurzfassungRecord | null> {
  return idb.get<KurzfassungRecord>(keyFor(aktenzeichen));
}

export async function putKurzfassung(idb: IDBStore, record: KurzfassungRecord): Promise<void> {
  await idb.set(keyFor(record.aktenzeichen), record);
}

export async function deleteKurzfassung(idb: IDBStore, aktenzeichen: string): Promise<void> {
  await idb.delete(keyFor(aktenzeichen));
}

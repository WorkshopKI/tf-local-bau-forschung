/**
 * Persistenz der Gutachten-Korpus-Auswahl: ein Record je Verbund im generischen
 * `kv`-Store unter `gutachten-korpus:<key>`. Exakt das Profil des Workflow-/
 * Kurzfassung-Stores — Exact-Key-Lookup, KEIN dedizierter Object-Store und kein
 * Version-Bump (ein Bump triggert unter file:// mit parallel offenen Varianten ein
 * `onblocked`-Upgrade, siehe recurring-bug-classes.md §3 / Pitfall #29).
 *
 * IDB ist Primary; der JSON-Spiegel im persönlichen Ordner macht die Auswahl
 * browser-wechsel-fest. Das ist kein Komfort: die Auswahl ist die Tatsache „welchen
 * Text hat die KI für dieses Gutachten gesehen" und gehört damit zur Nachvollzieh-
 * barkeit des Laufs.
 */
import type { IDBStore } from '@/core/services/storage';
import { korpusAuswahlPath } from '@/core/services/personal-storage/personal-layout';
import {
  mirrorJsonToPersonal, hydrateJsonFromPersonal, removePersonalMirror,
} from '@/core/services/personal-storage/state-mirror';
import { leererKorpusRecord, type KorpusAuswahlRecord } from './korpusAuswahl';

export const korpusAuswahlKey = (key: string): string => `gutachten-korpus:${key}`;

/** Nie null: ohne gespeicherte Auswahl gilt der leere Record (Korpus === VB). */
export async function getKorpusAuswahl(idb: IDBStore, key: string): Promise<KorpusAuswahlRecord> {
  const fromIdb = await idb.get<KorpusAuswahlRecord>(korpusAuswahlKey(key));
  if (fromIdb) return normalisiere(fromIdb, key);
  const fromDisk = await hydrateJsonFromPersonal<KorpusAuswahlRecord>(idb, korpusAuswahlPath(key));
  if (fromDisk) {
    const record = normalisiere(fromDisk, key);
    await idb.set(korpusAuswahlKey(key), record); // IDB seeden → nur 1× Disk-Read
    return record;
  }
  return leererKorpusRecord(key);
}

export async function putKorpusAuswahl(idb: IDBStore, record: KorpusAuswahlRecord): Promise<void> {
  const zuSchreiben: KorpusAuswahlRecord = { ...record, geaendert_am: new Date().toISOString() };
  await idb.set(korpusAuswahlKey(record.key), zuSchreiben);
  await mirrorJsonToPersonal(idb, korpusAuswahlPath(record.key), zuSchreiben);
}

export async function deleteKorpusAuswahl(idb: IDBStore, key: string): Promise<void> {
  await idb.delete(korpusAuswahlKey(key));
  await removePersonalMirror(idb, korpusAuswahlPath(key));
}

/** Defensiv gegen alte/teilweise Records: `aufgenommen` muss ein Array sein. */
function normalisiere(record: KorpusAuswahlRecord, key: string): KorpusAuswahlRecord {
  return {
    ...record,
    key: record.key || key,
    aufgenommen: Array.isArray(record.aufgenommen) ? record.aufgenommen : [],
  };
}

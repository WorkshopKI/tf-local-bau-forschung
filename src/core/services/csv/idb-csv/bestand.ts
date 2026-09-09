/** Programm-weite Sammel-Reads und Bestands-Wartung (zaehlen, leeren). */
import { IDBStore, CSV_STORES, type CsvStoreName } from '../../storage/idb-store';
import { LIST_VIEW_VERSION_KEY } from '../constants';
import { SNAPSHOT_SYNC_KEY_PREFIX } from '../snapshot-keys';
import type { CsvRowHash, AntragHistorieEntry, Verbund, VerbundHistorieEntry, AkronymIndexEntry } from '../types';
import { tx, req, waitTx } from './intern';
import { getRowHashesForSchema } from './row-hash';
import { listAntraegeByProgramm } from './antrag';

export async function listVerbuendeByProgramm(idb: IDBStore, programmId: string): Promise<Verbund[]> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readonly');
  const idx = t.objectStore(CSV_STORES.VERBUENDE).index('programm_id');
  return (await req(idx.getAll(programmId))) as Verbund[];
}

/** Alias for listVerbuendeByProgramm — matches snapshot import naming. */
export async function listVerbundsByProgramm(idb: IDBStore, programmId: string): Promise<Verbund[]> {
  return listVerbuendeByProgramm(idb, programmId);
}

// TODO: Wenn antrag_historie ueber 50k+ Eintraege waechst, einen
// programm_id-Index in der IDB-Schema-Migration ergaenzen. Aktuell laeuft
// listAntragHistorieByProgramm via getAll() + in-memory-filter (O(N)).
/**
 * Alle AntragHistorie-Eintraege fuer ein Programm.
 * ANTRAG_HISTORIE hat keinen programm_id-Index — getAll + In-Memory-Filter
 * nach bekannten Aktenzeichen. Akzeptabler Overhead fuer Snapshot-Write
 * (einmalig pro Re-Import).
 */
export async function listAntragHistorieByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<AntragHistorieEntry[]> {
  const antraege = await listAntraegeByProgramm(idb, programmId);
  const azSet = new Set(antraege.map(a => a.aktenzeichen));
  const t = tx(idb, CSV_STORES.ANTRAG_HISTORIE, 'readonly');
  const all = (await req(t.objectStore(CSV_STORES.ANTRAG_HISTORIE).getAll())) as AntragHistorieEntry[];
  return all.filter(e => azSet.has(e.aktenzeichen));
}

/**
 * Alle VerbundHistorie-Eintraege fuer ein Programm.
 * VERBUND_HISTORIE hat keinen programm_id-Index — getAll + In-Memory-Filter
 * nach Verbund-IDs des Programms.
 */
export async function listVerbundHistorieByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<VerbundHistorieEntry[]> {
  const verbuende = await listVerbuendeByProgramm(idb, programmId);
  const verbundIdSet = new Set(verbuende.map(v => v.verbund_id));
  const t = tx(idb, CSV_STORES.VERBUND_HISTORIE, 'readonly');
  const all = (await req(t.objectStore(CSV_STORES.VERBUND_HISTORIE).getAll())) as VerbundHistorieEntry[];
  return all.filter(e => verbundIdSet.has(e.verbund_id));
}

/**
 * Alle AkronymIndex-Eintraege fuer ein Programm.
 * AKRONYM_INDEX hat keinen separaten programm_id-Index (Composite-Key
 * [programm_id, akronym]) — getAll + In-Memory-Filter.
 */
export async function listAkronymIndexByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<AkronymIndexEntry[]> {
  const t = tx(idb, CSV_STORES.AKRONYM_INDEX, 'readonly');
  const all = (await req(t.objectStore(CSV_STORES.AKRONYM_INDEX).getAll())) as AkronymIndexEntry[];
  return all.filter(e => e.programm_id === programmId);
}

/**
 * Alle CsvRowHash-Eintraege fuer eine Liste von Schema-IDs.
 * Ruft getRowHashesForSchema pro Schema auf und konkateniert die Ergebnisse.
 */
export async function listRowHashesBySchemas(
  idb: IDBStore,
  schemaIds: string[],
): Promise<CsvRowHash[]> {
  const results: CsvRowHash[] = [];
  for (const schemaId of schemaIds) {
    const hashes = await getRowHashesForSchema(idb, schemaId);
    results.push(...hashes);
  }
  return results;
}

// ---------- Wartung ----------

export interface ClearAntragDataResult {
  antraege: number;
  verbuende: number;
  historie: number;
  rowHashes: number;
  /** Records der Slim-Projektion — das, was Tabelle/Startseite/Suche wirklich lesen. */
  listView: number;
}

async function countStore(idb: IDBStore, store: CsvStoreName): Promise<number> {
  const t = tx(idb, store, 'readonly');
  return req(t.objectStore(store).count());
}

async function clearStoreFully(idb: IDBStore, store: CsvStoreName): Promise<void> {
  const t = tx(idb, store, 'readwrite');
  t.objectStore(store).clear();
  return waitTx(t);
}

/**
 * Loescht alle importierten Antrags-Daten + Historie + Akronym-Index +
 * Row-Hashes. Behaelt PROGRAMME, UNTERPROGRAMME, CSV_SCHEMAS — der Kurator
 * kann unmittelbar danach via "Re-Import" der bestehenden Schemas neu
 * laden, ohne den Wizard erneut zu durchlaufen.
 *
 * Use-Case: Encoding-Mojibake im IDB. User bereinigt die Quell-CSV extern
 * und re-importiert.
 */
export async function clearAntragData(idb: IDBStore): Promise<ClearAntragDataResult> {
  const result: ClearAntragDataResult = {
    antraege: await countStore(idb, CSV_STORES.ANTRAEGE),
    verbuende: await countStore(idb, CSV_STORES.VERBUENDE),
    historie:
      (await countStore(idb, CSV_STORES.ANTRAG_HISTORIE)) +
      (await countStore(idb, CSV_STORES.VERBUND_HISTORIE)),
    rowHashes: await countStore(idb, CSV_STORES.CSV_ROW_HASHES),
    listView: await countStore(idb, CSV_STORES.ANTRAEGE_LIST_VIEW),
  };
  await clearStoreFully(idb, CSV_STORES.ANTRAEGE);
  await clearStoreFully(idb, CSV_STORES.VERBUENDE);
  await clearStoreFully(idb, CSV_STORES.ANTRAG_HISTORIE);
  await clearStoreFully(idb, CSV_STORES.VERBUND_HISTORIE);
  await clearStoreFully(idb, CSV_STORES.AKRONYM_INDEX);
  await clearStoreFully(idb, CSV_STORES.CSV_ROW_HASHES);
  // Die Slim-Projektion ist die EINZIGE Lesequelle von Tabelle, Startseite und
  // Suche. Bliebe sie stehen, zeigte die App nach dem Reset den alten Bestand
  // weiter — mit der Meldung, er sei gelöscht.
  await clearStoreFully(idb, CSV_STORES.ANTRAEGE_LIST_VIEW);
  await idb.delete(LIST_VIEW_VERSION_KEY);

  // Sync-Marken mit: sie sagen „diese Snapshot-Version ist integriert". Nach dem
  // Leeren stimmt das nicht mehr, und der nächste Sync übersprünge den Nachschub
  // als erledigt. Über das Präfix, damit keine neue Marke vergessen wird.
  for (const key of await idb.keys(SNAPSHOT_SYNC_KEY_PREFIX)) {
    await idb.delete(key);
  }
  return result;
}

export async function countAntragData(idb: IDBStore): Promise<ClearAntragDataResult> {
  return {
    antraege: await countStore(idb, CSV_STORES.ANTRAEGE),
    verbuende: await countStore(idb, CSV_STORES.VERBUENDE),
    historie:
      (await countStore(idb, CSV_STORES.ANTRAG_HISTORIE)) +
      (await countStore(idb, CSV_STORES.VERBUND_HISTORIE)),
    rowHashes: await countStore(idb, CSV_STORES.CSV_ROW_HASHES),
    listView: await countStore(idb, CSV_STORES.ANTRAEGE_LIST_VIEW),
  };
}

/** ANTRAEGE_LIST_VIEW: die schlanke Projektion fuer Listen. Getrennte Ablage vom Voll-Store (Pitfall #32); wer den Voll-Store schreibt, zieht sie mit. */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import { MAX_WRITES_PER_TX } from '../constants';
import type { AntragListItem } from '../types';
import { tx, req, waitTx } from './intern';

// ---------- Antraege List-View (Phase 2 / Slim-Projektion) ----------

export async function putAntraegeListView(
  idb: IDBStore,
  items: AntragListItem[],
): Promise<void> {
  for (let i = 0; i < items.length; i += MAX_WRITES_PER_TX) {
    const chunk = items.slice(i, i + MAX_WRITES_PER_TX);
    const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readwrite');
    const s = t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW);
    for (const it of chunk) s.put(it);
    await waitTx(t);
  }
}

/** Leert die gesamte Slim-Projektion. Für den vollständigen Neuaufbau nach
 *  einem Snapshot-Sync (der den ANTRAEGE-Store via replaceStore komplett
 *  ersetzt, die List-View aber nicht berührt). */
export async function clearAntraegeListView(idb: IDBStore): Promise<void> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readwrite');
  t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).clear();
  return waitTx(t);
}

export async function listAntraegeListViewByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<AntragListItem[]> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).index('programm_id');
  return (await req(idx.getAll(programmId))) as AntragListItem[];
}

/** Programm-uebergreifender Voll-Scan des `ANTRAEGE_LIST_VIEW`-Stores.
 *  Wird fuer Cross-Programm-Lookups gebraucht — z.B. Netzwerk-Lead-Namen,
 *  deren Lead-Antrag in einem anderen Programm liegt als die TVs im
 *  aktiven Programm. Pro Datensatz ~14 schmale Felder, IDB-getAll() liefert
 *  auch bei 50k+ Records in < 1 s. */
export async function listAllAntraegeListView(idb: IDBStore): Promise<AntragListItem[]> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readonly');
  return (await req(t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).getAll())) as AntragListItem[];
}

export async function deleteAntraegeListViewByAktenzeichen(
  idb: IDBStore,
  az: string,
): Promise<void> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readwrite');
  t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).delete(az);
  return waitTx(t);
}

/** Löscht List-View-Einträge per aktenzeichen-Key (chunked) — Pendant zu
 *  deleteAntraegeByKeys für die inkrementelle Slim-Projektion. */
export async function deleteAntraegeListViewByKeys(idb: IDBStore, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += MAX_WRITES_PER_TX) {
    const chunk = keys.slice(i, i + MAX_WRITES_PER_TX);
    const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readwrite');
    const s = t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW);
    for (const k of chunk) s.delete(k);
    await waitTx(t);
  }
}

export async function countAntraegeListViewByProgramm(
  idb: IDBStore,
  programmId: string,
): Promise<number> {
  const t = tx(idb, CSV_STORES.ANTRAEGE_LIST_VIEW, 'readonly');
  const idx = t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW).index('programm_id');
  return req(idx.count(programmId));
}

/**
 * Dieselbe Zählung, aufgeschlüsselt nach Unterprogramm — die Grundmenge einer
 * Richtlinien-Auswahl.
 *
 * Bewusst aus demselben Store wie {@link countAntraegeListViewByProgramm}:
 * eine zweite Quelle (etwa der Wortlaut-Korpus, der textleere Anträge
 * auslässt) ergäbe im Grundzustand eine ANDERE Gesamtzahl als die Zeile
 * daneben — die Zahl spränge beim Umschalten, ohne dass sich etwas geändert
 * hätte. Anträge ohne Nummer zählen unter `''`; sie bleiben in jeder Auswahl
 * sichtbar (siehe `wendeRichtlinienAn`).
 *
 * Es gibt keinen Index auf `unterprogramm_id` — ein Voll-Lauf über die schmale
 * Projektion des Programms ist billiger als eine IDB-Version mehr, und er
 * läuft nur, wenn jemand die Auswahl überhaupt einschränkt.
 */
export async function countAntraegeListViewByUnterprogramm(
  idb: IDBStore,
  programmId: string,
): Promise<Map<string, number>> {
  const items = await listAntraegeListViewByProgramm(idb, programmId);
  const je = new Map<string, number>();
  for (const a of items) {
    const code = typeof a.unterprogramm_id === 'string' ? a.unterprogramm_id.trim() : '';
    je.set(code, (je.get(code) ?? 0) + 1);
  }
  return je;
}

/** Programme — Stammdaten der Foerderprogramme. */
import { IDBStore, CSV_STORES } from '../../storage/idb-store';
import type { Programm } from '../types';
import { tx, req, waitTx } from './intern';

// ---------- Programme ----------

export async function putProgramm(idb: IDBStore, p: Programm): Promise<void> {
  const t = tx(idb, CSV_STORES.PROGRAMME, 'readwrite');
  t.objectStore(CSV_STORES.PROGRAMME).put(p);
  return waitTx(t);
}

export async function getProgramm(idb: IDBStore, id: string): Promise<Programm | null> {
  const t = tx(idb, CSV_STORES.PROGRAMME, 'readonly');
  return (await req(t.objectStore(CSV_STORES.PROGRAMME).get(id))) ?? null;
}

export async function listProgramme(idb: IDBStore): Promise<Programm[]> {
  const t = tx(idb, CSV_STORES.PROGRAMME, 'readonly');
  return (await req(t.objectStore(CSV_STORES.PROGRAMME).getAll())) as Programm[];
}

/**
 * Roh-Delete eines Programm-Records. Macht KEINE Cascade — Aufrufer
 * (`programmRegistry.deleteProgramm`) ist verantwortlich für die Sicherheits-
 * Checks (0 Anträge, nicht das einzige Programm).
 */
export async function deleteProgrammRecord(idb: IDBStore, id: string): Promise<void> {
  const t = tx(idb, CSV_STORES.PROGRAMME, 'readwrite');
  t.objectStore(CSV_STORES.PROGRAMME).delete(id);
  return waitTx(t);
}

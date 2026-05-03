import type { IDBStore } from '../storage/idb-store';
import { DEFAULT_PROGRAMM_ID, DEFAULT_PROGRAMM_NAME, DEFAULT_SMB_HANDLE_KEY } from './constants';
import {
  deleteProgrammRecord,
  getProgramm,
  listAntraegeByProgramm,
  listProgramme,
  putProgramm,
} from './idb-csv';
import type { Programm } from './types';

export async function ensureDefaultProgramm(idb: IDBStore): Promise<Programm> {
  const existing = await getProgramm(idb, DEFAULT_PROGRAMM_ID);
  if (existing) return existing;
  const programm: Programm = {
    id: DEFAULT_PROGRAMM_ID,
    name: DEFAULT_PROGRAMM_NAME,
    created_at: new Date().toISOString(),
    smb_handle_key: DEFAULT_SMB_HANDLE_KEY,
  };
  await putProgramm(idb, programm);
  return programm;
}

/**
 * @deprecated Vor Multi-Programm-Switch — liefert das erste Programm aus der
 * Liste. Lieber `useActiveProgramm()` verwenden, das auch Profile-Persistenz
 * berücksichtigt. Wird noch von Bootstrap-Pfaden genutzt.
 */
export async function getActiveProgramm(idb: IDBStore): Promise<Programm | null> {
  const all = await listProgramme(idb);
  return all[0] ?? null;
}

export async function renameProgramm(idb: IDBStore, id: string, name: string): Promise<void> {
  const p = await getProgramm(idb, id);
  if (!p) return;
  p.name = name.trim();
  await putProgramm(idb, p);
}

/**
 * Legt ein neues Programm an. ID = `crypto.randomUUID()` (im Browser unter
 * `file://` verfügbar — secure context). Name wird getrimmt; doppelte Namen
 * sind erlaubt (User kann später umbenennen). Wirft, wenn Name leer.
 */
export async function createProgramm(idb: IDBStore, name: string): Promise<Programm> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Programm-Name darf nicht leer sein.');
  const programm: Programm = {
    id: crypto.randomUUID(),
    name: trimmed,
    created_at: new Date().toISOString(),
    smb_handle_key: DEFAULT_SMB_HANDLE_KEY,
  };
  await putProgramm(idb, programm);
  return programm;
}

export type DeleteProgrammResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'has_antraege'; antragCount?: number }
  | { ok: false; reason: 'last_programm' };

/**
 * Löscht ein Programm — nur erlaubt wenn:
 *  - das Programm existiert,
 *  - 0 Anträge dranhängen,
 *  - es nicht das einzige verbleibende Programm ist (sonst hätte der User
 *    keinen Active-Programm-Anker mehr; Bootstrap würde zwar `default-
 *    programm` neu anlegen, aber UX-mäßig unschön).
 *
 * Macht KEIN Cascade-Delete von csv_schemas, filter_definitionen, csv_row_hashes
 * o.ä. Da im 0-Anträge-Fall diese Records bedeutungslos verbleiben (sie sind
 * an die Programm-ID gekeyt; ohne Programm sind sie inert), ist das im
 * Worst-Case ein paar KB IDB-Müll. Cascade-Cleanup ist eigener Patch falls
 * gewünscht.
 */
export async function deleteProgramm(idb: IDBStore, id: string): Promise<DeleteProgrammResult> {
  const all = await listProgramme(idb);
  const target = all.find(p => p.id === id);
  if (!target) return { ok: false, reason: 'not_found' };
  if (all.length <= 1) return { ok: false, reason: 'last_programm' };

  const antraege = await listAntraegeByProgramm(idb, id);
  if (antraege.length > 0) {
    return { ok: false, reason: 'has_antraege', antragCount: antraege.length };
  }
  await deleteProgrammRecord(idb, id);
  return { ok: true };
}

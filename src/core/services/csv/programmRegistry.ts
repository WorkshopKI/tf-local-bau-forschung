import type { IDBStore } from '../storage/idb-store';
import {
  DEFAULT_PROGRAMM_ID,
  DEFAULT_PROGRAMM_NAME,
  DEFAULT_SMB_HANDLE_KEY,
  LEGACY_DEFAULT_PROGRAMM_NAME,
} from './constants';
import {
  deleteProgrammRecord,
  deleteRowHashes,
  deleteSchema,
  deleteUnterprogramm,
  deleteVerbund,
  getProgramm,
  getRowHashesForSchema,
  listAntraegeByProgramm,
  listProgramme,
  listSchemasByProgramm,
  listUnterprogrammeByProgramm,
  listVerbuendeByProgramm,
  putProgramm,
} from './idb-csv';
import { listFilters, removeFilter } from './filter/filterRegistry';
import type { Programm } from './types';

export async function ensureDefaultProgramm(idb: IDBStore): Promise<Programm> {
  const existing = await getProgramm(idb, DEFAULT_PROGRAMM_ID);
  if (existing) {
    // Self-Heal: Pre-„ZIM"-Installationen tragen noch den Platzhalter-Namen
    // „Standard-Programm". Auf den aktuellen Default-Namen migrieren — Guard auf
    // den exakten Legacy-Namen, damit user-umbenannte Programme unangetastet
    // bleiben. Idempotent: feuert nach der Umbenennung nicht mehr.
    if (existing.name === LEGACY_DEFAULT_PROGRAMM_NAME) {
      existing.name = DEFAULT_PROGRAMM_NAME;
      await putProgramm(idb, existing);
    }
    return existing;
  }
  const programm: Programm = {
    id: DEFAULT_PROGRAMM_ID,
    name: DEFAULT_PROGRAMM_NAME,
    created_at: new Date().toISOString(),
    smb_handle_key: DEFAULT_SMB_HANDLE_KEY,
  };
  await putProgramm(idb, programm);
  return programm;
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

export interface DeleteProgrammCleaned {
  schemas: number;
  rowHashes: number;
  unterprogramme: number;
  verbuende: number;
  filters: number;
}

export type DeleteProgrammResult =
  | { ok: true; cleaned: DeleteProgrammCleaned }
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
 * Cascade-Cleanup nach erfolgreichem Delete: alle Records, die an die
 * Programm-ID gekeyt sind, werden mit-gelöscht — sonst bleiben sie als
 * verwaiste IDB-Einträge zurück:
 *  - csv_schemas (+ csv_row_hashes pro Schema)
 *  - unterprogramme
 *  - verbuende (verbund_historie folgt indirekt — kein Index auf programm_id)
 *  - filter_definitionen
 *
 * Akronym_index-Einträge sind über `[programm_id, akronym]` gekeyt, aber
 * im 0-Anträge-Fall sollten sie nicht existieren — Akronyme entstehen nur
 * beim Antrags-Import.
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

  // Cascade-Cleanup vor dem Programm-Delete (sonst verlieren wir die
  // programm_id-Beziehung beim Lookup von Schemas etc.).
  const cleaned: DeleteProgrammCleaned = {
    schemas: 0,
    rowHashes: 0,
    unterprogramme: 0,
    verbuende: 0,
    filters: 0,
  };

  // CSV-Schemas + ihre Row-Hashes
  const schemas = await listSchemasByProgramm(idb, id);
  for (const s of schemas) {
    const hashes = await getRowHashesForSchema(idb, s.id);
    if (hashes.length > 0) {
      await deleteRowHashes(idb, s.id, hashes.map(h => h.join_value));
      cleaned.rowHashes += hashes.length;
    }
    await deleteSchema(idb, s.id);
    cleaned.schemas++;
  }

  // Unterprogramme
  const ups = await listUnterprogrammeByProgramm(idb, id);
  for (const up of ups) {
    await deleteUnterprogramm(idb, up.id);
    cleaned.unterprogramme++;
  }

  // Verbuende (sollten 0 sein wenn Anträge 0, aber defensiv)
  const verbuende = await listVerbuendeByProgramm(idb, id);
  for (const v of verbuende) {
    await deleteVerbund(idb, v.verbund_id);
    cleaned.verbuende++;
  }

  // Filter-Definitionen
  const filters = await listFilters(idb, id);
  for (const f of filters) {
    await removeFilter(idb, f.id);
    cleaned.filters++;
  }

  await deleteProgrammRecord(idb, id);
  return { ok: true, cleaned };
}

import Papa from 'papaparse';
import type { IDBStore } from '../storage/idb-store';
import { logAudit } from '../infrastructure/audit-log';
import type { CsvSchema, Unterprogramm } from './types';
import {
  putUnterprogramm,
  getUnterprogramm,
  listUnterprogrammeByProgramm,
  listAntraegeByProgramm,
} from './idb-csv';

/**
 * Scannt eine CSV-Datei nach Distinct-Werten einer Spalte. Nutzt Papa-Parse
 * im step-Modus für Memory-Effizienz bei großen CSVs (~40K Zeilen).
 */
export async function scanDistinctColumnValues(
  blob: Blob,
  columnName: string,
): Promise<Map<string, number>> {
  const text = await blob.text();
  const counts = new Map<string, number>();
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      step: (row) => {
        const raw = row.data?.[columnName];
        const val = (raw ?? '').toString().trim();
        if (!val) return;
        counts.set(val, (counts.get(val) ?? 0) + 1);
      },
      complete: () => resolve(counts),
      error: (err: unknown) => reject(err),
    });
  });
}

export async function listUnterprogramme(idb: IDBStore, programmId: string): Promise<Unterprogramm[]> {
  return listUnterprogrammeByProgramm(idb, programmId);
}

/** Upsert: legt neuen Eintrag an oder aktualisiert vorhandenen (behält created_at). */
export async function saveUnterprogramm(idb: IDBStore, input: Partial<Unterprogramm> & { id: string; programm_id: string; code: string; aktiv: boolean }): Promise<Unterprogramm> {
  const now = new Date().toISOString();
  const existing = await getUnterprogramm(idb, input.id);
  const up: Unterprogramm = {
    id: input.id,
    programm_id: input.programm_id,
    code: input.code,
    name: input.name ?? existing?.name,
    zeitraum_von: input.zeitraum_von ?? existing?.zeitraum_von,
    zeitraum_bis: input.zeitraum_bis ?? existing?.zeitraum_bis,
    aktiv: input.aktiv,
    antrag_count_cached: input.antrag_count_cached ?? existing?.antrag_count_cached,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await putUnterprogramm(idb, up);
  return up;
}

/**
 * Gibt die Set<code> zurück, die für den Master-Schema-Import aktiv sind.
 * Nicht-Master: gibt null zurück (= kein Filter).
 */
export async function getActiveUnterprogrammCodes(
  idb: IDBStore,
  schema: CsvSchema,
): Promise<Set<string> | null> {
  if (!schema.is_master) return null;
  const all = await listUnterprogrammeByProgramm(idb, schema.programm_id);
  const codes = new Set<string>();
  for (const up of all) if (up.aktiv) codes.add(up.code);
  return codes;
}

/**
 * Aktualisiert die `antrag_count_cached`-Felder aller Unterprogramme eines Programms
 * nach einem Import.
 */
export async function recomputeAntragCounts(idb: IDBStore, programmId: string): Promise<void> {
  const [ups, antraege] = await Promise.all([
    listUnterprogrammeByProgramm(idb, programmId),
    listAntraegeByProgramm(idb, programmId),
  ]);
  const counts = new Map<string, number>();
  for (const a of antraege) {
    const code = typeof a.unterprogramm_id === 'string' ? a.unterprogramm_id.trim() : '';
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const now = new Date().toISOString();
  for (const up of ups) {
    const n = counts.get(up.code) ?? 0;
    if (up.antrag_count_cached === n) continue;
    await putUnterprogramm(idb, { ...up, antrag_count_cached: n, updated_at: now });
  }
}

/**
 * Findet die CSV-Spalte, die auf `unterprogramm_id` gemappt wurde.
 */
export function findUnterprogrammColumn(schema: CsvSchema): string | null {
  const entry = Object.entries(schema.column_mapping).find(
    ([, e]) => e.canonical === 'unterprogramm_id' && !e.ignore,
  );
  return entry ? entry[0] : null;
}

/**
 * Audit-Event für UP-Änderungen (Import oder Admin-Edit).
 */
export async function logUnterprogrammChange(
  idb: IDBStore,
  action: 'unterprogramm_activated' | 'unterprogramm_deactivated' | 'unterprogramm_edited' | 'unterprogramm_created',
  details: Record<string, unknown>,
  kuratorName?: string,
): Promise<void> {
  await logAudit(idb, { action, user: kuratorName, details });
}

import Papa from 'papaparse';
import type { IDBStore } from '../storage/idb-store';
import { logAudit } from '../infrastructure/audit-log';
import { parseGermanDate } from './dateParse';
import type { Antrag, CsvSchema, Unterprogramm } from './types';
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
    geplanter_zeitraum: input.geplanter_zeitraum ?? existing?.geplanter_zeitraum,
    zeitraum_auto_von_cached: input.zeitraum_auto_von_cached ?? existing?.zeitraum_auto_von_cached,
    zeitraum_auto_bis_cached: input.zeitraum_auto_bis_cached ?? existing?.zeitraum_auto_bis_cached,
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

/** Liefert das antragsdatum als ISO-Date-String (YYYY-MM-DD) oder null. */
function pickAntragsDatumIso(a: Antrag): string | null {
  const raw = a.antragsdatum;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s = raw.trim();
  // Schon ISO? (Date-Felder werden im merger normalisiert.)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Defensiv: deutsches Format akzeptieren (alte Importe ohne type='date').
  return parseGermanDate(s);
}

/**
 * Aktualisiert die Cache-Felder aller Unterprogramme eines Programms nach einem Import:
 * - `antrag_count_cached` (Anzahl Anträge)
 * - `zeitraum_auto_von_cached` / `zeitraum_auto_bis_cached` (min/max antragsdatum als ISO)
 *
 * Single-Pass über alle Anträge eines Programms, idempotent (schreibt nur bei Änderung).
 */
export async function recomputeUnterprogrammStats(idb: IDBStore, programmId: string): Promise<void> {
  const [ups, antraege] = await Promise.all([
    listUnterprogrammeByProgramm(idb, programmId),
    listAntraegeByProgramm(idb, programmId),
  ]);
  const counts = new Map<string, number>();
  const ranges = new Map<string, { min: string; max: string }>();
  for (const a of antraege) {
    const code = typeof a.unterprogramm_id === 'string' ? a.unterprogramm_id.trim() : '';
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
    const dat = pickAntragsDatumIso(a);
    if (dat) {
      const cur = ranges.get(code);
      if (!cur) {
        ranges.set(code, { min: dat, max: dat });
      } else {
        if (dat < cur.min) cur.min = dat;
        if (dat > cur.max) cur.max = dat;
      }
    }
  }
  const now = new Date().toISOString();
  for (const up of ups) {
    const n = counts.get(up.code) ?? 0;
    const r = ranges.get(up.code);
    const nextVon = r?.min;
    const nextBis = r?.max;
    const unchanged =
      up.antrag_count_cached === n &&
      up.zeitraum_auto_von_cached === nextVon &&
      up.zeitraum_auto_bis_cached === nextBis;
    if (unchanged) continue;
    await putUnterprogramm(idb, {
      ...up,
      antrag_count_cached: n,
      zeitraum_auto_von_cached: nextVon,
      zeitraum_auto_bis_cached: nextBis,
      updated_at: now,
    });
  }
}

/** @deprecated Use {@link recomputeUnterprogrammStats}. */
export const recomputeAntragCounts = recomputeUnterprogrammStats;

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

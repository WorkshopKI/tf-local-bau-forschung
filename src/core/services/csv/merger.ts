import type { IDBStore } from '../storage/idb-store';
import { parseCsvAll } from './parser';
import { parseGermanDate } from './dateParse';
import { loadCsvSourceFile } from './schemaRegistry';
import {
  getAntrag,
  putAntraege,
  deleteAntrag,
  listSchemasByProgramm,
  getAkronymEntry,
  putAkronymEntry,
  deleteAkronymEntry,
  getVerbund,
  putVerbund,
  deleteVerbund,
  appendHistory,
  appendVerbundHistory,
} from './idb-csv';
import type { Antrag, AntragHistorieEntry, CsvSchema, ColumnMappingEntry, Verbund, VerbundHistorieEntry } from './types';
import { getCanonicalLevel } from './constants';
import { uuid } from '@/core/services/id-generator';

export interface SchemaWithRows {
  schema: CsvSchema;
  rows: Record<string, string>[];
}

async function loadSchemaRows(idb: IDBStore, schema: CsvSchema): Promise<Record<string, string>[]> {
  const text = await loadCsvSourceFile(idb, schema.id);
  if (!text) return [];
  // Importer normalisiert die CSV beim Speichern auf UTF-8 (siehe importer.ts
  // vor saveCsvSourceFile). Der hier zurückgelesene Text ist daher immer UTF-8,
  // unabhängig vom Original-Encoding der hochgeladenen Datei.
  const blob = new Blob([text], { type: 'text/csv' });
  const { rows } = await parseCsvAll(blob, {
    encoding: 'UTF-8',
    separator: schema.separator,
  });
  return rows;
}

function coerceValue(raw: string, entry: ColumnMappingEntry | undefined): unknown {
  const s = (raw ?? '').trim();
  if (!s) return '';
  if (!entry) return s;
  if (entry.type === 'date') {
    const iso = parseGermanDate(s);
    return iso ?? s;
  }
  if (entry.type === 'number') {
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : s;
  }
  if (entry.type === 'boolean') {
    const low = s.toLowerCase();
    if (['ja', 'true', '1', 'yes'].includes(low)) return true;
    if (['nein', 'false', '0', 'no'].includes(low)) return false;
    return s;
  }
  return s;
}

function resolveFieldKey(col: string, entry: ColumnMappingEntry | undefined): string | null {
  if (!entry) return null;
  if (entry.ignore) return null;
  if (entry.canonical) return entry.canonical;
  if (entry.custom) return entry.custom;
  return col.toLowerCase();
}

function findJoinColumn(schema: CsvSchema): string | null {
  const entry = Object.entries(schema.column_mapping).find(
    ([, e]) => e.canonical === schema.join_key && !e.ignore,
  );
  return entry ? entry[0] : null;
}

function findMatchingRows(
  schema: CsvSchema,
  rows: Record<string, string>[],
  antrag: Partial<Antrag>,
): Record<string, string>[] {
  const joinCol = findJoinColumn(schema);
  if (!joinCol) return [];

  if (schema.join_key === 'aktenzeichen') {
    const az = antrag.aktenzeichen;
    if (!az) return [];
    return rows.filter(r => (r[joinCol] ?? '').trim() === az);
  }
  if (schema.join_key === 'verbund_id') {
    if (!antrag.verbund_id) return [];
    return rows.filter(r => (r[joinCol] ?? '').trim() === antrag.verbund_id);
  }
  if (schema.join_key === 'akronym') {
    if (!antrag.akronym) return [];
    return rows.filter(r => (r[joinCol] ?? '').trim() === antrag.akronym);
  }
  return [];
}

export async function loadAllSchemasWithRows(
  idb: IDBStore,
  programmId: string,
): Promise<SchemaWithRows[]> {
  const schemas = await listSchemasByProgramm(idb, programmId);
  const out: SchemaWithRows[] = [];
  for (const s of schemas) {
    const rows = await loadSchemaRows(idb, s);
    out.push({ schema: s, rows });
  }
  return out;
}

// Multi-CSV Merge für genau einen Antrag. Zweiphasiges Merge:
// Pass 0: nur Schemas mit join_key='aktenzeichen' (seedet identity-Felder: akronym, verbund_id)
// Pass 1: alle Schemas nach priority asc (höhere Priority gewinnt)
// Historie wird aus Diff zwischen existing und merged abgeleitet (nicht während Merge).
export async function recomputeAntrag(
  idb: IDBStore,
  aktenzeichen: string,
  programmId: string,
  schemasCache?: SchemaWithRows[],
): Promise<void> {
  const schemas = schemasCache ?? (await loadAllSchemasWithRows(idb, programmId));
  const existing = await getAntrag(idb, aktenzeichen);

  const merged: Antrag = {
    aktenzeichen,
    programm_id: programmId,
    _field_sources: {},
    _updated_at: new Date().toISOString(),
  };

  const winnerEntry = new Map<string, ColumnMappingEntry>();
  // Verbund-Level-Updates werden separat akkumuliert und nach dem Antrag-Merge
  // auf das Verbund-Objekt angewandt — sie landen NICHT auf dem Antrag.
  const verbundUpdates: Record<string, unknown> = {};
  const verbundFieldSources: Record<string, string> = {};
  const verbundWinnerEntry = new Map<string, ColumnMappingEntry>();

  const sorted = [...schemas].sort((a, b) => {
    const d = a.schema.priority - b.schema.priority;
    return d !== 0 ? d : a.schema.id.localeCompare(b.schema.id);
  });

  for (let pass = 0; pass < 2; pass++) {
    for (const { schema, rows } of sorted) {
      if (pass === 0 && schema.join_key !== 'aktenzeichen') continue;
      const matches = findMatchingRows(schema, rows, merged);
      if (matches.length === 0) continue;

      // Patch 1b-1 (Änderung 2): Implizite Attribution des Join-Key-Felds.
      // Master darf die Quelle jederzeit setzen (Master-Initial-Insert), Non-Master
      // nur wenn noch keine Source zugewiesen ist (first-match-wins).
      const joinKeyField = schema.join_key;
      if (schema.is_master || merged._field_sources[joinKeyField] === undefined) {
        merged._field_sources[joinKeyField] = schema.id;
      }

      for (const row of matches) {
        for (const [col, entry] of Object.entries(schema.column_mapping)) {
          const field = resolveFieldKey(col, entry);
          if (!field) continue;
          // Patch 1b-1 (Änderung 1): Das Feld, das als join_key dient, wird von
          // dieser CSV-Source nicht geschrieben — sie nutzt es nur als Lookup-Key.
          if (entry.canonical === schema.join_key) continue;
          const val = coerceValue(row[col] ?? '', entry);
          // Verbund-Level-Felder: gehen auf das Verbund-Objekt, nicht den Antrag.
          if (entry.canonical && getCanonicalLevel(entry.canonical) === 'verbund') {
            if (val === '' && verbundUpdates[field] != null && verbundUpdates[field] !== '') continue;
            verbundUpdates[field] = val;
            verbundFieldSources[field] = schema.id;
            verbundWinnerEntry.set(field, entry);
            continue;
          }
          if (val === '' && merged[field] != null && merged[field] !== '') continue;
          merged[field] = val;
          merged._field_sources[field] = schema.id;
          winnerEntry.set(field, entry);
        }
      }
    }
  }

  // History aus Diff zwischen vorherigem Stand und neuem merged-Stand ableiten
  const history: AntragHistorieEntry[] = [];
  const nowIso = merged._updated_at;
  if (existing) {
    for (const [field, entry] of winnerEntry.entries()) {
      if (!entry.trackHistory) continue;
      const oldVal = existing[field];
      const newVal = merged[field];
      if (oldVal === undefined || oldVal === '' || oldVal === null) continue;
      if (oldVal === newVal) continue;
      history.push({
        id: uuid(),
        aktenzeichen,
        feld: field,
        alt_wert: oldVal,
        neu_wert: newVal,
        geaendert_am: nowIso,
        csv_schema_id: merged._field_sources[field] ?? '',
      });
    }
  }

  await putAntraege(idb, [merged]);
  if (history.length > 0) await appendHistory(idb, history);

  // Akronym-Index aktualisieren (bei geändertem Akronym: altes Entry säubern)
  const oldAkronym = typeof existing?.akronym === 'string' ? existing.akronym : undefined;
  const newAkronym = typeof merged.akronym === 'string' ? merged.akronym : undefined;
  if (oldAkronym && oldAkronym !== newAkronym) {
    const oldIdx = await getAkronymEntry(idb, programmId, oldAkronym);
    if (oldIdx) {
      const remaining = oldIdx.aktenzeichen.filter(x => x !== aktenzeichen);
      if (remaining.length === 0) await deleteAkronymEntry(idb, programmId, oldAkronym);
      else await putAkronymEntry(idb, { ...oldIdx, aktenzeichen: remaining });
    }
  }
  if (newAkronym) {
    const idx = await getAkronymEntry(idb, programmId, newAkronym);
    const list = new Set(idx?.aktenzeichen ?? []);
    list.add(aktenzeichen);
    await putAkronymEntry(idb, {
      programm_id: programmId,
      akronym: newAkronym,
      aktenzeichen: [...list],
    });
  }

  // Verbund aktualisieren
  const oldVerbund = typeof existing?.verbund_id === 'string' ? existing.verbund_id : undefined;
  const newVerbund = typeof merged.verbund_id === 'string' ? merged.verbund_id : undefined;
  if (oldVerbund && oldVerbund !== newVerbund) {
    const vb = await getVerbund(idb, oldVerbund);
    if (vb) {
      vb.teilantrags_ids = vb.teilantrags_ids.filter(x => x !== aktenzeichen);
      if (vb.teilantrags_ids.length === 0) await deleteVerbund(idb, vb.verbund_id);
      else await putVerbund(idb, vb);
    }
  }
  if (newVerbund) {
    const vb = await getVerbund(idb, newVerbund);
    const tvTitel = typeof merged.titel === 'string' ? merged.titel : undefined;
    const vbTitel = typeof verbundUpdates.verbund_titel === 'string' ? verbundUpdates.verbund_titel : undefined;
    const vbStatus = typeof verbundUpdates.verbund_status === 'string' ? verbundUpdates.verbund_status : undefined;

    // Verbund-Level-Felder priorisieren: Wenn aus CSV ein verbund_titel gemappt ist,
    // gewinnt dieser; sonst Fallback auf TV-Titel (Backward-Compat).
    const effectiveTitel = vbTitel ?? tvTitel;
    const sources = { ...(vb?._field_sources ?? {}), ...verbundFieldSources };

    // Diff fuer Verbund-Historie: nur wenn Verbund existierte UND VB-Felder mit
    // trackHistory tatsaechlich neue Werte erhalten (alte vs. neue Werte vergleichen).
    const VB_FIELD_MAP: Record<string, keyof Verbund> = {
      verbund_titel: 'titel',
      verbund_status: 'status',
    };
    const vbHistory: VerbundHistorieEntry[] = [];
    if (vb) {
      for (const [canonicalKey, entry] of verbundWinnerEntry) {
        if (!entry.trackHistory) continue;
        const vbProp = VB_FIELD_MAP[canonicalKey];
        if (!vbProp) continue;
        const oldVal = vb[vbProp];
        const newVal = verbundUpdates[canonicalKey];
        if (oldVal === undefined || oldVal === '' || oldVal === null) continue;
        if (oldVal === newVal) continue;
        if (newVal === '' || newVal === undefined) continue;
        vbHistory.push({
          id: uuid(),
          verbund_id: newVerbund,
          feld: canonicalKey,
          alt_wert: oldVal,
          neu_wert: newVal,
          geaendert_am: nowIso,
          csv_schema_id: verbundFieldSources[canonicalKey] ?? '',
        });
      }
    }

    if (!vb) {
      await putVerbund(idb, {
        verbund_id: newVerbund,
        programm_id: programmId,
        akronym: newAkronym,
        titel: effectiveTitel,
        status: vbStatus,
        teilantrags_ids: [aktenzeichen],
        _field_sources: sources,
        _updated_at: nowIso,
      });
    } else {
      if (!vb.teilantrags_ids.includes(aktenzeichen)) vb.teilantrags_ids.push(aktenzeichen);
      if (!vb.akronym && newAkronym) vb.akronym = newAkronym;
      // VB-Titel: explizites Mapping wins, sonst Erstbelegung mit TV-Titel
      if (vbTitel !== undefined && vbTitel !== '') vb.titel = vbTitel;
      else if (!vb.titel && tvTitel) vb.titel = tvTitel;
      // VB-Status: aus VB-Mapping uebernehmen, leerer Wert ueberschreibt nicht
      if (vbStatus !== undefined && vbStatus !== '') vb.status = vbStatus;
      vb._field_sources = sources;
      vb._updated_at = nowIso;
      await putVerbund(idb, vb);
    }

    if (vbHistory.length > 0) await appendVerbundHistory(idb, vbHistory);
  }
}

export async function recomputeMultiple(
  idb: IDBStore,
  aktenzeichen: string[],
  programmId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const cache = await loadAllSchemasWithRows(idb, programmId);
  let done = 0;
  for (const az of aktenzeichen) {
    await recomputeAntrag(idb, az, programmId, cache);
    done++;
    onProgress?.(done, aktenzeichen.length);
  }
}

export function discoverAktenzeichen(schemas: SchemaWithRows[]): Set<string> {
  const all = new Set<string>();
  // Priorisiere Master-Schemas; wenn keine Master-Schemas: alle Schemas mit join_key=aktenzeichen
  const masters = schemas.filter(s => s.schema.is_master);
  const pool = masters.length > 0 ? masters : schemas.filter(s => s.schema.join_key === 'aktenzeichen');
  for (const { schema, rows } of pool) {
    const joinCol = findJoinColumn(schema);
    if (!joinCol) continue;
    for (const r of rows) {
      const az = (r[joinCol] ?? '').trim();
      if (az) all.add(az);
    }
  }
  return all;
}

export async function removeAntragAndCleanup(
  idb: IDBStore,
  aktenzeichen: string,
  programmId: string,
): Promise<void> {
  const antrag = await getAntrag(idb, aktenzeichen);
  await deleteAntrag(idb, aktenzeichen);

  if (antrag?.verbund_id && typeof antrag.verbund_id === 'string') {
    const vb = await getVerbund(idb, antrag.verbund_id);
    if (vb) {
      vb.teilantrags_ids = vb.teilantrags_ids.filter(x => x !== aktenzeichen);
      if (vb.teilantrags_ids.length === 0) await deleteVerbund(idb, vb.verbund_id);
      else await putVerbund(idb, vb);
    }
  }

  if (antrag?.akronym && typeof antrag.akronym === 'string') {
    const idx = await getAkronymEntry(idb, programmId, antrag.akronym);
    if (idx) {
      const remaining = idx.aktenzeichen.filter(x => x !== aktenzeichen);
      if (remaining.length === 0) await deleteAkronymEntry(idb, programmId, antrag.akronym);
      else await putAkronymEntry(idb, { ...idx, aktenzeichen: remaining });
    }
  }
}

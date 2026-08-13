/**
 * Batch-optimierter Recompute-Pfad für Bulk-Operationen (Re-Import, Initial-Import).
 *
 * Bisheriges recomputeAntrag öffnet pro Antrag 4–7 IDB-Transaktionen
 * (putAntraege, putVerbund, putAkronymEntry, appendHistory, ...). Bei einem
 * Re-Import von 13k+ Antraegen sind das 50k+ Transaktionen — der dominante
 * Anteil der Import-Dauer.
 *
 * recomputeMultipleBatched preloadet die Caches einmal, baut alle Mutationen
 * in einem Buffer pro Chunk auf und flusht jeden Chunk in EINER Multi-Store-
 * Transaction. Das reduziert die Transaktionsanzahl ~50–100x.
 *
 * Erwartete Performance: Re-Import von 13k Antraegen in ~30–60 s statt ~5 min.
 */

import { uuid } from '@/core/services/id-generator';
import type { IDBStore } from '../../storage/idb-store';
import { CSV_STORES } from '../../storage/idb-store';
import { getCanonicalLevel } from '../constants';
import {
  listAkronymIndexByProgramm,
  listAntraegeByProgramm,
  listVerbuendeByProgramm,
} from '../idb-csv';
import type {
  AkronymIndexEntry,
  Antrag,
  AntragHistorieEntry,
  ColumnMappingEntry,
  CsvSchema,
  Verbund,
  VerbundHistorieEntry,
} from '../types';
import { asAntragStatusRaw } from '../types';
import { toAntragListItem } from '../list-view';
import { loeseKategorieSpaltenFuer } from '../list-view-migration';
import {
  resolveStatusDatumGruppen,
  type ResolvedKategorieSpalten,
  type ResolvedStatusDatumGruppe,
} from '../status-datum-gruppen';
import type { AntragListItem } from '../types';
import { applyFristDatumFallback, coerceValue, findJoinColumn, resolveFieldKey } from './helpers';
import { loadAllSchemasWithRows, type SchemaWithRows } from './loader';

interface RecomputeBatch {
  antraegeUpsert: Map<string, Antrag>;
  antraegeDelete: Set<string>;
  /** Slim-Spiegel von antraegeUpsert/Delete — wird parallel zum vollen
   *  Antrag-Store geschrieben (Phase-2-Optimierung). */
  listViewUpsert: Map<string, AntragListItem>;
  listViewDelete: Set<string>;
  verbuendeUpsert: Map<string, Verbund>;
  verbuendeDelete: Set<string>;
  akronymUpsert: Map<string, AkronymIndexEntry>;
  akronymDelete: Set<string>;
  history: AntragHistorieEntry[];
  vbHistory: VerbundHistorieEntry[];
}

interface RecomputeCaches {
  schemas: SchemaWithRows[];
  /** Datums-Status-Gruppen, einmal pro Programm aus den Schemas aufgelöst (für
   *  die Slim-Projektion `toAntragListItem`). */
  statusGruppen: ResolvedStatusDatumGruppe[];
  /** Kuratierte Ordner-Spalten (`kat_status`), ebenfalls einmal pro Programm.
   *  Muss mit, weil `putAntraegeListView` ein Vollersatz ist: ein Slim-Item
   *  ohne sie löschte die Ordner-Spalten der berührten Anträge. */
  kategorieSpalten: ResolvedKategorieSpalten[];
  /** Pro Schema-ID: pre-indexed Map joinValue → matching rows. Macht aus dem
   *  ehemaligen findMatchingRows() (Linear-Scan ueber alle Rows) ein
   *  O(1)-Lookup. Bei 13k Antraegen × 5 Schemas spart das ~850M Vergleiche
   *  pro Pass. */
  rowIndices: Map<string, Map<string, Record<string, string>[]>>;
  antraegeByAz: Map<string, Antrag>;
  verbuendeById: Map<string, Verbund>;
  akronymByKey: Map<string, AkronymIndexEntry>;
}

const akrKey = (programmId: string, akronym: string): string => `${programmId}|${akronym}`;

function emptyBatch(): RecomputeBatch {
  return {
    antraegeUpsert: new Map(),
    antraegeDelete: new Set(),
    listViewUpsert: new Map(),
    listViewDelete: new Set(),
    verbuendeUpsert: new Map(),
    verbuendeDelete: new Set(),
    akronymUpsert: new Map(),
    akronymDelete: new Set(),
    history: [],
    vbHistory: [],
  };
}

function batchSize(b: RecomputeBatch): number {
  return (
    b.antraegeUpsert.size + b.antraegeDelete.size +
    b.listViewUpsert.size + b.listViewDelete.size +
    b.verbuendeUpsert.size + b.verbuendeDelete.size +
    b.akronymUpsert.size + b.akronymDelete.size +
    b.history.length + b.vbHistory.length
  );
}

function buildRowIndex(schema: CsvSchema, rows: Record<string, string>[]): Map<string, Record<string, string>[]> {
  const idx = new Map<string, Record<string, string>[]>();
  const joinCol = findJoinColumn(schema);
  if (!joinCol) return idx;
  for (const row of rows) {
    const k = (row[joinCol] ?? '').trim();
    if (!k) continue;
    let list = idx.get(k);
    if (!list) {
      list = [];
      idx.set(k, list);
    }
    list.push(row);
  }
  return idx;
}

async function loadRecomputeCaches(
  idb: IDBStore,
  programmId: string,
  schemas: SchemaWithRows[],
): Promise<RecomputeCaches> {
  const [antraege, verbuende, akronymEntries, kategorieSpalten] = await Promise.all([
    listAntraegeByProgramm(idb, programmId),
    listVerbuendeByProgramm(idb, programmId),
    listAkronymIndexByProgramm(idb, programmId),
    loeseKategorieSpaltenFuer(idb, programmId),
  ]);
  const rowIndices = new Map<string, Map<string, Record<string, string>[]>>();
  for (const { schema, rows } of schemas) {
    rowIndices.set(schema.id, buildRowIndex(schema, rows));
  }
  return {
    schemas,
    statusGruppen: resolveStatusDatumGruppen(schemas.map(s => s.schema)),
    kategorieSpalten,
    rowIndices,
    antraegeByAz: new Map(antraege.map(a => [a.aktenzeichen, a])),
    verbuendeById: new Map(verbuende.map(v => [v.verbund_id, v])),
    akronymByKey: new Map(akronymEntries.map(e => [akrKey(e.programm_id, e.akronym), e])),
  };
}

function findMatchingRowsIndexed(
  caches: RecomputeCaches,
  schema: CsvSchema,
  antrag: Partial<Antrag>,
): Record<string, string>[] {
  const idx = caches.rowIndices.get(schema.id);
  if (!idx) return [];
  if (schema.join_key === 'aktenzeichen') {
    return antrag.aktenzeichen ? (idx.get(antrag.aktenzeichen) ?? []) : [];
  }
  if (schema.join_key === 'verbund_id') {
    return typeof antrag.verbund_id === 'string' ? (idx.get(antrag.verbund_id) ?? []) : [];
  }
  if (schema.join_key === 'akronym') {
    return typeof antrag.akronym === 'string' ? (idx.get(antrag.akronym) ?? []) : [];
  }
  return [];
}

function flushRecomputeBatch(idb: IDBStore, batch: RecomputeBatch): Promise<void> {
  if (batchSize(batch) === 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const stores = [
      CSV_STORES.ANTRAEGE,
      CSV_STORES.ANTRAEGE_LIST_VIEW,
      CSV_STORES.VERBUENDE,
      CSV_STORES.AKRONYM_INDEX,
      CSV_STORES.ANTRAG_HISTORIE,
      CSV_STORES.VERBUND_HISTORIE,
    ];
    const t = idb.getDb().transaction(stores, 'readwrite');
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    // Reihenfolge: erst Deletes (bereinigt alten Zustand), dann Upserts.
    const sAntraege = t.objectStore(CSV_STORES.ANTRAEGE);
    for (const az of batch.antraegeDelete) sAntraege.delete(az);
    for (const a of batch.antraegeUpsert.values()) sAntraege.put(a);
    const sListView = t.objectStore(CSV_STORES.ANTRAEGE_LIST_VIEW);
    for (const az of batch.listViewDelete) sListView.delete(az);
    for (const it of batch.listViewUpsert.values()) sListView.put(it);
    const sVerbuende = t.objectStore(CSV_STORES.VERBUENDE);
    for (const id of batch.verbuendeDelete) sVerbuende.delete(id);
    for (const v of batch.verbuendeUpsert.values()) sVerbuende.put(v);
    const sAkronym = t.objectStore(CSV_STORES.AKRONYM_INDEX);
    for (const key of batch.akronymDelete) {
      const sep = key.indexOf('|');
      if (sep <= 0) continue;
      const pid = key.slice(0, sep);
      const akr = key.slice(sep + 1);
      sAkronym.delete([pid, akr]);
    }
    for (const e of batch.akronymUpsert.values()) sAkronym.put(e);
    const sHist = t.objectStore(CSV_STORES.ANTRAG_HISTORIE);
    for (const h of batch.history) sHist.put(h);
    const sVbHist = t.objectStore(CSV_STORES.VERBUND_HISTORIE);
    for (const h of batch.vbHistory) sVbHist.put(h);
  });
}

/** In-memory Variante von recomputeAntrag — pusht alle Writes in den Batch
 *  und aktualisiert die Caches, sodass nachfolgende Aufrufe innerhalb
 *  desselben Chunks den frischen Zustand sehen. */
function recomputeAntragIntoBatch(
  caches: RecomputeCaches,
  programmId: string,
  aktenzeichen: string,
  batch: RecomputeBatch,
): void {
  const existing = caches.antraegeByAz.get(aktenzeichen) ?? null;

  const merged: Antrag = {
    aktenzeichen,
    programm_id: programmId,
    _field_sources: {},
    _updated_at: new Date().toISOString(),
  };

  const winnerEntry = new Map<string, ColumnMappingEntry>();
  const verbundUpdates: Record<string, unknown> = {};
  const verbundFieldSources: Record<string, string> = {};
  const verbundWinnerEntry = new Map<string, ColumnMappingEntry>();

  const sorted = [...caches.schemas].sort((a, b) => {
    const d = a.schema.priority - b.schema.priority;
    return d !== 0 ? d : a.schema.id.localeCompare(b.schema.id);
  });

  for (let pass = 0; pass < 2; pass++) {
    for (const { schema } of sorted) {
      if (pass === 0 && schema.join_key !== 'aktenzeichen') continue;
      const matches = findMatchingRowsIndexed(caches, schema, merged);
      if (matches.length === 0) continue;

      const joinKeyField = schema.join_key;
      if (schema.is_master || merged._field_sources[joinKeyField] === undefined) {
        merged._field_sources[joinKeyField] = schema.id;
      }

      for (const row of matches) {
        for (const [col, entry] of Object.entries(schema.column_mapping)) {
          const field = resolveFieldKey(col, entry);
          if (!field) continue;
          if (entry.canonical === schema.join_key) continue;
          const val = coerceValue(row[col] ?? '', entry);
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

  applyFristDatumFallback(merged);

  const nowIso = merged._updated_at;
  if (existing) {
    for (const [field, entry] of winnerEntry.entries()) {
      if (!entry.trackHistory) continue;
      const oldVal = existing[field];
      const newVal = merged[field];
      if (oldVal === undefined || oldVal === '' || oldVal === null) continue;
      if (oldVal === newVal) continue;
      batch.history.push({
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

  // Antrag persistieren (Buffer + Cache) — voller Record und Slim-Spiegel
  // werden in derselben Multi-Store-TX geflusht, damit beide Stores
  // konsistent bleiben.
  batch.antraegeUpsert.set(aktenzeichen, merged);
  batch.antraegeDelete.delete(aktenzeichen);
  batch.listViewUpsert.set(
    aktenzeichen,
    toAntragListItem(merged, caches.statusGruppen, caches.kategorieSpalten),
  );
  batch.listViewDelete.delete(aktenzeichen);
  caches.antraegeByAz.set(aktenzeichen, merged);

  // Akronym-Index aktualisieren
  const oldAkronym = typeof existing?.akronym === 'string' ? existing.akronym : undefined;
  const newAkronym = typeof merged.akronym === 'string' ? merged.akronym : undefined;
  if (oldAkronym && oldAkronym !== newAkronym) {
    const oldKey = akrKey(programmId, oldAkronym);
    const oldIdx = caches.akronymByKey.get(oldKey);
    if (oldIdx) {
      const remaining = oldIdx.aktenzeichen.filter(x => x !== aktenzeichen);
      if (remaining.length === 0) {
        batch.akronymDelete.add(oldKey);
        batch.akronymUpsert.delete(oldKey);
        caches.akronymByKey.delete(oldKey);
      } else {
        const updated = { ...oldIdx, aktenzeichen: remaining };
        batch.akronymUpsert.set(oldKey, updated);
        batch.akronymDelete.delete(oldKey);
        caches.akronymByKey.set(oldKey, updated);
      }
    }
  }
  if (newAkronym) {
    const key = akrKey(programmId, newAkronym);
    const idx = caches.akronymByKey.get(key);
    const list = new Set(idx?.aktenzeichen ?? []);
    list.add(aktenzeichen);
    const updated: AkronymIndexEntry = {
      programm_id: programmId,
      akronym: newAkronym,
      aktenzeichen: [...list],
    };
    batch.akronymUpsert.set(key, updated);
    batch.akronymDelete.delete(key);
    caches.akronymByKey.set(key, updated);
  }

  // Verbund aktualisieren
  const oldVerbund = typeof existing?.verbund_id === 'string' ? existing.verbund_id : undefined;
  const newVerbund = typeof merged.verbund_id === 'string' ? merged.verbund_id : undefined;
  if (oldVerbund && oldVerbund !== newVerbund) {
    const vb = caches.verbuendeById.get(oldVerbund);
    if (vb) {
      const remainingTas = vb.teilantrags_ids.filter(x => x !== aktenzeichen);
      if (remainingTas.length === 0) {
        batch.verbuendeDelete.add(oldVerbund);
        batch.verbuendeUpsert.delete(oldVerbund);
        caches.verbuendeById.delete(oldVerbund);
      } else {
        const updated: Verbund = { ...vb, teilantrags_ids: remainingTas };
        batch.verbuendeUpsert.set(oldVerbund, updated);
        batch.verbuendeDelete.delete(oldVerbund);
        caches.verbuendeById.set(oldVerbund, updated);
      }
    }
  }
  if (newVerbund) {
    const vb = caches.verbuendeById.get(newVerbund);
    const tvTitel = typeof merged.titel === 'string' ? merged.titel : undefined;
    const vbTitel = typeof verbundUpdates.verbund_titel === 'string' ? verbundUpdates.verbund_titel : undefined;
    const vbStatus = typeof verbundUpdates.verbund_status === 'string' ? asAntragStatusRaw(verbundUpdates.verbund_status) : undefined;
    const effectiveTitel = vbTitel ?? tvTitel;
    const sources = { ...(vb?._field_sources ?? {}), ...verbundFieldSources };

    const VB_FIELD_MAP: Record<string, keyof Verbund> = {
      verbund_titel: 'titel',
      verbund_status: 'status',
    };
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
        batch.vbHistory.push({
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

    let next: Verbund;
    if (!vb) {
      next = {
        verbund_id: newVerbund,
        programm_id: programmId,
        akronym: newAkronym,
        titel: effectiveTitel,
        status: vbStatus,
        teilantrags_ids: [aktenzeichen],
        _field_sources: sources,
        _updated_at: nowIso,
      };
    } else {
      next = { ...vb };
      // programm_id-Drift heilen: ein mis-filed Record (leere/falsche
      // programm_id) fiele sonst dauerhaft aus dem Snapshot-Index-Query
      // (listVerbundsByProgramm) → unvollständige verbuende.jsonl.
      if (next.programm_id !== programmId) next.programm_id = programmId;
      if (!next.teilantrags_ids.includes(aktenzeichen)) {
        next.teilantrags_ids = [...next.teilantrags_ids, aktenzeichen];
      }
      // Akronym wie Titel/Status behandeln: ein nicht-leerer Wert aus dem
      // Export gewinnt. First-write-wins ließ eine korrigierte VB_KURZNAM nie
      // am Verbund-Record ankommen — Liste und Detailseite zeigten danach zwei
      // verschiedene Namen, und weil `akronym` antrag-level ist, hielt auch die
      // Verbund-Historie die Abweichung nicht fest.
      if (newAkronym) next.akronym = newAkronym;
      if (vbTitel !== undefined && vbTitel !== '') next.titel = vbTitel;
      else if (!next.titel && tvTitel) next.titel = tvTitel;
      if (vbStatus !== undefined && vbStatus !== '') next.status = vbStatus;
      next._field_sources = sources;
      next._updated_at = nowIso;
    }
    batch.verbuendeUpsert.set(newVerbund, next);
    batch.verbuendeDelete.delete(newVerbund);
    caches.verbuendeById.set(newVerbund, next);
  }
}

function removeAntragIntoBatch(
  caches: RecomputeCaches,
  programmId: string,
  aktenzeichen: string,
  batch: RecomputeBatch,
): void {
  const antrag = caches.antraegeByAz.get(aktenzeichen) ?? null;
  batch.antraegeDelete.add(aktenzeichen);
  batch.antraegeUpsert.delete(aktenzeichen);
  batch.listViewDelete.add(aktenzeichen);
  batch.listViewUpsert.delete(aktenzeichen);
  caches.antraegeByAz.delete(aktenzeichen);

  if (antrag?.verbund_id && typeof antrag.verbund_id === 'string') {
    const vbId = antrag.verbund_id;
    const vb = caches.verbuendeById.get(vbId);
    if (vb) {
      const remaining = vb.teilantrags_ids.filter(x => x !== aktenzeichen);
      if (remaining.length === 0) {
        batch.verbuendeDelete.add(vbId);
        batch.verbuendeUpsert.delete(vbId);
        caches.verbuendeById.delete(vbId);
      } else {
        const updated: Verbund = { ...vb, teilantrags_ids: remaining };
        batch.verbuendeUpsert.set(vbId, updated);
        batch.verbuendeDelete.delete(vbId);
        caches.verbuendeById.set(vbId, updated);
      }
    }
  }

  if (antrag?.akronym && typeof antrag.akronym === 'string') {
    const key = akrKey(programmId, antrag.akronym);
    const idx = caches.akronymByKey.get(key);
    if (idx) {
      const remaining = idx.aktenzeichen.filter(x => x !== aktenzeichen);
      if (remaining.length === 0) {
        batch.akronymDelete.add(key);
        batch.akronymUpsert.delete(key);
        caches.akronymByKey.delete(key);
      } else {
        const updated = { ...idx, aktenzeichen: remaining };
        batch.akronymUpsert.set(key, updated);
        batch.akronymDelete.delete(key);
        caches.akronymByKey.set(key, updated);
      }
    }
  }
}

export interface BatchedRecomputeArgs {
  touchedAz: string[];
  removedAz: string[];
  schemasCache?: SchemaWithRows[];
}

export async function recomputeMultipleBatched(
  idb: IDBStore,
  programmId: string,
  args: BatchedRecomputeArgs,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // Nichts zu tun → sofort raus, BEVOR die teuren Caches geladen werden
  // (loadRecomputeCaches liest alle Antraege/Verbuende/Akronyme des Programms).
  const total = args.touchedAz.length + args.removedAz.length;
  if (total === 0) return;

  const schemas = args.schemasCache ?? (await loadAllSchemasWithRows(idb, programmId));
  const caches = await loadRecomputeCaches(idb, programmId, schemas);

  const FLUSH_THRESHOLD = 500;
  const YIELD_EVERY_MS = 100;
  let batch = emptyBatch();
  let done = 0;
  let lastYieldAt = Date.now();

  // Progress nach jedem Antrag melden — der ETA-Sampler in Step4Progress
  // braucht eine ausreichend hohe Update-Frequenz (3 Samples in 1.5 s
  // Mindest-Window), sonst wird keine ETA berechnet.
  const reportProgress = (): void => {
    if (onProgress) onProgress(done, total);
  };

  // Periodisch an die Event-Loop zurueckkehren, damit React rendern und der
  // Sampler-useEffect feuern kann. Ohne maybeYield laeuft die Schleife
  // synchron bis zum naechsten Flush — dann gibt's nur einen einzigen Render
  // pro 500er-Chunk und das 1.5 s ETA-Window wird nie gefuellt.
  const maybeYield = async (): Promise<void> => {
    const now = Date.now();
    if (now - lastYieldAt >= YIELD_EVERY_MS) {
      lastYieldAt = now;
      await new Promise<void>(r => setTimeout(r, 0));
    }
  };

  // Removals zuerst — bereinigt alte Verbund/Akronym-Refs, bevor neue Antraege
  // sie ggf. wieder belegen.
  for (const az of args.removedAz) {
    removeAntragIntoBatch(caches, programmId, az, batch);
    done++;
    reportProgress();
    await maybeYield();
    if (batchSize(batch) >= FLUSH_THRESHOLD) {
      await flushRecomputeBatch(idb, batch);
      batch = emptyBatch();
    }
  }
  for (const az of args.touchedAz) {
    recomputeAntragIntoBatch(caches, programmId, az, batch);
    done++;
    reportProgress();
    await maybeYield();
    if (batchSize(batch) >= FLUSH_THRESHOLD) {
      await flushRecomputeBatch(idb, batch);
      batch = emptyBatch();
    }
  }
  if (batchSize(batch) > 0) {
    await flushRecomputeBatch(idb, batch);
  }
  reportProgress();
}

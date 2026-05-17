/**
 * Embedding-Corpus — laedt pro historischem Antrag ein Embedding und cached
 * es in IDB (kv-Store, Prefix `auslastung-emb:`). 13k × 768d × 4 B ≈ 40 MB.
 *
 * Wird seit Mai 2026 auch auf den SMB-Daten-Share gespiegelt
 * (`_intern/auslastung-embedding-corpus.{manifest.json,bin}`), damit ein
 * zweiter PL den Korpus nicht 46 min lang neu bauen muss. Mirroring-Logik
 * lebt in `embedding-corpus-mirror.ts` + `useEmbeddingCorpusMirror`. Hier
 * unveraendert: lokale IDB-CRUD-Operationen + Build-Pipeline. Der Caller
 * (EmbeddingCorpusSection) triggert nach jedem erfolgreichen Build
 * automatisch den Upload.
 *
 * Operationen:
 *  - `buildEmbeddingCorpus(idb, antraege, onProgress, signal)` — alle Antraege
 *  - `incrementalBuild(idb, antraege, onProgress, signal)` — nur fehlende
 *  - `loadAllEmbeddings(idb)` — Map<aktenzeichen, number[]>
 *  - `loadEmbedding(idb, az)` — single
 *  - `countEmbeddings(idb)` / `countMissing(idb, antraege)`
 *  - `clearEmbeddings(idb)`
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Antrag } from '@/core/services/csv/types';
import {
  AUSLASTUNG_EMB_PREFIX,
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
} from '../types';
import { embedText, ensureEmbeddingReady } from './embed-wrapper';

/** Erzeugt den Embedding-Text fuer einen Antrag. Reihenfolge: Titel, VB-Titel, Abstract. */
export function buildEmbeddingTextForAntrag(antrag: Antrag): string {
  const fields = [
    antrag[CANONICAL_VERBUND_TITEL],
    antrag[CANONICAL_TITEL],
    antrag[FIELD_PROJEKTBESCHREIBUNG],
  ];
  const parts: string[] = [];
  for (const f of fields) {
    if (typeof f === 'string' && f.trim()) parts.push(f.trim());
  }
  return parts.join(' \n ').slice(0, 4000); // cap fuer Modell-Token-Limit
}

function idbKey(aktenzeichen: string): string {
  return `${AUSLASTUNG_EMB_PREFIX}${aktenzeichen}`;
}

export async function loadEmbedding(idb: IDBStore, aktenzeichen: string): Promise<number[] | null> {
  const value = await idb.get<number[]>(idbKey(aktenzeichen));
  return Array.isArray(value) ? value : null;
}

export async function storeEmbedding(
  idb: IDBStore,
  aktenzeichen: string,
  vector: number[],
): Promise<void> {
  await idb.set(idbKey(aktenzeichen), vector);
}

/** Loescht ein einzelnes Embedding (falls Antrag aus dem Programm rausfaellt). */
export async function deleteEmbedding(idb: IDBStore, aktenzeichen: string): Promise<void> {
  await idb.delete(idbKey(aktenzeichen));
}

/** Vollstaendiger Iterator — wird bei Match-Stage-2 + Centroid-Berechnung benutzt. */
export async function loadAllEmbeddings(idb: IDBStore): Promise<Map<string, number[]>> {
  const keys = await idb.keys(AUSLASTUNG_EMB_PREFIX);
  const result = new Map<string, number[]>();
  for (const k of keys) {
    const az = k.slice(AUSLASTUNG_EMB_PREFIX.length);
    const v = await idb.get<number[]>(k);
    if (Array.isArray(v)) result.set(az, v);
  }
  return result;
}

export async function countEmbeddings(idb: IDBStore): Promise<number> {
  const keys = await idb.keys(AUSLASTUNG_EMB_PREFIX);
  return keys.length;
}

/** Wieviele Antraege haben noch kein Embedding? */
export async function countMissing(idb: IDBStore, antraege: Antrag[]): Promise<number> {
  const keys = new Set(await idb.keys(AUSLASTUNG_EMB_PREFIX));
  let missing = 0;
  for (const a of antraege) {
    if (!keys.has(idbKey(a.aktenzeichen))) missing++;
  }
  return missing;
}

/** Loescht den gesamten Embedding-Cache. */
export async function clearEmbeddings(idb: IDBStore): Promise<number> {
  const keys = await idb.keys(AUSLASTUNG_EMB_PREFIX);
  for (const k of keys) await idb.delete(k);
  return keys.length;
}

export interface BuildProgress {
  done: number;
  total: number;
  lastAntrag?: string;
  /** Geschaetzte verbleibende Zeit in Sekunden, oder undefined wenn noch zu unsicher. */
  etaSec?: number;
}

export interface BuildOptions {
  onProgress?: (p: BuildProgress) => void;
  signal?: AbortSignal;
  /** Nur fehlende neu embedden. Default true. */
  incremental?: boolean;
}

/**
 * Hauptpfad: laeuft durch alle Antraege, embed't (Tibtitel + VB_Titel +
 * Zusammenfassung) und schreibt in den IDB-Cache.
 *
 * Annahme: Caller hat `ensureEmbeddingReady(idb)` bereits aufgerufen — wenn
 * nicht, machen wir das hier nochmal idempotent.
 */
export async function buildEmbeddingCorpus(
  idb: IDBStore,
  antraege: Antrag[],
  opts: BuildOptions = {},
): Promise<{ done: number; skipped: number; aborted: boolean }> {
  const incremental = opts.incremental ?? true;
  await ensureEmbeddingReady(idb);

  // Liste filtern
  let queue: Antrag[];
  if (incremental) {
    const existing = new Set(await idb.keys(AUSLASTUNG_EMB_PREFIX));
    queue = antraege.filter(a => !existing.has(idbKey(a.aktenzeichen)));
  } else {
    queue = antraege;
  }

  const total = queue.length;
  let done = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const a of queue) {
    if (opts.signal?.aborted) {
      return { done, skipped, aborted: true };
    }
    const text = buildEmbeddingTextForAntrag(a);
    if (!text) {
      skipped++;
      done++;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
      continue;
    }
    try {
      const vec = await embedText(text, 'document');
      await storeEmbedding(idb, a.aktenzeichen, vec);
      done++;
      const elapsed = (Date.now() - startedAt) / 1000;
      const etaSec = done > 5 ? (elapsed / done) * (total - done) : undefined;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen, etaSec });
    } catch (err) {
      console.warn(`[embedding-corpus] embed failed for ${a.aktenzeichen}:`, err);
      skipped++;
      done++;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
    }
    // Yield zwischen Iterations -> UI bleibt responsiv
    await new Promise(r => setTimeout(r, 0));
  }

  return { done, skipped, aborted: false };
}

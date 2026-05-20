/**
 * Embedding-Korpus — IDB-Storage-Layer.
 *
 * Generische CRUD-Operationen auf einem keyed IDB-Cache von Float-Vektoren.
 * Keine Antrag-Semantik — der Caller mappt seine Domain-Objekte (z.B.
 * Aktenzeichen → Vektor). Aktuell genutzt von:
 *  - Auslastungs-Modul (Stage-2-Matching, Kategorie-Centroids)
 *  - Antraege-Hybrid-Suche (semantische Treffer)
 *
 * **Backward-Compat:** Der IDB-Prefix bleibt `'auslastung-emb:'` (historisch
 * gewachsen). Umbenennen würde alle bestehenden lokalen Caches verwerfen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';

/**
 * IDB-kv-Prefix unter dem Embedding-Vektoren gespeichert werden.
 * Wert beabsichtigt unverändert seit dem ersten Auslastungs-Release —
 * Umbenennen würde alle User-Caches invalidieren.
 */
export const EMBEDDING_CORPUS_IDB_PREFIX = 'auslastung-emb:';

function idbKey(key: string): string {
  return `${EMBEDDING_CORPUS_IDB_PREFIX}${key}`;
}

export async function loadEmbedding(idb: IDBStore, key: string): Promise<number[] | null> {
  const value = await idb.get<number[]>(idbKey(key));
  return Array.isArray(value) ? value : null;
}

export async function storeEmbedding(
  idb: IDBStore,
  key: string,
  vector: number[],
): Promise<void> {
  await idb.set(idbKey(key), vector);
}

/** Loescht ein einzelnes Embedding. */
export async function deleteEmbedding(idb: IDBStore, key: string): Promise<void> {
  await idb.delete(idbKey(key));
}

/** Vollstaendiger Iterator — Stage-2-Matching, Centroid-Berechnung,
 *  Hybrid-Suche. Macht N IDB-Roundtrips, daher Caller-Caching empfohlen. */
export async function loadAllEmbeddings(idb: IDBStore): Promise<Map<string, number[]>> {
  const keys = await idb.keys(EMBEDDING_CORPUS_IDB_PREFIX);
  const result = new Map<string, number[]>();
  for (const k of keys) {
    const id = k.slice(EMBEDDING_CORPUS_IDB_PREFIX.length);
    const v = await idb.get<number[]>(k);
    if (Array.isArray(v)) result.set(id, v);
  }
  return result;
}

export async function countEmbeddings(idb: IDBStore): Promise<number> {
  const keys = await idb.keys(EMBEDDING_CORPUS_IDB_PREFIX);
  return keys.length;
}

/** Set aller existierenden Embedding-Keys (ohne Prefix). Fuer
 *  `countMissing`-style Aufrufer effizienter als N x hasEmbedding. */
export async function listEmbeddingKeys(idb: IDBStore): Promise<Set<string>> {
  const keys = await idb.keys(EMBEDDING_CORPUS_IDB_PREFIX);
  const result = new Set<string>();
  for (const k of keys) result.add(k.slice(EMBEDDING_CORPUS_IDB_PREFIX.length));
  return result;
}

/** Loescht den gesamten Embedding-Cache. Returnt Anzahl der geloeschten Keys. */
export async function clearEmbeddings(idb: IDBStore): Promise<number> {
  const keys = await idb.keys(EMBEDDING_CORPUS_IDB_PREFIX);
  for (const k of keys) await idb.delete(k);
  return keys.length;
}

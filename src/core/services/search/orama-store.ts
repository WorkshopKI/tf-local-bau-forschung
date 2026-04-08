import { create, upsert, remove, search, save, load, count,
  type Orama, type Results } from '@orama/orama';
import { pipelineLog } from './pipeline-logger';

export interface OramaDoc {
  id: string;
  text: string;
  title: string;
  source: string;
  tags: string;
  type: string;
  embedding: number[];
}

export interface OramaSearchResult {
  id: string;
  text: string;
  title: string;
  source: string;
  tags: string[];
  type: string;
  score: number;
  method: 'fulltext' | 'vector' | 'hybrid';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: Orama<any> | null = null;
let docChunkCounts: Record<string, number> | null = null;

/**
 * Lädt die Chunk-Counts pro Dokument aus IDB.
 * Wird einmal beim App-Start aufgerufen.
 */
export async function loadDocChunkCounts(
  idb: { get: <T>(key: string) => Promise<T | null> },
): Promise<void> {
  docChunkCounts = await idb.get<Record<string, number>>('doc-chunk-counts');
}

/**
 * Normalisiert den Score basierend auf der Chunk-Anzahl des Quelldokuments.
 * Lange Dokumente (viele Chunks) werden abgestraft.
 * Formel: score * (1 / log2(chunkCount + 1))
 *
 * Beispiele:
 *   5 Chunks  → Faktor 0.39
 *   20 Chunks → Faktor 0.22
 *   100 Chunks → Faktor 0.15
 */
function normalizeScore(score: number, source: string): number {
  if (!docChunkCounts) return score;
  const count = docChunkCounts[source];
  if (!count || count <= 1) return score;
  return score * (1 / Math.log2(count + 1));
}

export function createOramaDB(vectorDimensions: number): void {
  db = create({
    schema: {
      id: 'string',
      text: 'string',
      title: 'string',
      source: 'string',
      tags: 'string',
      type: 'string',
      embedding: `vector[${vectorDimensions}]`,
    } as any,
  });
}

export function getOramaDB(): Orama<any> | null {
  return db;
}

export function saveOramaToDB(
  idb: { set: (key: string, value: unknown) => Promise<void> },
): Promise<void> {
  if (!db) return Promise.resolve();
  const data = save(db);
  return idb.set('orama-db', data);
}

export function loadOramaFromDB(
  idb: { get: <T>(key: string) => Promise<T | null> },
): Promise<boolean> {
  return idb.get<Record<string, unknown>>('orama-db').then(data => {
    if (!data) return false;
    try {
      // Erstelle leere DB und lade Daten rein
      db = create({ schema: { id: 'string' } as any });
      load(db!, data as any);
      return true;
    } catch {
      db = null;
      return false;
    }
  });
}

export function insertDoc(doc: OramaDoc): void {
  if (!db) throw new Error('Orama not initialized');
  upsert(db, doc as any);
}

export function removeDoc(id: string): void {
  if (!db) return;
  try { remove(db, id); } catch { /* not found */ }
}

/**
 * Dedupliziert Suchergebnisse: Maximal maxPerDoc Chunks pro Quelldokument.
 * Identifiziert Dokumente anhand des `source`-Feldes (Dateiname).
 */
function deduplicateBySource(
  results: OramaSearchResult[],
  maxPerDoc: number,
): OramaSearchResult[] {
  const counts = new Map<string, number>();
  return results.filter(r => {
    const key = r.source;
    const current = counts.get(key) ?? 0;
    if (current >= maxPerDoc) return false;
    counts.set(key, current + 1);
    return true;
  });
}

export function hybridSearch(
  query: string,
  queryVector: number[] | null,
  options?: { type?: string; limit?: number; maxPerDoc?: number },
): OramaSearchResult[] {
  if (!db) return [];

  const limit = options?.limit ?? 10;
  const maxPerDoc = options?.maxPerDoc ?? 2;
  // Mehr Kandidaten holen um nach Deduplizierung genug zu haben
  const fetchLimit = limit * 3;
  const where = options?.type ? { type: options.type } : undefined;

  let results: Results<any> | Promise<Results<any>>;

  if (queryVector && queryVector.length > 0) {
    results = search(db, {
      mode: 'hybrid',
      term: query,
      vector: { value: queryVector, property: 'embedding' },
      similarity: 0.2,
      limit: fetchLimit,
      where,
    } as any);
  } else {
    results = search(db, {
      mode: 'fulltext',
      term: query,
      limit: fetchLimit,
      where,
    } as any);
  }

  // Orama's search() is sync in v3 but typed as sync|async — cast safely
  const syncResults = results as Results<any>;

  const mapped = syncResults.hits.map(hit => {
    const doc = hit.document as Record<string, unknown>;
    return {
      id: doc.id as string,
      text: doc.text as string,
      title: doc.title as string,
      source: doc.source as string,
      tags: ((doc.tags as string) ?? '').split(',').filter(Boolean),
      type: doc.type as string,
      score: normalizeScore(hit.score, doc.source as string),
      method: queryVector ? 'hybrid' as const : 'fulltext' as const,
    };
  });

  // Nach Normalisierung neu sortieren (Scores haben sich verändert)
  mapped.sort((a, b) => b.score - a.score);
  const final = deduplicateBySource(mapped, maxPerDoc).slice(0, limit);
  pipelineLog.info('Orama', `${queryVector ? 'hybrid' : 'fulltext'}: ${syncResults.hits.length} Treffer → ${final.length} nach Dedup`);
  return final;
}

export function getDocCount(): number {
  if (!db) return 0;
  return count(db);
}

export function destroyOrama(): void {
  db = null;
}

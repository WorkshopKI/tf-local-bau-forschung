import { create, insert, remove, search, save, load, count,
  type Orama, type Results } from '@orama/orama';

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
  insert(db, doc as any);
}

export function removeDoc(id: string): void {
  if (!db) return;
  try { remove(db, id); } catch { /* not found */ }
}

export function hybridSearch(
  query: string,
  queryVector: number[] | null,
  options?: { type?: string; limit?: number },
): OramaSearchResult[] {
  if (!db) return [];

  const limit = options?.limit ?? 10;
  const where = options?.type ? { type: options.type } : undefined;

  let results: Results<any> | Promise<Results<any>>;

  if (queryVector && queryVector.length > 0) {
    results = search(db, {
      mode: 'hybrid',
      term: query,
      vector: { value: queryVector, property: 'embedding' },
      similarity: 0.3,
      hybridWeights: { text: 0.3, vector: 0.7 },
      limit,
      where,
    } as any);
  } else {
    results = search(db, {
      mode: 'fulltext',
      term: query,
      limit,
      where,
    } as any);
  }

  // Orama's search() is sync in v3 but typed as sync|async — cast safely
  const syncResults = results as Results<any>;

  return syncResults.hits.map(hit => {
    const doc = hit.document as Record<string, unknown>;
    return {
      id: doc.id as string,
      text: doc.text as string,
      title: doc.title as string,
      source: doc.source as string,
      tags: ((doc.tags as string) ?? '').split(',').filter(Boolean),
      type: doc.type as string,
      score: hit.score,
      method: queryVector ? 'hybrid' as const : 'fulltext' as const,
    };
  });
}

export function getDocCount(): number {
  if (!db) return 0;
  return count(db);
}

export function destroyOrama(): void {
  db = null;
}

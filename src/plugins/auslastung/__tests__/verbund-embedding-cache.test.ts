/**
 * Tests fuer den Closure-Cache in `loadAllVerbundEmbeddings`.
 *
 * Wichtig: dieser Cache spart einen vollen IDB-Scan beim Re-Mount von
 * `KlassifizierungsReview` (Plugin-Wechsel-Szenario). Bei Corpus-Rebuild muss
 * der Cache via `invalidateVerbundEmbeddingsCache()` geleert werden, sonst
 * liefert der naechste Load stale Vektoren.
 *
 * v2.26.x: Der Read laeuft ueber `idb.entries(prefix)` (EIN Cursor-Scan) statt
 * `keys()` + N `get()` — bei 7000+ Verbuenden war der alte Pfad der teuerste
 * Teil des Cold-Loads (~15 s). Tests asserten daher auf `entriesCalls`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedVerbundEmbeddings,
  loadAllVerbundEmbeddings,
  invalidateVerbundEmbeddingsCache,
} from '../services/matching';
import type { IDBStore } from '@/core/services/storage/idb-store';

function makeMockIdb(data: Record<string, number[]>): IDBStore & { entriesCalls: number } {
  let entriesCalls = 0;
  return {
    get entriesCalls() { return entriesCalls; },
    entries: vi.fn(async (prefix?: string) => {
      entriesCalls++;
      return Object.entries(data).filter(([k]) => !prefix || k.startsWith(prefix));
    }),
    keys: vi.fn(async (prefix?: string) => Object.keys(data).filter(k => !prefix || k.startsWith(prefix))),
    get: vi.fn(async (key: string) => data[key]),
    set: vi.fn(),
    delete: vi.fn(),
  } as unknown as IDBStore & { entriesCalls: number };
}

describe('loadAllVerbundEmbeddings — Closure-Cache', () => {
  beforeEach(() => {
    invalidateVerbundEmbeddingsCache();
  });

  it('Folge-Call mit gleichem idb liefert gecachten Wert ohne IDB-Read', async () => {
    const idb = makeMockIdb({
      'auslastung-emb-verbund:V1': [0.1, 0.2, 0.3],
      'auslastung-emb-verbund:V2': [0.4, 0.5, 0.6],
    });

    const first = await loadAllVerbundEmbeddings(idb);
    expect(first.size).toBe(2);
    expect(first.get('V1')).toEqual([0.1, 0.2, 0.3]);
    expect((idb as unknown as { entriesCalls: number }).entriesCalls).toBe(1);

    const second = await loadAllVerbundEmbeddings(idb);
    expect(second).toBe(first);  // exakte Map-Identitaet
    // KEIN weiterer IDB-Zugriff
    expect((idb as unknown as { entriesCalls: number }).entriesCalls).toBe(1);
  });

  it('anderer idb → Cache-Miss, neuer Read', async () => {
    const idb1 = makeMockIdb({ 'auslastung-emb-verbund:V1': [1, 2, 3] });
    const idb2 = makeMockIdb({ 'auslastung-emb-verbund:V2': [4, 5, 6] });
    const a = await loadAllVerbundEmbeddings(idb1);
    const b = await loadAllVerbundEmbeddings(idb2);
    expect(b).not.toBe(a);
    expect(b.get('V2')).toEqual([4, 5, 6]);
  });

  it('invalidateVerbundEmbeddingsCache zwingt IDB-Read', async () => {
    const idb = makeMockIdb({
      'auslastung-emb-verbund:V1': [1, 2, 3],
    });
    await loadAllVerbundEmbeddings(idb);
    const callsBefore = (idb as unknown as { entriesCalls: number }).entriesCalls;
    invalidateVerbundEmbeddingsCache();
    await loadAllVerbundEmbeddings(idb);
    expect((idb as unknown as { entriesCalls: number }).entriesCalls).toBe(callsBefore + 1);
  });

  it('leere Map wird genauso gecacht', async () => {
    const idb = makeMockIdb({});
    const first = await loadAllVerbundEmbeddings(idb);
    expect(first.size).toBe(0);
    const second = await loadAllVerbundEmbeddings(idb);
    expect(second).toBe(first);
  });
});

describe('getCachedVerbundEmbeddings — synchroner Cache-Read (Hebel B)', () => {
  beforeEach(() => {
    invalidateVerbundEmbeddingsCache();
  });

  it('Cache leer → null (kein async Load)', () => {
    const idb = makeMockIdb({});
    const result = getCachedVerbundEmbeddings(idb);
    expect(result).toBe(null);
    // KEIN IDB-Zugriff
    expect((idb as unknown as { entriesCalls: number }).entriesCalls).toBe(0);
  });

  it('Nach loadAllVerbundEmbeddings → identische Map-Ref synchron', async () => {
    const idb = makeMockIdb({
      'auslastung-emb-verbund:V1': [0.1, 0.2],
    });
    const loaded = await loadAllVerbundEmbeddings(idb);
    const cached = getCachedVerbundEmbeddings(idb);
    expect(cached).toBe(loaded);
  });

  it('Nach invalidateVerbundEmbeddingsCache → null', async () => {
    const idb = makeMockIdb({ 'auslastung-emb-verbund:V1': [1] });
    await loadAllVerbundEmbeddings(idb);
    invalidateVerbundEmbeddingsCache();
    expect(getCachedVerbundEmbeddings(idb)).toBe(null);
  });

  it('anderer idb-Identity → null (Cross-Session-Schutz)', async () => {
    const idb1 = makeMockIdb({ 'auslastung-emb-verbund:V1': [1] });
    const idb2 = makeMockIdb({ 'auslastung-emb-verbund:V1': [1] });
    await loadAllVerbundEmbeddings(idb1);
    expect(getCachedVerbundEmbeddings(idb2)).toBe(null);
    expect(getCachedVerbundEmbeddings(idb1)).not.toBe(null);
  });
});

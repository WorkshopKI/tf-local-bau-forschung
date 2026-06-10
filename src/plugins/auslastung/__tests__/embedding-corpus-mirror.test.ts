/**
 * Unit-Tests fuer den Embedding-Corpus-Mirror.
 *
 * Wichtigste Garantien:
 *  - serialize → parse Round-Trip ist bit-exakt (Float32-Konversion stabil).
 *  - aktenzeichenSetHash ist stabil bei beliebiger Eingabe-Reihenfolge.
 *  - checkCompat erkennt Modell- und Dim-Mismatch.
 *  - parseCorpus wirft bei korruptem Bin (binBytes != tatsaechliche Bytes).
 */
import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import {
  serializeCorpus,
  parseCorpus,
  applyCorpusStreamed,
  applyCorpusToIdb,
  loadAllEmbeddings,
  hashAktenzeichenSet,
  checkCompat,
  type EmbeddingCorpusManifest,
} from '@/core/services/embedding-corpus';
import { IDBStore } from '@/core/services/storage/idb-store';

function makeVec(dim: number, fill: number): number[] {
  return Array.from({ length: dim }, (_, i) => fill + i * 0.01);
}

describe('serializeCorpus + parseCorpus Round-Trip', () => {
  it('Round-Trip ist bit-exakt fuer kleine Korpora', async () => {
    const embs = new Map<string, number[]>([
      ['A1', makeVec(4, 0.1)],
      ['A2', makeVec(4, 0.2)],
      ['A3', makeVec(4, 0.3)],
    ]);
    const { manifest, bin } = await serializeCorpus(embs, 'test-model', 4, 'tester');
    const back = parseCorpus(manifest, bin);

    expect(back.size).toBe(3);
    for (const [az, vec] of embs) {
      // Float32-Konversion: erwarte Annaeherung, da number[] -> float32 -> number[]
      // 0.1 (number) → 0.10000000149011612 (float32) — kleiner Drift im < 1e-7-Bereich
      const recovered = back.get(az)!;
      expect(recovered.length).toBe(vec.length);
      for (let i = 0; i < vec.length; i++) {
        expect(recovered[i]).toBeCloseTo(vec[i]!, 6);
      }
    }
  });

  it('Manifest enthaelt korrekte Metadaten', async () => {
    const embs = new Map<string, number[]>([
      ['B1', makeVec(8, 0.5)],
      ['B2', makeVec(8, 0.6)],
    ]);
    const { manifest } = await serializeCorpus(embs, 'embeddinggemma-300m', 8, 'PL_Alice');
    expect(manifest.version).toBe(1);
    expect(manifest.modellId).toBe('embeddinggemma-300m');
    expect(manifest.dim).toBe(8);
    expect(manifest.antraegeCount).toBe(2);
    expect(manifest.builderProfile).toBe('PL_Alice');
    expect(manifest.binFormat).toBe('f32-stream');
    expect(manifest.binBytes).toBe(2 * 8 * 4); // 64 Bytes
    expect(manifest.aktenzeichen).toEqual(['B1', 'B2']); // sortiert
    expect(typeof manifest.builtAt).toBe('string');
    expect(manifest.aktenzeichenSetHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('aktenzeichen-Reihenfolge in der Bin folgt der sortierten Liste im Manifest', async () => {
    const embs = new Map<string, number[]>([
      ['ZZ', [1, 2, 3, 4]],
      ['AA', [5, 6, 7, 8]],
      ['MM', [9, 10, 11, 12]],
    ]);
    const { manifest, bin } = await serializeCorpus(embs, 'm', 4);
    expect(manifest.aktenzeichen).toEqual(['AA', 'MM', 'ZZ']);
    const back = parseCorpus(manifest, bin);
    expect(back.get('AA')![0]).toBeCloseTo(5, 6);
    expect(back.get('MM')![0]).toBeCloseTo(9, 6);
    expect(back.get('ZZ')![0]).toBeCloseTo(1, 6);
  });

  it('serializeCorpus wirft bei Dim-Mismatch', async () => {
    const embs = new Map<string, number[]>([
      ['X1', makeVec(4, 0.1)],
      ['X2', makeVec(5, 0.2)], // ← falsche Dim
    ]);
    await expect(serializeCorpus(embs, 'm', 4)).rejects.toThrow(/Dim-Mismatch/i);
  });

  it('parseCorpus wirft bei korrupter Bin-Groesse', () => {
    const manifest: EmbeddingCorpusManifest = {
      version: 1,
      modellId: 'm',
      dim: 4,
      antraegeCount: 2,
      builtAt: '2026-01-01T00:00:00.000Z',
      aktenzeichenSetHash: 'abc',
      aktenzeichen: ['A1', 'A2'],
      binFormat: 'f32-stream',
      binBytes: 32, // 2 * 4 * 4
    };
    const wrongBin = new ArrayBuffer(16); // halb so gross
    expect(() => parseCorpus(manifest, wrongBin)).toThrow(/Bin-Groesse/i);
  });

  it('parseCorpus wirft bei unbekanntem binFormat', () => {
    const manifest: EmbeddingCorpusManifest = {
      version: 1,
      modellId: 'm',
      dim: 4,
      antraegeCount: 1,
      builtAt: '2026-01-01T00:00:00.000Z',
      aktenzeichenSetHash: 'abc',
      aktenzeichen: ['A1'],
      binFormat: 'future-format' as unknown as 'f32-stream',
      binBytes: 16,
    };
    const bin = new ArrayBuffer(16);
    expect(() => parseCorpus(manifest, bin)).toThrow(/binFormat/i);
  });
});

describe('applyCorpusStreamed (Cold-Start-Memory-Fix v2.61.5)', () => {
  async function freshIdb(): Promise<IDBStore> {
    const { IDBFactory } = await import('fake-indexeddb');
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    const s = new IDBStore();
    await s.open();
    return s;
  }

  it('schreibt dieselben Vektoren wie parseCorpus + applyCorpusToIdb', async () => {
    const embs = new Map<string, number[]>([
      ['A1', makeVec(4, 0.1)],
      ['A2', makeVec(4, 0.2)],
      ['A3', makeVec(4, 0.3)],
    ]);
    const { manifest, bin } = await serializeCorpus(embs, 'm', 4);

    // Referenz-Pfad: parseCorpus → applyCorpusToIdb
    const idbRef = await freshIdb();
    await applyCorpusToIdb(idbRef, parseCorpus(manifest, bin));
    const ref = await loadAllEmbeddings(idbRef);

    // Streaming-Pfad
    const idbStream = await freshIdb();
    const count = await applyCorpusStreamed(idbStream, manifest, bin);
    const streamed = await loadAllEmbeddings(idbStream);

    expect(count).toBe(3);
    expect(streamed.size).toBe(ref.size);
    for (const [az, vec] of ref) {
      expect(streamed.get(az)).toEqual(vec);
    }
  });

  it('meldet Fortschritt und schreibt alle Eintraege (>100 → Yield-Pfad)', async () => {
    const embs = new Map<string, number[]>();
    for (let i = 0; i < 250; i++) embs.set(`A${String(i).padStart(3, '0')}`, makeVec(4, i));
    const { manifest, bin } = await serializeCorpus(embs, 'm', 4);
    const idb = await freshIdb();
    const seen: number[] = [];
    const count = await applyCorpusStreamed(idb, manifest, bin, (done) => seen.push(done));
    expect(count).toBe(250);
    expect((await loadAllEmbeddings(idb)).size).toBe(250);
    expect(seen[seen.length - 1]).toBe(250); // finaler Progress = total
  });

  it('wirft bei korrupter Bin-Groesse (wie parseCorpus)', async () => {
    const manifest: EmbeddingCorpusManifest = {
      version: 1, modellId: 'm', dim: 4, antraegeCount: 2,
      builtAt: '2026-01-01T00:00:00.000Z', aktenzeichenSetHash: 'abc',
      aktenzeichen: ['A1', 'A2'], binFormat: 'f32-stream', binBytes: 32,
    };
    const idb = await freshIdb();
    await expect(applyCorpusStreamed(idb, manifest, new ArrayBuffer(16))).rejects.toThrow(/Bin-Groesse/i);
  });
});

describe('hashAktenzeichenSet', () => {
  it('gleiche Eingabe in unterschiedlicher Reihenfolge → gleicher Hash', async () => {
    const a = await hashAktenzeichenSet(['A1', 'A2', 'A3']);
    const b = await hashAktenzeichenSet(['A3', 'A1', 'A2']);
    expect(a).toBe(b);
  });

  it('unterschiedliche Eingabe → unterschiedlicher Hash', async () => {
    const a = await hashAktenzeichenSet(['A1', 'A2', 'A3']);
    const b = await hashAktenzeichenSet(['A1', 'A2', 'A4']);
    expect(a).not.toBe(b);
  });

  it('Format ist 64 Hex-Zeichen (SHA-256)', async () => {
    const h = await hashAktenzeichenSet(['x']);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('leere Eingabe → stabiler Hash', async () => {
    const h = await hashAktenzeichenSet([]);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashAktenzeichenSet([])).toBe(h);
  });
});

describe('checkCompat', () => {
  function makeManifest(modellId: string, dim: number): EmbeddingCorpusManifest {
    return {
      version: 1,
      modellId,
      dim,
      antraegeCount: 0,
      builtAt: '2026-01-01T00:00:00.000Z',
      aktenzeichenSetHash: 'x',
      aktenzeichen: [],
      binFormat: 'f32-stream',
      binBytes: 0,
    };
  }

  it('gleiche modellId + dim → compatible', () => {
    expect(checkCompat(makeManifest('embeddinggemma-300m', 768), 'embeddinggemma-300m', 768))
      .toEqual({ kind: 'compatible' });
  });

  it('andere modellId → modell-mismatch (beide Werte im Result)', () => {
    const r = checkCompat(makeManifest('embeddinggemma-300m', 768), 'harrier-0.6b', 1024);
    expect(r).toEqual({
      kind: 'modell-mismatch',
      shareModell: 'embeddinggemma-300m',
      lokalModell: 'harrier-0.6b',
    });
  });

  it('gleiche modellId, andere dim → dim-mismatch (defensiv)', () => {
    const r = checkCompat(makeManifest('m', 768), 'm', 1024);
    expect(r).toEqual({
      kind: 'dim-mismatch',
      shareDim: 768,
      lokalDim: 1024,
    });
  });
});

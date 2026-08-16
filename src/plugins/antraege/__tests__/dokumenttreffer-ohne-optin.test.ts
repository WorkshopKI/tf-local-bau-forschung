/**
 * Der Schnitt zwischen den drei Such-Quellen (v4.64).
 *
 * Bis dahin hing die DMS-Stufe am selben Opt-in wie die Ähnlichkeitssuche: ohne
 * „Mit Ähnlichkeitssuche" endete `searchAntraege` nach dem Substring — und das
 * Suchfeld versprach im Platzhalter trotzdem Treffer aus den Dokumenten. Der
 * Dokument-Index braucht das Modell aber gar nicht.
 *
 * Der Test hält beide Hälften fest: der Index läuft ohne Opt-in (und ohne
 * Modell-Init), das Modell läuft nur mit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ensureEmbeddingReady = vi.fn(async (_idb: unknown) => {});
const embedText = vi.fn(async (_t: string, _rolle?: string) => [0.1, 0.2, 0.3]);
const hybridSearch = vi.fn(
  (_query: string, _vektor: number[] | null, _opts?: unknown) =>
    [{ source: 'antrag-16EP123456.pdf', score: 0.7 }],
);

vi.mock('@/core/services/embedding-corpus', () => ({
  ensureEmbeddingReady: (idb: unknown) => ensureEmbeddingReady(idb),
  embedText: (t: string, rolle?: string) => embedText(t, rolle),
  cosineSimilarity: () => 0,
  loadAllEmbeddings: async () => new Map(),
  loadManifest: async () => null,
  loadBin: async () => null,
  parseCorpus: () => ({ vectors: new Map() }),
  applyCorpusToIdb: async () => {},
  checkCompat: () => ({ ok: false }),
}));

vi.mock('@/core/services/search/orama-store', () => ({
  // Ein belegter Index — sonst meldete die Stufe nur „nicht verfügbar".
  getOramaDB: () => ({}),
  hybridSearch: (query: string, vektor: number[] | null, opts?: unknown) =>
    hybridSearch(query, vektor, opts),
}));

vi.mock('../services/search-corpus', () => ({
  // Leerer Wortlaut-Korpus: was am Ende in der Liste steht, kann dann NUR aus
  // dem Dokument-Index kommen.
  loadAntraegeTextCorpus: async () => new Map(),
  loadDmsFilenameToAkz: async () => new Map([['antrag-16EP123456.pdf', '16EP123456']]),
  standortNadel: () => null,
}));

import {
  searchAntraege,
  clearAntraegeSearchCaches,
} from '../services/antraege-search-service';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';

const IDB = {} as never;

async function suche(): Promise<string[]> {
  const res = await searchAntraege({
    query: 'brennstoffzelle',
    idb: IDB,
    programmId: 'p1',
    abortSignal: new AbortController().signal,
  });
  return res.hits.map(h => h.aktenzeichen);
}

beforeEach(() => {
  clearAntraegeSearchCaches();
  ensureEmbeddingReady.mockClear();
  embedText.mockClear();
  hybridSearch.mockClear();
  useSemanticSearchMode.setState({ enabled: false });
});

describe('Dokumenttreffer hängen nicht am Ähnlichkeits-Opt-in', () => {
  it('ohne Opt-in: der Dokument-Index liefert, das Modell wird nicht angefasst', async () => {
    expect(await suche()).toEqual(['16EP123456']);
    expect(ensureEmbeddingReady).not.toHaveBeenCalled();
    expect(embedText).not.toHaveBeenCalled();
  });

  it('ohne Opt-in läuft Orama als reiner Wortlaut-Lauf (Vektor = null)', async () => {
    await suche();
    expect(hybridSearch).toHaveBeenCalledTimes(1);
    expect(hybridSearch.mock.calls[0]![1]).toBeNull();
  });

  it('mit Opt-in kommt der Vektor dazu — dieselbe Stufe, jetzt hybrid', async () => {
    useSemanticSearchMode.setState({ enabled: true });
    await suche();
    expect(ensureEmbeddingReady).toHaveBeenCalled();
    expect(hybridSearch.mock.calls[0]![1]).toEqual([0.1, 0.2, 0.3]);
  });

  it('zu kurze Eingabe rührt keine der beiden Index-Stufen an', async () => {
    await searchAntraege({
      query: 'b',
      idb: IDB,
      programmId: 'p1',
      abortSignal: new AbortController().signal,
    });
    expect(hybridSearch).not.toHaveBeenCalled();
    expect(ensureEmbeddingReady).not.toHaveBeenCalled();
  });
});

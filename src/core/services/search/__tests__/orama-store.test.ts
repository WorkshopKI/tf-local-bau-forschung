import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { create, insert, save } from '@orama/orama';
import {
  ensureOramaDB, createOramaDB, destroyOrama, getOramaDB, getCurrentDimensions,
  insertDoc, getDocCount, persistOramaSoon, flushOramaPersist,
  INDEX_SPRACHE, spracheAusIndex, spracheVeraltet, getIndexSprache, indexSpracheVeraltet,
  loadOramaFromDB, hybridSearch, type OramaDoc,
  removeDocAndChunks, setDocChunkIds, getDocChunkIds,
} from '../orama-store';

/** Minimal-IDB: nur `set`, mehr braucht der Persistenz-Pfad nicht. */
function fakeIdb(): { set: (k: string, v: unknown) => Promise<void>; calls: string[] } {
  const calls: string[] = [];
  return { calls, set: async (k: string) => { calls.push(k); } };
}

/** Lese-IDB fuer `loadOramaFromDB` — liefert genau die hinterlegten Schluessel. */
function leseIdb(werte: Record<string, unknown>): { get: <T>(k: string) => Promise<T | null> } {
  return { get: async <T>(k: string) => (werte[k] as T) ?? null };
}

const doc = (id: string, dims: number): Parameters<typeof insertDoc>[0] => ({
  id, text: 'Vorhabensbeschreibung Text', title: 'VB.pdf', source: 'VB.pdf',
  tags: 'ZKN122220,vorhabensbeschreibung', type: 'dokument',
  embedding: new Array(dims).fill(0) as number[],
});

describe('orama-store: ensureOramaDB', () => {
  beforeEach(() => { destroyOrama(); });
  afterEach(() => { destroyOrama(); });

  it('legt bei fehlender DB eine neue an und meldet das', () => {
    expect(getOramaDB()).toBeNull();
    expect(ensureOramaDB(768)).toBe(true);
    expect(getOramaDB()).not.toBeNull();
    expect(getCurrentDimensions()).toBe(768);
  });

  it('laesst eine bestehende DB unangetastet', () => {
    createOramaDB(768);
    insertDoc(doc('a', 768));
    expect(ensureOramaDB(384)).toBe(false);
    // Weder neu erstellt noch die Dimension umgebogen — der Inhalt bleibt.
    expect(getCurrentDimensions()).toBe(768);
    expect(getDocCount()).toBe(1);
  });

  it('Kaltstart: insertDoc wirft nach ensureOramaDB nicht mehr', () => {
    // Regression zum gemeldeten Fehler "Orama not initialized": frische Variant-IDB,
    // nie ein Vollindexlauf gelaufen, nichts vom Share — die Ablage legt selbst an.
    expect(() => insertDoc(doc('vb-1', 768))).toThrow('Orama not initialized');
    ensureOramaDB(768);
    expect(() => insertDoc(doc('vb-1', 768))).not.toThrow();
    expect(getDocCount()).toBe(1);
  });
});

describe('orama-store: deutsche Worttrennung', () => {
  beforeEach(() => { destroyOrama(); });
  afterEach(() => { destroyOrama(); });

  /** Zwei Saetze, die sich nur ueber ihren Umlaut aehneln.
   *  Als Fabrik, nicht als Konstante: Orama leert beim Indexieren das
   *  `embedding`-Feld des uebergebenen Objekts — ein zweiter Lauf mit denselben
   *  Objekten scheitert an der Schema-Pruefung. */
  const umlautDocs = (): OramaDoc[] => [
    { ...doc('foerder', 768), text: 'Förderung beantragt', source: 'a.pdf' },
    { ...doc('fuehr', 768), text: 'Führung des Teams', source: 'b.pdf' },
  ];

  /** Baut einen Index so, wie ihn die App vor v4.8 gespeichert hat: englisch getrennt. */
  function alterIndex(inhalt = [{ ...doc('alt-1', 768), text: 'Förderung der Technologie' }]): Record<string, unknown> {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const alt = create({
      schema: {
        id: 'string', text: 'string', title: 'string',
        source: 'string', tags: 'string', type: 'string',
        embedding: 'vector[768]',
      } as any,
      language: 'english',
    } as any);
    for (const d of inhalt) insert(alt, d as any);
    return save(alt) as unknown as Record<string, unknown>;
  }

  it('eine frische DB traegt die deutsche Worttrennung', () => {
    createOramaDB(768);
    expect(getIndexSprache()).toBe(INDEX_SPRACHE);
    expect(indexSpracheVeraltet()).toBe(false);
  });

  it('findet Wortteile hinter dem Bindestrich (englisch war ein Token)', () => {
    createOramaDB(768);
    insertDoc({ ...doc('a', 768), text: 'ZIM-Kooperationsprojekt zur Wasserstoff-Technologie' });
    // Die englische Trennung haelt `-` INNERHALB des Tokens: dort waere der
    // ganze Text ein einziges Token `zim-kooperationsprojekt` und diese Suche leer.
    expect(hybridSearch('Kooperationsprojekt', null, { threshold: 0 })).toHaveLength(1);
  });

  it('Umlautwort zieht keine fremden Treffer mehr herein', async () => {
    // Der alte Zustand, nicht behauptet sondern vorgefuehrt: englisch zerlegte
    // BEIDE Saetze in `f` + Rest, und „Förderung" traf ueber das Bruchstueck `f`
    // auch „Führung des Teams".
    await loadOramaFromDB(leseIdb({
      'orama-db': alterIndex(umlautDocs()), 'orama-dimensions': 768,
    }), 768);
    expect(hybridSearch('Förderung', null, { threshold: 1 }).map(t => t.source))
      .toEqual(['a.pdf', 'b.pdf']);

    // Deutsch bleibt das Wort ganz — genau ein Treffer.
    destroyOrama();
    createOramaDB(768);
    for (const d of umlautDocs()) insertDoc(d);
    expect(hybridSearch('Förderung', null, { threshold: 1 }).map(t => t.source))
      .toEqual(['a.pdf']);
  });

  it('unbekannte Sprache erzwingt KEINEN Neuaufbau', () => {
    // Dieselbe Regel traegt die Ampel im Kurator-Bereich UND den erzwungenen
    // Vollaufbau im Indexer — ohne Beleg passiert in beiden Faellen nichts.
    expect(spracheVeraltet(null)).toBe(false);
    expect(spracheVeraltet('english')).toBe(true);
    expect(spracheVeraltet(INDEX_SPRACHE)).toBe(false);
  });

  it('spracheAusIndex liest die Sprache aus den Rohdaten, ohne zu raten', () => {
    expect(spracheAusIndex({ language: 'english' })).toBe('english');
    expect(spracheAusIndex({})).toBeNull();
    expect(spracheAusIndex(null)).toBeNull();
    expect(spracheAusIndex({ language: '' })).toBeNull();
    expect(spracheAusIndex({ language: 42 })).toBeNull();
  });

  it('ein Alt-Index bleibt lesbar UND meldet sich als veraltet', async () => {
    const geladen = await loadOramaFromDB(leseIdb({
      'orama-db': alterIndex(), 'orama-dimensions': 768,
    }), 768);

    // Kein Datenverlust: der Alt-Index wird geladen, nicht verworfen …
    expect(geladen).toBe(true);
    expect(getDocCount()).toBe(1);
    // … bleibt in sich stimmig (`load` setzt die Sprache zurueck) …
    expect(getIndexSprache()).toBe('english');
    // … und ist damit als aufzubauender Bestand erkennbar.
    expect(indexSpracheVeraltet()).toBe(true);
  });

  it('ein frisch gespeicherter Index kommt als aktuell zurueck', async () => {
    createOramaDB(768);
    insertDoc(doc('neu', 768));
    const rohdaten = save(getOramaDB()!) as unknown as Record<string, unknown>;
    expect(spracheAusIndex(rohdaten)).toBe(INDEX_SPRACHE);

    destroyOrama();
    await loadOramaFromDB(leseIdb({ 'orama-db': rohdaten, 'orama-dimensions': 768 }), 768);
    expect(indexSpracheVeraltet()).toBe(false);
  });
});

describe('orama-store: persistOramaSoon', () => {
  beforeEach(() => { vi.useFakeTimers(); destroyOrama(); createOramaDB(768); });
  afterEach(() => { vi.useRealTimers(); destroyOrama(); });

  it('koalesziert mehrere schnelle Aufrufe zu genau einem Schreibvorgang', async () => {
    const idb = fakeIdb();
    insertDoc(doc('a', 768));
    persistOramaSoon(idb);
    insertDoc(doc('b', 768));
    persistOramaSoon(idb);
    insertDoc(doc('c', 768));
    persistOramaSoon(idb);

    expect(idb.calls).toHaveLength(0); // nachlaufend, nicht sofort
    await vi.advanceTimersByTimeAsync(2000);
    await flushOramaPersist(idb);
    expect(idb.calls).toEqual(['orama-db']);
  });

  it('destroyOrama verwirft ein ausstehendes Speichern', async () => {
    const idb = fakeIdb();
    insertDoc(doc('a', 768));
    persistOramaSoon(idb);
    destroyOrama();
    await vi.advanceTimersByTimeAsync(2000);
    expect(idb.calls).toHaveLength(0);
  });
});

/**
 * Befund 7 der Bug-Jagd: `queryVector` WAEHLTE zwischen Wortlaut- und
 * Hybrid-Lauf, statt den zweiten hinzuzunehmen. Dieselbe Anfrage befragte damit
 * eine andere Dokumentmenge, obwohl die Beschriftung des Schalters „auch
 * aehnliche Themen" verspricht — an einem Index aus 400 echten Antragstexten mit
 * ihren echten Vektoren verlor „Sensorik" 4 der 20 Treffer.
 *
 * Die Fixtur unten reproduziert die Verdraengung im Kleinen: ein KURZER Text
 * (hoher BM25, Vektor orthogonal zur Anfrage) gegen 30 lange Texte (schwacher
 * BM25, perfekter Vektor). Mit dem alten Zweig-Wechsel verschwand `a.pdf` bei
 * jedem Limit; additiv behaelt es seinen Platz.
 */
describe('orama-store: hybridSearch nimmt hinzu, statt zu ersetzen', () => {
  const DIM = 8;
  const anfrageVektor = (() => { const v = new Array<number>(DIM).fill(0); v[0] = 1; return v; })();

  function dok(id: string, text: string, achse: number | null): Parameters<typeof insertDoc>[0] {
    const embedding = new Array<number>(DIM).fill(0);
    if (achse !== null) embedding[achse] = 1;
    return { id, text, title: `${id}.pdf`, source: `${id}.pdf`, tags: '', type: 'dokument', embedding };
  }

  beforeEach(() => {
    destroyOrama(); createOramaDB(DIM);
    insertDoc(dok('a', 'Sensorik', DIM - 1));
    for (let i = 0; i < 30; i++) {
      insertDoc(dok(`v${i}`, `Sensorik in einem sehr langen Text ueber viele voellig andere Dinge ${i}`, 0));
    }
  });
  afterEach(() => { destroyOrama(); });

  it.each([1, 2, 5])('bei Limit %i geht kein Wortlaut-Treffer verloren', (limit) => {
    const ohne = hybridSearch('Sensorik', null, { limit, maxPerDoc: 1, threshold: 0 }).map(t => t.source);
    const mit = hybridSearch('Sensorik', anfrageVektor, { limit, maxPerDoc: 1, threshold: 0 }).map(t => t.source);
    expect(ohne).toContain('a.pdf');
    for (const quelle of ohne) expect(mit).toContain(quelle);
  });

  it('das Limit bleibt gewahrt', () => {
    expect(hybridSearch('Sensorik', anfrageVektor, { limit: 3, maxPerDoc: 1, threshold: 0 }))
      .toHaveLength(3);
  });

  it('ohne Vektor bleibt die Methode „fulltext"', () => {
    expect(hybridSearch('Sensorik', null, { threshold: 0 }).every(t => t.method === 'fulltext'))
      .toBe(true);
  });
});

/**
 * Befund 10 der Bug-Jagd: ein Dokument liegt im Index NICHT unter seiner `docId`,
 * sondern als `docId-0`, `docId-1`, … — `removeDoc(docId)` fand nichts, schluckte
 * den Fehlschlag, und die Chunks blieben als Geister stehen, auffindbar unter dem
 * Namen einer Datei, die es nicht mehr gab.
 */
describe('orama-store: ein Dokument mit seinen Chunks entfernen', () => {
  const DIM = 8;
  const chunk = (id: string): Parameters<typeof insertDoc>[0] => ({
    id, text: 'Abschnitt zur Sensorik', title: 'VB.pdf', source: 'VB.pdf',
    tags: '', type: 'dokument', embedding: new Array<number>(DIM).fill(0),
  });

  beforeEach(() => { destroyOrama(); createOramaDB(DIM); setDocChunkIds({}); });
  afterEach(() => { destroyOrama(); setDocChunkIds({}); });

  it('nimmt alle Chunks des Dokuments aus dem Index', () => {
    for (const id of ['doc1-0', 'doc1-1', 'doc1-2', 'doc2-0']) insertDoc(chunk(id));
    setDocChunkIds({ doc1: ['doc1-0', 'doc1-1', 'doc1-2'], doc2: ['doc2-0'] });
    expect(getDocCount()).toBe(4);

    removeDocAndChunks('doc1');
    expect(getDocCount()).toBe(1);
    expect(hybridSearch('Sensorik', null, { threshold: 0 }).map(t => t.id)).toEqual(['doc2-0']);
  });

  it('vergisst die Zuordnung mit, damit ein zweiter Aufruf nicht ins Leere greift', () => {
    insertDoc(chunk('doc1-0'));
    setDocChunkIds({ doc1: ['doc1-0'] });
    removeDocAndChunks('doc1');
    expect(getDocChunkIds('doc1')).toEqual([]);
    expect(() => removeDocAndChunks('doc1')).not.toThrow();
  });

  // Der lazy Ablage-Pfad (`indexDocument`) legt tatsaechlich EINEN Datensatz unter
  // der reinen `docId` an — der muss weiter erreichbar bleiben.
  it('entfernt auch einen Datensatz, der unter der reinen docId liegt', () => {
    insertDoc(chunk('doc3'));
    removeDocAndChunks('doc3');
    expect(getDocCount()).toBe(0);
  });

  it('ohne bekannte Zuordnung bleibt es beim alten Verhalten', () => {
    insertDoc(chunk('doc4-0'));
    removeDocAndChunks('doc4');
    expect(getDocCount()).toBe(1); // nichts gefunden, nichts kaputt
  });
});

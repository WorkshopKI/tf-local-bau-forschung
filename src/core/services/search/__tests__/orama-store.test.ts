import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { create, insert, save } from '@orama/orama';
import {
  ensureOramaDB, createOramaDB, destroyOrama, getOramaDB, getCurrentDimensions,
  insertDoc, getDocCount, persistOramaSoon, flushOramaPersist,
  INDEX_SPRACHE, spracheAusIndex, spracheVeraltet, getIndexSprache, indexSpracheVeraltet,
  loadOramaFromDB, hybridSearch, type OramaDoc,
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

import { describe, it, expect } from 'vitest';
import type { IDBStore } from '@/core/services/storage';
import { INFOGRAFIK_SCHEMA_VERSION } from '../infografik/schema';
import { deleteEinreichung } from '../store';
import {
  leseMapAnalyse, mapBausteinKeys, mapBausteinPraefixe, mapCacheSchluessel,
} from '../vb/analyse-cache';

/** Minimaler In-Memory-IDB (nur die genutzten Methoden) — Muster aus `bausteine.test.ts`. */
function fakeIdb(): { store: Map<string, unknown>; idb: IDBStore } {
  const store = new Map<string, unknown>();
  const idb = {
    get: async <T>(k: string): Promise<T | null> => (store.has(k) ? (store.get(k) as T) : null),
    set: async (k: string, v: unknown): Promise<void> => { store.set(k, v); },
    delete: async (k: string): Promise<void> => { store.delete(k); },
    keys: async (prefix?: string): Promise<string[]> =>
      [...store.keys()].filter(k => !prefix || k.startsWith(prefix)),
  } as unknown as IDBStore;
  return { store, idb };
}

describe('mapBausteinKeys', () => {
  /**
   * Das Key-Schema ist der Vertrag mit allen bereits berechneten Ergebnissen im
   * Feld. Ändert es sich, verwaisen sie stillschweigend — dieser Test ist der
   * Regressionsschutz dagegen, deshalb wörtlich statt über die Bauer abgeleitet.
   *
   * Der Infografik-Key trägt seit dem Substanzcheck zusätzlich die Schemaversion
   * der Modell-Antwort. Dieses Verwaisen ist hier ausnahmsweise ERWÜNSCHT: eine
   * v1-Antwort kennt `widersprueche`/`unschaerfeBegriffe` nicht, passte aber
   * weiterhin zum unveränderten Korpus-Hash und bliebe ein gültiger Treffer mit
   * dauerhaft leeren Listen. Steckbrief und Aspekte sind unverändert — ihre
   * Feldmenge ist dieselbe geblieben.
   */
  it('haelt das gewachsene Key-Schema woertlich ein', () => {
    expect(mapBausteinKeys('E1', 'h1')).toEqual({
      steckbrief: 'aufbereitung:map:E1:steckbrief:h1',
      aspekte: 'aufbereitung:map:E1:aspekte:h1',
      infografik: `map:E1:infografik:v${INFOGRAFIK_SCHEMA_VERSION}:h1`,
    });
  });

  it('bindet den Infografik-Key an die Schemaversion', () => {
    // Sonst faellt die Versionierung bei einer spaeteren Umstellung still weg.
    expect(mapBausteinKeys('E1', 'h1').infografik).toContain(`:v${INFOGRAFIK_SCHEMA_VERSION}:`);
  });

  it('trennt Einreichungen und Korpus-Staende', () => {
    expect(mapBausteinKeys('E1', 'h1').steckbrief).not.toBe(mapBausteinKeys('E2', 'h1').steckbrief);
    expect(mapBausteinKeys('E1', 'h1').steckbrief).not.toBe(mapBausteinKeys('E1', 'h2').steckbrief);
  });

  it('mapCacheSchluessel traegt das Kollisions-Praefix gegen echte Antraege', () => {
    expect(mapCacheSchluessel('E1')).toBe('map:E1');
  });
});

describe('leseMapAnalyse', () => {
  const keys = mapBausteinKeys('E1', 'h1');

  it('liest alle drei Bausteine zurueck', async () => {
    const { idb, store } = fakeIdb();
    store.set(keys.steckbrief, { vbHash: 'h1', daten: { einSatz: { text: 'Ein Satz' } } });
    store.set(keys.aspekte, { vbHash: 'h1', daten: { zuordnung: { A: ['k-1'] }, fehlend: {} } });
    store.set(keys.infografik, { vbHash: 'h1', daten: { canvas: {}, sdtDelta: [], wirkungskette: {} } });

    const a = await leseMapAnalyse(idb, 'E1', 'h1');
    expect(a.steckbrief).toEqual({ einSatz: { text: 'Ein Satz' } });
    expect(a.aspekte).toEqual({ zuordnung: { A: ['k-1'] }, fehlend: {} });
    expect(a.infografik).toEqual({ canvas: {}, sdtDelta: [], wirkungskette: {} });
  });

  /** Ein Baustein kann degradiert und damit ungecacht sein — die anderen gelten trotzdem. */
  it('Teil-Treffer: fehlende Bausteine bleiben null', async () => {
    const { idb, store } = fakeIdb();
    store.set(keys.steckbrief, { vbHash: 'h1', daten: { einSatz: { text: 'Ein Satz' } } });

    const a = await leseMapAnalyse(idb, 'E1', 'h1');
    expect(a.steckbrief).not.toBeNull();
    expect(a.aspekte).toBeNull();
    expect(a.infografik).toBeNull();
  });

  it('geaenderter Korpus (anderer Hash) liefert nichts statt Veraltetem', async () => {
    const { idb, store } = fakeIdb();
    store.set(keys.steckbrief, { vbHash: 'h1', daten: { einSatz: { text: 'Alt' } } });

    const a = await leseMapAnalyse(idb, 'E1', 'h2');
    expect(a).toEqual({ steckbrief: null, aspekte: null, infografik: null });
  });

  it('leerer Store liefert drei nulls statt zu werfen', async () => {
    const { idb } = fakeIdb();
    await expect(leseMapAnalyse(idb, 'E1', 'h1')).resolves.toEqual({
      steckbrief: null, aspekte: null, infografik: null,
    });
  });

  it('fremde Einreichung wird nicht mitgelesen', async () => {
    const { idb, store } = fakeIdb();
    const fremd = mapBausteinKeys('E2', 'h1');
    store.set(fremd.steckbrief, { vbHash: 'h1', daten: { einSatz: { text: 'Fremd' } } });

    expect((await leseMapAnalyse(idb, 'E1', 'h1')).steckbrief).toBeNull();
  });
});

describe('mapBausteinPraefixe', () => {
  it('deckt beide Key-Schemata ab', () => {
    expect(mapBausteinPraefixe('E1')).toEqual(['aufbereitung:map:E1:', 'map:E1:infografik:']);
  });

  /**
   * Der abschliessende Doppelpunkt trennt `E1` von `E10`. Ohne ihn risse das
   * Löschen einer Einreichung die Ergebnisse einer anderen mit.
   */
  it('trifft keine Einreichung, deren Id mit derselben Zeichenfolge beginnt', async () => {
    const { idb, store } = fakeIdb();
    const e1 = mapBausteinKeys('E1', 'h1');
    const e10 = mapBausteinKeys('E10', 'h1');
    store.set(e1.steckbrief, { vbHash: 'h1', daten: {} });
    store.set(e1.infografik, { vbHash: 'h1', daten: {} });
    store.set(e10.steckbrief, { vbHash: 'h1', daten: {} });
    store.set(e10.infografik, { vbHash: 'h1', daten: {} });

    const getroffen: string[] = [];
    for (const p of mapBausteinPraefixe('E1')) getroffen.push(...await idb.keys(p));

    expect(getroffen.sort()).toEqual([e1.infografik, e1.steckbrief].sort());
  });
});

/**
 * Die KI-Ergebnisse sind Cache UND Persistenz — beim Löschen einer Einreichung
 * müssen sie mitgehen, sonst bleiben VB-Inhalte einer gelöschten Prüfung liegen.
 */
describe('deleteEinreichung raeumt die KI-Caches ab', () => {
  it('loescht alle Hash-Staende der Einreichung und laesst fremde unberuehrt', async () => {
    const { idb, store } = fakeIdb();
    // Zwei Korpus-Stände derselben Einreichung — beide sind nach dem Löschen wertlos.
    const alt = mapBausteinKeys('E1', 'h1');
    const neu = mapBausteinKeys('E1', 'h2');
    const fremd = mapBausteinKeys('E10', 'h1');
    for (const k of [...Object.values(alt), ...Object.values(neu), ...Object.values(fremd)]) {
      store.set(k, { vbHash: 'h1', daten: {} });
    }
    store.set('map-einreichung:E1', { id: 'E1' });
    store.set('map-einreichung:E10', { id: 'E10' });

    await deleteEinreichung(idb, 'E1');

    for (const k of [...Object.values(alt), ...Object.values(neu)]) expect(store.has(k)).toBe(false);
    for (const k of Object.values(fremd)) expect(store.has(k)).toBe(true);
    expect(store.has('map-einreichung:E1')).toBe(false);
    expect(store.has('map-einreichung:E10')).toBe(true);
  });
});

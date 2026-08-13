/**
 * Cold-Start-Guard fuer die kuerzel-map (v2.46.1).
 *
 * Regression gegen das leere Match-Panel (Anträge zuweisen, pl-Build): Der
 * Plugin-onInit ruft `useKuerzelMap.load()` VOR dem StartupScreen-Share-Grant.
 * `loadKuerzelMap` schluckt den Permission-Fehler still und liefert
 * `emptyKuerzelMap()`. Ohne das `isDatenShareReadable`-Gate friert der
 * `if (loaded) return;`-Guard die leere Map fest → leere anonymMap → leere
 * historischeDeskriptorenByAnon → matching-engine.ts:189 skippt jeden nicht-
 * onboarded MA → "Keine passenden MAs gefunden", bis zum Browser-Reload.
 * Gleiche Bugklasse + Fix wie useAuslastungData.load (v2.19.2).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadKuerzelMapSpy = vi.fn();
vi.mock('../services/identitaet', async (importActual) => {
  const actual = await importActual<typeof import('../services/identitaet')>();
  return { ...actual, loadKuerzelMapLage: () => loadKuerzelMapSpy() };
});

const readableSpy = vi.fn();
vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  isDatenShareReadable: () => readableSpy(),
}));

import { useKuerzelMap } from '../hooks/useKuerzelMap';
import { emptyKuerzelMap, type KuerzelMapFile } from '../services/identitaet';

const fakeStorage = { idb: {} } as never;

function mapWith(kuerzel: string[]): KuerzelMapFile {
  const now = '2026-06-08T00:00:00.000Z';
  return {
    version: 1,
    updatedAt: now,
    entries: kuerzel.map((k, i) => ({
      kuerzel: k,
      anonId: `MA${String(i + 1).padStart(2, '0')}`,
      createdAt: now,
    })),
  };
}

describe('useKuerzelMap.load — Cold-Start-Guard (isDatenShareReadable)', () => {
  beforeEach(() => {
    loadKuerzelMapSpy.mockReset();
    readableSpy.mockReset();
    useKuerzelMap.setState({
      file: emptyKuerzelMap(),
      loaded: false,
      loading: false,
      saving: false,
      unlesbar: false,
      error: null,
    });
  });

  it('armt loaded NICHT, wenn der Daten-Share (noch) nicht lesbar ist (pre-grant)', async () => {
    loadKuerzelMapSpy.mockResolvedValue({ status: 'leer', map: emptyKuerzelMap() }); // still-geschluckter Permission-Fehler
    readableSpy.mockResolvedValue(false);

    await useKuerzelMap.getState().load(fakeStorage);

    // loaded bleibt false → der Post-Grant-Mount darf erneut laden.
    expect(useKuerzelMap.getState().loaded).toBe(false);
  });

  it('lädt + armt loaded, wenn der Share lesbar ist und die Map gefüllt ist', async () => {
    loadKuerzelMapSpy.mockResolvedValue({ status: 'ok', map: mapWith(['MUE', 'SCH']) });
    readableSpy.mockResolvedValue(true);

    await useKuerzelMap.getState().load(fakeStorage);

    expect(useKuerzelMap.getState().loaded).toBe(true);
    expect(useKuerzelMap.getState().file.entries.length).toBe(2);
  });

  it('Retry nach Grant füllt die Map, nachdem der pre-grant-Load leer blieb', async () => {
    // 1. pre-grant: leer + nicht lesbar → loaded bleibt false
    loadKuerzelMapSpy.mockResolvedValueOnce({ status: 'leer', map: emptyKuerzelMap() });
    readableSpy.mockResolvedValueOnce(false);
    await useKuerzelMap.getState().load(fakeStorage);
    expect(useKuerzelMap.getState().loaded).toBe(false);
    expect(useKuerzelMap.getState().file.entries.length).toBe(0);

    // 2. post-grant Retry (Guard greift NICHT, weil loaded:false) → echte Map
    loadKuerzelMapSpy.mockResolvedValueOnce({ status: 'ok', map: mapWith(['MUE']) });
    readableSpy.mockResolvedValueOnce(true);
    await useKuerzelMap.getState().load(fakeStorage);
    expect(useKuerzelMap.getState().loaded).toBe(true);
    expect(useKuerzelMap.getState().file.entries.length).toBe(1);
  });
});

describe('useKuerzelMap — unlesbare Sidecar sperrt den Write (v4.12)', () => {
  beforeEach(() => {
    loadKuerzelMapSpy.mockReset();
    readableSpy.mockReset();
    useKuerzelMap.setState({
      file: emptyKuerzelMap(), loaded: false, loading: false, saving: false,
      unlesbar: false, error: null,
    });
  });

  it('unlesbar → loaded bleibt false, unlesbar wird gesetzt, Map bleibt leer', async () => {
    loadKuerzelMapSpy.mockResolvedValue({ status: 'unlesbar' });
    readableSpy.mockResolvedValue(true);

    await useKuerzelMap.getState().load(fakeStorage);

    expect(useKuerzelMap.getState().loaded).toBe(false);
    expect(useKuerzelMap.getState().unlesbar).toBe(true);
    expect(useKuerzelMap.getState().error).toMatch(/nicht lesbar/);
  });

  it('syncWithAntraege schreibt NICHT nach einem unlesbaren Lesevorgang', async () => {
    // Der Kern von Pitfall #18: `saveKuerzelMap` ersetzt die Datei vollstaendig.
    // Auf einer leeren Notbehelf-Map bootstrappt der Sync neu — jede vergebene
    // anonId verschiebt sich, und Profile/Zuweisungen gehoeren lautlos zu
    // anderen Personen. Also: gar nicht erst schreiben.
    loadKuerzelMapSpy.mockResolvedValue({ status: 'unlesbar' });
    readableSpy.mockResolvedValue(true);
    await useKuerzelMap.getState().load(fakeStorage);

    const antraege = [{ tib_kuerz: 'MUE' }, { tib_kuerz: 'SCH' }] as never;
    const res = await useKuerzelMap.getState().syncWithAntraege(fakeStorage, antraege);

    expect(res).toEqual({ added: [] });
    expect(useKuerzelMap.getState().file.entries).toHaveLength(0);
  });

  it('syncWithAntraege schreibt auch dann NICHT, wenn noch gar nicht geladen wurde', async () => {
    // Zweites Loch derselben Klasse: ohne durchgelaufenen `load` ist `file` der
    // leere Anfangswert — ihn zurueckzuschreiben haette denselben Effekt.
    const antraege = [{ tib_kuerz: 'MUE' }] as never;
    const res = await useKuerzelMap.getState().syncWithAntraege(fakeStorage, antraege);
    expect(res).toEqual({ added: [] });
  });
});

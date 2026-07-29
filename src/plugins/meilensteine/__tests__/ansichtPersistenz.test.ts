import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ladeBereich, ladeTab, ladeUebersichtFilter, ladeWocheNurMeine,
  speichereBereich, speichereTab, speichereUebersichtFilter, speichereWocheNurMeine,
} from '@/plugins/meilensteine/ansichtPersistenz';
import { LEERER_FILTER, standardBereich } from '@/plugins/meilensteine/monitoringLogic';

const KEY = 'teamflow_meilensteine_ansicht';

/** Node-Testumgebung hat kein localStorage — einfacher In-Memory-Stub. */
function installLocalStorageStub(): void {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

beforeEach(installLocalStorageStub);
afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

describe('Ansicht der Meilenstein-Seite — Standard beim ersten Besuch', () => {
  it('startet auf der Arbeitsliste, nicht auf der Übersicht', () => {
    expect(ladeTab()).toBe('woche');
  });

  it('belegt den Zeitraum mit den letzten drei Jahren vor', () => {
    expect(ladeBereich(2026)).toEqual(standardBereich(2026));
    expect(ladeBereich(2026)).toEqual({ von: '2024-01-01', bis: '2026-12-31' });
  });

  it('ignoriert einen unter der alten Bedeutung gespeicherten Zeitraum', () => {
    // Vor v2.358 galt der Zeitraum nicht für „Diese Woche" und war nur ein Jahr
    // breit. Ein alter Wert darf die neue Vorbelegung nicht überstimmen — sonst
    // sähen ausgerechnet die aktivsten Nutzer die Änderung nicht.
    localStorage.setItem(
      'teamflow_meilensteine_ansicht',
      JSON.stringify({ tab: 'woche', bereich: { von: '2026-01-01', bis: '2026-12-31' } }),
    );
    expect(ladeBereich(2026)).toEqual(standardBereich(2026));
    expect(ladeTab()).toBe('woche');   // der Rest der Ansicht bleibt erhalten
  });

  it('schaltet „nur meine" ein, sobald ein eigenes Kürzel gesetzt ist', () => {
    expect(ladeUebersichtFilter(true).nurMeine).toBe(true);
    expect(ladeWocheNurMeine(true)).toBe(true);
  });

  it('lässt „nur meine" ohne eigenes Kürzel aus — sonst wäre alles ausgeblendet', () => {
    expect(ladeUebersichtFilter(false)).toEqual(LEERER_FILTER);
    expect(ladeWocheNurMeine(false)).toBe(false);
  });
});

describe('Ansicht der Meilenstein-Seite — Merken und Wiederherstellen', () => {
  it('merkt den zuletzt gewählten Tab', () => {
    speichereTab('auswertung');
    expect(ladeTab()).toBe('auswertung');
  });

  it('merkt einen taggenauen Zeitraum', () => {
    speichereBereich({ von: '2025-04-01', bis: '2025-06-30' });
    expect(ladeBereich(2026)).toEqual({ von: '2025-04-01', bis: '2025-06-30' });
  });

  it('merkt „Alle Eingänge" als bewusste Wahl — nicht als „nichts gespeichert"', () => {
    // Der springende Punkt: `null` darf beim nächsten Laden NICHT still zum
    // Jahres-Standard zurückfallen.
    speichereBereich(null);
    expect(ladeBereich(2026)).toBeNull();
  });

  it('merkt die Pills der Übersicht, den Suchtext aber bewusst nicht', () => {
    speichereUebersichtFilter({
      suche: 'wasserstoff', typen: ['DS'], prognosen: ['gefaehrdet'], nurMeine: false,
    });
    expect(ladeUebersichtFilter(true)).toEqual({
      suche: '', typen: ['DS'], prognosen: ['gefaehrdet'], nurMeine: false,
    });
  });

  it('hält das Abwählen von „nur meine" fest — der Standard überschreibt es nicht', () => {
    speichereUebersichtFilter({ ...LEERER_FILTER, nurMeine: false });
    speichereWocheNurMeine(false);
    expect(ladeUebersichtFilter(true).nurMeine).toBe(false);
    expect(ladeWocheNurMeine(true)).toBe(false);
  });

  it('hält die Werte auseinander — ein Schreiben löscht die anderen nicht', () => {
    speichereTab('uebersicht');
    speichereBereich(null);
    speichereWocheNurMeine(true);
    speichereUebersichtFilter({ ...LEERER_FILTER, typen: ['NW'] });
    expect(ladeTab()).toBe('uebersicht');
    expect(ladeBereich(2026)).toBeNull();
    expect(ladeWocheNurMeine(true)).toBe(true);
    expect(ladeUebersichtFilter(true).typen).toEqual(['NW']);
  });
});

describe('Ansicht der Meilenstein-Seite — defensiv gegen kaputte Werte', () => {
  it('fällt bei unlesbarem Speicher auf die Standards zurück', () => {
    localStorage.setItem(KEY, '{kein json');
    expect(ladeTab()).toBe('woche');
    expect(ladeBereich(2026)).toEqual(standardBereich(2026));
    expect(ladeUebersichtFilter(false)).toEqual(LEERER_FILTER);
  });

  it('verwirft einen unbekannten Tab', () => {
    localStorage.setItem(KEY, JSON.stringify({ tab: 'gibtsnicht' }));
    expect(ladeTab()).toBe('woche');
  });

  it('verwirft einen Zeitraum ohne saubere ISO-Grenzen', () => {
    localStorage.setItem(KEY, JSON.stringify({ bereich: { von: '01.01.2025', bis: 'heute' } }));
    expect(ladeBereich(2026)).toEqual(standardBereich(2026));
  });

  it('lässt Typen und Prognosen weg, die es nicht mehr gibt', () => {
    localStorage.setItem(KEY, JSON.stringify({
      uebersicht: { typen: ['DS', 'ABGESCHAFFT'], prognosen: ['imPlan', 'weg'], nurMeine: true },
    }));
    const filter = ladeUebersichtFilter(true);
    expect(filter.typen).toEqual(['DS']);
    expect(filter.prognosen).toEqual(['imPlan']);
  });

  it('blendet ein gespeichertes „nur meine" aus, wenn das Kürzel weg ist', () => {
    speichereUebersichtFilter({ ...LEERER_FILTER, nurMeine: true });
    speichereWocheNurMeine(true);
    expect(ladeUebersichtFilter(false).nurMeine).toBe(false);
    expect(ladeWocheNurMeine(false)).toBe(false);
  });
});

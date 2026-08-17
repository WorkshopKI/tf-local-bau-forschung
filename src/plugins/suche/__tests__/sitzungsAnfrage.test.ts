/**
 * Der Sitzungs-Spiegel der Suchanfrage (siehe `sitzungsAnfrage.ts`).
 *
 * Der Punkt der Tests ist die Toleranz: Fremdinhalt darf nie zu einem halb
 * geladenen Zustand führen. Ein kaputter Frageplan wäre der teuerste Fall — die
 * Deutungszeile beschriebe dann eine andere Frage als die im Feld.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  liesFacettenWahl, liesFrageplan, liesQuery, liesWortliste, merke,
  S_BEGRIFFE, S_FACETTEN, S_PLAN, S_QUERY, S_WOERTER,
} from '../sitzungsAnfrage';
import { LEERE_WAHL } from '../facetten';

const PLAN = {
  frage: 'Was läuft in Bayern zum Thema Leichtbau?',
  leitbegriffe: [
    { begriff: 'Leichtbau', nadeln: ['leichtbau'], pflicht: false },
    { begriff: 'Bayern', nadeln: ['bayern', 'by'], pflicht: true },
  ],
  facetten: { status: [], jahr: [] },
  ignoriert: [],
};

// Vitest läuft node-only (siehe vitest.config.mts) — Speicher wie im Rest der
// Suite per stubGlobal, nicht per jsdom-Environment.
beforeEach(() => {
  const ablage = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => ablage.get(k) ?? null,
    setItem: (k: string, v: string) => { ablage.set(k, v); },
    removeItem: (k: string) => { ablage.delete(k); },
    clear: () => { ablage.clear(); },
  });
});

describe('merke + liesQuery', () => {
  it('merkt die Anfrage und liest sie zurück', () => {
    merke(S_QUERY, 'laser');
    expect(liesQuery()).toBe('laser');
  });

  it('löscht bei leerer Anfrage statt sie zu merken', () => {
    merke(S_QUERY, 'laser');
    merke(S_QUERY, '');
    expect(sessionStorage.getItem(S_QUERY)).toBeNull();
    expect(liesQuery()).toBe('');
  });

  it('liest Fremdinhalt als leere Anfrage', () => {
    sessionStorage.setItem(S_QUERY, '{kein json');
    expect(liesQuery()).toBe('');
    sessionStorage.setItem(S_QUERY, '42');
    expect(liesQuery()).toBe('');
  });
});

describe('liesWortliste', () => {
  it('liest die Abwahl zurück', () => {
    merke(S_WOERTER, ['laser', 'strich']);
    expect(liesWortliste(S_WOERTER)).toEqual(['laser', 'strich']);
    expect(liesWortliste(S_BEGRIFFE)).toEqual([]);
  });

  it('verwirft alles, was keine reine Wortliste ist', () => {
    for (const roh of ['{}', '"laser"', '[1,2]', '[null]', '[["a"]]', 'kein json']) {
      sessionStorage.setItem(S_WOERTER, roh);
      expect(liesWortliste(S_WOERTER), roh).toEqual([]);
    }
  });
});

describe('liesFacettenWahl', () => {
  it('liest gesetzte Facetten zurück', () => {
    merke(S_FACETTEN, { ...LEERE_WAHL, jahr: ['2024'] });
    expect(liesFacettenWahl().jahr).toEqual(['2024']);
    expect(liesFacettenWahl().status).toEqual([]);
  });

  it('übernimmt nur bekannte Facetten-Ids', () => {
    // Eine Facette, die es nicht mehr gibt, filterte sonst unsichtbar weiter.
    sessionStorage.setItem(S_FACETTEN, JSON.stringify({ jahr: ['2024'], erfunden: ['x'] }));
    const wahl = liesFacettenWahl() as Record<string, unknown>;
    expect(wahl.jahr).toEqual(['2024']);
    expect(wahl.erfunden).toBeUndefined();
  });

  it('fällt bei Fremdinhalt auf die leere Wahl zurück', () => {
    for (const roh of ['[]', '"status"', '7', 'kein json', '{"jahr":"2024"}']) {
      sessionStorage.setItem(S_FACETTEN, roh);
      expect(liesFacettenWahl(), roh).toEqual(LEERE_WAHL);
    }
  });
});

describe('liesFrageplan', () => {
  it('liest einen vollständigen Plan zurück', () => {
    merke(S_PLAN, PLAN);
    expect(liesFrageplan()).toEqual(PLAN);
  });

  it('verwirft einen Plan, dem etwas Gelesenes fehlt', () => {
    const kaputt: unknown[] = [
      { ...PLAN, frage: '' },
      { ...PLAN, frage: 7 },
      { ...PLAN, leitbegriffe: [] },
      { ...PLAN, leitbegriffe: ['Leichtbau'] },
      { ...PLAN, leitbegriffe: [{ begriff: 'Leichtbau' }] },
      { ...PLAN, leitbegriffe: [{ begriff: 'L', nadeln: ['l'] }] }, // pflicht fehlt
      { ...PLAN, facetten: {} },
      { ...PLAN, facetten: { status: [], jahr: 2024 } },
      { ...PLAN, ignoriert: 'nichts' },
    ];
    for (const p of kaputt) {
      sessionStorage.setItem(S_PLAN, JSON.stringify(p));
      expect(liesFrageplan(), JSON.stringify(p)).toBeNull();
    }
  });

  it('kein Plan gemerkt heißt Stichwortsuche', () => {
    expect(liesFrageplan()).toBeNull();
    merke(S_PLAN, null);
    expect(liesFrageplan()).toBeNull();
  });
});

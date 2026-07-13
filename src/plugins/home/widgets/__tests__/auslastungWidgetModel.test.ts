/**
 * Tests für die reinen Modell-Helfer des Auslastungs-Mini-Widgets (Phase 2):
 * Sicht-Ableitung + Override, Vorquartal, Ich-Balkenmodell (inkl. Überbuchung),
 * Team-Aggregat (Summe nur aktive MAs, „N von M über 100 %", Bänder-Summe,
 * leerer MA), Katalog-Verankerung.
 */
import { describe, expect, it } from 'vitest';
import type { AnonymerMitarbeiter } from '@/plugins/auslastung/types';
import type {
  KapazitaetsView,
  MaAltlastBucket,
  QuartalsStatistik,
} from '@/plugins/auslastung/services/kapazitaet';
import {
  ermittleSicht,
  ichBalkenModell,
  teamAggregat,
  vorherigesQuartal,
} from '../auslastungWidgetModel';
import { WIDGET_KATALOG } from '../widgetCatalog';

describe('ermittleSicht', () => {
  it('auto: mit Kürzel → ich, „alle"/kein Kürzel → team', () => {
    expect(ermittleSicht('auto', 'MA01')).toBe('ich');
    expect(ermittleSicht('auto', null)).toBe('team');
  });
  it('Override erzwingt die Sicht (auch entgegen dem Kürzel-Modus)', () => {
    expect(ermittleSicht('team', 'MA01')).toBe('team'); // PL mit Kürzel, will Team
    expect(ermittleSicht('ich', null)).toBe('ich');     // ich ohne Kürzel → Hinweis später
  });
});

describe('vorherigesQuartal', () => {
  it('jahresübergreifend', () => {
    expect(vorherigesQuartal('2026-Q3')).toBe('2026-Q2');
    expect(vorherigesQuartal('2026-Q1')).toBe('2025-Q4');
    expect(vorherigesQuartal('quatsch')).toBeNull();
  });
});

const kapView = (verbrauchteStunden: number, effektivStunden: number): KapazitaetsView => ({
  effektivStunden,
  fest: { antraege: 0, tvs: 5, stunden: 45 },
  pending: { antraege: 0, tvs: 3, stunden: 27 },
  verbrauchteStunden,
  restStunden: effektivStunden - verbrauchteStunden,
  restTVs: 3,
  ueberbuchung: Math.max(0, verbrauchteStunden - effektivStunden),
});

const altlast = (tvs: number, band: [number, number, number]): MaAltlastBucket =>
  ({ antraege: 0, tvs, stunden: 0, tvsProBand: band, quartale: [], verbuende: [] } as unknown as MaAltlastBucket);

describe('ichBalkenModell', () => {
  it('leitet Prozent + TV-Zahlen ab', () => {
    const m = ichBalkenModell(kapView(72, 100), altlast(12, [4, 3, 5]), 9);
    expect(m.belegtPct).toBe(72);
    expect(m.belegteTVs).toBe(8);        // fest.tvs 5 + pending.tvs 3
    expect(m.freiTVs).toBe(3);
    expect(m.gesamtTVs).toBe(11);        // belegt 8 + frei 3
    expect(m.altlastTvs).toBe(12);
    expect(m.altlastBandTvs).toEqual([4, 3, 5]);
    expect(m.altlastBandPct).toEqual([36, 27, 45]); // (tv*9/100)*100
  });

  it('Überbuchung: belegtPct > 100 (ungekappt, Danger-Farbe der Vollansicht)', () => {
    const m = ichBalkenModell(kapView(120, 100), undefined, 9);
    expect(m.belegtPct).toBe(120);
    expect(m.altlastTvs).toBe(0);
    expect(m.altlastBandPct).toEqual([0, 0, 0]);
  });
});

const statFixture: QuartalsStatistik = {
  quartal: { label: '2026-Q3', tagAktuell: 1, tageGesamt: 92, fortschrittProzent: 1 },
  ma: { aktiv: 3, gesamt: 4, abgemeldet: 0, ohneBuchungen: 0 },
  kapazitaet: { effektivStunden: 300, verbrauchteStunden: 240, freiStunden: 60, prozent: 80 },
  antraege: { fest: 0, festTvs: 30, pending: 0, pendingTvs: 11, freieTVs: 9 },
  warnungen: { ueberbuchteMAs: ['MA01', 'MA02'], leereMAs: [] },
  kategorienVerteilung: [],
};

const ma = (anonId: string, aktiv: boolean): AnonymerMitarbeiter =>
  ({ anonId, aktiv } as unknown as AnonymerMitarbeiter);

describe('teamAggregat', () => {
  const mitarbeiter: Record<string, AnonymerMitarbeiter> = {
    MA01: ma('MA01', true),
    MA02: ma('MA02', true),
    MA03: ma('MA03', false), // inaktiv → NICHT summiert
    MA04: ma('MA04', true),  // aktiv, aber nicht in der Altlast-Map → übersprungen, kein Crash
  };
  const altlastByAnon = new Map<string, MaAltlastBucket>([
    ['MA01', altlast(4, [2, 1, 1])],
    ['MA02', altlast(8, [2, 2, 4])],
    ['MA03', altlast(100, [50, 25, 25])], // inaktiv → ignoriert
  ]);

  it('summiert Altlast nur über aktive MAs (leerer MA egal), Bänder korrekt', () => {
    const agg = teamAggregat(statFixture, altlastByAnon, mitarbeiter, 9);
    expect(agg.altlastTvs).toBe(12);              // 4 + 8 (MA03 inaktiv, MA04 fehlt)
    expect(agg.altlastBandTvs).toEqual([4, 3, 5]); // [2+2, 1+2, 1+4]
    expect(agg.altlastBandPct).toEqual([12, 9, 15]); // (band*9/300)*100
  });

  it('Belegung + TV-Zahlen + „N von M über 100 %" aus der Statistik', () => {
    const agg = teamAggregat(statFixture, altlastByAnon, mitarbeiter, 9);
    expect(agg.belegtPct).toBe(80);
    expect(agg.belegteTVs).toBe(41);   // festTvs 30 + pendingTvs 11
    expect(agg.freiTVs).toBe(9);
    expect(agg.gesamtTVs).toBe(50);    // 41 + 9
    expect(agg.ueberMaCount).toBe(2);
    expect(agg.aktivMaCount).toBe(3);
  });
});

describe('Katalog-Verankerung des Auslastungs-Widgets', () => {
  it('ist ein Seiten-Widget mit Auto-Sicht + Vergleich als Default', () => {
    const eintrag = WIDGET_KATALOG.auslastung;
    expect(eintrag.bereich).toBe('seite');
    expect(eintrag.verfuegbar).toBe(true);
    expect(eintrag.defaultConfig()).toEqual({ art: 'auslastung', sicht: 'auto', vergleichAnzeigen: true });
  });
});

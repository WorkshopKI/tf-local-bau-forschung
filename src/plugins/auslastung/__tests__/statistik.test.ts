/**
 * Tests fuer statistik.ts (v2.6).
 *
 * Schwerpunkte:
 *  1. `tageVergangenImQuartal` — Datums-Helper
 *  2. `computeQuartalsStatistik` — Aggregation ueber MAs
 *  3. Warnungen (ueberbucht, leer)
 *  4. Kategorien-Verteilung
 */
import { describe, it, expect } from 'vitest';
import { computeQuartalsStatistik, tageVergangenImQuartal } from '../services/statistik';
import {
  DEFAULT_AUSLASTUNG_CONFIG,
  type AnonymerMitarbeiter,
  type AuslastungConfig,
  type UeberKategorie,
} from '../types';
import type { MaQuartalsAuslastung, MaQuartalsBucket } from '../services/quartals-auslastung';

function makeMa(overrides: Partial<AnonymerMitarbeiter> = {}): AnonymerMitarbeiter {
  return {
    anonId: 'MA01',
    jahresKapazitaet: 800,
    abgemeldet: [],
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie: 'IT',
    nebenKategorien: [],
    abschlagProzent: 0,
    ueberKategorien: ['IT'],
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv: true,
    ...overrides,
  };
}

function makeBucket(overrides: Partial<MaQuartalsBucket> = {}): MaQuartalsBucket {
  return {
    antraege: 0,
    tvs: 0,
    stunden: 0,
    aktenzeichenSet: new Set<string>(),
    verbuende: [],
    ...overrides,
  };
}

function makeAuslastung(
  fest: Partial<MaQuartalsBucket> = {},
  pending: Partial<MaQuartalsBucket> = {},
): MaQuartalsAuslastung {
  return { fest: makeBucket(fest), pending: makeBucket(pending) };
}

function makeConfig(kats: UeberKategorie[] = []): AuslastungConfig {
  return {
    ...DEFAULT_AUSLASTUNG_CONFIG,
    ueberKategorien: kats,
  };
}

function makeKategorie(id: string, name: string): UeberKategorie {
  return { id, name, farbe: 'blue', deskriptorenMapping: [] };
}

describe('tageVergangenImQuartal', () => {
  it('Q2 2026 Mitte April → ~15 Tage von 91', () => {
    const r = tageVergangenImQuartal('2026-Q2', new Date(2026, 3, 15, 12, 0, 0));
    expect(r.tageGesamt).toBe(91);
    expect(r.tagAktuell).toBe(15);
  });

  it('Q1 → 90 Tage gesamt (2026 ist kein Schaltjahr)', () => {
    const r = tageVergangenImQuartal('2026-Q1', new Date(2026, 0, 1, 12, 0, 0));
    expect(r.tageGesamt).toBe(90);
    expect(r.tagAktuell).toBe(1);
  });

  it('Q3 → 92 Tage gesamt', () => {
    const r = tageVergangenImQuartal('2026-Q3', new Date(2026, 6, 1, 12, 0, 0));
    expect(r.tageGesamt).toBe(92);
    expect(r.tagAktuell).toBe(1);
  });

  it('Heute vor dem Quartal → 0', () => {
    const r = tageVergangenImQuartal('2026-Q2', new Date(2026, 0, 15, 12, 0, 0));
    expect(r.tagAktuell).toBe(0);
  });

  it('Heute nach dem Quartal → tageGesamt', () => {
    const r = tageVergangenImQuartal('2026-Q2', new Date(2026, 9, 15, 12, 0, 0));
    expect(r.tagAktuell).toBe(91);
  });

  it('Ungueltiges Quartal → 0/0', () => {
    expect(tageVergangenImQuartal('foo', new Date())).toEqual({ tagAktuell: 0, tageGesamt: 0 });
  });
});

describe('computeQuartalsStatistik', () => {
  it('leere Eingabe → alles 0', () => {
    const s = computeQuartalsStatistik({}, new Map(), makeConfig(), '2026-Q2', 0, new Date(2026, 3, 15));
    expect(s.ma.aktiv).toBe(0);
    expect(s.ma.gesamt).toBe(0);
    expect(s.kapazitaet.effektivStunden).toBe(0);
    expect(s.kapazitaet.verbrauchteStunden).toBe(0);
    expect(s.antraege.fest).toBe(0);
    expect(s.warnungen.ueberbuchteMAs).toEqual([]);
    expect(s.warnungen.leereMAs).toEqual([]);
  });

  it('aktive vs. inaktive MAs trennen', () => {
    const mitarbeiter = {
      MA01: makeMa({ anonId: 'MA01', aktiv: true }),
      MA02: makeMa({ anonId: 'MA02', aktiv: false }),
      MA03: makeMa({ anonId: 'MA03', aktiv: true }),
    };
    const s = computeQuartalsStatistik(mitarbeiter, new Map(), makeConfig(), '2026-Q2', 0);
    expect(s.ma.aktiv).toBe(2);
    expect(s.ma.gesamt).toBe(3);
  });

  it('inaktive Kapazität wird NICHT aufsummiert', () => {
    const mitarbeiter = {
      MA01: makeMa({ anonId: 'MA01', aktiv: true, jahresKapazitaet: 800 }),  // 200 h/Q
      MA02: makeMa({ anonId: 'MA02', aktiv: false, jahresKapazitaet: 800 }), // ausgeschlossen
    };
    const s = computeQuartalsStatistik(mitarbeiter, new Map(), makeConfig(), '2026-Q2', 0);
    expect(s.kapazitaet.effektivStunden).toBe(200);
  });

  it('abgemeldete im Quartal werden gezählt', () => {
    const mitarbeiter = {
      MA01: makeMa({ anonId: 'MA01', abgemeldet: ['2026-Q2'] }),
      MA02: makeMa({ anonId: 'MA02', abgemeldet: ['2026-Q1'] }),  // anderes Quartal
      MA03: makeMa({ anonId: 'MA03', abgemeldet: [] }),
    };
    const s = computeQuartalsStatistik(mitarbeiter, new Map(), makeConfig(), '2026-Q2', 0);
    expect(s.ma.abgemeldet).toBe(1);
  });

  it('Stunden-Bilanz: fest + pending summieren', () => {
    const mitarbeiter = {
      MA01: makeMa({ anonId: 'MA01', jahresKapazitaet: 800 }),  // 200 h/Q
    };
    const auslastung = new Map<string, MaQuartalsAuslastung>([
      ['MA01', makeAuslastung(
        { antraege: 1, tvs: 4, stunden: 36 },
        { antraege: 1, tvs: 1, stunden: 9 },
      )],
    ]);
    const s = computeQuartalsStatistik(mitarbeiter, auslastung, makeConfig(), '2026-Q2', 0);
    expect(s.kapazitaet.verbrauchteStunden).toBe(45);
    expect(s.kapazitaet.freiStunden).toBe(155);
    expect(s.kapazitaet.prozent).toBe(23);  // round(45/200*100)
    expect(s.antraege.fest).toBe(1);
    expect(s.antraege.festTvs).toBe(4);
    expect(s.antraege.pending).toBe(1);
    expect(s.antraege.pendingTvs).toBe(1);
    expect(s.antraege.freieTVs).toBe(17);  // floor(155/9)
  });

  it('überbuchte MAs werden gelistet', () => {
    const mitarbeiter = {
      MA01: makeMa({ anonId: 'MA01', jahresKapazitaet: 100 }),  // 25 h/Q
      MA02: makeMa({ anonId: 'MA02', jahresKapazitaet: 800 }),  // 200 h/Q
    };
    const auslastung = new Map<string, MaQuartalsAuslastung>([
      ['MA01', makeAuslastung({ stunden: 36 })],  // ueberbucht!
      ['MA02', makeAuslastung({ stunden: 36 })],  // ok
    ]);
    const s = computeQuartalsStatistik(mitarbeiter, auslastung, makeConfig(), '2026-Q2', 0);
    expect(s.warnungen.ueberbuchteMAs).toEqual(['MA01']);
  });

  it('leere MAs (kein fest, kein pending) werden gelistet', () => {
    const mitarbeiter = {
      MA01: makeMa({ anonId: 'MA01' }),
      MA02: makeMa({ anonId: 'MA02' }),
    };
    const auslastung = new Map<string, MaQuartalsAuslastung>([
      ['MA01', makeAuslastung({ stunden: 9 })],
    ]);
    const s = computeQuartalsStatistik(mitarbeiter, auslastung, makeConfig(), '2026-Q2', 0);
    expect(s.warnungen.leereMAs).toEqual(['MA02']);
    expect(s.ma.ohneBuchungen).toBe(1);
  });

  it('Kategorien-Verteilung pro Hauptkategorie', () => {
    const it = makeKategorie('IT', 'Industrielle Technologien');
    const dt = makeKategorie('DT', 'Digitale Technologien');
    const mitarbeiter = {
      MA01: makeMa({ anonId: 'MA01', hauptKategorie: 'IT' }),
      MA02: makeMa({ anonId: 'MA02', hauptKategorie: 'IT' }),
      MA03: makeMa({ anonId: 'MA03', hauptKategorie: 'IT' }),
      MA04: makeMa({ anonId: 'MA04', hauptKategorie: 'DT' }),
      MA05: makeMa({ anonId: 'MA05', hauptKategorie: 'DT' }),
    };
    const s = computeQuartalsStatistik(mitarbeiter, new Map(), makeConfig([it, dt]), '2026-Q2', 0);
    const itEntry = s.kategorienVerteilung.find(e => e.id === 'IT')!;
    const dtEntry = s.kategorienVerteilung.find(e => e.id === 'DT')!;
    expect(itEntry.aktiveCount).toBe(3);
    expect(itEntry.prozent).toBe(60);
    expect(dtEntry.aktiveCount).toBe(2);
    expect(dtEntry.prozent).toBe(40);
  });

  it('Quartal-Fortschritt-Prozent korrekt', () => {
    const s = computeQuartalsStatistik(
      {}, new Map(), makeConfig(), '2026-Q2',
      0, new Date(2026, 4, 16, 12, 0, 0),  // Mitte Mai = Q2-Tag 46
    );
    expect(s.quartal.tageGesamt).toBe(91);
    expect(s.quartal.tagAktuell).toBe(46);
    expect(s.quartal.fortschrittProzent).toBe(51);  // round(46/91*100)
  });

  it('deskriptorenOhneZuordnung wird durchgereicht', () => {
    const s = computeQuartalsStatistik({}, new Map(), makeConfig(), '2026-Q2', 11);
    expect(s.warnungen.deskriptorenOhneZuordnung).toBe(11);
  });

  it('Abschlag reduziert effektivStunden', () => {
    const mitarbeiter = {
      MA01: makeMa({ anonId: 'MA01', jahresKapazitaet: 800, abschlagProzent: 25 }),
    };
    const s = computeQuartalsStatistik(mitarbeiter, new Map(), makeConfig(), '2026-Q2', 0);
    expect(s.kapazitaet.effektivStunden).toBe(150);  // 800 × 0.75 / 4
  });
});

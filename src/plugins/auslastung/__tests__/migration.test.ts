/**
 * Migrations-Tests fuer Workflow-Revision 1.17.
 *
 * Deckt zwei Pfade ab (beide lesen Pre-1.17-Felder aus Roh-JSON und
 * konvertieren in das neue Schema — die Interface-Felder selbst sind seit
 * v2.3 entfernt, der Read-Migration-Pfad bleibt fuer Legacy-IDB/SMB-Daten):
 *  1. `normalizeMitarbeiterRecord` — `ueberKategorien` → `hauptKategorie` + `nebenKategorien`
 *  2. `normalizeKlassifizierungArray` — Multi-Label → Primaer + Aspekte
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeKlassifizierungArray,
  normalizeMitarbeiterRecord,
} from '../services/auslastung-store';

describe('normalizeMitarbeiterRecord — 1.17 Haupt/Neben-Migration', () => {
  it('verteilt ueberKategorien auf haupt + neben', () => {
    const raw = {
      MA01: {
        anonId: 'MA01',
        jahresKapazitaet: 800,
        abgemeldet: [],
        manuelleTechnologien: [],
        ausgeblendeteAutoTags: [],
        ueberKategorien: ['IT', 'DT'],
        virtuelleProjekte: [],
        onboardingAbgeschlossen: false,
        aktiv: true,
      } as Record<string, unknown>,
    };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA01!.hauptKategorie).toBe('IT');
    expect(out.MA01!.nebenKategorien).toEqual(['DT']);
    expect(out.MA01!.abschlagProzent).toBe(0);
  });

  it('leere ueberKategorien → leere haupt+neben', () => {
    const raw = {
      MA01: {
        anonId: 'MA01',
        jahresKapazitaet: 800,
        abgemeldet: [],
        manuelleTechnologien: [],
        ausgeblendeteAutoTags: [],
        ueberKategorien: [],
        virtuelleProjekte: [],
        onboardingAbgeschlossen: false,
        aktiv: true,
      },
    };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA01!.hauptKategorie).toBe('');
    expect(out.MA01!.nebenKategorien).toEqual([]);
  });

  it('bereits migrierter Datensatz unveraendert (Idempotenz)', () => {
    const raw = {
      MA01: {
        anonId: 'MA01',
        jahresKapazitaet: 800,
        abgemeldet: [],
        manuelleTechnologien: [],
        ausgeblendeteAutoTags: [],
        hauptKategorie: 'DT',
        nebenKategorien: ['IT'],
        abschlagProzent: 25,
        ueberKategorien: ['DT', 'IT'],
        virtuelleProjekte: [],
        onboardingAbgeschlossen: true,
        aktiv: true,
      },
    };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA01!.hauptKategorie).toBe('DT');
    expect(out.MA01!.nebenKategorien).toEqual(['IT']);
    expect(out.MA01!.abschlagProzent).toBe(25);
  });

  it('fehlende abschlagProzent → 0', () => {
    const raw = {
      MA01: {
        anonId: 'MA01',
        jahresKapazitaet: 800,
        abgemeldet: [],
        manuelleTechnologien: [],
        ausgeblendeteAutoTags: [],
        ueberKategorien: ['IT'],
        virtuelleProjekte: [],
        onboardingAbgeschlossen: false,
        aktiv: true,
      },
    };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA01!.abschlagProzent).toBe(0);
  });
});

describe('normalizeMitarbeiterRecord — Antragstyp-Vorbelegung Roundtrip', () => {
  // Regression: vor v2.56.2 hat normalizeMitarbeiterRecord die beiden
  // antragstyp-Felder NICHT durchgereicht → PL-Vorbelegung verschwand bei
  // jedem Reload (Bug-Report PL-Tester).
  function rawMa(extra: Record<string, unknown>): Record<string, unknown> {
    return {
      anonId: 'MA01',
      jahresKapazitaet: 800,
      abgemeldet: [],
      manuelleTechnologien: [],
      ausgeblendeteAutoTags: [],
      hauptKategorie: 'IT',
      nebenKategorien: [],
      abschlagProzent: 0,
      virtuelleProjekte: [],
      onboardingAbgeschlossen: true,
      aktiv: true,
      ...extra,
    };
  }

  it('erhaelt antragstypBevorzugt + antragstypUeberschreibung beim Laden', () => {
    const out = normalizeMitarbeiterRecord({
      MA01: rawMa({ antragstypBevorzugt: ['FuE'], antragstypUeberschreibung: ['DS'] }),
    });
    expect(out.MA01!.antragstypBevorzugt).toEqual(['FuE']);
    expect(out.MA01!.antragstypUeberschreibung).toEqual(['DS']);
  });

  it('filtert ungueltige Bucket-Werte heraus', () => {
    const out = normalizeMitarbeiterRecord({
      MA01: rawMa({ antragstypBevorzugt: ['FuE', 'XX', 'DL'] }),
    });
    expect(out.MA01!.antragstypBevorzugt).toEqual(['FuE', 'DL']);
  });

  it('fehlende Felder → undefined (keine Vorbelegung)', () => {
    const out = normalizeMitarbeiterRecord({ MA01: rawMa({}) });
    expect(out.MA01!.antragstypBevorzugt).toBeUndefined();
    expect(out.MA01!.antragstypUeberschreibung).toBeUndefined();
  });
});

describe('normalizeKlassifizierungArray — 1.17 Primaer+Aspekte-Migration', () => {
  it('migriert vorgeschlageneKategorien → primaer + aspekte', () => {
    const raw = [{
      antragId: '16DS261161',
      vorgeschlageneKategorien: [
        { kategorieId: 'IT', confidence: 0.9, methode: 'embedding' },
        { kategorieId: 'DT', confidence: 0.75, methode: 'embedding' },
      ],
      freigegebeneKategorien: [],
      status: 'vorgeschlagen',
    }];
    const out = normalizeKlassifizierungArray(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.vorgeschlagenePrimaer).toEqual({
      kategorieId: 'IT',
      confidence: 0.9,
      methode: 'embedding',
    });
    expect(out[0]!.vorgeschlageneAspekte).toEqual([
      { kategorieId: 'DT', confidence: 0.75 },
    ]);
  });

  it('migriert freigegebeneKategorien → primaer + aspekte', () => {
    const raw = [{
      antragId: '16DS261161',
      vorgeschlageneKategorien: [],
      freigegebeneKategorien: ['IT', 'DT', 'EU'],
      status: 'freigegeben',
      freigegebenAm: '2026-05-20T10:00:00.000Z',
    }];
    const out = normalizeKlassifizierungArray(raw);
    expect(out[0]!.freigegebenePrimaer).toBe('IT');
    expect(out[0]!.freigegebeneAspekte).toEqual(['DT', 'EU']);
  });

  it('leere vorgeschlageneKategorien → primaer null, aspekte leer', () => {
    const raw = [{
      antragId: '16DS261161',
      vorgeschlageneKategorien: [],
      freigegebeneKategorien: [],
      status: 'vorgeschlagen',
    }];
    const out = normalizeKlassifizierungArray(raw);
    expect(out[0]!.vorgeschlagenePrimaer).toBeNull();
    expect(out[0]!.vorgeschlageneAspekte).toEqual([]);
    expect(out[0]!.freigegebenePrimaer).toBe('');
    expect(out[0]!.freigegebeneAspekte).toEqual([]);
  });

  it('bereits migrierter Datensatz unveraendert (Idempotenz)', () => {
    const raw = [{
      antragId: '16DS261161',
      vorgeschlagenePrimaer: { kategorieId: 'DT', confidence: 0.85, methode: 'llm', begruendung: 'Test' },
      vorgeschlageneAspekte: [{ kategorieId: 'IT', confidence: 0.4 }],
      freigegebenePrimaer: 'DT',
      freigegebeneAspekte: ['IT'],
      vorgeschlageneKategorien: [],
      freigegebeneKategorien: [],
      status: 'freigegeben',
    }];
    const out = normalizeKlassifizierungArray(raw);
    expect(out[0]!.vorgeschlagenePrimaer).toEqual({
      kategorieId: 'DT', confidence: 0.85, methode: 'llm', begruendung: 'Test',
    });
    expect(out[0]!.vorgeschlageneAspekte).toEqual([{ kategorieId: 'IT', confidence: 0.4 }]);
    expect(out[0]!.freigegebenePrimaer).toBe('DT');
    expect(out[0]!.freigegebeneAspekte).toEqual(['IT']);
  });

  it('filtert ungueltige Eintraege (ohne antragId)', () => {
    const raw = [
      { vorgeschlageneKategorien: [], freigegebeneKategorien: [], status: 'vorgeschlagen' },
      { antragId: '', vorgeschlageneKategorien: [], freigegebeneKategorien: [], status: 'vorgeschlagen' },
      { antragId: '16DS261161', vorgeschlageneKategorien: [], freigegebeneKategorien: [], status: 'vorgeschlagen' },
    ];
    const out = normalizeKlassifizierungArray(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.antragId).toBe('16DS261161');
  });

  it('non-array Input → leeres Array', () => {
    expect(normalizeKlassifizierungArray(null)).toEqual([]);
    expect(normalizeKlassifizierungArray({})).toEqual([]);
    expect(normalizeKlassifizierungArray('foo')).toEqual([]);
  });
});


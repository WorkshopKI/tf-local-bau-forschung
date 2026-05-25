/**
 * Migration + Store-Verhalten fuer das aktiv-Flag.
 *
 * Hier testbar ohne Storage-Mock, weil `normalizeMitarbeiterRecord` aus
 * `auslastung-store.ts` als named export verfuegbar ist und keine I/O macht.
 */
import { describe, it, expect } from 'vitest';
import { normalizeMitarbeiterRecord } from '../services/auslastung-store';
import { DEFAULT_JAHRESKAPAZITAET } from '../types';

describe('normalizeMitarbeiterRecord (aktiv-Migration)', () => {
  it('Pre-Patch-Daten ohne aktiv-Feld → aktiv: true fuer alle', () => {
    const raw = {
      MA01: {
        anonId: 'MA01', jahresKapazitaet: 1000, abgemeldet: [], manuelleTechnologien: [],
        ausgeblendeteAutoTags: [],
        ueberKategorien: ['IKT'], virtuelleProjekte: [], onboardingAbgeschlossen: true,
      },
      MA02: {
        anonId: 'MA02', jahresKapazitaet: 800, abgemeldet: [], manuelleTechnologien: [],
        ausgeblendeteAutoTags: [],
        ueberKategorien: ['IND'], virtuelleProjekte: [], onboardingAbgeschlossen: false,
      },
    };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA01!.aktiv).toBe(true);
    expect(out.MA02!.aktiv).toBe(true);
  });

  it('aktiv: false in Pre-Patch-Daten wird respektiert', () => {
    const raw = {
      MA01: { anonId: 'MA01', aktiv: false } as Record<string, unknown>,
    };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA01!.aktiv).toBe(false);
  });

  it('explizit aktiv: true wird respektiert (kein Verschlucken)', () => {
    const raw = {
      MA01: { anonId: 'MA01', aktiv: true } as Record<string, unknown>,
    };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA01!.aktiv).toBe(true);
  });

  it('fuellt fehlende Pflicht-Felder mit sinnvollen Defaults', () => {
    const raw = { MA01: {} as Record<string, unknown> };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA01).toEqual({
      anonId: 'MA01',
      jahresKapazitaet: DEFAULT_JAHRESKAPAZITAET,
      abgemeldet: [],
      manuelleTechnologien: [],
      ausgeblendeteAutoTags: [],
      // 1.17: neue Felder + deprecated ueberKategorien
      hauptKategorie: '',
      nebenKategorien: [],
      abschlagProzent: 0,
      ueberKategorien: [],
      virtuelleProjekte: [],
      profilEmbeddingText: undefined,
      onboardingAbgeschlossen: false,
      aktiv: true,
    });
  });

  it('non-object Input → leeres Record', () => {
    expect(normalizeMitarbeiterRecord(null)).toEqual({});
    expect(normalizeMitarbeiterRecord(undefined)).toEqual({});
    expect(normalizeMitarbeiterRecord('not-an-object')).toEqual({});
    expect(normalizeMitarbeiterRecord(42)).toEqual({});
  });

  it('filtert non-object MA-Eintraege raus (defensiv)', () => {
    const raw = {
      MA01: { anonId: 'MA01' },
      MA02: null as unknown,
      MA03: 'not-an-object' as unknown,
    };
    const out = normalizeMitarbeiterRecord(raw);
    expect(Object.keys(out)).toEqual(['MA01']);
  });

  it('anonId fehlt → Key wird verwendet', () => {
    const raw = { MA42: { jahresKapazitaet: 500 } as Record<string, unknown> };
    const out = normalizeMitarbeiterRecord(raw);
    expect(out.MA42!.anonId).toBe('MA42');
  });
});

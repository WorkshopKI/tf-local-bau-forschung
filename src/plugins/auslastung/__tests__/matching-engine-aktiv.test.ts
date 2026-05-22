/**
 * Matching-Engine: Inaktive MAs werden ausgeschlossen.
 *
 * Drei Garantien:
 *  1. Match-Output enthaelt nie einen inaktiven MA, auch wenn er die
 *     hoechste BM25 + Kompetenz haette.
 *  2. Alle MAs inaktiv → leeres Ergebnis (kein Crash).
 *  3. Mix aktiv/inaktiv → nur aktive landen im Top-N.
 */
import { describe, it, expect } from 'vitest';
import { runMatching } from '../services/matching-engine';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymerMitarbeiter, AuslastungConfig } from '../types';
import { DEFAULT_AUSLASTUNG_CONFIG } from '../types';

function makeAntrag(az: string, fields: Partial<Antrag> = {}): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: new Date().toISOString(),
    ...fields,
  } as Antrag;
}

function makeMa(anonId: string, tech: string[], aktiv = true): AnonymerMitarbeiter {
  return {
    anonId,
    jahresKapazitaet: 1600,
    abgemeldet: [],
    manuelleTechnologien: tech,
    ausgeblendeteAutoTags: [],
    ueberKategorien: ['IKT'],
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv,
  };
}

function makeConfig(overrides: Partial<AuslastungConfig> = {}): AuslastungConfig {
  return {
    ...DEFAULT_AUSLASTUNG_CONFIG,
    aktuellesQuartal: '2026-Q2',
    stage2Aktiv: false,
    ...overrides,
  };
}

describe('runMatching mit aktiv-Filter', () => {
  it('inaktiver MA mit dem besten BM25-Match wird nie vorgeschlagen', () => {
    const antrag = makeAntrag('A1', {
      titel: 'Künstliche Intelligenz Bildverarbeitung',
      projektbeschreibung_text: 'KI für medizinische Bilder.',
    } as Partial<Antrag>);
    const mitarbeiter = {
      // MA01 ist inaktiv, hat aber das beste Vokabular-Match
      MA01: makeMa('MA01', ['künstliche', 'intelligenz', 'bildverarbeitung', 'medizin'], false),
      // MA02 ist aktiv, schwaecheres Match
      MA02: makeMa('MA02', ['datenbanken'], true),
    };
    const out = runMatching({
      antrag,
      kategorieIds: ['IKT'],
      config: makeConfig(),
      mitarbeiter,
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    expect(out.find(r => r.anonId === 'MA01')).toBeUndefined();
    expect(out.map(r => r.anonId)).toContain('MA02');
  });

  it('alle MAs inaktiv → leeres Ergebnis', () => {
    const antrag = makeAntrag('A1', {
      titel: 'KI',
      projektbeschreibung_text: 'KI-Projekt.',
    } as Partial<Antrag>);
    const mitarbeiter = {
      MA01: makeMa('MA01', ['ki'], false),
      MA02: makeMa('MA02', ['ki'], false),
    };
    const out = runMatching({
      antrag,
      kategorieIds: ['IKT'],
      config: makeConfig(),
      mitarbeiter,
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    expect(out).toEqual([]);
  });

  it('Mix: nur aktive MAs im Top-3', () => {
    const antrag = makeAntrag('A1', {
      titel: 'Datenanalyse',
      projektbeschreibung_text: 'Analytics fuer Sensordaten.',
    } as Partial<Antrag>);
    const mitarbeiter = {
      MA01: makeMa('MA01', ['datenanalyse'], true),
      MA02: makeMa('MA02', ['sensoren'], false),  // inaktiv
      MA03: makeMa('MA03', ['analytics'], true),
      MA04: makeMa('MA04', ['datenanalyse'], false),  // inaktiv
    };
    const out = runMatching({
      antrag,
      kategorieIds: ['IKT'],
      config: makeConfig(),
      mitarbeiter,
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    const ids = out.map(r => r.anonId);
    expect(ids).not.toContain('MA02');
    expect(ids).not.toContain('MA04');
  });
});

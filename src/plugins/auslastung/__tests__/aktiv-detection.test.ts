/**
 * Aktiv-Detection-Heuristik: "MA hat Antrag im Referenz-Jahr → aktiv".
 */
import { describe, it, expect } from 'vitest';
import { detectAktiveMAs, shouldShowAktivVorschlag } from '../services/kapazitaet';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymerMitarbeiter } from '../types';

function makeAntrag(az: string, fields: Partial<Antrag> = {}): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: new Date().toISOString(),
    ...fields,
  } as Antrag;
}

function makeMa(anonId: string, aktiv = true): AnonymerMitarbeiter {
  return {
    anonId,
    jahresKapazitaet: 1600,
    abgemeldet: [],
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie: 'IKT',
    nebenKategorien: [],
    abschlagProzent: 0,
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv,
  };
}

describe('detectAktiveMAs', () => {
  it('aktiv = mind. ein Antrag mit antragsdatum im Referenz-Jahr und passendem tib_kuerz', () => {
    const antraege: Antrag[] = [
      makeAntrag('A1', { tib_kuerz: 'MUE', antragsdatum: '2026-03-15' } as Partial<Antrag>),
      makeAntrag('A2', { tib_kuerz: 'MUE', antragsdatum: '2024-01-01' } as Partial<Antrag>),
      makeAntrag('A3', { tib_kuerz: 'SCH', antragsdatum: '2026-08-01' } as Partial<Antrag>),
      makeAntrag('A4', { tib_kuerz: 'ALB', antragsdatum: '2023-11-30' } as Partial<Antrag>),
      makeAntrag('A5', { tib_kuerz: 'KLA', antragsdatum: undefined } as Partial<Antrag>),
    ];
    const map = buildAnonymMapForTests(antraege);
    const mue = map.toAnon.get('MUE')!;
    const sch = map.toAnon.get('SCH')!;
    const alb = map.toAnon.get('ALB')!;
    const kla = map.toAnon.get('KLA')!;
    const mitarbeiter = {
      [mue]: makeMa(mue),
      [sch]: makeMa(sch),
      [alb]: makeMa(alb),
      [kla]: makeMa(kla),
    };
    const result = detectAktiveMAs(antraege, mitarbeiter, map, 2026);
    expect(result.vorschlag[mue]).toBe(true);
    expect(result.vorschlag[sch]).toBe(true);
    expect(result.vorschlag[alb]).toBe(false);
    expect(result.vorschlag[kla]).toBe(false);
    expect(result.aktivCount).toBe(2);
    expect(result.inaktivCount).toBe(2);
  });

  it('MA ohne aufloesbares Kuerzel bleibt unveraendert (vorschlag = current aktiv)', () => {
    // Szenario: MA09 existiert im Store, aber kein Antrag hat ein Kuerzel das auf MA09 zeigt
    const antraege: Antrag[] = [
      makeAntrag('A1', { tib_kuerz: 'MUE', antragsdatum: '2026-03-15' } as Partial<Antrag>),
    ];
    const map = buildAnonymMapForTests(antraege);
    const mitarbeiter = {
      MA09: makeMa('MA09', false),  // im Store, aber nicht in der map
    };
    const result = detectAktiveMAs(antraege, mitarbeiter, map, 2026);
    expect(result.vorschlag.MA09).toBe(false);  // bleibt wie er war
    expect(result.ohneKuerzelCount).toBe(1);
  });

  it('antragsdatum als non-string wird ignoriert', () => {
    const antraege: Antrag[] = [
      // antragsdatum als Zahl (z.B. fehlerhaftes Mapping) — soll nicht zaehlen
      makeAntrag('A1', { tib_kuerz: 'MUE', antragsdatum: 20260315 } as unknown as Partial<Antrag>),
    ];
    const map = buildAnonymMapForTests(antraege);
    const mue = map.toAnon.get('MUE')!;
    const result = detectAktiveMAs(antraege, { [mue]: makeMa(mue) }, map, 2026);
    expect(result.vorschlag[mue]).toBe(false);
  });

  it('leere Antraege: MA ohne aufloesbares Kuerzel behaelt aktuellen aktiv-Status', () => {
    // Edge-Case: kein Antrag in der CSV → leere anonymMap → der Store-MA
    // hat kein aufloesbares Kuerzel → bleibt wie er ist (kein Vorschlag).
    const map = buildAnonymMapForTests([]);
    const result = detectAktiveMAs([], { MA01: makeMa('MA01', true) }, map, 2026);
    expect(result.vorschlag.MA01).toBe(true);
    expect(result.ohneKuerzelCount).toBe(1);
  });
});

describe('shouldShowAktivVorschlag', () => {
  it('alle MAs aktiv: true → Banner zeigen', () => {
    expect(shouldShowAktivVorschlag({
      MA01: makeMa('MA01', true),
      MA02: makeMa('MA02', true),
    })).toBe(true);
  });

  it('mindestens ein MA inaktiv → Banner verstecken (Liste ist bereits gepflegt)', () => {
    expect(shouldShowAktivVorschlag({
      MA01: makeMa('MA01', true),
      MA02: makeMa('MA02', false),
    })).toBe(false);
  });

  it('leeres Record → kein Banner', () => {
    expect(shouldShowAktivVorschlag({})).toBe(false);
  });
});

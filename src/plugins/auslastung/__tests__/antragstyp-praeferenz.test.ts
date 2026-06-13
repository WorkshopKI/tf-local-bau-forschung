/**
 * Tests fuer antragstyp-praeferenz.ts (v2.2).
 *
 * Deckt zwei pure Funktionen ab:
 *  - getEffectiveAntragstypen — Override > Bevorzugt > null
 *  - matchesAntragstyp        — Pruefung gegen vb_phase via getKategorieLabel
 */
import { describe, it, expect } from 'vitest';
import {
  deriveAntragstypenFromKontingent,
  getAntragstypHerkunft,
  getEffectiveAntragstypen,
  hasPlOverride,
  matchesAntragstyp,
} from '../services/kapazitaet';
import type { AnonymerMitarbeiter, AntragstypBucket } from '../types';
import type { Antrag } from '@/core/services/csv/types';

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
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv: true,
    ...overrides,
  };
}

function makeAntrag(vbPhase: number | undefined): Antrag {
  const out: Record<string, unknown> = {
    aktenzeichen: 'AZ-TEST',
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: new Date().toISOString(),
  };
  if (vbPhase !== undefined) out.vb_phase = vbPhase;
  return out as Antrag;
}

describe('getEffectiveAntragstypen', () => {
  it('Override nicht-leer → Override gilt', () => {
    const ma = makeMa({
      antragstypBevorzugt: ['FuE', 'NW'],
      antragstypUeberschreibung: ['FuE'],
    });
    expect(getEffectiveAntragstypen(ma)).toEqual(['FuE']);
  });

  it('Override leer-Array → Bevorzugt gilt', () => {
    const ma = makeMa({
      antragstypBevorzugt: ['FuE', 'NW'],
      antragstypUeberschreibung: [],
    });
    expect(getEffectiveAntragstypen(ma)).toEqual(['FuE', 'NW']);
  });

  it('Override undefined → Bevorzugt gilt', () => {
    const ma = makeMa({
      antragstypBevorzugt: ['DS'],
    });
    expect(getEffectiveAntragstypen(ma)).toEqual(['DS']);
  });

  it('beide leer/undefined → null (Backwards-Kompat: alle erlaubt)', () => {
    expect(getEffectiveAntragstypen(makeMa())).toBeNull();
    expect(getEffectiveAntragstypen(makeMa({
      antragstypBevorzugt: [],
      antragstypUeberschreibung: [],
    }))).toBeNull();
  });

  it('nur Bevorzugt leer-Array → null', () => {
    expect(getEffectiveAntragstypen(makeMa({ antragstypBevorzugt: [] }))).toBeNull();
  });
});

describe('matchesAntragstyp', () => {
  it('MA ohne Praeferenz → true fuer alle Anträge (auch Irrläufer)', () => {
    const ma = makeMa();
    expect(matchesAntragstyp(makeAntrag(3), ma)).toBe(true);  // FuE
    expect(matchesAntragstyp(makeAntrag(5), ma)).toBe(true);  // DS
    expect(matchesAntragstyp(makeAntrag(9), ma)).toBe(true);  // Irrläufer
    expect(matchesAntragstyp(makeAntrag(undefined), ma)).toBe(true);
  });

  it('vb_phase=3 (FuE) gegen Praeferenz [FuE] → true', () => {
    const ma = makeMa({ antragstypBevorzugt: ['FuE'] });
    expect(matchesAntragstyp(makeAntrag(3), ma)).toBe(true);
  });

  it('vb_phase=5 (DS) gegen Praeferenz [FuE] → false', () => {
    const ma = makeMa({ antragstypBevorzugt: ['FuE'] });
    expect(matchesAntragstyp(makeAntrag(5), ma)).toBe(false);
  });

  it('vb_phase=1 (NW1) gegen Praeferenz [NW] → true', () => {
    const ma = makeMa({ antragstypBevorzugt: ['NW'] });
    expect(matchesAntragstyp(makeAntrag(1), ma)).toBe(true);
  });

  it('vb_phase=2 (NW2) gegen Praeferenz [NW] → true', () => {
    const ma = makeMa({ antragstypBevorzugt: ['NW'] });
    expect(matchesAntragstyp(makeAntrag(2), ma)).toBe(true);
  });

  it('vb_phase=9 (Irrläufer) gegen Praeferenz [FuE,NW,DS,DL] → false', () => {
    const types: AntragstypBucket[] = ['FuE', 'NW', 'DS', 'DL'];
    const ma = makeMa({ antragstypBevorzugt: types });
    expect(matchesAntragstyp(makeAntrag(9), ma)).toBe(false);
  });

  it('Override-Priorität: Bevorzugt=[FuE,NW] aber Override=[FuE] → DS rausgefiltert', () => {
    const ma = makeMa({
      antragstypBevorzugt: ['FuE', 'NW'],
      antragstypUeberschreibung: ['FuE'],
    });
    expect(matchesAntragstyp(makeAntrag(3), ma)).toBe(true);   // FuE
    expect(matchesAntragstyp(makeAntrag(1), ma)).toBe(false);  // NW1 — durch Override raus
    expect(matchesAntragstyp(makeAntrag(2), ma)).toBe(false);  // NW2
  });

  it('vb_phase fehlt am Antrag → false bei Präferenz, true ohne', () => {
    const mit = makeMa({ antragstypBevorzugt: ['FuE'] });
    expect(matchesAntragstyp(makeAntrag(undefined), mit)).toBe(false);
    const ohne = makeMa();
    expect(matchesAntragstyp(makeAntrag(undefined), ohne)).toBe(true);
  });
});

describe('deriveAntragstypenFromKontingent (v2.60)', () => {
  it('Buckets mit Stunden > 0 → abgeleitete Liste (in Bucket-Reihenfolge)', () => {
    const ma = makeMa({ jahresKapazitaetProTyp: { FuE: 337, DS: 100 } });
    expect(deriveAntragstypenFromKontingent(ma)).toEqual(['FuE', 'DS']);
  });

  it('kein Kontingent / undefined → null', () => {
    expect(deriveAntragstypenFromKontingent(makeMa())).toBeNull();
    expect(deriveAntragstypenFromKontingent(makeMa({ jahresKapazitaetProTyp: {} }))).toBeNull();
  });

  it('Null-/Negativ-Stunden zaehlen nicht als Kontingent', () => {
    expect(deriveAntragstypenFromKontingent(makeMa({ jahresKapazitaetProTyp: { DL: 0 } }))).toBeNull();
  });
});

describe('getEffectiveAntragstypen — Ableitung aus Kontingent (v2.60)', () => {
  it('keine Vorbelegung, aber Kontingent → abgeleitete Typen gelten', () => {
    const ma = makeMa({ jahresKapazitaetProTyp: { FuE: 300, NW: 50 } });
    expect(getEffectiveAntragstypen(ma)).toEqual(['FuE', 'NW']);
  });

  it('explizite Vorbelegung schlaegt Kontingent', () => {
    const ma = makeMa({ antragstypBevorzugt: ['DS'], jahresKapazitaetProTyp: { FuE: 300 } });
    expect(getEffectiveAntragstypen(ma)).toEqual(['DS']);
  });

  it('Override schlaegt Vorbelegung UND Kontingent', () => {
    const ma = makeMa({
      antragstypUeberschreibung: ['DL'],
      antragstypBevorzugt: ['DS'],
      jahresKapazitaetProTyp: { FuE: 300 },
    });
    expect(getEffectiveAntragstypen(ma)).toEqual(['DL']);
  });

  it('weder Vorbelegung noch Kontingent → null (Backwards-Kompat)', () => {
    expect(getEffectiveAntragstypen(makeMa())).toBeNull();
  });
});

describe('matchesAntragstyp — abgeleiteter Filter (v2.60)', () => {
  it('MA mit nur-FuE-Kontingent: FuE-Antrag true, DS-Antrag false', () => {
    const ma = makeMa({ jahresKapazitaetProTyp: { FuE: 300 } });
    expect(matchesAntragstyp(makeAntrag(3), ma)).toBe(true);   // FuE
    expect(matchesAntragstyp(makeAntrag(5), ma)).toBe(false);  // DS — nicht im Kontingent
  });

  it('MA ohne Kontingent + ohne Praeferenz → weiterhin alle erlaubt', () => {
    const ma = makeMa();
    expect(matchesAntragstyp(makeAntrag(5), ma)).toBe(true);
    expect(matchesAntragstyp(makeAntrag(9), ma)).toBe(true);
  });
});

describe('getAntragstypHerkunft (v2.60)', () => {
  it('override / bevorzugt / abgeleitet / keine', () => {
    expect(getAntragstypHerkunft(makeMa({ antragstypUeberschreibung: ['FuE'] }))).toBe('override');
    expect(getAntragstypHerkunft(makeMa({ antragstypBevorzugt: ['DS'] }))).toBe('bevorzugt');
    expect(getAntragstypHerkunft(makeMa({ jahresKapazitaetProTyp: { FuE: 100 } }))).toBe('abgeleitet');
    expect(getAntragstypHerkunft(makeMa())).toBe('keine');
  });
});

describe('hasPlOverride', () => {
  it('true wenn Override nicht-leer', () => {
    expect(hasPlOverride(makeMa({ antragstypUeberschreibung: ['FuE'] }))).toBe(true);
  });
  it('false wenn Override leer/undefined', () => {
    expect(hasPlOverride(makeMa())).toBe(false);
    expect(hasPlOverride(makeMa({ antragstypUeberschreibung: [] }))).toBe(false);
  });
});

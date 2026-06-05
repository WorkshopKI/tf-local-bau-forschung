import { describe, it, expect } from 'vitest';
import {
  computeKapazitaetProTyp,
  quartalsKontingentProTyp,
  quartalsTVsProTyp,
  effektiveJahresStunden,
} from '../services/kapazitaet-pro-typ';
import type { MaQuartalsAuslastung, MaQuartalsBucket } from '../services/quartals-auslastung';
import { ALL_ANTRAGSTYP_BUCKETS, type AnonymerMitarbeiter, type AntragstypBucket } from '../types';

const STD = 9; // stundenProTV

function ma(kontingent: Partial<Record<AntragstypBucket, number>>, abschlag = 0): AnonymerMitarbeiter {
  return {
    anonId: 'MA01', jahresKapazitaet: 1600, abgemeldet: [], manuelleTechnologien: [],
    ausgeblendeteAutoTags: [], hauptKategorie: 'IT', nebenKategorien: [], abschlagProzent: abschlag,
    virtuelleProjekte: [], onboardingAbgeschlossen: true, aktiv: true,
    jahresKapazitaetProTyp: kontingent,
  };
}

/** Bucket mit per-Typ-TV-Verbrauch (`tvsProTyp`) — die neue Kapazitäts-Währung. */
function bucket(tvsProTyp: Partial<Record<AntragstypBucket, number>>): MaQuartalsBucket {
  return { antraege: 0, tvs: 0, stunden: 0, aktenzeichenSet: new Set(), verbuende: [], antraegeProTyp: {}, tvsProTyp };
}

function auslastung(
  fest: Partial<Record<AntragstypBucket, number>>,
  pending: Partial<Record<AntragstypBucket, number>> = {},
): MaQuartalsAuslastung {
  return { fest: bucket(fest), pending: bucket(pending) };
}

const slot = (v: ReturnType<typeof computeKapazitaetProTyp>, b: AntragstypBucket) =>
  v.slots.find(s => s.bucket === b)!;

describe('effektiveJahresStunden', () => {
  it('summiert die Typ-Stunden', () => {
    expect(effektiveJahresStunden(ma({ FuE: 72, DS: 36 }))).toBe(108);
  });
  it('0 ohne Typ-Stunden (kein Default mehr)', () => {
    expect(effektiveJahresStunden(ma({}))).toBe(0);
  });
  it('ignoriert 0/negative Einträge', () => {
    expect(effektiveJahresStunden(ma({ FuE: 72, DS: 0 }))).toBe(72);
  });
});

describe('quartalsKontingentProTyp (Stunden/Quartal)', () => {
  it('teilt die Jahres-Stunden auf vier Quartale', () => {
    expect(quartalsKontingentProTyp(ma({ FuE: 8 }), 'FuE')).toBe(2);
  });
  it('wendet den Abschlag an', () => {
    expect(quartalsKontingentProTyp(ma({ FuE: 8 }, 50), 'FuE')).toBe(1);
  });
  it('null wenn kein/0 Kontingent', () => {
    expect(quartalsKontingentProTyp(ma({}), 'FuE')).toBeNull();
    expect(quartalsKontingentProTyp(ma({ FuE: 0 }), 'FuE')).toBeNull();
  });
});

describe('quartalsTVsProTyp (TVs/Quartal)', () => {
  it('Stunden/Quartal ÷ stundenProTV', () => {
    // 72 h/Jahr → 18 h/Quartal → /9 = 2 TVs
    expect(quartalsTVsProTyp(ma({ FuE: 72 }), 'FuE', 9)).toBe(2);
  });
  it('null ohne Kontingent', () => {
    expect(quartalsTVsProTyp(ma({}), 'FuE', 9)).toBeNull();
  });
});

describe('computeKapazitaetProTyp (TVs)', () => {
  it('liefert immer 4 Slots in fester Reihenfolge', () => {
    const v = computeKapazitaetProTyp(ma({}), undefined, STD);
    expect(v.slots.map(s => s.bucket)).toEqual(ALL_ANTRAGSTYP_BUCKETS);
  });

  it('ohne Kontingent → unlimited (nur Count, keine Bar)', () => {
    const v = computeKapazitaetProTyp(ma({}), auslastung({ FuE: 2 }), STD);
    expect(v.hatKontingent).toBe(false);
    const fue = slot(v, 'FuE');
    expect(fue.unlimited).toBe(true);
    expect(fue.verbraucht).toBe(2);
    expect(fue.kontingentQ).toBeNull();
    expect(fue.pct).toBeNull();
    expect(v.verbrauchGesamt).toBe(2);
  });

  it('Kontingent mit Rest → rest>0, nicht überbucht', () => {
    // 72 h/Jahr → 2 TVs/Quartal, 0 verbraucht
    const v = computeKapazitaetProTyp(ma({ FuE: 72 }), auslastung({}), STD);
    const fue = slot(v, 'FuE');
    expect(v.hatKontingent).toBe(true);
    expect(fue.kontingentQ).toBe(2);
    expect(fue.verbraucht).toBe(0);
    expect(fue.rest).toBe(2);
    expect(fue.pct).toBe(0);
    expect(fue.ueberbucht).toBe(false);
  });

  it('Verbrauch > Kontingent → überbucht, pct auf 100 geclampt', () => {
    // 2 TVs Kontingent, 3 TVs verbraucht
    const v = computeKapazitaetProTyp(ma({ FuE: 72 }), auslastung({ FuE: 3 }), STD);
    const fue = slot(v, 'FuE');
    expect(fue.rest).toBe(-1);
    expect(fue.ueberbucht).toBe(true);
    expect(fue.pct).toBe(100);
  });

  it('summiert fest + pending je Typ (TVs)', () => {
    // 2 TVs Kontingent, 1 fest + 1 pending = 2 verbraucht
    const v = computeKapazitaetProTyp(ma({ FuE: 72 }), auslastung({ FuE: 1 }, { FuE: 1 }), STD);
    expect(slot(v, 'FuE').verbraucht).toBe(2);
    expect(slot(v, 'FuE').rest).toBe(0);
  });

  it('Abschlag senkt das Quartals-Kontingent', () => {
    // 144 h × 50 % = 72 h effektiv → 18 h/Quartal → 2 TVs
    const v = computeKapazitaetProTyp(ma({ FuE: 144 }, 50), auslastung({ FuE: 1 }), STD);
    const fue = slot(v, 'FuE');
    expect(fue.kontingentQ).toBe(2);
    expect(fue.rest).toBe(1);
  });
});

describe('computeKapazitaetProTyp — per-Typ-Stunden (v2.31)', () => {
  it('DS-Faktor 4,5 → doppelt so viele DS-TVs wie FuE bei gleichem Stunden-Konto', () => {
    // FuE+DS je 72 h/Jahr → je 18 h/Quartal. FuE ÷ 9 = 2 TVs, DS ÷ 4,5 = 4 TVs.
    const v = computeKapazitaetProTyp(ma({ FuE: 72, DS: 72 }), auslastung({}), STD, { DS: 4.5 });
    expect(slot(v, 'FuE').kontingentQ).toBe(2);
    expect(slot(v, 'DS').kontingentQ).toBe(4);
  });

  it('ohne per-Typ-Map → alle Typen Standard (Backward-Compat)', () => {
    const v = computeKapazitaetProTyp(ma({ FuE: 72, DS: 72 }), auslastung({}), STD);
    expect(slot(v, 'FuE').kontingentQ).toBe(2);
    expect(slot(v, 'DS').kontingentQ).toBe(2);
  });

  it('nur gesetzter Typ wird ueberschrieben, Rest faellt auf Standard', () => {
    const v = computeKapazitaetProTyp(ma({ FuE: 72, DL: 72 }), auslastung({}), STD, { DS: 4.5 });
    expect(slot(v, 'FuE').kontingentQ).toBe(2); // Standard 9
    expect(slot(v, 'DL').kontingentQ).toBe(2);  // Standard 9 (kein Override)
  });
});

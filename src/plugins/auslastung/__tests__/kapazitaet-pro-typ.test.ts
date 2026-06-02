import { describe, it, expect } from 'vitest';
import { computeKapazitaetProTyp, quartalsKontingentProTyp } from '../services/kapazitaet-pro-typ';
import type { MaQuartalsAuslastung, MaQuartalsBucket } from '../services/quartals-auslastung';
import { ALL_ANTRAGSTYP_BUCKETS, type AnonymerMitarbeiter, type AntragstypBucket } from '../types';

function ma(kontingent: Partial<Record<AntragstypBucket, number>>, abschlag = 0): AnonymerMitarbeiter {
  return {
    anonId: 'MA01', jahresKapazitaet: 1600, abgemeldet: [], manuelleTechnologien: [],
    ausgeblendeteAutoTags: [], hauptKategorie: 'IT', nebenKategorien: [], abschlagProzent: abschlag,
    virtuelleProjekte: [], onboardingAbgeschlossen: true, aktiv: true,
    jahresKapazitaetProTyp: kontingent,
  };
}

function bucket(antraegeProTyp: Partial<Record<AntragstypBucket, number>>): MaQuartalsBucket {
  return { antraege: 0, tvs: 0, stunden: 0, aktenzeichenSet: new Set(), verbuende: [], antraegeProTyp };
}

function auslastung(
  fest: Partial<Record<AntragstypBucket, number>>,
  pending: Partial<Record<AntragstypBucket, number>> = {},
): MaQuartalsAuslastung {
  return { fest: bucket(fest), pending: bucket(pending) };
}

const slot = (v: ReturnType<typeof computeKapazitaetProTyp>, b: AntragstypBucket) =>
  v.slots.find(s => s.bucket === b)!;

describe('quartalsKontingentProTyp', () => {
  it('teilt das Jahres-Kontingent auf vier Quartale', () => {
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

describe('computeKapazitaetProTyp', () => {
  it('liefert immer 4 Slots in fester Reihenfolge', () => {
    const v = computeKapazitaetProTyp(ma({}), undefined);
    expect(v.slots.map(s => s.bucket)).toEqual(ALL_ANTRAGSTYP_BUCKETS);
  });

  it('ohne Kontingent → unlimited (nur Count, keine Bar)', () => {
    const v = computeKapazitaetProTyp(ma({}), auslastung({ FuE: 2 }));
    expect(v.hatKontingent).toBe(false);
    const fue = slot(v, 'FuE');
    expect(fue.unlimited).toBe(true);
    expect(fue.verbraucht).toBe(2);
    expect(fue.kontingentQ).toBeNull();
    expect(fue.pct).toBeNull();
    expect(v.verbrauchGesamt).toBe(2);
  });

  it('Kontingent mit Rest → rest>0, nicht überbucht', () => {
    const v = computeKapazitaetProTyp(ma({ FuE: 4 }), auslastung({}));
    const fue = slot(v, 'FuE');
    expect(v.hatKontingent).toBe(true);
    expect(fue.kontingentQ).toBe(1);
    expect(fue.verbraucht).toBe(0);
    expect(fue.rest).toBe(1);
    expect(fue.pct).toBe(0);
    expect(fue.ueberbucht).toBe(false);
  });

  it('Verbrauch > Kontingent → überbucht, pct auf 100 geclampt', () => {
    const v = computeKapazitaetProTyp(ma({ FuE: 4 }), auslastung({ FuE: 2 }));
    const fue = slot(v, 'FuE');
    expect(fue.rest).toBe(-1);
    expect(fue.ueberbucht).toBe(true);
    expect(fue.pct).toBe(100);
  });

  it('summiert fest + pending je Typ', () => {
    const v = computeKapazitaetProTyp(ma({ FuE: 8 }), auslastung({ FuE: 1 }, { FuE: 1 }));
    expect(slot(v, 'FuE').verbraucht).toBe(2);
    expect(slot(v, 'FuE').rest).toBe(0);
  });

  it('Abschlag senkt das Quartals-Kontingent', () => {
    const v = computeKapazitaetProTyp(ma({ FuE: 8 }, 50), auslastung({ FuE: 1 }));
    const fue = slot(v, 'FuE');
    expect(fue.kontingentQ).toBe(1);
    expect(fue.rest).toBe(0);
  });
});

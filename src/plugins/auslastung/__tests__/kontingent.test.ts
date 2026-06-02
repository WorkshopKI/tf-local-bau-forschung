import { describe, it, expect } from 'vitest';
import { computeKontingentVerbrauch, kontingentInfoFor } from '../services/kontingent';
import type { AnonymerMitarbeiter, AntragstypBucket, Zuweisung } from '../types';

function maMit(kontingent: Partial<Record<AntragstypBucket, number>>): AnonymerMitarbeiter {
  return {
    anonId: 'MA01', jahresKapazitaet: 1600, abgemeldet: [], manuelleTechnologien: [],
    ausgeblendeteAutoTags: [], hauptKategorie: 'IT', nebenKategorien: [], abschlagProzent: 0,
    virtuelleProjekte: [], onboardingAbgeschlossen: true, aktiv: true,
    jahresKapazitaetProTyp: kontingent,
  };
}

describe('computeKontingentVerbrauch', () => {
  it('zaehlt freigegebene + selbst je Bucket im Quartal', () => {
    const z: Zuweisung[] = [
      { antragId: 'A1', anonId: 'MA01', quartal: '2026-Q2', stunden: 9, status: 'freigegeben' },
      { antragId: 'A2', anonId: 'MA01', quartal: '2026-Q2', stunden: 9, status: 'selbst' },
      { antragId: 'A3', anonId: 'MA01', quartal: '2026-Q1', stunden: 9, status: 'freigegeben' }, // anderes Quartal
      { antragId: 'A4', anonId: 'MA01', quartal: '2026-Q2', stunden: 9, status: 'abgelehnt' },   // abgelehnt
      { antragId: 'A5', anonId: 'MA01', quartal: '2026-Q2', stunden: 9, status: 'freigegeben' },  // DS
    ];
    const idx = new Map<string, { vb_phase?: unknown }>([
      ['A1', { vb_phase: 3 }], // FuE
      ['A2', { vb_phase: 3 }], // FuE
      ['A3', { vb_phase: 3 }],
      ['A4', { vb_phase: 3 }],
      ['A5', { vb_phase: 5 }], // DS
    ]);
    const v = computeKontingentVerbrauch(z, idx, '2026-Q2');
    expect(v.get('MA01')).toEqual({ FuE: 2, DS: 1 });
  });

  it('ohne antraegeIndex → leere Map (keine Deckelung)', () => {
    const z: Zuweisung[] = [{ antragId: 'A1', anonId: 'MA01', quartal: '2026-Q2', stunden: 9, status: 'freigegeben' }];
    expect(computeKontingentVerbrauch(z, undefined, '2026-Q2').size).toBe(0);
  });
});

describe('kontingentInfoFor', () => {
  // stundenProTV=1 → Quartals-Kontingent in TVs == Stunden/Quartal (Math bleibt
  // wie vor der TV-Umstellung prüfbar).
  it('kein Kontingent gesetzt → neutral (Score 1, rest null)', () => {
    expect(kontingentInfoFor(maMit({}), 'FuE', undefined, 1)).toEqual({ score: 1, rest: null, kontingentQ: null });
  });

  it('Rest >= 1 → Score 1.0', () => {
    const info = kontingentInfoFor(maMit({ FuE: 8 }), 'FuE', { FuE: 0 }, 1); // Q-Kontingent 2 TVs
    expect(info.kontingentQ).toBe(2);
    expect(info.rest).toBe(2);
    expect(info.score).toBe(1);
  });

  it('0 < Rest < 1 → Score 0.8', () => {
    const info = kontingentInfoFor(maMit({ FuE: 6 }), 'FuE', { FuE: 1 }, 1); // Q 1.5, rest 0.5
    expect(info.score).toBe(0.8);
  });

  it('Rest <= 0 (überbucht) → weicher Malus 0.5', () => {
    const info = kontingentInfoFor(maMit({ FuE: 8 }), 'FuE', { FuE: 2 }, 1); // Q 2, rest 0
    expect(info.rest).toBe(0);
    expect(info.score).toBe(0.5);
  });

  it('stundenProTV konvertiert Stunden-Kontingent → TVs', () => {
    // 72 h/Jahr → 18 h/Quartal → /9 = 2 TVs Kontingent
    const info = kontingentInfoFor(maMit({ FuE: 72 }), 'FuE', { FuE: 1 }, 9);
    expect(info.kontingentQ).toBe(2);
    expect(info.rest).toBe(1);
    expect(info.score).toBe(1);
  });

  it('Antrag ohne Bucket (Irrläufer) → neutral', () => {
    expect(kontingentInfoFor(maMit({ FuE: 8 }), null, undefined, 9).score).toBe(1);
  });
});

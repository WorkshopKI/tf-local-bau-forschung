/**
 * buildPendingByAntrag — reine Gruppierung offener Übernahme-Wünsche zu
 * `antragId → anonIds[]` für die „vorgemerkt"-Markierung im Cockpit (v2.9).
 */
import { describe, it, expect } from 'vitest';
import { buildPendingByAntrag } from '../services/onboarding';
import { resolveAnonIdForUser } from '../services/identitaet';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag } from '@/core/services/csv/types';
import type { PersoenlicheUebernahmeWuensche } from '../types';

const wunsch = (kuerzel: string, antragIds: string[]): PersoenlicheUebernahmeWuensche => ({
  version: 1,
  kuerzel,
  updatedAt: '2026-06-01T00:00:00.000Z',
  wuensche: antragIds.map(antragId => ({
    antragId, quartal: '2026-Q2', anzahlTV: 1, createdAt: '2026-06-01T00:00:00.000Z',
  })),
});

describe('buildPendingByAntrag', () => {
  const antraege = [
    { aktenzeichen: 'X1', tib_kuerz: 'ABC' },
    { aktenzeichen: 'X2', tib_kuerz: 'XYZ' },
  ] as unknown as Antrag[];
  const map = buildAnonymMapForTests(antraege);
  const abc = resolveAnonIdForUser('ABC', map)!;
  const xyz = resolveAnonIdForUser('XYZ', map)!;

  it('gruppiert nach antragId und löst Kürzel→anonId auf', () => {
    const res = buildPendingByAntrag(
      [wunsch('ABC', ['A1', 'A2']), wunsch('XYZ', ['A1'])],
      map,
    );
    expect(new Set(res.get('A1'))).toEqual(new Set([abc, xyz]));
    expect(res.get('A2')).toEqual([abc]);
  });

  it('überspringt unauflösbare Kürzel (keine Phantom-Einträge)', () => {
    const res = buildPendingByAntrag([wunsch('UNBEKANNT', ['A1'])], map);
    expect(res.get('A1')).toBeUndefined();
    expect(res.size).toBe(0);
  });

  it('dedupliziert anonIds pro Antrag', () => {
    const res = buildPendingByAntrag([wunsch('ABC', ['A1']), wunsch('ABC', ['A1'])], map);
    expect(res.get('A1')).toEqual([abc]);
  });
});

/**
 * buildPendingByAntrag — reine Gruppierung offener Übernahme-Wünsche zu
 * `antragId → anonIds[]` für die „vorgemerkt"-Markierung im Cockpit (v2.9).
 *
 * Dazu (v2.290) der volle `WunschStand` + `findeZurueckgezogeneWuensche`: die
 * Rückzugs-Erkennung, die einen zurückgezogenen Wunsch aus dem Cockpit nimmt,
 * BEVOR die PL einsammelt.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPendingByAntrag,
  buildWunschStand,
  findeZurueckgezogeneWuensche,
} from '../services/onboarding';
import { resolveAnonIdForUser } from '../services/identitaet';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag } from '@/core/services/csv/types';
import type { PersoenlicheUebernahmeWuensche, Zuweisung } from '../types';

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

  it('merkt sich gelesene anonIds — auch bei LEERER Wunsch-Liste (alles zurückgezogen)', () => {
    const stand = buildWunschStand([wunsch('ABC', [])], map);
    expect(stand.byAntrag.size).toBe(0);
    expect(stand.gelesenAnonIds.has(abc)).toBe(true);
  });
});

describe('findeZurueckgezogeneWuensche', () => {
  const antraege = [
    { aktenzeichen: 'X1', tib_kuerz: 'ABC' },
    { aktenzeichen: 'X2', tib_kuerz: 'XYZ' },
  ] as unknown as Antrag[];
  const map = buildAnonymMapForTests(antraege);
  const abc = resolveAnonIdForUser('ABC', map)!;
  const xyz = resolveAnonIdForUser('XYZ', map)!;
  const Q = '2026-Q2';

  const selbst = (antragId: string, anonId: string): Zuweisung => ({
    antragId, anonId, quartal: Q, stunden: 9, anzahlTV: 1,
    status: 'selbst', selbstEingetragen: true,
  });

  it('erkennt einen Wunsch, der nicht mehr in der gelesenen Datei steht', () => {
    const stand = buildWunschStand([wunsch('ABC', ['A1'])], map);
    const res = findeZurueckgezogeneWuensche([selbst('A1', abc), selbst('A2', abc)], stand);
    expect(res.map(z => z.antragId)).toEqual(['A2']);
  });

  it('beurteilt NUR anonIds mit gelesener Datei (kein Phantom-Rückzug)', () => {
    // Nur ABCs Datei gelesen — XYZ bleibt unangetastet.
    const stand = buildWunschStand([wunsch('ABC', ['A1'])], map);
    expect(findeZurueckgezogeneWuensche([selbst('A9', xyz)], stand)).toEqual([]);
  });

  it('lässt eine Freigabe mit selbstEingetragen in Ruhe (Flag überlebt die Freigabe)', () => {
    const stand = buildWunschStand([wunsch('ABC', [])], map);
    const freigegeben: Zuweisung = {
      antragId: 'A1', anonId: abc, quartal: Q, stunden: 9, anzahlTV: 1,
      status: 'freigegeben', selbstEingetragen: true,
      freigegebenAm: '2026-06-02T00:00:00.000Z',
    };
    expect(findeZurueckgezogeneWuensche([freigegeben], stand)).toEqual([]);
  });

  it('ohne gelesene Dateien (kein Ordner-Zugriff) passiert nichts', () => {
    const leer = { byAntrag: new Map(), gelesenAnonIds: new Set<string>() };
    expect(findeZurueckgezogeneWuensche([selbst('A1', abc)], leer)).toEqual([]);
  });
});

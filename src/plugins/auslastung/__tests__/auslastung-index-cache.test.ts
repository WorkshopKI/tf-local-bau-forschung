/**
 * Tests fuer den Module-globalen Closure-Cache in useAuslastungIndex.
 *
 * Wichtig: dieser Cache haelt das Ergebnis von `computeQuartalsAuslastung` +
 * `computeAltlasten` ueber Komponenten-Unmounts hinaus — Folge-Calls mit
 * gleichen Input-Refs sind O(1). Bei Re-Mount des `AuslastungIndexProvider`
 * (z.B. nach Plugin-Wechsel) ist das der Hauptperformance-Hebel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import {
  getOrComputeIndex,
  invalidateAuslastungIndexCache,
} from '../hooks/useAuslastungIndex';
import type { Zuweisung } from '../types';

function makeAntrag(overrides: Partial<Antrag> & Pick<Antrag, 'aktenzeichen'>): Antrag {
  return {
    _updated_at: '2026-04-15T12:00:00Z',
    ...overrides,
  } as Antrag;
}

describe('getOrComputeIndex — Closure-Cache', () => {
  beforeEach(() => {
    invalidateAuslastungIndexCache();
  });

  it('zweiter Call mit identischen Refs liefert dasselbe Index-Objekt (===)', () => {
    const antraege: Antrag[] = [
      makeAntrag({ aktenzeichen: 'A1', tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),
    ];
    const zuweisungen: Zuweisung[] = [];
    const toAnon = new Map([['MUE', 'MA01']]);
    const a = getOrComputeIndex(antraege, zuweisungen, toAnon, '2026-Q2', 9);
    const b = getOrComputeIndex(antraege, zuweisungen, toAnon, '2026-Q2', 9);
    expect(b).toBe(a);  // exakt dieselbe Objekt-Referenz
    expect(b.auslastungByAnon).toBe(a.auslastungByAnon);
    expect(b.altlastByAnon).toBe(a.altlastByAnon);
  });

  it('andere antraege-Ref → re-compute (neues Objekt)', () => {
    const toAnon = new Map([['MUE', 'MA01']]);
    const a = getOrComputeIndex([makeAntrag({ aktenzeichen: 'A1' })], [], toAnon, '2026-Q2', 9);
    const b = getOrComputeIndex([makeAntrag({ aktenzeichen: 'A2' })], [], toAnon, '2026-Q2', 9);
    expect(b).not.toBe(a);
  });

  it('anderes quartal → re-compute', () => {
    const antraege: Antrag[] = [];
    const toAnon = new Map();
    const a = getOrComputeIndex(antraege, [], toAnon, '2026-Q2', 9);
    const b = getOrComputeIndex(antraege, [], toAnon, '2026-Q3', 9);
    expect(b).not.toBe(a);
  });

  it('anderer stundenProTV → re-compute', () => {
    const antraege: Antrag[] = [];
    const toAnon = new Map();
    const a = getOrComputeIndex(antraege, [], toAnon, '2026-Q2', 9);
    const b = getOrComputeIndex(antraege, [], toAnon, '2026-Q2', 12);
    expect(b).not.toBe(a);
  });

  it('invalidateAuslastungIndexCache zwingt Re-Compute', () => {
    const antraege: Antrag[] = [];
    const toAnon = new Map();
    const a = getOrComputeIndex(antraege, [], toAnon, '2026-Q2', 9);
    invalidateAuslastungIndexCache();
    const b = getOrComputeIndex(antraege, [], toAnon, '2026-Q2', 9);
    expect(b).not.toBe(a);
  });
});

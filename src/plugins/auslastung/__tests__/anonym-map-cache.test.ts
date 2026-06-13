/**
 * Tests fuer den Module-globalen Closure-Cache in `buildAnonymMapFromKuerzelMap`
 * (Hebel C+ aus Performance-Patch v2.12).
 *
 * Hintergrund: dieser Cache ist die Voraussetzung dafuer, dass der `cachedIndex`
 * in useAuslastungIndex.ts beim Re-Mount tatsaechlich greift — sonst liefert
 * der useMemo-Aufruf in useAntraegeCache.ts jedes Mal eine frische AnonymMap-Ref
 * und der Index-Cache sieht einen Miss in seinem `toAnon`-Key-Vergleich.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildAnonymMapFromKuerzelMap,
  invalidateAnonymMapCache,
  type KuerzelMapFile,
} from '../services/identitaet';

function makeFile(entries: Array<{ kuerzel: string; anonId: string }>): KuerzelMapFile {
  return {
    version: 1,
    updatedAt: '2026-05-27T10:00:00Z',
    entries: entries.map(e => ({ ...e, createdAt: '2026-05-27T10:00:00Z' })),
  };
}

describe('buildAnonymMapFromKuerzelMap — Closure-Cache', () => {
  beforeEach(() => {
    invalidateAnonymMapCache();
  });

  it('Folge-Call mit identischer file-Ref liefert dieselbe AnonymMap (===)', () => {
    const file = makeFile([{ kuerzel: 'MUE', anonId: 'MA01' }]);
    const a = buildAnonymMapFromKuerzelMap(file);
    const b = buildAnonymMapFromKuerzelMap(file);
    expect(b).toBe(a);
    expect(b.toAnon).toBe(a.toAnon);
    expect(b.toReal).toBe(a.toReal);
  });

  it('andere file-Ref → Re-Compute (neue Map, aber gleicher Inhalt moeglich)', () => {
    const file1 = makeFile([{ kuerzel: 'MUE', anonId: 'MA01' }]);
    const file2 = makeFile([{ kuerzel: 'MUE', anonId: 'MA01' }]);
    const a = buildAnonymMapFromKuerzelMap(file1);
    const b = buildAnonymMapFromKuerzelMap(file2);
    expect(b).not.toBe(a);
    expect(b.toAnon.get('MUE')).toBe('MA01');
  });

  it('invalidateAnonymMapCache zwingt Re-Compute auch bei identischer file-Ref', () => {
    const file = makeFile([{ kuerzel: 'MUE', anonId: 'MA01' }]);
    const a = buildAnonymMapFromKuerzelMap(file);
    invalidateAnonymMapCache();
    const b = buildAnonymMapFromKuerzelMap(file);
    expect(b).not.toBe(a);
  });

  it('leere file wird genauso gecacht', () => {
    const file = makeFile([]);
    const a = buildAnonymMapFromKuerzelMap(file);
    expect(a.toAnon.size).toBe(0);
    const b = buildAnonymMapFromKuerzelMap(file);
    expect(b).toBe(a);
  });

  it('toAnon + toReal-Maps bleiben bei Cache-Hit referenz-identisch', () => {
    // Das ist der eigentliche Wert des Caches: useAuslastungIndex.cachedIndex
    // vergleicht via `toAnon === ...` — die Sub-Map-Identitaet muss stabil sein.
    const file = makeFile([
      { kuerzel: 'ALB', anonId: 'MA01' },
      { kuerzel: 'MUE', anonId: 'MA02' },
    ]);
    const a = buildAnonymMapFromKuerzelMap(file);
    const toAnonBefore = a.toAnon;
    const toRealBefore = a.toReal;
    const b = buildAnonymMapFromKuerzelMap(file);
    expect(b.toAnon).toBe(toAnonBefore);
    expect(b.toReal).toBe(toRealBefore);
  });
});

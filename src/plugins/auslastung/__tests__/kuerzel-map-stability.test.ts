/**
 * Tests fuer den `isSameKuerzelContent`-Helper aus useKuerzelMap.ts
 * (Hebel C aus Performance-Patch v2.12).
 *
 * Wenn die Inhalte fachlich identisch sind, soll der Store die alte file-Ref
 * behalten — sonst kaskadiert die 5er-useMemo-Kette in useAntraegeCache.ts
 * mehrfach durch beim Initial-Mount (Bootstrap-Phase).
 *
 * Beziehung zur Append-only-Invariante: bei gleichem Inhalt sind auch die
 * Indizes stabil (entries[i].anonId === MA{i+1}), daher reicht der Kuerzel-
 * Vergleich an Position i.
 */
import { describe, it, expect } from 'vitest';
import { isSameKuerzelContent } from '../hooks/useKuerzelMap';
import type { KuerzelMapFile } from '../services/kuerzel-map';

function makeFile(kuerzel: string[]): KuerzelMapFile {
  return {
    version: 1,
    updatedAt: '2026-05-27T10:00:00Z',
    entries: kuerzel.map((k, i) => ({
      kuerzel: k,
      anonId: `MA${String(i + 1).padStart(2, '0')}`,
      createdAt: '2026-05-27T10:00:00Z',
    })),
  };
}

describe('isSameKuerzelContent', () => {
  it('identische Ref → true', () => {
    const f = makeFile(['MUE', 'ALB']);
    expect(isSameKuerzelContent(f, f)).toBe(true);
  });

  it('zwei leere Files → true', () => {
    expect(isSameKuerzelContent(makeFile([]), makeFile([]))).toBe(true);
  });

  it('zwei Files mit gleichem Inhalt (verschiedene Refs) → true', () => {
    const a = makeFile(['MUE', 'ALB']);
    const b = makeFile(['MUE', 'ALB']);
    expect(a).not.toBe(b);
    expect(isSameKuerzelContent(a, b)).toBe(true);
  });

  it('unterschiedliche Anzahl → false', () => {
    expect(isSameKuerzelContent(makeFile(['MUE']), makeFile(['MUE', 'ALB']))).toBe(false);
  });

  it('gleiche Anzahl, unterschiedliche Kuerzel → false', () => {
    expect(isSameKuerzelContent(makeFile(['MUE']), makeFile(['ALB']))).toBe(false);
  });

  it('gleiche Anzahl, gleiche Kuerzel in anderer Reihenfolge → false', () => {
    // Append-only-Invariante: Reihenfolge bestimmt anonId. Eine Permutation
    // der Eintraege ist semantisch eine andere AnonymMap.
    expect(isSameKuerzelContent(makeFile(['MUE', 'ALB']), makeFile(['ALB', 'MUE']))).toBe(false);
  });

  it('unterschiedlicher updatedAt aendert das Ergebnis nicht (nur Kuerzel-Vergleich)', () => {
    const a: KuerzelMapFile = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      entries: [{ kuerzel: 'MUE', anonId: 'MA01', createdAt: '2026-01-01T00:00:00Z' }],
    };
    const b: KuerzelMapFile = {
      version: 1,
      updatedAt: '2026-12-31T23:59:59Z',
      entries: [{ kuerzel: 'MUE', anonId: 'MA01', createdAt: '2026-12-31T23:59:59Z' }],
    };
    expect(isSameKuerzelContent(a, b)).toBe(true);
  });
});

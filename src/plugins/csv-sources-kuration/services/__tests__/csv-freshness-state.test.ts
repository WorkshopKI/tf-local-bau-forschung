/**
 * Regression gegen den 2026-06-Vorfall: In einem Produktions-Build darf eine
 * Fixture-Quelle (`fixture-real-*`) oder eine unerreichbare Datei den ● CSV-Punkt
 * NICHT „fresh/grün" machen — sonst läuft der Import „durch, ohne dass etwas
 * ankommt". In dev sind Fixtures erwartet (gebündelt) und kein Problem.
 */
import { describe, it, expect } from 'vitest';
import { deriveCsvFreshnessState, type FreshnessInput } from '../csv-freshness-state';

function base(over: Partial<FreshnessInput> = {}): FreshnessInput {
  return {
    totalSchemas: 3,
    candidates: 0,
    permissionNeeded: 0,
    unlinked: 0,
    fixtures: 0,
    fileMissing: 0,
    isProd: true,
    ...over,
  };
}

describe('deriveCsvFreshnessState', () => {
  it('prod + Fixture-Quelle → NICHT fresh, misconfig=true (Kern-Regression)', () => {
    const d = deriveCsvFreshnessState(base({ fixtures: 1 }));
    expect(d.state).not.toBe('fresh');
    expect(d.state).toBe('stale');
    expect(d.misconfig).toBe(true);
  });

  it('nur Fixture-Quellen in prod → misconfig, kein grün', () => {
    // alle 3 Schemas sind Fixtures → früher fälschlich „fresh" (reachable>0).
    const d = deriveCsvFreshnessState(base({ totalSchemas: 3, fixtures: 3 }));
    expect(d.state).toBe('stale');
    expect(d.misconfig).toBe(true);
  });

  it('dev + Fixture-Quelle → fresh, kein misconfig (Fixtures dort erwartet)', () => {
    const d = deriveCsvFreshnessState(base({ fixtures: 1, isProd: false }));
    expect(d.state).toBe('fresh');
    expect(d.misconfig).toBe(false);
  });

  it('unerreichbare Datei → misconfig, kein grün (auch in dev)', () => {
    const d = deriveCsvFreshnessState(base({ fileMissing: 1, isProd: false }));
    expect(d.state).toBe('stale');
    expect(d.misconfig).toBe(true);
  });

  it('alles importiert, erreichbar → fresh', () => {
    const d = deriveCsvFreshnessState(base());
    expect(d.state).toBe('fresh');
    expect(d.misconfig).toBe(false);
  });

  it('offen: geänderte Exporte (candidates) → stale, kein misconfig', () => {
    const d = deriveCsvFreshnessState(base({ candidates: 2 }));
    expect(d.state).toBe('stale');
    expect(d.misconfig).toBe(false);
  });

  it('nichts erreichbar (alles Permission/unlinked) → unknown', () => {
    const d = deriveCsvFreshnessState(base({ totalSchemas: 2, permissionNeeded: 1, unlinked: 1 }));
    expect(d.state).toBe('unknown');
    expect(d.misconfig).toBe(false);
  });
});

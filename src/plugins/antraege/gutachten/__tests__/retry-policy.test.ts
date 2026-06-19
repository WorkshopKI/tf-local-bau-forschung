import { describe, it, expect } from 'vitest';
import { chooseRetryModifier } from '../retry-policy';
import type { CheckResult } from '@/core/services/skills';

const check = (over: Partial<CheckResult>): CheckResult => ({ id: 'r', level: 'fehler', label: 'L', ...over });

describe('chooseRetryModifier — deterministische Modifier-Wahl', () => {
  it('keine Fehler (leer / nur ok / nur hinweis) → null (kein Retry)', () => {
    expect(chooseRetryModifier([])).toBeNull();
    expect(chooseRetryModifier([check({ level: 'ok' })])).toBeNull();
    expect(chooseRetryModifier([check({ level: 'hinweis', richtung: 'zu_lang' })])).toBeNull();
  });

  it('alle Fehler „zu lang" → kuerzer', () => {
    expect(chooseRetryModifier([check({ richtung: 'zu_lang' })])).toBe('kuerzer');
    expect(chooseRetryModifier([
      check({ id: 'a', richtung: 'zu_lang' }),
      check({ id: 'b', richtung: 'zu_lang' }),
    ])).toBe('kuerzer');
  });

  it('alle Fehler „zu kurz" → laenger', () => {
    expect(chooseRetryModifier([check({ richtung: 'zu_kurz' })])).toBe('laenger');
  });

  it('Fehler ohne Richtung (verbotenes Muster etc.) → neu', () => {
    expect(chooseRetryModifier([check({})])).toBe('neu');
    // gemischt: Größen-Fehler + richtungsloser Fehler → neu
    expect(chooseRetryModifier([
      check({ id: 'a', richtung: 'zu_lang' }),
      check({ id: 'b' }),
    ])).toBe('neu');
  });

  it('widersprüchliche Richtungen (zu lang UND zu kurz) → neu', () => {
    expect(chooseRetryModifier([
      check({ id: 'a', richtung: 'zu_lang' }),
      check({ id: 'b', richtung: 'zu_kurz' }),
    ])).toBe('neu');
  });

  it('ignoriert hinweis-Level-Checks bei der Richtungsbestimmung', () => {
    // Ein zu_lang-Fehler + ein hinweis (mit Gegenrichtung) → nur der Fehler zählt → kuerzer
    expect(chooseRetryModifier([
      check({ id: 'a', level: 'fehler', richtung: 'zu_lang' }),
      check({ id: 'b', level: 'hinweis', richtung: 'zu_kurz' }),
    ])).toBe('kuerzer');
  });
});

/**
 * Loop-Terminierung: simuliert den Hook-Orchestrator als reine Schleife über
 * chooseRetryModifier — er endet IMMER nach höchstens N Versuchen (harte Decke).
 */
describe('Auto-Retry-Loop — Terminierung (Decke N)', () => {
  function simulate(persistentChecks: CheckResult[], max: number): number {
    let checks: CheckResult[] | null = persistentChecks;
    let attempt = 0;
    while (checks && attempt < max) {
      const mod = chooseRetryModifier(checks);
      if (!mod) break;
      attempt += 1;
      checks = persistentChecks; // Fehler bleibt bestehen (worst case)
    }
    return attempt;
  }

  it('läuft höchstens N-mal bei dauerhaftem Fehler', () => {
    expect(simulate([check({ richtung: 'zu_lang' })], 2)).toBe(2);
    expect(simulate([check({ richtung: 'zu_lang' })], 0)).toBe(0);
    expect(simulate([check({ richtung: 'zu_lang' })], 3)).toBe(3);
  });

  it('kein Retry, wenn nur Hinweise/ok bestehen', () => {
    expect(simulate([check({ level: 'ok' })], 3)).toBe(0);
  });
});

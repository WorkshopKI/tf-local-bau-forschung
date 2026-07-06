import { describe, it, expect } from 'vitest';
import { pruefSummary } from '../pruefSummary';
import type { CheckResult } from '@/core/services/skills';

function c(level: CheckResult['level'], id: string = level): CheckResult {
  return { id, level, label: 'x' };
}

describe('pruefSummary', () => {
  it('zählt Fehler und Hinweise getrennt, ok zählt nicht', () => {
    expect(pruefSummary([c('fehler', 'a'), c('fehler', 'b'), c('hinweis', 'c'), c('ok', 'd')]))
      .toEqual({ fehler: 2, hinweis: 1 });
  });
  it('leere Liste → 0/0', () => {
    expect(pruefSummary([])).toEqual({ fehler: 0, hinweis: 0 });
  });
  it('nur ok → 0/0', () => {
    expect(pruefSummary([c('ok', 'a'), c('ok', 'b')])).toEqual({ fehler: 0, hinweis: 0 });
  });
});

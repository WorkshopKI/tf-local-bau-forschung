import { describe, it, expect } from 'vitest';
import { aggregate, cellAt } from '../aggregate';
import type { EvalRunResult, JudgeResult } from '../types';
import type { CheckResult, CheckLevel } from '@/core/services/skills';
import type { StepId } from '@/plugins/antraege/gutachten/types';

function checks(levels: CheckLevel[]): CheckResult[] {
  return levels.map((level, i) => ({ id: `c${i}`, level, label: `check ${i}`, regelId: `c${i}` }));
}

function run(abschnitt: StepId, modellId: string, levels: CheckLevel[], fehler?: string): EvalRunResult {
  return {
    vbFile: 'f.md',
    modellId,
    abschnitt,
    skillId: 'gutachten-x',
    raw: fehler ? '' : 'text',
    parsed: fehler ? null : { quellenanalyse: '', entwurf: '', finalerText: 'text' },
    checks: fehler ? [] : checks(levels),
    ...(fehler ? { fehler } : {}),
    dauerMs: 1,
  };
}

interface JudgeOpts {
  fk?: number | null;
  vo?: number | null;
  sp?: number | null;
  rt?: number | null;
  pv?: string | null;
  fehler?: boolean;
}
function judge(abschnitt: StepId, modellId: string, s: JudgeOpts): JudgeResult {
  return {
    vbFile: 'f.md',
    modellId,
    abschnitt,
    fachliche_korrektheit: s.fk ?? null,
    vollstaendigkeit: s.vo ?? null,
    sprachqualitaet: s.sp ?? null,
    regeltreue: s.rt ?? null,
    begruendung: null,
    prompt_verbesserung: s.pv ?? null,
    ...(s.fehler ? { fehler: true } : {}),
  };
}

describe('aggregate', () => {
  it('leere Eingabe → leere Matrix (kein Crash)', () => {
    const m = aggregate([], []);
    expect(m.cells).toEqual([]);
    expect(m.modelle).toEqual([]);
    expect(m.abschnitte).toEqual([]);
  });

  it('Check-Raten über alle Checks der Zelle', () => {
    const m = aggregate(
      [
        run('A', 'm1', ['ok', 'ok']),
        run('A', 'm1', ['fehler', 'hinweis']),
      ],
      [],
    );
    const cell = cellAt(m, 'A', 'm1')!;
    expect(cell.n).toBe(2);
    expect(cell.checkSummen).toEqual({ ok: 2, hinweis: 1, fehler: 1, total: 4 });
    expect(cell.checkOkRate).toBe(0.5);
    expect(cell.checkFehlerRate).toBe(0.25);
    expect(cell.checkHinweisRate).toBe(0.25);
  });

  it('Läufe mit Transport-Fehler zählen in n, aber tragen keine Checks bei', () => {
    const m = aggregate([run('A', 'm1', ['ok']), run('A', 'm1', [], 'boom')], []);
    const cell = cellAt(m, 'A', 'm1')!;
    expect(cell.n).toBe(2);
    expect(cell.laeufeMitFehler).toBe(1);
    expect(cell.checkSummen.total).toBe(1);
    expect(cell.checkOkRate).toBe(1);
  });

  it('keine Checks → Raten sind null (kein 0/0)', () => {
    const m = aggregate([run('A', 'm1', [])], []);
    expect(cellAt(m, 'A', 'm1')!.checkOkRate).toBeNull();
  });

  it('Judge-Mittel ignorieren null + fehlerhafte Judges', () => {
    const m = aggregate(
      [run('A', 'm1', ['ok'])],
      [
        judge('A', 'm1', { fk: 4, vo: 2, pv: 'mehr Marktbezug' }),
        judge('A', 'm1', { fk: null, vo: null, fehler: true }), // ignoriert
      ],
    );
    const cell = cellAt(m, 'A', 'm1')!;
    expect(cell.judgeN).toBe(1);
    expect(cell.judge.fachliche_korrektheit).toBe(4);
    expect(cell.judge.vollstaendigkeit).toBe(2);
    expect(cell.judge.sprachqualitaet).toBeNull();
    // gesamt = Mittel der vorhandenen Subscore-Mittel (4, 2) = 3
    expect(cell.judge.gesamt).toBe(3);
    expect(cell.promptVerbesserungen).toEqual(['mehr Marktbezug']);
  });

  it('Subscore-Mittel über mehrere Judges', () => {
    const m = aggregate(
      [run('A', 'm1', ['ok'])],
      [judge('A', 'm1', { fk: 5 }), judge('A', 'm1', { fk: 2 })],
    );
    expect(cellAt(m, 'A', 'm1')!.judge.fachliche_korrektheit).toBe(3.5);
  });

  it('stabile Sortierung: Abschnitte A→G, dann Modelle alphabetisch', () => {
    const m = aggregate(
      [
        run('C', 'zeta', ['ok']),
        run('A', 'beta', ['ok']),
        run('A', 'alpha', ['ok']),
      ],
      [],
    );
    expect(m.cells.map(c => `${c.abschnitt}:${c.modellId}`)).toEqual(['A:alpha', 'A:beta', 'C:zeta']);
    expect(m.modelle).toEqual(['alpha', 'beta', 'zeta']);
    expect(m.abschnitte).toEqual(['A', 'C']);
  });

  it('Zelle nur mit Judges (ohne Runs) erscheint mit n=0', () => {
    const m = aggregate([], [judge('B', 'm1', { fk: 3 })]);
    const cell = cellAt(m, 'B', 'm1')!;
    expect(cell.n).toBe(0);
    expect(cell.judge.fachliche_korrektheit).toBe(3);
  });

  it('Kontext-Achse: voll und relevant landen in GETRENNTEN Zellen', () => {
    const m = aggregate(
      [
        { ...run('A', 'm1', ['ok', 'ok']), kontext: 'voll' },
        { ...run('A', 'm1', ['fehler']), kontext: 'relevant' },
      ],
      [],
    );
    expect(m.kontexte).toEqual(['voll', 'relevant']);
    expect(cellAt(m, 'A', 'm1', 'voll')!.checkOkRate).toBe(1);
    expect(cellAt(m, 'A', 'm1', 'relevant')!.checkFehlerRate).toBe(1);
    // Default-Lookup zielt auf 'voll'.
    expect(cellAt(m, 'A', 'm1')).toBe(cellAt(m, 'A', 'm1', 'voll'));
  });

  it('fehlende Kontext-Markierung (Alt-Zeile) → als „voll" gruppiert', () => {
    const m = aggregate([run('A', 'm1', ['ok'])], []); // run() setzt kein kontext
    expect(m.kontexte).toEqual(['voll']);
    expect(cellAt(m, 'A', 'm1', 'voll')!.n).toBe(1);
  });
});

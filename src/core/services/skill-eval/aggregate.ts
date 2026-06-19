/**
 * Aggregiert die Roh-Läufe (`EvalRunResult[]`) + Judge-Bewertungen
 * (`JudgeResult[]`) zur Skill×Modell-Matrix: pro `(abschnitt × modell)`-Zelle
 * die deterministischen Check-Raten, die Judge-Mittel je Subscore + Gesamt und
 * die gesammelten Prompt-Verbesserungsvorschläge.
 *
 * Rein + deterministisch: stabile Sortierung, fehlende Judge-Daten toleriert,
 * leere Eingabe → leere Matrix (kein Crash).
 */
import { STEP_ORDER, type StepId } from '@/plugins/antraege/gutachten/types';
import { JUDGE_DIMENSIONS, type JudgeDimension, type EvalRunResult, type JudgeResult } from './types';

export interface CheckSummen {
  ok: number;
  hinweis: number;
  fehler: number;
  total: number;
}

export interface JudgeMittel {
  fachliche_korrektheit: number | null;
  vollstaendigkeit: number | null;
  sprachqualitaet: number | null;
  regeltreue: number | null;
  /** Mittel der vier (vorhandenen) Subscore-Mittel. */
  gesamt: number | null;
}

export interface MatrixCell {
  abschnitt: StepId;
  modellId: string;
  /** Anzahl Läufe in der Zelle (inkl. fehlgeschlagener). */
  n: number;
  /** Läufe mit Transport-/Skill-Fehler (kein Output, keine Checks). */
  laeufeMitFehler: number;
  /** Anteil der Checks je Level (über ALLE Checks der Zelle); `null` ohne Checks. */
  checkOkRate: number | null;
  checkHinweisRate: number | null;
  checkFehlerRate: number | null;
  checkSummen: CheckSummen;
  judge: JudgeMittel;
  /** Anzahl gültiger (nicht-fehler) Judge-Bewertungen in der Zelle. */
  judgeN: number;
  /** Konkrete Prompt-Verbesserungsvorschläge (nicht-leer, Reihenfolge stabil). */
  promptVerbesserungen: string[];
}

export interface EvalMatrix {
  cells: MatrixCell[];
  /** Distinkte Modell-IDs, alphabetisch (Spalten der Matrix). */
  modelle: string[];
  /** Vorhandene Abschnitte in A–G-Reihenfolge (Zeilen der Matrix). */
  abschnitte: StepId[];
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round2(x: number | null): number | null {
  return x === null ? null : Math.round(x * 100) / 100;
}

function dimMean(valid: JudgeResult[], dim: JudgeDimension): number | null {
  return round2(mean(valid.map(j => j[dim]).filter((v): v is number => v !== null)));
}

interface CellGroup {
  abschnitt: StepId;
  modellId: string;
  runs: EvalRunResult[];
  judges: JudgeResult[];
}

function buildCell(group: CellGroup): MatrixCell {
  const { abschnitt, modellId, runs, judges } = group;
  let ok = 0;
  let hinweis = 0;
  let fehler = 0;
  for (const r of runs) {
    for (const ch of r.checks) {
      if (ch.level === 'ok') ok++;
      else if (ch.level === 'hinweis') hinweis++;
      else if (ch.level === 'fehler') fehler++;
    }
  }
  const total = ok + hinweis + fehler;
  const rate = (x: number): number | null => (total === 0 ? null : round2(x / total));

  const valid = judges.filter(j => !j.fehler);
  const fk = dimMean(valid, 'fachliche_korrektheit');
  const vo = dimMean(valid, 'vollstaendigkeit');
  const sp = dimMean(valid, 'sprachqualitaet');
  const rt = dimMean(valid, 'regeltreue');
  const gesamt = round2(mean([fk, vo, sp, rt].filter((v): v is number => v !== null)));

  return {
    abschnitt,
    modellId,
    n: runs.length,
    laeufeMitFehler: runs.filter(r => r.fehler).length,
    checkOkRate: rate(ok),
    checkHinweisRate: rate(hinweis),
    checkFehlerRate: rate(fehler),
    checkSummen: { ok, hinweis, fehler, total },
    judge: { fachliche_korrektheit: fk, vollstaendigkeit: vo, sprachqualitaet: sp, regeltreue: rt, gesamt },
    judgeN: valid.length,
    promptVerbesserungen: judges
      .map(j => j.prompt_verbesserung)
      .filter((v): v is string => typeof v === 'string' && v.trim() !== ''),
  };
}

const cellKey = (abschnitt: StepId, modellId: string): string => `${abschnitt}::${modellId}`;

export function aggregate(results: EvalRunResult[], judges: JudgeResult[]): EvalMatrix {
  const groups = new Map<string, CellGroup>();
  const ensure = (abschnitt: StepId, modellId: string): CellGroup => {
    const k = cellKey(abschnitt, modellId);
    let g = groups.get(k);
    if (!g) {
      g = { abschnitt, modellId, runs: [], judges: [] };
      groups.set(k, g);
    }
    return g;
  };

  for (const r of results) ensure(r.abschnitt, r.modellId).runs.push(r);
  for (const j of judges) ensure(j.abschnitt, j.modellId).judges.push(j);

  const cells = [...groups.values()].map(buildCell);

  const sectionRank = (s: StepId): number => STEP_ORDER.indexOf(s);
  cells.sort((a, b) => sectionRank(a.abschnitt) - sectionRank(b.abschnitt) || a.modellId.localeCompare(b.modellId));

  const modelle = [...new Set(cells.map(c => c.modellId))].sort((a, b) => a.localeCompare(b));
  const abschnitte = STEP_ORDER.filter(s => cells.some(c => c.abschnitt === s));

  return { cells, modelle, abschnitte };
}

/** Lookup einer Zelle (für Report-Tabellen). */
export function cellAt(matrix: EvalMatrix, abschnitt: StepId, modellId: string): MatrixCell | undefined {
  return matrix.cells.find(c => c.abschnitt === abschnitt && c.modellId === modellId);
}

// JUDGE_DIMENSIONS hier re-exportiert, damit der Report die Spalten-Reihenfolge
// aus EINER Quelle zieht.
export { JUDGE_DIMENSIONS };

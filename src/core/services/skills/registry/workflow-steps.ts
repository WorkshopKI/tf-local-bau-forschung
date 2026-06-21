/**
 * Reine, layer-agnostische Workflow-Schritt-Helfer. Hier wohnt die Logik, die im
 * Datensatz NICHT stehen darf — allen voran die Gate-Auswertung (kein `eval()`,
 * keine Funktions-Strings im JSON). In Phase 5 kommen `computeStepNumbers` /
 * `flattenStepsTopological` dazu.
 */
import type { GateExpr, WorkflowStep } from './types';

/**
 * Minimaler Kontext für die Gate-Auswertung — bewusst STRUKTURELL typisiert (kein
 * `KurzfassungContext`-Import aus der Plugin-Schicht). Der Gutachten-`ctx` ist
 * zuweisungskompatibel (`teilvorhaben` ist ein Array).
 */
export interface GateContext {
  teilvorhaben: readonly unknown[];
}

/* -------------------------------------------------------------------------- */
/* Rolle + Auto-Retry: Defaults, Klemmung, abhängige Felder (reine Funktion)    */
/* -------------------------------------------------------------------------- */

/** Harte Obergrenze des beschränkten Auto-Retry (Decke). */
export const MAX_AUTO_RETRIES = 3;
/** Default-Versuchszahl, wenn Auto-Retry aktiv ist, aber keine Zahl gesetzt wurde. */
export const DEFAULT_MAX_RETRIES = 2;

/** Klemmt `maxRetries` auf `[0..MAX_AUTO_RETRIES]`; fehlend/ungültig → Default 2. */
export function clampMaxRetries(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_MAX_RETRIES;
  return Math.max(0, Math.min(MAX_AUTO_RETRIES, Math.round(n)));
}

/**
 * Normalisiert Rolle + die davon abhängigen Felder eines Schritts (rein, typ→typ).
 * Hält die Invarianten EINMAL fest (eine Quelle für Laden + Speichern):
 *  - `rolle` default `'generierung'` → wird weggelassen (additiv, kein Daten-Drift).
 *  - `'llm_qs'`: behält `qsZielStepId`; `autoRetry`/`maxRetries` entfallen.
 *  - `'generierung'`: `qsZielStepId` entfällt; `autoRetry`/`maxRetries` nur bei `autoRetry`,
 *    `maxRetries` dann auf `[0..3]` geklemmt.
 */
export function normalizeStepRolle(step: WorkflowStep): WorkflowStep {
  const base: WorkflowStep = { ...step };
  delete base.rolle;
  delete base.qsZielStepId;
  delete base.autoRetry;
  delete base.maxRetries;
  if (step.rolle === 'llm_qs') {
    base.rolle = 'llm_qs';
    if (step.qsZielStepId) base.qsZielStepId = step.qsZielStepId;
  } else if (step.autoRetry) {
    base.autoRetry = true;
    base.maxRetries = clampMaxRetries(step.maxRetries);
  }
  // kontextBedarf: nur die nicht-default Werte behalten; `'voll'`/Unbekanntes → weglassen.
  delete base.kontextBedarf;
  if (step.kontextBedarf === 'relevant' || step.kontextBedarf === 'nur_zieltext' || step.kontextBedarf === 'kein') {
    base.kontextBedarf = step.kontextBedarf;
  }
  return base;
}

/**
 * Wertet ein deklaratives Anwendbarkeits-Gate aus. `'hat_teilvorhaben'` ⇒ es gibt
 * mindestens ein Teilvorhaben; alles andere (inkl. `undefined` / unbekannte Werte)
 * ⇒ `true` (anwendbar). Reine Funktion, trivial testbar.
 */
export function evalGate(expr: GateExpr | undefined, ctx: GateContext): boolean {
  if (expr === 'hat_teilvorhaben') return ctx.teilvorhaben.length > 0;
  return true;
}

/* -------------------------------------------------------------------------- */
/* Eine Gruppierungs-Ebene: Top-Level + Unterschritte (genau eine Ebene)        */
/* -------------------------------------------------------------------------- */

/**
 * Ein Schritt ist ein ECHTES Kind, wenn sein `parentStepId` auf einen existier-
 * enden Schritt zeigt, der SELBST kein Kind ist (genau eine Ebene). Dangling-/
 * Tiefe-2-/Selbst-Referenzen gelten als Top-Level — deckungsgleich mit der
 * Klemm-Logik in `storage.normalizeWorkflowDef`.
 */
function makeIstKind(steps: readonly WorkflowStep[]): (s: WorkflowStep) => boolean {
  const ids = new Set(steps.map(s => s.id));
  const hatParent = new Set(steps.filter(s => s.parentStepId).map(s => s.id));
  return (s: WorkflowStep): boolean =>
    !!s.parentStepId && s.parentStepId !== s.id && ids.has(s.parentStepId) && !hatParent.has(s.parentStepId);
}

/**
 * Flacht die (eine) Hierarchie topologisch ab: jeder Top-Level-Schritt, direkt
 * gefolgt von seinen Kindern (jeweils in ursprünglicher Reihenfolge). Diese Liste
 * ist die autoritative Iterations-/Generierungs-Reihenfolge der Laufzeit. Für eine
 * bereits flache Liste (zim-ep) ist sie die Identität (Verhalten unverändert).
 */
export function flattenStepsTopological(steps: readonly WorkflowStep[]): WorkflowStep[] {
  const istKind = makeIstKind(steps);
  const tops = steps.filter(s => !istKind(s));
  const result: WorkflowStep[] = [];
  for (const top of tops) {
    result.push(top);
    for (const s of steps) if (istKind(s) && s.parentStepId === top.id) result.push(s);
  }
  return result;
}

/**
 * Berechnet die Anzeige-Nummern aus der Hierarchie: Top-Level `1,2,3,…`, Kinder
 * `5a,5b,5c` relativ zu ihrem Parent. Reine Funktion (kein Schreiben). Liefert eine
 * Map `id → nr`.
 */
export function computeStepNumbers(steps: readonly WorkflowStep[]): Map<string, string> {
  const istKind = makeIstKind(steps);
  const out = new Map<string, string>();
  let topCount = 0;
  let lastTopNr = '';
  let childLetter = 0;
  for (const s of flattenStepsTopological(steps)) {
    if (!istKind(s)) {
      topCount += 1;
      lastTopNr = String(topCount);
      childLetter = 0;
      out.set(s.id, lastTopNr);
    } else {
      out.set(s.id, `${lastTopNr}${String.fromCharCode(97 + childLetter)}`);
      childLetter += 1;
    }
  }
  return out;
}

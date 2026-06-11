/**
 * Deterministische State Machine des Gutachten-Workflows A–G. REINE Funktionen
 * `(run, …) → run` — kein IO, kein React, kein `Date.now()` (now + Inhalt werden
 * hereingereicht, analog `appendVerlauf`). Das macht alle Übergänge trivial
 * testbar. Der Hook ruft einen Reducer und persistiert das Ergebnis (nie während
 * des Streams). KEINE LLM-Entscheidung über Ablauf/Gates, KEIN Auto-Retry.
 */
import type { CheckResult, SkillModifierKey } from '@/core/services/skills';
import { appendVerlauf, restoreVersion } from '../kurzfassung/kurzfassung-verlauf';
import { STEP_ORDER, type StepId, type StepRun, type WorkflowRun } from './types';

/** Leerer Run für einen Verbund (vor der ersten Generierung / Migration). */
export function emptyRun(aktenzeichen: string, now: string): WorkflowRun {
  return {
    aktenzeichen,
    schritte: {},
    aktiverSchritt: 'A',
    erstellt_am: now,
    geaendert_am: now,
    schemaVersion: 1,
  };
}

/** Erster Schritt in A–G-Reihenfolge, der NICHT freigegeben ist (sonst der letzte). */
export function firstNonFreigegeben(run: WorkflowRun): StepId {
  for (const id of STEP_ORDER) {
    if (run.schritte[id]?.status !== 'freigegeben') return id;
  }
  return STEP_ORDER[STEP_ORDER.length - 1]!;
}

/**
 * True, wenn ein FRÜHERER Abschnitt (vor `stepId`) gerade in `entwurf` ist —
 * treibt den dezenten „frühere Abschnitte geändert"-Hinweis auf späteren
 * freigegebenen Abschnitten nach „Erneut öffnen". Reine Funktion von `run`.
 */
export function fruehereInArbeit(run: WorkflowRun, stepId: StepId): boolean {
  const idx = STEP_ORDER.indexOf(stepId);
  return STEP_ORDER.slice(0, idx).some(id => run.schritte[id]?.status === 'entwurf');
}

/** Deterministischer, kollisions-toleranter Hash (djb2) — für `freigabeHash`. */
export function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Eingabe einer Generierung (der Hook liefert parse-Ergebnis + Checks + Meta). */
export interface GenerationInput {
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  checks: CheckResult[];
  modell: string;
  skillId: string;
  skillVersion: number;
  vbGekuerzt?: boolean;
  warnung?: string;
  modifier?: SkillModifierKey;
  mitTweak?: boolean;
  tweakGeaendertAm?: string;
}

function touch(run: WorkflowRun, now: string): WorkflowRun {
  return { ...run, geaendert_am: now };
}

function setStep(run: WorkflowRun, stepId: StepId, step: StepRun, now: string): WorkflowRun {
  return touch({ ...run, schritte: { ...run.schritte, [stepId]: step } }, now);
}

/**
 * Neue Generierung eines Schritts einsetzen (Status `'entwurf'`). Die bisher
 * aktive Fassung wandert in den Verlauf. Ändert `aktiverSchritt` NICHT.
 */
export function applyGeneration(
  run: WorkflowRun,
  stepId: StepId,
  gen: GenerationInput,
  now: string,
): WorkflowRun {
  const prev = run.schritte[stepId] ?? null;
  const step: StepRun = {
    quellenanalyse: gen.quellenanalyse,
    entwurf: gen.entwurf,
    finalerText: gen.finalerText,
    checks: gen.checks,
    status: 'entwurf',
    erstellt_am: now,
    modell: gen.modell,
    skillId: gen.skillId,
    skillVersion: gen.skillVersion,
    verlauf: appendVerlauf(prev),
    ...(gen.vbGekuerzt ? { vbGekuerzt: gen.vbGekuerzt } : {}),
    ...(gen.warnung ? { warnung: gen.warnung } : {}),
    ...(gen.modifier ? { modifier: gen.modifier } : {}),
    ...(gen.mitTweak ? { mitTweak: gen.mitTweak } : {}),
    ...(gen.tweakGeaendertAm ? { tweakGeaendertAm: gen.tweakGeaendertAm } : {}),
  };
  return setStep(run, stepId, step, now);
}

/** Checks eines Schritts neu setzen (Aktion „Prüfen"). No-op, wenn Schritt leer. */
export function applyPruefen(
  run: WorkflowRun,
  stepId: StepId,
  checks: CheckResult[],
  now: string,
): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  return setStep(run, stepId, { ...step, checks }, now);
}

/**
 * Schritt freigeben: Status `'freigegeben'`, `freigegeben_am`, `freigabeHash`
 * (über den finalen Text). Danach `aktiverSchritt = firstNonFreigegeben`.
 * No-op, wenn der Schritt leer ist.
 */
export function freigeben(run: WorkflowRun, stepId: StepId, now: string): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  const freigegeben: StepRun = {
    ...step,
    status: 'freigegeben',
    freigegeben_am: now,
    freigabeHash: hashText(step.finalerText),
  };
  const next = setStep(run, stepId, freigegeben, now);
  return { ...next, aktiverSchritt: firstNonFreigegeben(next) };
}

/**
 * Freigegebenen Schritt wieder öffnen: NUR dieser → `'entwurf'`
 * (`freigegeben_am`/`freigabeHash` gelöscht). Spätere Schritte bleiben
 * freigegeben. Fokus auf diesen Schritt. No-op, wenn leer/entwurf.
 */
export function erneutOeffnen(run: WorkflowRun, stepId: StepId, now: string): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step || step.status !== 'freigegeben') return run;
  const offen: StepRun = { ...step, status: 'entwurf', freigegeben_am: undefined, freigabeHash: undefined };
  return { ...setStep(run, stepId, offen, now), aktiverSchritt: stepId };
}

/** Reine Fokus-Änderung („Weiter bei X"). */
export function weiterschalten(run: WorkflowRun, stepId: StepId, now: string): WorkflowRun {
  return touch({ ...run, aktiverSchritt: stepId }, now);
}

/** Schritt verwerfen (→ `'leer'`, Eintrag entfernt). Fokus bleibt auf dem Schritt. */
export function verwerfen(run: WorkflowRun, stepId: StepId, now: string): WorkflowRun {
  if (!run.schritte[stepId]) return run;
  const schritte = { ...run.schritte };
  delete schritte[stepId];
  return touch({ ...run, schritte, aktiverSchritt: stepId }, now);
}

/**
 * Eine Vorfassung des Schritts zur aktiven machen (Status zurück auf `'entwurf'`,
 * Freigabe-Felder gelöscht). No-op bei leerem Schritt / Out-of-range-Index.
 */
export function uebernehmen(run: WorkflowRun, stepId: StepId, index: number, now: string): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  const restored = restoreVersion(step, index);
  if (restored === step) return run;
  const cleaned: StepRun = { ...restored, freigegeben_am: undefined, freigabeHash: undefined };
  return { ...setStep(run, stepId, cleaned, now), aktiverSchritt: stepId };
}

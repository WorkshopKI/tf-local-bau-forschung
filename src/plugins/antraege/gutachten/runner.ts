/**
 * Deterministische State Machine des Gutachten-Workflows A–G. REINE Funktionen
 * `(run, …) → run` — kein IO, kein React, kein `Date.now()` (now + Inhalt werden
 * hereingereicht, analog `appendVerlauf`). Das macht alle Übergänge trivial
 * testbar. Der Hook ruft einen Reducer und persistiert das Ergebnis (nie während
 * des Streams). KEINE LLM-Entscheidung über Ablauf/Gates, KEIN Auto-Retry.
 */
import type { CheckResult, QuellenBeleg, SkillModifierKey, TeilFeld } from '@/core/services/skills';
import { resetHatVerlaufsrisiko, type ChatResetStatus } from '@/core/services/ai/chat-reset';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { appendVerlauf, restoreVersion } from '../kurzfassung/kurzfassung-verlauf';
import {
  STEP_ORDER,
  type QsAbnahme, type QsBefund, type StepId, type StepRun, type VorlageRef, type WorkflowRun,
} from './types';

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

/**
 * Erster Schritt in Workflow-Reihenfolge, der NICHT freigegeben ist (sonst der
 * letzte). `order` = geordnete Schritt-IDs der aktiven `WorkflowDef`; Default
 * `STEP_ORDER` (zim-ep) hält Bestands-Aufrufer + Tests verhaltensgleich.
 */
export function firstNonFreigegeben(run: WorkflowRun, order: readonly StepId[] = STEP_ORDER): StepId {
  for (const id of order) {
    if (run.schritte[id]?.status !== 'freigegeben') return id;
  }
  return order[order.length - 1]!;
}

/**
 * Abschnitte ohne Eintrag (bzw. Status `'leer'`) in `order`-Reihenfolge — die
 * „noch fehlenden". Auswahl-Quelle für den Bulk-Lauf „Alle Abschnitte erstellen"
 * (Umfang „nur fehlende": Entwürfe + Freigaben bleiben unangetastet). Reine
 * Funktion von `run`.
 */
export function leereSchritte(run: WorkflowRun, order: readonly StepId[] = STEP_ORDER): StepId[] {
  return order.filter(id => {
    const s = run.schritte[id]?.status;
    return !s || s === 'leer';
  });
}

/**
 * True, wenn ein FRÜHERER Abschnitt (vor `stepId` in `order`) gerade in `entwurf`
 * ist — treibt den dezenten „frühere Abschnitte geändert"-Hinweis auf späteren
 * freigegebenen Abschnitten nach „Erneut öffnen". Reine Funktion von `run`.
 */
export function fruehereInArbeit(
  run: WorkflowRun, stepId: StepId, order: readonly StepId[] = STEP_ORDER,
): boolean {
  const idx = order.indexOf(stepId);
  return order.slice(0, idx).some(id => run.schritte[id]?.status === 'entwurf');
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
  /** Strukturierte Teilfelder (opt-in, render-only) — falls der Skill `teilStruktur` deklariert + JSON kam. */
  teile?: TeilFeld[];
  /** Quellen-Belege mit Satz-Zuordnung (opt-in, Journey-Paket 4) — aus der Quellenanalyse geparst. */
  belege?: QuellenBeleg[];
  checks: CheckResult[];
  modell: string;
  skillId: string;
  skillVersion: number;
  vbGekuerzt?: boolean;
  warnung?: string;
  /** Chat-Reset-Status des Laufs (Pitfall #36); nur bei Verlaufsrisiko persistiert. */
  chatResetStatus?: ChatResetStatus;
  modifier?: SkillModifierKey;
  /** Freie Überarbeitungs-Anweisung des Bearbeiters, die zu dieser Fassung führte. */
  anweisung?: string;
  /** Regel-ID, deren Verletzung diesen Korrektur-Lauf ausgelöst hat (nur Anzeige). */
  korrekturRegelId?: string;
  mitTweak?: boolean;
  tweakGeaendertAm?: string;
  denkprozess?: string;
  denkprozessAngefordert?: boolean;
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
    ...(gen.teile?.length ? { teile: gen.teile } : {}),
    ...(gen.belege?.length ? { belege: gen.belege } : {}),
    checks: gen.checks,
    status: 'entwurf',
    erstellt_am: now,
    modell: gen.modell,
    skillId: gen.skillId,
    skillVersion: gen.skillVersion,
    verlauf: appendVerlauf(prev),
    ...(gen.vbGekuerzt ? { vbGekuerzt: gen.vbGekuerzt } : {}),
    ...(gen.warnung ? { warnung: gen.warnung } : {}),
    ...(gen.chatResetStatus && resetHatVerlaufsrisiko(gen.chatResetStatus) ? { chatResetStatus: gen.chatResetStatus } : {}),
    ...(gen.modifier ? { modifier: gen.modifier } : {}),
    ...(gen.anweisung ? { anweisung: gen.anweisung } : {}),
    ...(gen.korrekturRegelId ? { korrekturRegelId: gen.korrekturRegelId } : {}),
    ...(gen.mitTweak ? { mitTweak: gen.mitTweak } : {}),
    ...(gen.tweakGeaendertAm ? { tweakGeaendertAm: gen.tweakGeaendertAm } : {}),
    ...(gen.denkprozess ? { denkprozess: gen.denkprozess } : {}),
    ...(gen.denkprozessAngefordert ? { denkprozessAngefordert: gen.denkprozessAngefordert } : {}),
  };
  return setStep(run, stepId, step, now);
}

/**
 * Manuelle Inline-Bearbeitung des finalen Textes (Aktion „Bearbeiten → Übernehmen").
 * Kein Status-Wechsel, KEIN Verlaufs-Eintrag (das ist keine Re-Generierung). Beim
 * ERSTEN Edit wird der generierte Text als `originalText`-Snapshot festgehalten
 * (für „Zurücksetzen"); editiert der Nutzer wieder auf genau diesen Stand zurück,
 * verfällt der Snapshot (Badge weg). `checks` werden vom Hook über dem neuen Text
 * frisch gerechnet und hereingereicht (reine Funktion bleibt LLM-/IO-frei).
 * No-op, wenn der Schritt leer ist.
 */
export function applyBearbeitung(
  run: WorkflowRun,
  stepId: StepId,
  text: string,
  checks: CheckResult[],
  now: string,
): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  const original = step.originalText ?? step.finalerText;
  const zurueckAufOriginal = text === original;
  const next: StepRun = {
    ...step,
    finalerText: text,
    // Manueller Edit ist autoritativ → strukturierte `teile` (= generierter Stand)
    // würden divergieren; verwerfen, damit die Vorschau den editierten Flachtext zeigt.
    teile: undefined,
    checks,
    originalText: zurueckAufOriginal ? undefined : original,
    // Die QS-Abnahme galt für den Text VOR dieser Änderung — sichtbar entwerten.
    qsAbnahme: veralteAbnahme(step),
  };
  return setStep(run, stepId, next, now);
}

/** Ergebnis eines Lektor-Laufs (der Hook reicht Text + frische Checks + Meta herein). */
export interface LektoratInput {
  finalerText: string;
  checks: CheckResult[];
  /** Transport-/Provider-Name des Lektor-Laufs. */
  modell: string;
  /** Chat-Reset-Status des Laufs (Pitfall #36); nur bei Verlaufsrisiko persistiert. */
  chatResetStatus?: ChatResetStatus;
}

/**
 * Sprachlichen Feinschliff (Lektor-Skill) auf einen Abschnitt anwenden. Anders
 * als eine Re-Generierung entsteht KEIN frischer `StepRun`: der Abschnitt behält
 * Status, Belege, QS-Hinweise, `originalText` und Denkprozess — nur der Text
 * (plus Checks/Modell/Zeitstempel) wird ersetzt. Die bisherige Fassung wandert in
 * den Verlauf ⇒ Versionsvergleich + Rückgriff gelten unverändert.
 *
 * `teile` werden verworfen: der Lektor schreibt den FLACHEN Text neu, die
 * strukturierten Teilfelder würden gegen ihn divergieren (gleiche Regel wie im
 * Lektor-Zweitpass in `run-skill.ts` und bei `applyBearbeitung`).
 *
 * No-op bei leerem Schritt.
 */
export function applyLektorat(
  run: WorkflowRun,
  stepId: StepId,
  input: LektoratInput,
  now: string,
): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  const next: StepRun = {
    ...step,
    finalerText: input.finalerText,
    teile: undefined,
    checks: input.checks,
    erstellt_am: now,
    modell: input.modell,
    lektoriert: true,
    // Ein geglückter Feinschliff heilt einen früher übersprungenen — der
    // angezeigte Text IST jetzt die polierte Fassung.
    feinschliffUebersprungen: undefined,
    // Auch der Feinschliff ändert den bewerteten Text → Abnahme entwerten.
    qsAbnahme: veralteAbnahme(step),
    verlauf: appendVerlauf(step),
    ...(input.chatResetStatus && resetHatVerlaufsrisiko(input.chatResetStatus)
      ? { chatResetStatus: input.chatResetStatus }
      : {}),
  };
  return setStep(run, stepId, next, now);
}

/**
 * Manuelle Bearbeitung verwerfen (Aktion „Zurücksetzen" am bearbeitet-Badge):
 * stellt den gespeicherten `originalText` wieder her, löscht den Snapshot. `checks`
 * (über dem Originaltext) reicht der Hook herein. No-op ohne Snapshot.
 */
export function applyZuruecksetzen(
  run: WorkflowRun,
  stepId: StepId,
  checks: CheckResult[],
  now: string,
): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step || step.originalText == null) return run;
  const next: StepRun = {
    ...step, finalerText: step.originalText, originalText: undefined, checks,
    qsAbnahme: veralteAbnahme(step),
  };
  return setStep(run, stepId, next, now);
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
 * Beratende LLM-QS-Befunde am BEWERTETEN Schritt setzen (Aktion „KI-QS prüfen").
 * KEIN Status-Wechsel, kein Text-Overwrite — getrennt von den mechanischen Checks.
 * No-op, wenn der Schritt leer ist (man kann nur einen generierten Abschnitt bewerten).
 */
export function applyQsHinweise(
  run: WorkflowRun,
  stepId: StepId,
  befunde: QsBefund[],
  now: string,
  abnahme?: QsAbnahme,
): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  // `abnahme` fehlt (Skill ohne Kriterien) → eine ältere Abnahme wäre nach einem
  // frischen Lauf irreführend; sie fällt mit den neuen Befunden weg.
  return setStep(run, stepId, { ...step, qsHinweise: befunde, qsAbnahme: abnahme }, now);
}

/**
 * Markiert eine vorhandene QS-Abnahme als veraltet — der bewertete Text hat sich
 * seither geändert. Bewusst markieren statt löschen: „war abgenommen, ist aber
 * nicht mehr aktuell" ist ehrlicher als „nie geprüft". No-op ohne Abnahme (und
 * idempotent).
 */
function veralteAbnahme(step: StepRun): QsAbnahme | undefined {
  if (!step.qsAbnahme || step.qsAbnahme.veraltet) return step.qsAbnahme;
  return { ...step.qsAbnahme, veraltet: true };
}

/**
 * Markiert den Schritt als „Feinschliff lief nicht durch — der angezeigte Text
 * ist der Rohentwurf". Gesetzt vom automatisch angehängten Feinschliff-Bein der
 * Generierungs-Kette, wenn ein Tor griff, der Lauf warf oder abgebrochen wurde.
 * Bewusst kein Fehlerzustand: der Rohentwurf bleibt der finale Text.
 * No-op, wenn der Schritt leer ist.
 */
export function applyFeinschliffUebersprungen(
  run: WorkflowRun, stepId: StepId, now: string,
): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  return setStep(run, stepId, { ...step, feinschliffUebersprungen: true }, now);
}

/**
 * Markiert den Schritt als „über die Standard-KI entstanden, weil die agentische
 * nicht verfügbar war" (`ziel-fallback.ts`). Wird NACH der eigentlichen Mutation
 * gesetzt, weil der Fallback erst nach dem Lauf feststeht — und für Generierung
 * wie Feinschliff gleichermaßen, da beide den angezeigten Text erzeugen.
 * No-op, wenn der Schritt leer ist.
 */
export function applyZielFallback(run: WorkflowRun, stepId: StepId, now: string): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  return setStep(run, stepId, { ...step, zielFallback: true }, now);
}

/**
 * Hält am Schritt fest, welche interne KI seinen Text tatsächlich erzeugt hat.
 * Wie `applyZielFallback` NACH der Mutation gesetzt (das effektive Ziel steht erst
 * nach dem Lauf fest) und für Generierung wie Feinschliff gleichermaßen — beide
 * erzeugen den angezeigten Text. No-op, wenn der Schritt leer ist.
 *
 * `null` = das Ziel wirkt auf diesem Transport gar nicht (DirectLLM/lokales
 * llama.cpp kennt keine Tabs). Dann wird der Stempel **entfernt**, nicht bloß
 * übersprungen: ein Rest aus einem früheren Bridge-Lauf überlebt sonst im Record
 * und schreibt „Standard-KI" unter einen Text, der nie dort entstanden ist.
 */
export function applyLaufZiel(
  run: WorkflowRun, stepId: StepId, ziel: BridgeZiel | null, now: string,
): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  if (ziel === null) {
    const { ziel: _verworfen, ...ohneZiel } = step;
    return setStep(run, stepId, ohneZiel, now);
  }
  return setStep(run, stepId, { ...step, ziel }, now);
}

/**
 * Audit-Stempel der zuletzt zum Befüllen genutzten Vorlage setzen (Artefakt-
 * Engine). Reiner Run-Übergang, kein Schritt-Bezug.
 */
export function setVorlageRef(run: WorkflowRun, ref: VorlageRef, now: string): WorkflowRun {
  return { ...run, vorlageRef: ref, geaendert_am: now };
}

/**
 * Schritt freigeben: Status `'freigegeben'`, `freigegeben_am`, `freigabeHash`
 * (über den finalen Text). Danach `aktiverSchritt = firstNonFreigegeben`.
 * No-op, wenn der Schritt leer ist.
 */
export function freigeben(
  run: WorkflowRun, stepId: StepId, now: string, order: readonly StepId[] = STEP_ORDER,
): WorkflowRun {
  const step = run.schritte[stepId];
  if (!step) return run;
  const freigegeben: StepRun = {
    ...step,
    status: 'freigegeben',
    freigegeben_am: now,
    freigabeHash: hashText(step.finalerText),
  };
  const next = setStep(run, stepId, freigegeben, now);
  return { ...next, aktiverSchritt: firstNonFreigegeben(next, order) };
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

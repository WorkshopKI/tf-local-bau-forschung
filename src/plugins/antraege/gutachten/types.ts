/**
 * Datenmodell des Gutachten-Workflows A–G. Ein `WorkflowRun` hält pro Verbund
 * (Persistenz-Key = Aktenzeichen) den Stand aller sieben Abschnitte. Jeder
 * Abschnitt ist ein `StepRun` — inhaltlich identisch zum `KurzfassungRecord`
 * (Schritt A), nur OHNE dessen `key` (den besitzt der Run, nicht der Schritt).
 * So generalisiert A sauber, ohne den per-Record-Store wieder einzuführen.
 *
 * Persistenz: ein Objekt im generischen `kv`-Store unter
 * `gutachten-workflow:<aktenzeichen>` (siehe workflow-store.ts) — bewusst KEIN
 * dedizierter Object-Store/Version-Bump (recurring-bug-classes.md §3 / Pitfall #29).
 */
import type { CheckResult, SkillModifierKey } from '@/core/services/skills';
import type { KurzfassungVersion } from '../kurzfassung/types';

/** Abschnitts-IDs des ZIM-EP-Gutachtens. */
export type StepId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/** Reihenfolge der Abschnitte (Single Source of Truth für Sortierung/Iteration). */
export const STEP_ORDER: readonly StepId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Status eines Abschnitts. `'leer'` = noch nie generiert. */
export type StepStatus = 'leer' | 'entwurf' | 'freigegeben';

/**
 * Persistierter Stand EINES Abschnitts. Inhalts-Felder spiegeln den
 * `KurzfassungRecord` (ohne `key`) — die Migration kopiert A feldweise.
 */
export interface StepRun {
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  checks: CheckResult[];
  status: StepStatus;
  /** ISO-Zeitstempel der (letzten) Generierung. */
  erstellt_am: string;
  /** ISO-Zeitstempel der Freigabe. */
  freigegeben_am?: string;
  /** Transport-/Provider-Name zum Zeitpunkt der Generierung. */
  modell: string;
  skillId?: string;
  skillVersion?: number;
  vbGekuerzt?: boolean;
  warnung?: string;
  /** Modifier, der zur AKTUELLEN Fassung führte (für die Verlaufs-Anzeige). */
  modifier?: SkillModifierKey;
  /** Frühere Fassungen (älteste zuerst), gekappt auf MAX_VERLAUF. */
  verlauf?: KurzfassungVersion[];
  mitTweak?: boolean;
  tweakGeaendertAm?: string;
  /** Reasoning-/Thinking-Text dieses Laufs, falls Thinking aktiv war (aufklappbarer „Denkprozess"). */
  denkprozess?: string;
  /** True, wenn dieser Lauf MIT aktivem Thinking generiert wurde — für den Hinweis, falls kein Denkprozess kam. */
  denkprozessAngefordert?: boolean;
  /**
   * Hash des finalen Textes zum Zeitpunkt DIESER Freigabe. Treibt den dezenten
   * „frühere Abschnitte geändert"-Hinweis nach „Erneut öffnen" — Seam für die
   * präzise Versionierung später. Nur gesetzt, solange `status === 'freigegeben'`.
   */
  freigabeHash?: string;
}

/**
 * Gesamtstand des Gutachtens für einen Verbund. `schritte` ist dünn besetzt:
 * fehlt eine ID, war der Abschnitt nie in Arbeit (UI-Status `'leer'`).
 */
export interface WorkflowRun {
  /** Persistenz-Key (= Aktenzeichen/Verbund-ID). Ein Run pro Verbund. */
  aktenzeichen: string;
  schritte: Partial<Record<StepId, StepRun>>;
  /** Der aktuell als offene Review-Karte präsentierte Abschnitt. */
  aktiverSchritt: StepId;
  erstellt_am: string;
  geaendert_am: string;
  /** Provenance: true, sobald ein Alt-Kurzfassungs-Lauf als A übernommen wurde. */
  ausKurzfassungUebernommen?: boolean;
  schemaVersion: 1;
}

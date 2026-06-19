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

/**
 * Schritt-ID eines Gutachten-Workflows. Seit der Kuratierbarkeit (Phase 2) eine
 * offene `string`-Union — die konkreten IDs (`'A'..'G'`, später `'5a'` …) kommen
 * aus der aktiven `WorkflowDef`, nicht mehr aus einer geschlossenen Code-Union.
 * Der Alias bleibt für Lesbarkeit/Intent erhalten. Persistierte `WorkflowRun`s mit
 * `'A'..'G'`-Keys bleiben gültig (reine Typ-Weitung, kein Schema-Bump).
 */
export type StepId = string;

/**
 * Default-Reihenfolge der ZIM-EP-Abschnitte. Seit Phase 2 NICHT mehr autoritativ:
 * die Laufzeit reicht die geordnete Schrittliste der aktiven `WorkflowDef` als
 * Parameter herein; `STEP_ORDER` dient nur noch als abgeleiteter Default (deckungs-
 * gleich mit dem `zim-ep`-Seed, abgesichert per Cross-Layer-Test).
 */
export const STEP_ORDER: readonly StepId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Status eines Abschnitts. `'leer'` = noch nie generiert. */
export type StepStatus = 'leer' | 'entwurf' | 'freigegeben';

/**
 * Ein beratender LLM-QS-Befund zu EINER Dimension (Erdung/Kohärenz/…). Bewusst
 * getrennt von `CheckResult` (mechanische Checks): QS ist qualitativ + beratend,
 * `'unklar'` deckt nicht-parsebare Modell-Ausgabe ab (kein Throw, kein Overwrite).
 */
export interface QsBefund {
  dimension: string;
  bewertung: 'ok' | 'hinweis' | 'unklar';
  /** Konkreter Befund / Belegstelle (1–2 Sätze). */
  text: string;
}

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
  /**
   * Beratende LLM-QS-Befunde (additiv, KEIN Schema-Bump). Getrennt von `checks`:
   * der QS-Schritt schreibt sie an den BEWERTETEN Generierungs-Schritt; sie ändern
   * weder Status noch Text (Auto-Overwrite ausgeschlossen).
   */
  qsHinweise?: QsBefund[];
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

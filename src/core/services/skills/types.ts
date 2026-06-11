/**
 * Skill-Datenstrukturen für den Gutachten-Durchstich. Bewusst als reine Daten-
 * /Typ-Datei gehalten (keine Logik), damit eine `SkillDefinition` später ohne
 * Umbau in eine Skill-Registry wandern kann. „static data over logic".
 */
import type { CheckResult } from './checks';

export type SkillModifierKey = 'neu' | 'kuerzer' | 'laenger';

/** Geparste Skill-Ausgabe (drei `###`-Abschnitte). */
export interface ParsedSkillOutput {
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  /** Gesetzt, wenn die Ausgabe nicht sauber in die Abschnitte zerlegbar war. */
  warnung?: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  /** Kurze System-Rolle (als `system`-Message gesendet). */
  systemPrompt: string;
  /** Statisches Template mit `{{stammdaten}}`- und `{{vbMarkdown}}`-Slots. */
  promptTemplate: string;
  /** Zusatz-Instruktion pro Modifier (Re-Invocation). */
  modifiers: Record<SkillModifierKey, string>;
  /** Deterministische Checks auf dem finalen Text (kein LLM). */
  runChecks: (finalerText: string) => CheckResult[];
  /** Zerlegt die rohe LLM-Antwort in die drei Abschnitte. */
  parse: (raw: string) => ParsedSkillOutput;
  maxTokens: number;
}

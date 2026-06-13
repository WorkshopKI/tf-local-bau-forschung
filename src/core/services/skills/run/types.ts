/**
 * Skill-RUNTIME-Typen (transport-facing). Das Skill-Datenmodell selbst
 * (`SkillRecord`, `QualitaetsRegel`, `SkillModifierKey`) lebt jetzt im
 * Registry-Submodul (`@/core/services/skills`); hier bleibt nur die
 * geparste Ausgabe-Struktur.
 */

/** Geparste Skill-Ausgabe (drei `###`-Abschnitte). */
export interface ParsedSkillOutput {
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  /** Gesetzt, wenn die Ausgabe nicht sauber in die Abschnitte zerlegbar war. */
  warnung?: string;
}

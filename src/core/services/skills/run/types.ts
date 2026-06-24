/**
 * Skill-RUNTIME-Typen (transport-facing). Das Skill-Datenmodell selbst
 * (`SkillRecord`, `QualitaetsRegel`, `SkillModifierKey`) lebt jetzt im
 * Registry-Submodul (`@/core/services/skills`); hier bleibt nur die
 * geparste Ausgabe-Struktur.
 */

import type { TeilFeld } from '../registry/types';

/** Geparste Skill-Ausgabe (drei `###`-Abschnitte). */
export interface ParsedSkillOutput {
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  /** Gesetzt, wenn die Ausgabe nicht sauber in die Abschnitte zerlegbar war. */
  warnung?: string;
  /**
   * Opt-in (nur wenn der Skill `teilStruktur` deklariert UND das Modell ein
   * parsebares JSON-Array lieferte): strukturierte Teilfelder für die UI.
   * Render-only — `finalerText` (Teile per `teilJoin` verbunden) bleibt die
   * flache Quelle der Wahrheit. Fehlt das Feld → heutiges Verhalten.
   */
  teile?: TeilFeld[];
}

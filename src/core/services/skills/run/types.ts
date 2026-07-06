/**
 * Skill-RUNTIME-Typen (transport-facing). Das Skill-Datenmodell selbst
 * (`SkillRecord`, `QualitaetsRegel`, `SkillModifierKey`) lebt jetzt im
 * Registry-Submodul (`@/core/services/skills`); hier bleibt nur die
 * geparste Ausgabe-Struktur.
 */

import type { TeilFeld } from '../registry/types';

/**
 * Ein strukturierter Quellen-Beleg aus der Quellenanalyse (Journey-Paket 4).
 * `satzIndizes` sind **0-basiert** (aligned zu `splitSentences(finalerText)` +
 * `data-satz-index`); das LLM-Format ist 1-basiert (`→ stützt Satz {n}`) und wird
 * beim Parsen konvertiert. Ungültige/außerhalb-liegende Referenzen → `satzIndizes: []`
 * (= „ohne Zuordnung"). Rein additiv; die flache `quellenanalyse` bleibt unberührt.
 */
export interface QuellenBeleg {
  /** Wörtliches Kurz-Zitat (Zeile ohne Satz-/Abschnitts-Suffix). */
  zitat: string;
  /** Abschnitts-Referenz aus `(Abschn. x.y)`, falls vorhanden (z.B. `"1.1"`). */
  abschnittRef?: string;
  /** 0-basierte, gegen `splitSentences(finalerText)` validierte Satz-Indizes. */
  satzIndizes: number[];
}

/** Geparste Skill-Ausgabe (drei `###`-Abschnitte). */
export interface ParsedSkillOutput {
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  /** Gesetzt, wenn die Ausgabe nicht sauber in die Abschnitte zerlegbar war. */
  warnung?: string;
  /**
   * Opt-in (Journey-Paket 4): strukturierte Quellen-Belege mit Satz-Zuordnung,
   * geparst aus der Quellenanalyse. Fehlt das Feld (Alt-Format ohne Referenzen) →
   * heutiges flaches Rendering der `quellenanalyse`. Additiv, nie regressiv.
   */
  belege?: QuellenBeleg[];
  /**
   * Opt-in (nur wenn der Skill `teilStruktur` deklariert UND das Modell ein
   * parsebares JSON-Array lieferte): strukturierte Teilfelder für die UI.
   * Render-only — `finalerText` (Teile per `teilJoin` verbunden) bleibt die
   * flache Quelle der Wahrheit. Fehlt das Feld → heutiges Verhalten.
   */
  teile?: TeilFeld[];
}

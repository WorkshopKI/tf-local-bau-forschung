/**
 * User-Tweaks v2 — Datenmodell der persönlichen Stil-Schicht.
 *
 * Ein Tweak gehört dem Nutzer (nicht dem Kurator), gilt pro `skillId` und kann
 * die formalen Kurator-Vorgaben NIE aufheben (siehe `composeSkillPrompt`: der
 * Tweak-Block steht VOR den „Formalen Vorgaben"). Privat + lokal — niemals auf
 * dem Daten-Share, niemals in der Registry-Datei, nie für andere sichtbar.
 */

import type { PersoenlicheVorgaben } from '../registry/types';

/** Zeichen-Obergrenze je Freitextfeld (im UI angezeigt, beim Speichern geklemmt). */
export const TWEAK_FELD_MAX = 2000;

export interface SkillTweak {
  /** Skill, auf den sich der Tweak bezieht (z.B. `gutachten-kurzfassung`). */
  skillId: string;
  /**
   * Persönlich verschobene Umfangs-Werte (additiv, seit v2.296). Greift NUR bei
   * Vorgaben, die der Kurator als `persoenlichAnpassbar` freigegeben hat — die
   * Klemmung liegt in `wendeOverrideAn` (registry/vorgaben.ts), nicht hier. Der
   * Schweregrad bleibt immer Kurator-Sache; ein Override kann eine Vorgabe
   * verschieben, nie abschalten. Fehlt das Feld → reiner Stil-Tweak wie bisher.
   */
  vorgabenOverride?: PersoenlicheVorgaben;
  /** Skill-Version zum Zeitpunkt der letzten Bearbeitung (Basis des Versions-Hinweises). */
  angelegtFuerSkillVersion: number;
  aktiv: boolean;
  stilHinweise: string;
  beispielFormulierungen: string;
  /** ISO-Zeitstempel der letzten Änderung — LWW-Schlüssel für den Ordner-Spiegel. */
  geaendert_am: string;
  /**
   * Close-X-Merker: Versions-Hinweis für GENAU diese Skill-Version ausgeblendet.
   * Ein erneutes Speichern (das `angelegtFuerSkillVersion` aktualisiert) löst den
   * Hinweis ohnehin auf; dieses Feld blendet ihn nur dezent weg, ohne zu speichern.
   */
  hinweisAusgeblendetFuerVersion?: number;
}

/** Format der Spiegel-Datei im persönlichen Ordner (multi-skill, per-skill LWW). */
export interface SkillTweaksFile {
  version: 1;
  tweaks: Record<string, SkillTweak>;
}

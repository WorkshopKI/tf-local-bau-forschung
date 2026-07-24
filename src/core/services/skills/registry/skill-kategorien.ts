/**
 * Kategorie-Modell der Skills (additiv, eine zentrale Quelle).
 *
 * Zweck: die wachsende Skill-Bibliothek fachlich ordnen — Gutachten-Abschnitte,
 * Nachforderungs-Bausteine, Aufbereitungs-Läufe, Anfragen-Skills und interne
 * QS-/Hilfsläufe stehen sonst flach durcheinander.
 *
 * Die Kategorie wird aus ZWEI Signalen abgeleitet:
 *  - `id`-Präfix (Seed-Skills tragen sprechende IDs wie `gutachten-markt`),
 *  - `name`-Präfix (kuratierte Skills haben eine UUID als `id`, aber einen
 *    sprechenden Namen wie „Gutachten - Bullet Points …").
 * Eine explizit gesetzte `kategorie` (Kurator) schlägt beides. Unbekanntes →
 * `'sonstige'`. Vorwärts-kompatibel: Kategorien sind `string`, kein striktes
 * Enum — neue Werte landen tolerant in „Sonstige", wenn kein Label existiert.
 *
 * Die Ableitung ist Laufzeit-Logik — der Default wird NIE in die Registry-Daten
 * geschrieben (nur eine vom Kurator explizit gesetzte `kategorie` persistiert).
 * Gespiegeltes Muster: `kategorien.ts` (Kategorie-Achse der Qualitätsregeln).
 */

/**
 * Bekannte Skill-ID-Präfixe → Kategorie. Längster Treffer gewinnt nicht — die
 * Präfixe überschneiden sich bewusst nicht (`relevanz-map` ist ein Voll-Match
 * ohne Bindestrich-Suffix und daher als eigener Eintrag geführt).
 */
const SKILL_ID_PRAEFIX_ZU_KATEGORIE: Array<[praefix: string, kategorie: string]> = [
  ['gutachten-', 'gutachten'],
  ['ga-', 'gutachten'],
  ['nf-', 'nachforderung'],
  ['zim-rne', 'bescheid'],
  ['zim-abl', 'bescheid'],
  ['aufbereitung-', 'aufbereitung'],
  ['anfrage-', 'anfrage'],
  ['qs-', 'qs'],
  ['relevanz-map', 'qs'],
];

/**
 * Namens-Präfixe → Kategorie (Fallback für kuratierte Skills mit UUID-`id`).
 * Bewusst grob: nur der führende Wortstamm des Anzeigenamens wird geprüft.
 */
const SKILL_NAME_PRAEFIX_ZU_KATEGORIE: Array<[praefix: string, kategorie: string]> = [
  ['gutachten', 'gutachten'],
  ['nachforderung', 'nachforderung'],
  ['aufbereitung', 'aufbereitung'],
  ['anfrage', 'anfrage'],
];

/** Minimal-Shape für die Ableitung — nimmt jeden `SkillRecord` entgegen. */
export interface SkillKategorieQuelle {
  id: string;
  name: string;
  kategorie?: string;
}

/**
 * Effektive Kategorie eines Skills (reconciled). Reihenfolge: explizite
 * `kategorie` > `id`-Präfix > `name`-Präfix > `'sonstige'`.
 */
export function effektiveSkillKategorie(s: SkillKategorieQuelle): string {
  if (s.kategorie && s.kategorie.trim()) return s.kategorie.trim();
  const id = s.id.toLowerCase();
  for (const [praefix, kategorie] of SKILL_ID_PRAEFIX_ZU_KATEGORIE) {
    if (id.startsWith(praefix)) return kategorie;
  }
  const name = s.name.trim().toLowerCase();
  for (const [praefix, kategorie] of SKILL_NAME_PRAEFIX_ZU_KATEGORIE) {
    if (name.startsWith(praefix)) return kategorie;
  }
  return 'sonstige';
}

/** Lesbare Labels der bekannten Kategorien (UI). Unbekanntes fällt auf „Sonstige". */
export const SKILL_KATEGORIE_LABEL: Record<string, string> = {
  gutachten: 'Gutachten',
  nachforderung: 'Nachforderungen',
  bescheid: 'Bescheide',
  aufbereitung: 'Aufbereitung',
  anfrage: 'Anfragen',
  qs: 'Qualitätssicherung',
  sonstige: 'Sonstige',
};

/** Stabile Sektions-/Sortier-Reihenfolge der Kategorien (fachlich, nicht alphabetisch). */
export const SKILL_KATEGORIE_ORDER: string[] = [
  'gutachten',
  'nachforderung',
  'bescheid',
  'aufbereitung',
  'anfrage',
  'qs',
  'sonstige',
];

/** Anzeige-Label der effektiven Kategorie eines Skills. */
export function skillKategorieLabel(s: SkillKategorieQuelle): string {
  const k = effektiveSkillKategorie(s);
  return SKILL_KATEGORIE_LABEL[k] ?? k;
}

/**
 * Sortier-Rang der effektiven Kategorie (Index in `SKILL_KATEGORIE_ORDER`).
 * Unbekannte Kategorien landen stabil hinter allen bekannten.
 */
export function skillKategorieRang(s: SkillKategorieQuelle): number {
  const i = SKILL_KATEGORIE_ORDER.indexOf(effektiveSkillKategorie(s));
  return i < 0 ? SKILL_KATEGORIE_ORDER.length : i;
}

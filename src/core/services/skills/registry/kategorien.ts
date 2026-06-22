/**
 * Kategorie-Modell der Qualitätsregeln (additiv, eine zentrale Quelle).
 *
 * Eine Regel-„Art" (Kategorie) wird aus ZWEI Signalen reconciled:
 *  - `typ` (deterministische Textregeln) → Umfang / Sprache / Struktur / Form,
 *  - `pruefart` (QS-Regeln OHNE deterministischen Typ) → Inhalt (fachlich) /
 *    Form (administrativ).
 * Eine explizit gesetzte `kategorie` (Kurator) schlägt beides. Unbekanntes →
 * `'sonstige'`. Vorwärts-kompatibel: Kategorien sind `string`, kein striktes
 * Enum — neue Werte landen tolerant in „Sonstige", wenn kein Label existiert.
 *
 * Die Ableitung ist Laufzeit-Logik — der Default wird NIE in die Registry-Daten
 * geschrieben (nur eine vom Kurator explizit gesetzte `kategorie` persistiert).
 */

/**
 * Bekannte deterministische Regel-Typen → Kategorie. `nf_keine_platzhalter_reste`
 * ist ein handler-gestützter Vollständigkeits-Check (erzeugt echte CheckResults)
 * und gehört deterministisch zu `'form'` — unabhängig davon, ob das Seed eine
 * `pruefart` setzt (der pruefart-Fallback ergäbe dasselbe).
 */
const TYP_ZU_KATEGORIE: Record<string, string> = {
  satzanzahl: 'umfang',
  wortanzahl: 'umfang',
  zeichen_max: 'umfang',
  absatz_min: 'umfang',
  satzlaenge_max: 'sprache',
  verbotenes_muster: 'sprache',
  keine_aufzaehlungen: 'struktur',
  pflicht_anfang: 'struktur',
  nf_keine_platzhalter_reste: 'form',
};

/**
 * Effektive Kategorie einer Regel (reconciled). Reihenfolge: explizite
 * `kategorie` > deterministischer `typ` > `pruefart`-Fallback > `'sonstige'`.
 */
export function effektiveKategorie(r: { typ: string; pruefart?: string; kategorie?: string }): string {
  if (r.kategorie && r.kategorie.trim()) return r.kategorie;
  const k = TYP_ZU_KATEGORIE[r.typ];
  if (k) return k;
  if (r.pruefart === 'fachlich') return 'inhalt';
  if (r.pruefart === 'administrativ') return 'form';
  return 'sonstige';
}

/** Lesbare Labels der bekannten Kategorien (UI). Unbekanntes fällt auf „Sonstige". */
export const KATEGORIE_LABEL: Record<string, string> = {
  umfang: 'Umfang',
  sprache: 'Sprache',
  struktur: 'Struktur',
  inhalt: 'Inhalt & Quellen',
  form: 'Vollständigkeit & Form',
  sonstige: 'Sonstige',
};

/** Stabile Sektions-/Bucket-Reihenfolge der Kategorien. */
export const KATEGORIE_ORDER: string[] = ['umfang', 'sprache', 'struktur', 'inhalt', 'form', 'sonstige'];

/** Ampel-Stufe (deckt sich mit `CheckLevel`). */
export type AmpelLevel = 'ok' | 'hinweis' | 'fehler';

/** Deterministischer Roll-up: rot ⟩ gelb ⟩ grün. Leere Liste → `'ok'`. */
export function worstLevel(ls: AmpelLevel[]): AmpelLevel {
  if (ls.includes('fehler')) return 'fehler';
  if (ls.includes('hinweis')) return 'hinweis';
  return 'ok';
}

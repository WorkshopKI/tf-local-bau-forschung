/**
 * Merkliste der zuletzt genutzten KI-Überarbeitungs-Anweisungen („Bearbeiten mit KI").
 *
 * Dieselbe Anweisung braucht man über A–G hinweg mehrfach („Details des Lösungswegs
 * vertiefen"), deshalb ist die Liste **abschnitts- und verbundübergreifend** — sie
 * beschreibt eine Arbeitsweise, nicht ein Vorhaben.
 *
 * **Strikt gerätelokal**: `localStorage` wie die übrigen UI-Prefs der Werkstatt
 * (`RAIL_W_KEY` & Co. in GutachtenSection.tsx) — `file://`-tauglich, klein, uninteressant
 * für andere. Niemals auf den Daten-Share, in `registry.json` oder in den Snapshot:
 * der Text ist frei vom Nutzer formuliert und kann Vorhabens-Details enthalten.
 *
 * Die Mutation ist eine reine Funktion (Liste rein, Liste raus) — nur `lade`/`speichere`
 * fassen den Storage an.
 */

/** Storage-Key (Prefix `teamflow_` wie die übrigen UI-Prefs). */
const KEY = 'teamflow_gutachten_ki_anweisungen';

/** So viele Anweisungen bleiben gemerkt — Chips, keine Historie. */
export const MAX_ANWEISUNGEN = 5;

/**
 * Zeichen-Obergrenze je gemerkter Anweisung. Wer einen halben Absatz diktiert, will
 * ihn nicht als Chip wiederhaben; die Kappung schützt zugleich den Storage.
 */
export const ANWEISUNG_MAX_LAENGE = 300;

/** Auf Länge kappen (mit Auslassungszeichen, damit die Kürzung sichtbar ist). */
function kappe(text: string): string {
  const t = text.trim();
  return t.length > ANWEISUNG_MAX_LAENGE ? `${t.slice(0, ANWEISUNG_MAX_LAENGE).trimEnd()}…` : t;
}

/**
 * Anweisung vorne einreihen. Rein: Eingabe-Liste bleibt unberührt.
 *
 * Ein erneut genutzter Wortlaut wird NACH VORN GEZOGEN statt gedoppelt (Vergleich
 * case-insensitive nach Trim) — sonst verdrängt die Lieblings-Anweisung nach fünf
 * Wiederholungen alle anderen aus der eigenen Liste.
 */
export function merkeAnweisung(bisher: readonly string[], text: string): string[] {
  const neu = kappe(text);
  if (!neu) return [...bisher];
  const norm = neu.toLocaleLowerCase('de-DE');
  const rest = bisher.filter(a => a.trim().toLocaleLowerCase('de-DE') !== norm);
  return [neu, ...rest].slice(0, MAX_ANWEISUNGEN);
}

/** Gemerkte Anweisungen lesen. Jeder Defekt (kein Storage, kaputtes JSON) → leere Liste. */
export function ladeAnweisungen(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      .map(kappe)
      .slice(0, MAX_ANWEISUNGEN);
  } catch {
    return [];
  }
}

/** Gemerkte Anweisungen schreiben. Fehlschlag ist folgenlos (Chips fehlen, mehr nicht). */
export function speichereAnweisungen(liste: readonly string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(liste.slice(0, MAX_ANWEISUNGEN)));
  } catch {
    /* localStorage nicht verfügbar/voll — ignorieren */
  }
}

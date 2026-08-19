/**
 * Der Satz, mit dem die Ähnlichkeitsstufe Rechenschaft ablegt.
 *
 * Rein, weil er eine Entscheidung mit drei Fällen ist und keine Auszeichnung —
 * gerendert wird er von [AehnlichkeitsZeile.tsx](./AehnlichkeitsZeile.tsx).
 *
 * Gemeldet wurde: „ich schalte ‚auch ähnliche Themen' ein, die Trefferzahl
 * ändert sich nicht". Sie hatte sich auch nicht zu ändern — was über der
 * Schwelle liegt, steht bei einer breiten Anfrage meist **schon** im
 * Wortlaut-Ergebnis. Nur sagte das niemand: die Stufe lief zwanzig Sekunden und
 * legte keine Rechenschaft ab, und aus „nichts Neues" wurde „kaputt".
 *
 * Ein falscher Rechenschaftsbericht ist schlimmer als keiner — deshalb nennt
 * `kandidaten` seit v4.113 die Zahl VOR dem Deckel, und was der Deckel verworfen
 * hat, steht dabei.
 */
import type { SemantikBefund } from '@/core/hooks/useUnifiedSearch';

/**
 * Die **Reichweite** steht in jedem Fall dabei, solange sie nicht vollständig
 * ist: der Korpus liegt gerätelokal und deckt selten den ganzen Bestand ab. Ein
 * Vorhaben ohne Vektor kann nie ähnlich sein — das ist die halbe Antwort auf
 * „warum findet er nichts", und sie stand nirgends.
 *
 * Der **Ausweg** gehört dazu. Bis v4.113 nannte ihn nur der Zweig `corpus-empty`,
 * also der Fall von genau 0 Vektoren. Bei 1 086 von 14 225 stand da nur „nur sie
 * haben auf diesem Rechner einen Vektor" — wahr, aber es verschwieg, dass auf dem
 * Datenspeicher 14 065 bereitliegen. Am Bestand gemessen war der Rest kein
 * Randfall: 156 der 160 fehlenden Vorhaben waren aus dem laufenden Jahrgang,
 * also 14,7 % davon — gerade die Vorgänge, an denen gearbeitet wird.
 */
function reichweite(befund: SemantikBefund, bestand: number): string {
  if (befund.korpus >= bestand || bestand === 0) return '';
  return ` Vergleichbar sind ${befund.korpus.toLocaleString('de-DE')} von `
    + `${bestand.toLocaleString('de-DE')} Vorhaben — nur sie haben auf diesem Rechner einen `
    + 'Vektor. Die übrigen holt das Auslastungs-Modul unter „Themen-Vektoren" nach '
    + '(„Vom Datenspeicher laden", sonst „Corpus aufbauen").';
}

/**
 * Was der Deckel verworfen hat. Steht nur da, wenn etwas verworfen wurde — und
 * dann mit dem Grund, nicht als Zahl ohne Urteil.
 */
function deckel(befund: SemantikBefund): string {
  if (befund.verworfen <= 0) return '';
  return ` ${befund.verworfen} weitere lagen über der Schwelle, kamen aber nicht in die `
    + 'Liste — je Suche werden höchstens 50 neue Zeilen ergänzt.';
}

export function aehnlichkeitsSatz(befund: SemantikBefund, bestand: number): string {
  const rest = reichweite(befund, bestand);
  if (befund.kandidaten === 0) {
    return `Ähnlichkeit: kein Vorhaben lag über der Schwelle.${rest}`;
  }
  // Der gemeldete Fall — und er ist eine Auskunft, kein Fehler: die Stufe hat
  // gearbeitet, ihr Ergebnis war nur schon da.
  if (befund.neu === 0) {
    return `Ähnlichkeit: ${befund.kandidaten} thematisch verwandte Vorhaben — alle standen schon im `
      + `Wortlaut-Ergebnis, die Trefferzahl ändert sich dadurch nicht.${deckel(befund)}${rest}`;
  }
  return `Ähnlichkeit: ${befund.kandidaten} thematisch verwandte Vorhaben, ${befund.neu} davon neu in der `
    + `Liste (Fundstelle „ähnliche Bedeutung").${deckel(befund)}${rest}`;
}

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
 */
import type { SemantikBefund } from '@/core/hooks/useUnifiedSearch';

/**
 * Die **Reichweite** steht in jedem Fall dabei, solange sie nicht vollständig
 * ist: der Korpus liegt gerätelokal und deckt selten den ganzen Bestand ab (auf
 * der Entwicklungsmaschine 1 086 von 14 225). Ein Vorhaben ohne Vektor kann nie
 * ähnlich sein — das ist die halbe Antwort auf „warum findet er nichts", und sie
 * stand nirgends.
 */
function reichweite(befund: SemantikBefund, bestand: number): string {
  if (befund.korpus >= bestand || bestand === 0) return '';
  return ` Vergleichbar sind ${befund.korpus.toLocaleString('de-DE')} von `
    + `${bestand.toLocaleString('de-DE')} Vorhaben — nur sie haben auf diesem Rechner einen Vektor.`;
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
      + `Wortlaut-Ergebnis, die Trefferzahl ändert sich dadurch nicht.${rest}`;
  }
  return `Ähnlichkeit: ${befund.kandidaten} thematisch verwandte Vorhaben, ${befund.neu} davon neu in der `
    + `Liste (Fundstelle „ähnliche Bedeutung").${rest}`;
}

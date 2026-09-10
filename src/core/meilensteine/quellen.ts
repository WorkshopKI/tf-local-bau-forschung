/**
 * Die Quellspalten eines Meilensteins: seine Bedingung, sein Ist-Termin-Feld —
 * und die Regel, nach der daraus ein Wert für den VERBUND wird.
 *
 * Die Regel steht mit im Tooltip, weil sie die zweite Fehlerquelle neben der
 * falschen Spalte ist: eine Bedingung gilt für den Verbund, sobald IRGENDEIN
 * Teilvorhaben sie trägt (`baueMeilensteinKontext`), und der Ist-Termin ist das
 * früheste Datum über die Teilvorhaben (`fruehestesDatum` in der Bewertung).
 * Wer das nicht weiß, liest einen früh erreichten Meilenstein als Datenfehler.
 *
 * Rein; den Index reicht der Aufrufer herein.
 */
import type { QuellSpaltenIndex } from '@/core/services/csv/spalten-inventar';
import { bedingungIstLeer, bedingungSatz } from '@/core/status';
import { feldQuellen, type QuellSpaltenErklaerung } from '@/core/status/bedingung-quellen';
import { feldRefsAusKnoten } from './felder';
import type { MeilensteinKnoten } from './typen';

/** Wie aus den Teilvorhaben ein Verbund-Wert wird — in einem Satz. */
export function knotenRegel(k: MeilensteinKnoten): string {
  const ist = k.istDatumFeld
    ? 'das Datum des Ist-Termin-Feldes'
    : 'das früheste Datum der Bedingungsfelder';
  return 'Erfüllt, sobald ein Teilvorhaben des Verbunds die Bedingung trägt. '
    + `Ist-Termin: ${ist}, über die Teilvorhaben das früheste.`;
}

/**
 * Die Erklärung eines Knotens. `labelVon` nennt die Felder so wie der sichtbare
 * Text daneben; ohne Angabe das Schema-Label aus dem Index.
 */
export function knotenQuellen(
  k: MeilensteinKnoten,
  index: QuellSpaltenIndex,
  labelVon?: (feldId: string) => string,
): QuellSpaltenErklaerung {
  const namen = labelVon ?? index.labelVon;
  if (bedingungIstLeer(k.bedingung)) {
    return feldQuellen(feldRefsAusKnoten(k), index,
      `${k.label}: ohne eigene Bedingung — erfüllt über seine Unter-Meilensteine, falls es welche gibt.`,
      { labelVon: namen });
  }
  return feldQuellen(feldRefsAusKnoten(k), index, `${k.label}: ${bedingungSatz(k.bedingung, namen)}`, {
    labelVon: namen,
    regel: knotenRegel(k),
  });
}

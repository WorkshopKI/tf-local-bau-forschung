/**
 * Die Quellspalten eines Meilensteins: seine Bedingung, sein Ist-Termin-Feld —
 * und die Regel, nach der daraus ein Wert für den VERBUND wird.
 *
 * Die Regel steht mit im Tooltip, weil sie die zweite Fehlerquelle neben der
 * falschen Spalte ist: eine Bedingung gilt für den Verbund, sobald IRGENDEIN
 * Teilvorhaben sie trägt (`baueMeilensteinKontext`); je Feld zählt das früheste
 * Datum über die Teilvorhaben, und ohne Ist-Termin-Feld folgt der Ist-Termin der
 * Verknüpfung (`erfuellungsDatum` in der Bewertung). Wer das nicht weiß, liest
 * einen früh erreichten Meilenstein als Datenfehler.
 *
 * Rein; den Index reicht der Aufrufer herein.
 */
import type { QuellSpaltenIndex } from '@/core/services/csv/spalten-inventar';
import { bedingungIstLeer, bedingungSatz } from '@/core/status';
import { feldQuellen, type QuellSpaltenErklaerung } from '@/core/status/bedingung-quellen';
import { feldRefsAusKnoten } from './felder';
import type { MeilensteinKnoten } from './typen';

/**
 * Die Regel des Ist-Termins ohne eigenes Feld, in Worten des Editors. Eine
 * Konstante, weil sie zweimal steht: im Quellspalten-Tooltip und neben der
 * Auswahl „Ist-Termin" — zwei Fassungen liefen beim nächsten Umbau auseinander.
 */
export const IST_AUS_BEDINGUNG =
  'bei „alle“ das späteste, bei „eine“ das früheste Datum der erfüllten Bedingungen';

/** Wie aus den Teilvorhaben ein Verbund-Wert wird — in einem Satz. */
export function knotenRegel(k: MeilensteinKnoten): string {
  const ist = k.istDatumFeld
    ? 'das Datum des Ist-Termin-Feldes'
    : `der Tag, an dem die Bedingung wahr wurde — ${IST_AUS_BEDINGUNG}`;
  return 'Erfüllt, sobald ein Teilvorhaben des Verbunds die Bedingung trägt. '
    + `Ist-Termin: ${ist}; je Feld zählt das früheste Datum über die Teilvorhaben.`;
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

/**
 * Woraus der Reiter „Stöbern" seine Spalten baut.
 *
 * Rein — kein React. Die Darstellung liegt in
 * [StartStoebern.tsx](src/plugins/suche/start/StartStoebern.tsx).
 */
import { FELD_PRAEFIX } from '@/core/services/search/feldpraefix';
import { TREFFERFELD_LABEL } from '@/core/services/search/trefferstelle';
import {
  anzahlPassend, vorschlaegeFuer, type WertEintrag, type WertFeld, type WertIndex,
} from '@/plugins/antraege/services/wert-index';
import { alsAnfrageWert } from '../vervollstaendigung';

/**
 * Die Felder zum Stöbern, in der Reihenfolge „was errät man am wenigsten".
 *
 * Nur Felder mit abzählbarem Wertevorrat kommen überhaupt in Frage
 * ([wert-index.ts](src/plugins/antraege/services/wert-index.ts)) — Titel und
 * Beschreibung tragen Fließtext. `wahlkreis` fehlt bewusst: er ist abzählbar,
 * aber niemand sucht ein Vorhaben über seinen Wahlkreis, ohne den Ort schon zu
 * kennen.
 */
export const STOEBER_FELDER: readonly WertFeld[] = [
  'deskriptoren', 'netzwerk', 'organisation', 'standort',
];

/** Wie viele Werte je Feld im Reiter stehen. */
export const WERTE_JE_FELD = 5;

/**
 * Die Überschrift der Spalte — nur dort abweichend, wo `TREFFERFELD_LABEL` zu
 * eng ist.
 *
 * `standort` heißt in der Trefferzeile „Ort", weil dort ein Ortsname steht.
 * Hier steht die HÄUFIGKEITSLISTE desselben Feldes, und die führen die
 * Bundesländer an: am echten Bestand gemessen sind die fünf häufigsten Werte
 * ausnahmslos Länder (Sachsen 3.282, Bayern 1.976, …), weil jeder Antrag ein
 * Land trägt und die Orte sich auf 2.039 Werte verteilen. Eine Spalte „Ort",
 * in der kein Ort steht, wäre eine falsche Beschriftung — das Feld deckt beides
 * ab und sagt das anderswo auch („nur Ort und Bundesland").
 */
const SPALTEN_LABEL: Partial<Record<WertFeld, string>> = {
  standort: 'Ort & Bundesland',
};

export function stoeberLabel(feld: WertFeld): string {
  return SPALTEN_LABEL[feld] ?? TREFFERFELD_LABEL[feld];
}

/** Das Präfix, das die App für dieses Feld schreibt (`ort`, `deskriptor`, …). */
export function stoeberPraefix(feld: WertFeld): string {
  return FELD_PRAEFIX[feld] ?? feld;
}

/**
 * Die Anfrage, die eine Zeile ausführt.
 *
 * Mehrwortige Werte kommen in Anführungszeichen — ohne sie zerfiele der Wert an
 * den Leerzeichen und suchte etwas anderes, als in der Zeile stand.
 */
export function stoeberAnfrage(feld: WertFeld, wert: string): string {
  return `${stoeberPraefix(feld)}:${alsAnfrageWert(wert)}`;
}

/** Stabiler Schlüssel für React und für die Trefferzahl-Karte. */
export function stoeberKey(feld: WertFeld, wert: string): string {
  return `${feld}:${wert.toLowerCase()}`;
}

export interface StoeberSpalte {
  feld: WertFeld;
  /** Wie viele Werte das Feld im ganzen Bestand führt. */
  gesamt: number;
  /** Die häufigsten, gekappt auf `WERTE_JE_FELD`. */
  werte: WertEintrag[];
}

/**
 * Die Spalten des Reiters. Felder ohne einen einzigen Wert fallen weg — eine
 * Überschrift über einer leeren Spalte behauptet einen Vorrat, den es nicht
 * gibt.
 */
export function baueStoeberSpalten(index: WertIndex | null): StoeberSpalte[] {
  if (!index) return [];
  return STOEBER_FELDER
    .map(feld => ({
      feld,
      gesamt: anzahlPassend(index, feld, ''),
      werte: vorschlaegeFuer(index, feld, '', WERTE_JE_FELD),
    }))
    .filter(s => s.werte.length > 0);
}

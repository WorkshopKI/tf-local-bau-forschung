/**
 * Die Suchweisen, die der Startzustand vormacht — nach Zweck gruppiert.
 *
 * Jede Zeile ist AUSFÜHRBAR: sie startet dieselbe Suche über denselben Pfad wie
 * eine getippte Anfrage. Eine Syntax-Tabelle, die man abschreiben muss, wäre
 * eine Bedienungsanleitung; ein Klick, der es vormacht, ist die Erklärung.
 *
 * Die Beispiele sind statisch und bewusst so gewählt, dass sie am echten
 * Bestand Treffer haben (in dev:local an 14.225 Anträgen nachgemessen, Zahlen
 * als Kommentar) — ein Beispiel, das ins Leere führt, lehrt die falsche Lektion.
 * Der naheliegende Fall `ast:GMBU` steht deshalb NICHT hier: „GMBU" kommt im
 * ganzen Bestand in keinem Organisationsfeld vor, nur in der Web-Adresse
 * (v4.42) — das Beispiel wäre ausgerechnet an der Stelle leer, an der es etwas
 * beibringen soll.
 *
 * **Gruppiert wird nach Absicht, nicht nach Syntax.** Neun Zeilen in einer
 * Reihe sind eine Aufzählung, durch die man liest, bis etwas passt; vier
 * Überschriften sagen vorher, wo das Eigene steht. Die Kennzeichen-Zeilen
 * stehen dadurch beieinander, weil sie dieselbe Frage in wachsenden Weiten
 * stellen: dieses Teilvorhaben, sein Verbund, sein Netzwerk — und zuletzt ein
 * Name, dessen Schreibweise im Bestand schwankt.
 *
 * Rein — kein React.
 */

export type SuchspracheGruppe = 'thema' | 'kennung' | 'werWo' | 'eigenes';

/** Die Überschriften, in Anzeigereihenfolge. */
export const SUCHSPRACHE_GRUPPEN: readonly { id: SuchspracheGruppe; titel: string }[] = [
  { id: 'thema', titel: 'Ein Thema suchen' },
  { id: 'kennung', titel: 'Über eine Kennung' },
  { id: 'werWo', titel: 'Wer und wo' },
  { id: 'eigenes', titel: 'Eigenes' },
];

export interface Sucheart {
  query: string;
  erklaerung: string;
  gruppe: SuchspracheGruppe;
}

export const SUCHARTEN: readonly Sucheart[] = [
  { query: 'Bilderkennung', erklaerung: 'ein Thema — in allen Feldern', gruppe: 'thema' },              // 31
  { query: 'additive Fertigung', erklaerung: 'zwei Wörter — beide müssen vorkommen', gruppe: 'thema' }, // 643
  { query: '16KN055710', erklaerung: 'Förderkennzeichen — auch ein Anfang davon', gruppe: 'kennung' },  // 1
  { query: 'vb:ZKN073232', erklaerung: 'ein Verbund mit allen Teilvorhaben', gruppe: 'kennung' },       // 9
  { query: 'nw:ProAnimalLife', erklaerung: 'ein Netzwerk mit allen Teilvorhaben', gruppe: 'kennung' },  // 82
  // Der Platzhalter stand seit v4.101 im Code und in keiner Zeile der
  // Oberfläche — gefragt wurde nach einer Sache, die es längst gab. Das
  // Beispiel ist echt: dieses Netzwerk heißt im Bestand „mobiInspec" (32) UND
  // „mobilnspec" (3), und keine feste Nadel bringt beide zusammen.
  { query: 'mob*spec', erklaerung: 'Platzhalter — wenn die Schreibweise schwankt', gruppe: 'kennung' }, // 33
  { query: 'ast:Fraunhofer', erklaerung: 'nur die Einrichtung', gruppe: 'werWo' },                      // 307
  // „nur der Ort", NICHT „Ort und Bundesland": seit v4.82 ist das Bundesland ein
  // eigenes Trefferfeld mit eigenem Präfix (`bl:`), und `ort:` löst ausschließlich
  // auf `standort` auf. Gemessen: `ort:Sachsen` 7 (Sachsenheim & Co.),
  // `bl:Sachsen` 2 742. Ein Lehrbeispiel, das eine Reichweite verspricht, die es
  // nicht hat, bringt die Suchsprache falsch bei.
  { query: 'ort:Dresden', erklaerung: 'nur der Ort — Bundesland: bl:', gruppe: 'werWo' },               // 485
  { query: 'ort:"Frankfurt am Main"', erklaerung: 'mehrere Wörter als EIN Wert', gruppe: 'werWo' },     // 41
  { query: 'titel:Laser ort:Dresden', erklaerung: 'zwei Felder in einer Anfrage', gruppe: 'werWo' },    // 5
  { query: 'notiz:Einbehalt', erklaerung: 'in den eigenen Arbeitsnotizen', gruppe: 'eigenes' },         // 50
];

/** Die Sucharten einer Gruppe, in der Reihenfolge der Liste. */
export function suchartenDerGruppe(gruppe: SuchspracheGruppe): Sucheart[] {
  return SUCHARTEN.filter(s => s.gruppe === gruppe);
}

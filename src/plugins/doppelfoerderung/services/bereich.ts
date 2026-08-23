/**
 * Der Betrachtungsbereich der Prüfung: welche Anträge überhaupt verglichen werden.
 *
 * Die Anforderung nennt ihn in einem Satz — „relevant sind abgeschlossene,
 * bewilligte und beantragte FuE-Vorhaben, Netzwerke und Studien der letzten 5
 * Jahre" — und das sind drei getrennte Achsen: Zeit, Art des Vorhabens, Stand
 * der Bearbeitung. Sie stehen hier als drei reine Prädikate nebeneinander, weil
 * sie einzeln abschaltbar sind und einzeln erklärt werden müssen.
 *
 * **Der Bereich ist ein Parameter, kein stiller Filter** (Pitfall #46): er wird
 * von aussen hereingereicht, steht als Chip im Seitenkopf und schneidet nichts
 * im Daten-Layer weg. Wer die Prüfung ohne ihn laufen lassen will, kann das.
 *
 * Am echten Bestand gemessen (14.225 Anträge, Stand 23.08.2026): mit allen drei
 * Achsen bleiben **4.327** Vorhaben übrig. Jede Achse für sich: Antragsdatum ab
 * 2021 lässt 6.365 stehen (4 Anträge tragen gar keins), die Phasen-Achse 13.593
 * (Dienstleistung 550 und Irrläufer 82 fallen), die Status-Achse nimmt 4.094
 * abgelehnte/zurückgezogene heraus.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { isAbgelehntZurueckgezogenStatus } from '@/core/utils/status-canonical';
import type { BereichsWahl } from '../types';

/**
 * Verbund-Phasen, die als „FuE-Vorhaben, Netzwerke und Studien" zählen.
 *
 * `VB_PHASE` aus dem Fachsystem: 1 = NW1, 2 = NW2, 3 = FuE, 4 = DL, 5 = DS,
 * 9 = Irrläufer. Netzwerke sind die beiden Netzwerk-Phasen, Studien die
 * Durchführbarkeitsstudie. Draussen bleiben Dienstleistung (die Anforderung
 * nennt sie nicht) und Irrläufer (die sind gar kein Vorhaben).
 */
export const BEREICH_PHASEN: ReadonlySet<number> = new Set([1, 2, 3, 5]);

/** Die Vorbelegung: alle drei Achsen an, Zeitfenster fünf Jahre. */
export const BEREICH_VORGABE: BereichsWahl = {
  jahre: 5,
  nurFueNetzwerkStudie: true,
  ohneAbgelehnte: true,
};

/**
 * Das Jahr aus einem Antragsdatum; `null`, wenn keines darin steht.
 *
 * Die Projektion liefert mal ISO (`2024-03-17`), mal den Rohstring aus dem
 * Fachsystem (`17.03.2024`) — deshalb wird die vierstellige Jahreszahl gesucht
 * statt ein Format angenommen.
 */
export function jahrAus(datum: string | undefined): number | null {
  const treffer = /(?:19|20)\d{2}/.exec(datum ?? '');
  return treffer ? Number(treffer[0]) : null;
}

/**
 * Liegt das Antragsdatum im Zeitfenster?
 *
 * Ein Antrag **ohne** Datum bleibt drin. Die Alternative wäre, ihn wegen einer
 * Lücke in den Stammdaten aus einer Doppelförderungs-Warnung zu nehmen — eine
 * fehlende Angabe ist kein Beleg dafür, dass das Vorhaben alt ist.
 */
export function imZeitfenster(item: AntragListItem, jahre: number | null, heuteJahr: number): boolean {
  if (jahre === null) return true;
  const jahr = jahrAus(item.antragsdatum);
  if (jahr === null) return true;
  return jahr >= heuteJahr - jahre;
}

/**
 * Ist es ein FuE-Vorhaben, ein Netzwerk oder eine Studie?
 *
 * Ohne `vb_phase` bleibt der Antrag drin — gleiche Begründung wie beim Datum.
 */
export function istFueNetzwerkStudie(item: AntragListItem): boolean {
  if (typeof item.vb_phase !== 'number') return true;
  return BEREICH_PHASEN.has(item.vb_phase);
}

/**
 * Ist der Antrag NICHT abgelehnt oder zurückgezogen?
 *
 * Über `isAbgelehntZurueckgezogenStatus`, nie gegen ein Status-Literal
 * (Pitfall #12) — und ausdrücklich **nicht** über
 * `getStatusCategory(...) === 'abgelehnt'`. Diese Kategorie ist vom
 * Förder-Katalog seit v4.87 unbesetzt: der amtliche Wert
 * `abgelehnt/zurückgezogen` landet in `abgeschlossen`, weil er fachlich ein
 * Endzustand ist. Ein Vergleich gegen `'abgelehnt'` liefe deshalb still ins
 * Leere und liesse alle 4.094 abgelehnten Vorhaben im Bereich stehen. Der
 * Helper ist die eine Stelle, die beide Wege kennt.
 *
 * Nicht betroffen sind „Ablehnung" (Kategorie `entscheidung`, 110 Vorhaben) und
 * „ablehnungsreif" (`in_pruefung`, 53): dort ist noch nichts entschieden, die
 * Vorhaben sind beantragt und gehören damit in den Bereich.
 */
export function istNichtAbgelehnt(item: AntragListItem): boolean {
  return !isAbgelehntZurueckgezogenStatus(item.status);
}

/** Alle gewählten Achsen zusammen. */
export function imBereich(item: AntragListItem, wahl: BereichsWahl, heuteJahr: number): boolean {
  if (!imZeitfenster(item, wahl.jahre, heuteJahr)) return false;
  if (wahl.nurFueNetzwerkStudie && !istFueNetzwerkStudie(item)) return false;
  if (wahl.ohneAbgelehnte && !istNichtAbgelehnt(item)) return false;
  return true;
}

/** Die Aktenzeichen im Bereich — der Schnitt, auf den der Suchkorpus fällt. */
export function bereichsAktenzeichen(
  items: readonly AntragListItem[],
  wahl: BereichsWahl,
  heuteJahr: number,
): Set<string> {
  const out = new Set<string>();
  for (const it of items) if (imBereich(it, wahl, heuteJahr)) out.add(it.aktenzeichen);
  return out;
}

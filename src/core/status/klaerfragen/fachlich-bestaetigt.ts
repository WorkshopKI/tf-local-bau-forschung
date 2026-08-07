/**
 * Statuscodes, deren Wortlaut **fachlich bestätigt** ist — und der Abgleich
 * gegen das, was die App tatsächlich anzeigt.
 *
 * **Warum das eine eigene Tabelle ist.** `STATUS_CODE_KATALOG` und die geladene
 * Fassung sind beide *Quellen*: sie sagen, wie ein Code heißt. Diese Liste ist
 * eine *Zusage*: jemand aus dem Fachbereich hat den Wortlaut bestätigt. Fielen
 * beide zusammen, prüfte der Katalog sich selbst.
 *
 * Der Anlass ist das VerlaufsBand. Es zeigt Statusbezeichnungen in einer Bahn,
 * in der niemand mehr nachschlägt, ob die Beschriftung stimmt — anders als in
 * einer Tabelle, wo der Rohwert daneben steht. Weicht der Katalog ab, sieht man
 * es dort nicht mehr, sondern glaubt es.
 *
 * **Verglichen wird nur der amtliche Text, nie die Kurzform.** `kurz` ist unsere
 * Beschriftung und darf abweichen — Code 59 heißt amtlich `bewilligt`, die
 * Pille sagt `Bewilligt` (Pitfall #43). Wer beides vergleicht, meldet die
 * Trennung als Fehler.
 *
 * Eine leere Ergebnisliste ist das **gute** Ergebnis. Die Zusage hält ein Test
 * fest, nicht dieser Kommentar.
 */
import { statusLabel } from '@/core/utils/status-wert-labels';
import { statusCodeEintrag } from '../status-codes';

/** Ein Wortlaut, den der Fachbereich bestätigt hat. */
export interface Bestaetigung {
  code: number;
  /** Der bestätigte amtliche Wortlaut, wortgetreu. */
  wortlaut: string;
  /** Woher die Bestätigung stammt — steht in der Kontextspalte des Exports. */
  quelle: string;
}

/**
 * Bestätigte Wortlaute. Wächst, wenn eine Abstimmung einen weiteren festhält;
 * nie aus dem Katalog abgeschrieben, sonst prüft er sich selbst.
 *
 * Beide Einträge sind zugleich der bislang **einzige direkte Beleg für die Güte
 * des C16-Exports**: sie decken sich mit dem, was der Export unabhängig davon
 * als Zielstatus von `AB` und `XHSP` führt (`vorgangssystem.md §14.4` Punkt 2).
 */
export const FACHLICH_BESTAETIGT: readonly Bestaetigung[] = [
  { code: 51, wortlaut: 'bewilligungsreif', quelle: 'Fachabstimmung 08/2026, deckungsgleich mit C16 (Ziel von AB)' },
  { code: 50, wortlaut: 'Bewilligungsentwurf VDI/VDE-IT', quelle: 'Fachabstimmung 08/2026, deckungsgleich mit C16 (Ziel von XHSP)' },
];

/** Wie der Katalog von einer Bestätigung abweicht. */
export type AbweichungsArt = 'fehlt' | 'abweichend';

export interface BezeichnungsAbweichung {
  bestaetigung: Bestaetigung;
  art: AbweichungsArt;
  /** Was stattdessen dasteht; `null` bei `fehlt`. */
  gefunden: string | null;
  /**
   * `auslieferung` — schon `STATUS_CODE_KATALOG` weicht ab.
   * `anzeige` — die Auslieferung stimmt, aber die geladene Fassung überschreibt
   * sie. Zwei verschiedene Reparaturen: die eine ist ein Release, die andere
   * ein Klick im Cockpit.
   */
  wo: 'auslieferung' | 'anzeige';
}

/**
 * Prüft die bestätigten Wortlaute gegen Auslieferung **und** Anzeige.
 *
 * Beides, weil die geladene Fassung Beschriftungen überschreiben kann und genau
 * ihre Fassung im Band landet: eine korrekte Auslieferung, die eine Fassung
 * überschreibt, wäre sonst unsichtbar in Ordnung. Gelesen wird über
 * {@link statusLabel} — dieselbe Funktion, die auch die Oberfläche fragt, statt
 * einer zweiten Auflösung daneben.
 *
 * `bestaetigt` ist ein Parameter mit Vorgabe, damit die **Positivkontrolle**
 * möglich bleibt: eine Prüfung, die am Bestand immer leer ausgeht, ist ohne
 * Gegenprobe nicht von einer kaputten zu unterscheiden.
 */
export function bezeichnungsAbweichungen(
  bestaetigt: readonly Bestaetigung[] = FACHLICH_BESTAETIGT,
): BezeichnungsAbweichung[] {
  const out: BezeichnungsAbweichung[] = [];
  for (const b of bestaetigt) {
    const eintrag = statusCodeEintrag(b.code);
    if (eintrag === null || eintrag === undefined) {
      out.push({ bestaetigung: b, art: 'fehlt', gefunden: null, wo: 'auslieferung' });
      continue;
    }
    if (eintrag.text !== b.wortlaut) {
      out.push({ bestaetigung: b, art: 'abweichend', gefunden: eintrag.text, wo: 'auslieferung' });
    }
    const angezeigt = statusLabel(eintrag.text);
    if (angezeigt !== b.wortlaut && angezeigt !== eintrag.text) {
      out.push({ bestaetigung: b, art: 'abweichend', gefunden: angezeigt, wo: 'anzeige' });
    }
  }
  return out;
}

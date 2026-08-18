/**
 * Die Spalte „KI-Antwort" an die Tabelle hängen — und warum das hier steht.
 *
 * Die Beleg-Spalten der Suche (`autoSpalten`) hängen am BESTAND: sie erscheinen,
 * weil ein Treffer sein Suchwort in diesem Feld trägt. Die KI-Antwort hängt an
 * etwas anderem — an einer Antwort, die es erst gibt, wenn die Treffermenge
 * schon steht.
 *
 * Daraus folgt eine Reihenfolge, die sich nicht auflösen lässt: die Tabellen-
 * Pipeline (`useSearchResults`) braucht ihre Spalten, bevor die Antwort läuft,
 * und die Antwort braucht die Treffer, die aus der Pipeline kommen. Statt den
 * Kreis zu schließen, wird die Spalte NACH der Pipeline angehängt — sie ist
 * reine Anzeige und beeinflusst weder Sortierung noch Filter.
 *
 * Rein — kein React, kein IDB.
 */
import { SEARCH_COLUMNS, type SearchColumn } from '../columns';

/** Der Schlüssel der Spalte. Eine Zeichenkette, eine Stelle. */
export const KI_ANTWORT_SPALTE = 'kiAntwort';

const DEFINITION = SEARCH_COLUMNS.find(c => c.key === KI_ANTWORT_SPALTE);

/**
 * Die sichtbaren Spalten, um die KI-Antwort ergänzt — aber nur, wenn die
 * Antwort überhaupt Vorhaben genannt hat.
 *
 * Angehängt statt einsortiert: die Spalte trägt Fließtext und ist breit; vorn
 * schöbe sie die Kennung aus dem Blick, um die es beim Querlesen geht.
 */
export function spaltenMitAntwort(
  sichtbare: readonly SearchColumn[],
  genannteAnzahl: number,
): SearchColumn[] {
  if (genannteAnzahl <= 0 || DEFINITION === undefined) return [...sichtbare];
  if (sichtbare.some(c => c.key === KI_ANTWORT_SPALTE)) return [...sichtbare];
  return [...sichtbare, DEFINITION];
}

/** Dieselbe Entscheidung für den Spalten-Aufklapper: dort steht die Spalte
 *  angehakt und gesperrt mit der Marke „auto", wie die Beleg-Spalten. */
export function erzwungeneSpalten(
  basis: readonly string[],
  genannteAnzahl: number,
): string[] {
  return genannteAnzahl > 0 ? [...basis, KI_ANTWORT_SPALTE] : [...basis];
}

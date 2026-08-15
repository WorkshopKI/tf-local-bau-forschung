/**
 * Wo stehen die Felder, die selbst angelegte Spalten lesen?
 *
 * Die `feldId` einer Spalte ist entweder ein kanonischer Key (`antragsdatum`)
 * oder ein roher CSV-Spalten-Code (`D_QS`). Unter welchem Key der Wert im
 * Antrag-Record landet, entscheidet das Mapping — genau dieselbe Frage, die der
 * Statuskatalog stellt, deshalb derselbe Index (`baueSpaltenIndex`).
 *
 * Rein: keine IO. Die Schemas reicht der Aufrufer herein.
 */
import type { CsvSchema } from '@/core/services/csv/types';
import { normCode } from '@/core/services/csv/status-datum-gruppen';
import { baueSpaltenIndex } from '@/core/status/feld-aufloesung';

/** Ein zu projizierendes Feld: wie es heißt und wo es steht. */
export interface FreiesFeld {
  /** So referenziert es die Spalten-Definition — und so steht es im Beutel. */
  feldId: string;
  /** Key im Antrag-Record, aus dem gelesen wird. */
  recordKey: string;
}

/**
 * Löst eine Menge von `feldId`s gegen die Schemas auf.
 *
 * Zwei Regeln, wie beim Statuskatalog:
 * 1. Die `feldId` ist als CSV-Spalte gemappt ⇒ deren Record-Key.
 * 2. Sonst ⇒ die `feldId` selbst (kanonische Felder heißen im Record wie sie).
 *
 * Anders als bei den Ordner-Spalten fällt hier **nichts weg**, wenn ein Programm
 * die Spalte nicht mappt: die Spalte existiert weiter, bleibt leer, und ihr
 * Tooltip sagt warum. Sie stillschweigend verschwinden zu lassen wäre schlimmer
 * — der Nutzer hat sie selbst angelegt und würde sie suchen.
 */
export function loeseFreieFelder(
  feldIds: readonly string[], schemas: readonly CsvSchema[],
): FreiesFeld[] {
  const spalten = baueSpaltenIndex(schemas);
  const gesehen = new Set<string>();
  const out: FreiesFeld[] = [];
  for (const feldId of feldIds) {
    if (gesehen.has(feldId)) continue;
    gesehen.add(feldId);
    out.push({ feldId, recordKey: spalten.get(normCode(feldId)) ?? feldId });
  }
  // Stabile Reihenfolge: die Signatur der Projektion hängt daran, und eine
  // Umsortierung dürfte keinen Rebuild auslösen.
  return out.sort((a, b) => a.feldId.localeCompare(b.feldId, 'de'));
}

/**
 * Trägt die Spalte in DIESEM Programm überhaupt Daten? Nur eine Antwort auf die
 * Mapping-Frage — ob im Bestand Werte stehen, weiß erst die Projektion.
 */
export function istGemappt(feldId: string, schemas: readonly CsvSchema[]): boolean {
  return baueSpaltenIndex(schemas).has(normCode(feldId));
}

/**
 * Deterministische Signatur der aufgelösten Felder. Geht in den Projektions-
 * Guard ein: kommt ein Feld hinzu oder ändert sich seine Auflösung, muss die
 * Slim-Projektion neu gebaut werden.
 *
 * Bewusst **ohne** Beschriftungen, Regeltexte und Farben: die ändern die
 * Anzeige, nicht die projizierten Rohwerte. Genau darauf beruht die Zusage,
 * dass das Bearbeiten einer Regel keinen Neuaufbau kostet.
 */
export function freieFelderSignatur(felder: readonly FreiesFeld[]): string {
  return felder.map(f => `${f.feldId}>${f.recordKey}`).join('|');
}

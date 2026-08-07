/**
 * Der domänenfreie Kern des „Darstellung"-Menüs (`DarstellungDropdown`): eine
 * Achse ist eine benannte Einfachauswahl mit einem Wert, der als „unverändert"
 * gilt.
 *
 * Bis v3.23 lebte das komplett in `plugins/antraege/darstellungsAchsen.ts`. Beim
 * Teilen blieb die Frage „WELCHE Achsen gelten gerade" dort (sie hängt am
 * Antrags-Datenmodell), hierher kam nur die Form. Die Trennlinie ist keine
 * Kosmetik: `baueDarstellungsAchsen` importiert `views`/`sort`/`tableGrouping`/
 * `arbeitsvorrat` — mit ihr zusammen entstünde eine Kante von `components/`
 * nach `plugins/`, also genau die Richtung, gegen die der Zyklen-Check steht.
 *
 * `Id` ist generisch, damit jede Seite ihren eigenen engen Union behält. Ein
 * gemeinsamer Union wüchse mit jeder Seite, die das Menü benutzt, und jede Seite
 * müsste die Achsen der anderen mitschleppen.
 */

export interface DarstellungOption {
  key: string;
  label: string;
}

export interface DarstellungAchse<Id extends string = string> {
  id: Id;
  /** Überschrift des Abschnitts im Menü. */
  label: string;
  /** Ein Halbsatz darunter, der die Achse von den anderen abgrenzt. */
  hinweis: string;
  options: readonly DarstellungOption[];
  value: string;
  /** Der Wert, der als „unverändert" gilt — er taucht nicht in der
   *  Zusammenfassung am Knopf auf. */
  standard: string;
}

/**
 * Die abweichenden Werte als „Antrag mit TV · Status" für den Knopf.
 *
 * Leer, solange alles auf Standard steht — dann trägt der Knopf nur seinen
 * Namen und bleibt schmal. Das ist der Normalfall und der Grund, warum mehrere
 * Achsen überhaupt in ein Menü passen.
 */
export function darstellungsZusammenfassung(
  achsen: readonly DarstellungAchse<string>[],
): string {
  return achsen
    .filter(a => a.value !== a.standard)
    .map(a => a.options.find(o => o.key === a.value)?.label ?? a.value)
    .join(' · ');
}

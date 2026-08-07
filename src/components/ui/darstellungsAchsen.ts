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
 *
 * **Seit dem Zeilen-Pattern trägt die Achse ihre Bedienform selbst** (`art`).
 * Sie ist Pflicht und wird nie aus `options.length` geraten: „zwei Werte" heißt
 * nicht „An/Aus" — „Antrag / Antrag mit TV" ist zweiwertig und trotzdem ein
 * Segment. Bei einem Schalter sagt `anKey`, welcher Schlüssel „an" bedeutet;
 * ohne ihn wäre die Richtung eine Reihenfolgen-Wette (bei `beendet` heißt der
 * erste Schlüssel `aus` = „ausgeblendet").
 */

export interface DarstellungOption {
  key: string;
  label: string;
}

/** Bedienelement der Zeile. IMMER explizit — nie aus der Optionszahl geraten. */
export type DarstellungArt = 'segment' | 'schalter';

interface AchseBasis<Id extends string> {
  id: Id;
  /**
   * Beschriftung links in der Zeile. Sie muss die Achse allein erklären — die
   * frühere Halbsatz-Zeile darunter ist mit dem Zeilen-Pattern ersatzlos
   * entfallen („Ansicht / Was eine Zeile zeigt" → „Zeile zeigt").
   */
  label: string;
  options: readonly DarstellungOption[];
  value: string;
  /** Der Wert, der als „unverändert" gilt — er beschriftet den Knopf nicht. */
  standard: string;
  /**
   * Zeile stapeln: Beschriftung als Micro-Caps über die volle Breite, Auswahl
   * darunter. Für Optionssätze, die neben ihrer Beschriftung nicht mehr in die
   * 380-px-Zeile passen. Bewusst gesetzt statt dem Umbruch überlassen — sonst
   * springt dieselbe Achse je nach Wortlänge zwischen ein- und zweizeilig.
   */
  stapel?: boolean;
}

export type DarstellungAchse<Id extends string = string> =
  | (AchseBasis<Id> & { art: 'segment' })
  | (AchseBasis<Id> & {
      art: 'schalter';
      /** Der Options-Schlüssel, der „an" bedeutet. */
      anKey: string;
    });

/** Steht der Schalter dieser Achse auf „an"? */
export function schalterAn(achse: DarstellungAchse<string>): boolean {
  return achse.art === 'schalter' && achse.value === achse.anKey;
}

/**
 * Der Gegen-Schlüssel eines Schalters — was geschrieben wird, wenn er ausgeht.
 * Fällt auf den eigenen `anKey` zurück, falls eine Achse fälschlich nur einen
 * Wert führt: lieber wirkungslos als ein Schreiben ins Leere.
 */
export function schalterAusKey(achse: DarstellungAchse<string>): string {
  if (achse.art !== 'schalter') return achse.value;
  return achse.options.find(o => o.key !== achse.anKey)?.key ?? achse.anKey;
}

/** Was der Knopf trägt, wenn etwas vom Standard abweicht. */
export interface DarstellungKurzfassung {
  /** Anzeigetext der ERSTEN abweichenden Achse; leer, wenn alles Standard ist. */
  text: string;
  /** Zahl der WEITEREN Abweichungen — im Knopf als „+N" in der Primärfarbe. */
  weitere: number;
}

/**
 * Die Abweichungen für den Knopf: der erste Wert im Klartext, der Rest als Zahl.
 *
 * Leer, solange alles auf Standard steht — dann trägt der Knopf nur seinen Namen
 * und bleibt schmal. Das ist der Normalfall und der Grund, warum mehrere Achsen
 * überhaupt in ein Menü passen. Vorher standen alle Abweichungen ausgeschrieben
 * („Antrag mit TV · Status · eingeblendet"); bei drei Achsen war der Knopf damit
 * breiter als die halbe Werkzeugleiste.
 *
 * Ein **Schalter** liefert sein Achsen-Label statt seines Wertes: „Darstellung:
 * eingeblendet" sagt nichts, „Darstellung: Beendete zeigen" schon.
 */
export function darstellungsZusammenfassung(
  achsen: readonly DarstellungAchse<string>[],
): DarstellungKurzfassung {
  const abweichend = achsen.filter(a => a.value !== a.standard);
  const erste = abweichend[0];
  if (!erste) return { text: '', weitere: 0 };
  const text = erste.art === 'schalter'
    ? erste.label
    // Unbekannter (z.B. veralteter) Wert fällt auf seinen Schlüssel zurück,
    // statt den Knopf stillschweigend leer zu lassen.
    : erste.options.find(o => o.key === erste.value)?.label ?? erste.value;
  return { text, weitere: abweichend.length - 1 };
}

/**
 * Die Aufrufe, die „Zurücksetzen" auslösen muss — nur die abweichenden Achsen.
 *
 * Als eigene reine Funktion, weil daran eine Annahme über die Aufrufer hängt:
 * das Menü feuert mehrere `onChange` in EINEM Tick. Das ist heute auf beiden
 * Seiten sicher — die Anträge-Setter (`plugins/antraege/store.ts`) fassen
 * disjunkte Store-Slices an und Zustands `set()` ist synchron, und
 * `useBoardAnsicht` hält je Achse einen eigenen `useState`-Slot mit absolutem
 * Wert. Ein künftiger Read-Modify-Write-Setter auf DERSELBEN Slice würde die
 * erste Zuweisung leise überschreiben; dann gehört hier eine `onReset`-Prop hin.
 */
export function zuruecksetzenAufrufe<Id extends string>(
  achsen: readonly DarstellungAchse<Id>[],
): ReadonlyArray<{ id: Id; key: string }> {
  return achsen
    .filter(a => a.value !== a.standard)
    .map(a => ({ id: a.id, key: a.standard }));
}

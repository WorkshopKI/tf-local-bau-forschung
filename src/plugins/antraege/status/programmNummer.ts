/**
 * Die Programm-/Richtlinien-Nummer eines Vorhabens — der Schlüssel, mit dem das
 * Vorgangssystem die richtige Trigger-Menge auswählt.
 *
 * Im Fachsystem heißt die Spalte `FM_NUMMER`, im CSV-Schema kanonisch
 * `unterprogramm_id`, in der Trigger-Zuarbeit „Richtlinie" — dieselbe Nummer.
 *
 * **Gefragt werden die Teilvorhaben, nicht der Verbund**: der `Verbund`-Record
 * führt kein `unterprogramm_id` (siehe `csv/types.ts`), die Nummer steht an den
 * Anträgen. Genommen wird das erste TV, das eine führt — ein Verbund läuft in
 * genau einer Richtlinie.
 *
 * `null` heißt **unbekannt**, nicht „egal": ohne Nummer zeigt die Oberfläche
 * lieber gar keine Trigger als die eines fremden Programms, und sagt, dass die
 * Spalte fehlt (typischerweise: `FM_NUMMER` ist im Schema nicht gemappt).
 */
interface MitUnterprogramm {
  unterprogramm_id?: string;
}

export function programmNummer(antraege: readonly MitUnterprogramm[]): string | null {
  for (const antrag of antraege) {
    const roh = antrag.unterprogramm_id;
    if (typeof roh === 'string' && roh.trim()) return roh.trim();
  }
  return null;
}

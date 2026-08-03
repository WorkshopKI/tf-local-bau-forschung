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

/**
 * Alle im Verbund vorkommenden Programm-Nummern, dedupliziert, in Fundreihenfolge.
 *
 * Reiner Kern der Invariante **„alle TVs eines Verbunds tragen dasselbe
 * Programm"** — mehr als ein Eintrag heißt, dass die Auswahl der Trigger vom
 * Zufall der Zeilenreihenfolge abhinge. Exportiert, damit der Test ihn ohne
 * Konsolen-Attrappe prüfen kann (Muster: `findMissingVerbuende` in
 * `csv/snapshot.ts`).
 */
export function programmNummernVon(antraege: readonly MitUnterprogramm[]): string[] {
  const out: string[] = [];
  for (const antrag of antraege) {
    const roh = antrag.unterprogramm_id;
    if (typeof roh !== 'string') continue;
    const nummer = roh.trim();
    if (nummer && !out.includes(nummer)) out.push(nummer);
  }
  return out;
}

/**
 * Die Programm-Nummer des Vorhabens. `null` = keines der TVs führt eine.
 *
 * Verletzte Invariante (zwei verschiedene Nummern) wird **gemeldet, nicht
 * geheilt**: der Rückgabewert bleibt die erste Nummer, damit die Anzeige nicht
 * kippt — aber die Meldung nennt Verbund und Nummern, und der Status-Katalog
 * zählt die Fälle sichtbar mit. Kein DEV-`throw` wie in `csv/snapshot.ts`: das
 * hier läuft im Renderpfad, ein Wurf nähme dem Nutzer die ganze Seite statt ihm
 * einen Datenfehler zu zeigen.
 */
export function programmNummer(
  antraege: readonly MitUnterprogramm[], verbundId?: string,
): string | null {
  const nummern = programmNummernVon(antraege);
  if (nummern.length > 1) {
    console.error(
      `[programm-nummer] Invariante verletzt — Verbund ${verbundId ?? '(ohne Id)'} `
      + `trägt ${nummern.length} Programm-Nummern: ${nummern.join(', ')}. `
      + `Verwendet wird ${nummern[0]}; die Trigger-Auswahl hängt damit an der Zeilenreihenfolge.`,
    );
  }
  return nummern[0] ?? null;
}

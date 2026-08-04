/**
 * **Welche Spalten das Journal führt** — strukturell definiert, nicht kuratiert.
 *
 * Alle Spalten mit Präfix `D_` (die Vorgangskürzel des Fachsystems) plus
 * `STATUS_TV` und `STATUS_VB`. Kein generischer Diff über alle Exportspalten:
 * der Export führt mehrere hundert Felder, und ein Journal über Adressen und
 * Kostenpositionen beantwortet keine Frage, die jemand stellt.
 *
 * **Gelesen wird die ROHE CSV-Spalte, nicht der gemergte Record.** Das Journal
 * beschreibt den *Export*; ein gemergter Wert ist eine Mischung mehrerer Quellen
 * und ließe sich nicht mehr einer Änderung in C16 zuordnen. Damit entfällt
 * auch die Schema-Auflösung (Bug-Klasse 5) — die Spalte heißt hier, wie sie in
 * der Datei heißt.
 *
 * **Keine Bearbeiterspalte.** `JOURNAL_AUSGESCHLOSSEN` nennt sie ausdrücklich,
 * obwohl die `D_`-Regel sie ohnehin nicht erfasst — die Liste ist der Ort, an
 * dem die Entscheidung nachlesbar steht, und ein Konventionstest hält sie. Ein
 * Journal mit Personen-Achse wäre ein Aktivitätsprotokoll und damit
 * mitbestimmungspflichtig.
 */

/** Spalten-Präfix der Vorgangskürzel — sie tragen Datumswerte. */
export const KUERZEL_PRAEFIX = 'D_';

/** Die beiden Status-Spalten, die kein `D_` tragen, aber dazugehören. */
export const STATUS_SPALTEN: readonly string[] = ['STATUS_TV', 'STATUS_VB'];

/**
 * Spalten, die **nie** ins Journal gehören — mit Begründung, nicht nur als Liste.
 *
 * Bearbeiter-Kürzel (`BIB_KUERZ`, `TIB_KUERZ`, `BFM_KUERZ`, `ZTP_KUERZ`,
 * `PFM_KUERZ`) sagen, WER zuständig ist. Zusammen mit einem Datumsverlauf ergäbe
 * das ein personenbezogenes Aktivitätsprotokoll — Leistungs- und
 * Verhaltenskontrolle, mitbestimmungspflichtig. Das Journal beantwortet „was hat
 * sich geändert", nicht „wer war das".
 */
export const JOURNAL_AUSGESCHLOSSEN: readonly string[] = [
  'BIB_KUERZ', 'BFM_KUERZ', 'TIB_KUERZ', 'ZTP_KUERZ', 'PFM_KUERZ',
];

const AUSGESCHLOSSEN = new Set(JOURNAL_AUSGESCHLOSSEN.map(s => s.toUpperCase()));

/** Ein journalisiertes Feld: die rohe Spalte, so wie sie im Export steht. */
export interface JournalFeld {
  /** Schlüssel in der geparsten Zeile — die Spalte in Original-Schreibweise. */
  key: string;
  /** Normalisierter Name für Stand und Anzeige (`D_ARZ`). */
  spalte: string;
  /** Datumsspalte? Dann wird `YYYYMMDD` gespeichert. */
  datum: boolean;
}

/** Gehört diese rohe Spalte ins Journal? Rein — die Regel an einer Stelle. */
export function istJournalSpalte(spalte: string): boolean {
  const gross = spalte.trim().toUpperCase();
  if (AUSGESCHLOSSEN.has(gross)) return false;
  return gross.startsWith(KUERZEL_PRAEFIX) || STATUS_SPALTEN.includes(gross);
}

/**
 * Die Journal-Felder aus dem Spaltenkopf des Exports. Rein.
 *
 * Entdoppelt über den normalisierten Namen: ein Export, der eine Spalte zweimal
 * führt (kommt vor), soll nicht zwei Journal-Einträge je Änderung erzeugen.
 */
export function baueJournalFelder(headers: readonly string[]): JournalFeld[] {
  const proSpalte = new Map<string, JournalFeld>();
  for (const key of headers) {
    if (!istJournalSpalte(key)) continue;
    const spalte = key.trim().toUpperCase();
    if (proSpalte.has(spalte)) continue;
    proSpalte.set(spalte, { key, spalte, datum: spalte.startsWith(KUERZEL_PRAEFIX) });
  }
  return [...proSpalte.values()].sort((a, b) => a.spalte.localeCompare(b.spalte));
}

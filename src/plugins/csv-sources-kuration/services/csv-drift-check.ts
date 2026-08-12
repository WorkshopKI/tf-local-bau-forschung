/**
 * Schema-vs-CSV-Spalten-Drift-Erkennung.
 *
 * Wird vor jedem Re-Import (manuell oder Auto-Refresh) aufgerufen, um zu
 * pruefen, ob die aktuell vorliegende CSV-Datei dieselben Spalten hat wie
 * beim letzten Import. Die Auto-Refresh-Pipeline zieht Quellen mit
 * unveraendertem Header silent durch; bei Drift entscheidet sie anhand der
 * Drift-Art (siehe `isNewColumnsOnlyDrift`), ob sie die Zusatzspalten headless
 * uebernimmt oder die Quelle dem Kurator zur manuellen Bearbeitung vorlegt.
 *
 * Logik:
 *  - `matched`        : Schema-Spalten, die in der CSV vorhanden sind
 *  - `missingFromCsv` : Schema-Spalten, die in der CSV fehlen
 *                      -> Felder bleiben beim Import leer (BLOCKIEREND)
 *  - `newColumns`     : CSV-Spalten, die im Schema nicht gemappt sind
 *                      -> werden beim Import ignoriert (harmlos → Auto-Adopt)
 *
 * `hasDrift(v)`             = (missingFromCsv UND/ODER newColumns nicht leer).
 * `isNewColumnsOnlyDrift(v)` = nur Zusatzspalten, nichts fehlt → Auto-Refresh
 *   uebernimmt sie headless als `{ ignore: true }` (kein Block).
 * `entscheideDrift(v, akzeptiert)` = die Regel als Ganzes, inklusive der
 *   einmaligen Nutzer-Zustimmung „fehlende Spalten trotzdem in Kauf nehmen".
 */

import type { CsvSchema } from '@/core/services/csv/types';

export interface HeaderValidation {
  matched: string[];
  missingFromCsv: string[];
  newColumns: string[];
}

export function validateHeaders(schema: CsvSchema, csvHeaders: string[]): HeaderValidation {
  const schemaCols = Object.keys(schema.column_mapping);
  const csvSet = new Set(csvHeaders);
  const schemaSet = new Set(schemaCols);
  return {
    matched: schemaCols.filter(c => csvSet.has(c)),
    missingFromCsv: schemaCols.filter(c => !csvSet.has(c)),
    newColumns: csvHeaders.filter(c => !schemaSet.has(c)),
  };
}

export function hasDrift(v: HeaderValidation): boolean {
  return v.missingFromCsv.length > 0 || v.newColumns.length > 0;
}

/**
 * Reine „neue Spalten"-Drift: es fehlt keine gemappte Schema-Spalte, aber die
 * CSV bringt zusätzliche (noch nicht gemappte) Spalten mit. Dieser Fall ist für
 * den Import harmlos (unbekannte Spalten werden ohnehin ignoriert) und darf im
 * Auto-Refresh headless als `{ ignore: true }` übernommen werden, statt den
 * täglichen Import zu blockieren. `missingFromCsv > 0` bleibt dagegen der
 * gefährliche Fall (leert echte Felder) → weiter Kurator-Review.
 */
export function isNewColumnsOnlyDrift(v: HeaderValidation): boolean {
  return v.missingFromCsv.length === 0 && v.newColumns.length > 0;
}

/**
 * Was der Auto-Refresh mit einer Quelle tut — die EINE Stelle, an der die
 * Drift-Regel steht. Rein, damit sie ohne IDB/SMB prüfbar ist.
 *
 * `akzeptiert` = der Nutzer hat die fehlenden Spalten für DIESEN Lauf bewusst
 * in Kauf genommen (Knopf „Trotzdem importieren" im Drift-Bericht). Die
 * Zustimmung gilt einmalig und wird nirgends gespeichert: nach dem Import ist
 * die Quelle gestempelt und faellt aus den Kandidaten, ein NEUER Export mit
 * derselben Luecke fragt wieder.
 */
export interface DriftEntscheidung {
  /** Quelle importieren (statt sie blockierend zu melden)? */
  importieren: boolean;
  /** Zusatzspalten headless als `{ ignore: true }` ins Schema uebernehmen? */
  neueSpaltenAdoptieren: boolean;
  /**
   * Fehlende Schema-Spalten, die bewusst uebergangen werden. Nicht-leer heisst:
   * diese Felder liefert die Quelle nicht mehr und wird sie beim Merge leeren,
   * soweit keine andere Quelle dasselbe Feld traegt. Fuer Bericht + Audit.
   */
  uebergangeneSpalten: string[];
}

/**
 * Traegt der zweite Anlauf mit dem ERKANNTEN Encoding die Drift weg?
 *
 * Wechselt ein Export von windows-1252 auf UTF-8 (oder zurueck), decodieren alle
 * Umlaut-Spaltennamen falsch: `Nachrücker` steht dann als fehlend UND
 * `NachrÃ¼cker` als neu in derselben Validierung. Das sieht aus wie „Spalten
 * verschwunden", ist aber ein reiner Lesefehler — und ein Import mit dem falschen
 * Encoding wuerde auch jeden WERT verstuemmeln, nicht nur die Kopfzeile.
 *
 * Bewusst streng: uebernommen wird nur, wenn danach KEINE Schema-Spalte mehr
 * fehlt. „Etwas besser" reicht nicht — dann ist die Ursache eine andere und die
 * Quelle gehoert vor Augen.
 */
export function encodingHeilungTraegt(alt: HeaderValidation, neu: HeaderValidation): boolean {
  return alt.missingFromCsv.length > 0 && neu.missingFromCsv.length === 0;
}

export function entscheideDrift(v: HeaderValidation, akzeptiert: boolean): DriftEntscheidung {
  if (!hasDrift(v)) {
    return { importieren: true, neueSpaltenAdoptieren: false, uebergangeneSpalten: [] };
  }
  if (isNewColumnsOnlyDrift(v)) {
    return { importieren: true, neueSpaltenAdoptieren: true, uebergangeneSpalten: [] };
  }
  if (!akzeptiert) {
    return { importieren: false, neueSpaltenAdoptieren: false, uebergangeneSpalten: [] };
  }
  return {
    importieren: true,
    neueSpaltenAdoptieren: v.newColumns.length > 0,
    uebergangeneSpalten: v.missingFromCsv,
  };
}

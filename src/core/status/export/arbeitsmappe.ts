/**
 * Eine **Arbeitsmappe mit mehreren Blättern** schreiben.
 *
 * Die vier bestehenden XLSX-Exporte der App erzeugen je genau ein Blatt und
 * sind auf ihre Domäne zugeschnitten (`exportFilteredAntraegeXlsx` auf
 * `AntragListItem`, `buildWorkbook` der Auslastung auf Export-Zeilen). Für eine
 * Erhebung mit mehreren Auswertungen fehlte das Stück; es steht hier und lässt
 * die vier unangetastet.
 *
 * **Hierher gezogen mit dem zweiten Konsumenten** (v2.407, Klärungs-Export). Bis
 * dahin stand die Datei im Status-Cockpit, mit dem ausdrücklichen Vermerk, dass
 * das Hochziehen ein Zweizeiler ist, sobald jemand zweites sie braucht. Sie liegt
 * unter `core/status/`, nicht unter `core/services/`: alle drei Konsumenten
 * (Status-Cockpit, Vorgangs-Board, „Zu klären") gehören zum Status-Subsystem, und
 * `core/status/import/` ist der Präzedenzfall. Ein neues Verzeichnis unter
 * `core/services/` hätte zudem den Zähl-Guard gerissen.
 *
 * `zeitstempel` wohnt hier ebenfalls — es stand vorher wörtlich zweimal im Code
 * (hier und im Board-Export).
 *
 * **Jedes Blatt trägt eine Kopfzeile mit seinem Erhebungs-Kontext.** Eine Zahl
 * ohne Stichtag und Grundmenge ist im Termin nicht einzuordnen — und genau
 * darüber entsteht später der Streit, welche Liste denn nun gilt.
 *
 * `XLSX.writeFile` erledigt Blob und Download-Anker selbst und funktioniert
 * unter `file://` (kein Netzwerkzugriff, keine Object-URL-Sonderwege).
 */
import * as XLSX from 'xlsx';

export interface Blatt {
  /** Blattname. Excel erlaubt maximal 31 Zeichen — wird gekürzt. */
  name: string;
  /** Erklärender Kopf über der Tabelle, je Eintrag eine Zeile. */
  kopf: string[];
  /** Spaltenüberschriften. */
  spalten: string[];
  zeilen: (string | number)[][];
}

/** Excels harte Grenze für Blattnamen. */
const NAME_MAX = 31;

/** `2026-08-03T14:22` → `2026-08-03-14-22`; Mehrfach-Exports überschreiben nicht. */
export function zeitstempel(jetzt: Date): string {
  return jetzt.toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

export function baueArbeitsmappe(blaetter: readonly Blatt[]): XLSX.WorkBook {
  const mappe = XLSX.utils.book_new();
  for (const b of blaetter) {
    const aoa: (string | number)[][] = [
      ...b.kopf.map(z => [z]),
      ...(b.kopf.length > 0 ? [[]] : []),
      b.spalten,
      ...b.zeilen,
    ];
    const blatt = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(mappe, blatt, b.name.slice(0, NAME_MAX));
  }
  return mappe;
}

/** Schreibt die Mappe und stößt den Download an. */
export function schreibeArbeitsmappe(blaetter: readonly Blatt[], dateiname: string): void {
  if (blaetter.length === 0) throw new Error('Nichts zu exportieren — keine Auswertung enthalten.');
  XLSX.writeFile(baueArbeitsmappe(blaetter), dateiname);
}

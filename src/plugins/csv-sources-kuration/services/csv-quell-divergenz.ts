/**
 * Divergenz zweier Datei-Sichten auf dieselbe CSV-Quelle.
 *
 * Der Team-Stempel im Schema sagt: „diese Quelle wurde zuletzt aus einer Datei
 * mit mtime M, Größe S und Checksum X importiert — von Rechner R". Findet ein
 * Rechner für dieselbe Export-Nacht eine Datei mit ANDEREM Checksum und ändert
 * sein Import Zeilen, lesen zwei Rechner verschiedene Kopien desselben Exports:
 * andere Kodierung (die App-eigene UTF-8-Kopie unter `programm/antraege/imports`,
 * 18.08.2026), ein anderer Ordner nach dem Share-Umzug, eine mit Excel
 * gespeicherte Datei. Das ist kein neuer Export — der läge eine Nacht weiter —
 * sondern ein Konfigurationsproblem, und genau die Quelle der Import-Publish-
 * Kette, die das Team täglich mit „neue Daten" weckte (Sept. 2026).
 *
 * Die Regel ist bewusst eine WARNUNG, kein Block: welche Sicht die richtige
 * ist, weiß nur der Mensch; die Endlosschleife stoppt der lokale Import-
 * Stempel (`lokaler-stempel.ts`) ohnehin. Hier geht es darum, dass der Grund
 * am Bildschirm und im Audit-Log steht statt in Merge-Zahlen versteckt.
 */

import { MS_TAG } from '@/core/utils/zeitEinheiten';
import type { CsvSchema } from '@/core/services/csv/types';

/**
 * Zwei Sichten gelten als „dieselbe Export-Nacht", wenn ihre mtimes näher
 * beieinander liegen als dies. Die Exporte entstehen 1× nachts, also ≥ 24 h
 * auseinander; 6 h vertragen den mtime-Versatz zwischen SMB-Client, Citrix und
 * Zeitzone, ohne den Vortags-Export einzufangen.
 */
export const DIVERGENZ_FENSTER_MS = 6 * 60 * 60 * 1000;

/** Was das Schema über den letzten Team-Import der Quelle weiß. */
export interface TeamStempel {
  fileName: string | null;
  lastModified: number | null;
  size: number | null;
  checksum: string | null;
  /** Wer gestempelt hat (`source_stamped_by`) — bei Alt-Stempeln unbekannt. */
  von: string | null;
}

/** Die Datei, die DIESER Rechner gerade gelesen hat. */
export interface DateiSicht {
  name: string;
  lastModified: number;
  size: number;
  checksum: string;
}

export interface QuellDivergenz {
  schemaId: string;
  schemaName: string;
  teamStempel: TeamStempel;
  datei: DateiSicht;
  /** Zeilen, die der Import gegen die Team-Hashes als neu/geändert/entfernt fand. */
  geaenderteZeilen: number;
}

/**
 * Eine Datei gilt als VERALTET, wenn sie um mindestens einen Export-Zyklus
 * älter ist als die Datei, die das Team zuletzt importiert hat. Die Exporte
 * entstehen 1× nachts; ein Versatz unter 24 h ist Uhr- oder SMB-Versatz,
 * darüber liegt eine Datei aus der Vergangenheit — ein Import setzte den
 * Team-Stand zurück. Produktiv-Beleg 08.09.2026: ein Laptop mit einem
 * Export-Ordner vom 21.08. importierte dreimal am Tag über den aktuellen Stand
 * (`changed 1028, heldRemovals 66`), jedes Mal um 18 Tage zurück.
 */
export const VERALTET_SCHWELLE_MS = MS_TAG;

/** Eine Quelle, deren Datei älter ist als der Team-Stempel — nicht automatisch importiert. */
export interface VeralteteQuelle {
  schemaId: string;
  schemaName: string;
  teamStempel: TeamStempel;
  datei: { name: string; lastModified: number; size: number };
}

/**
 * Älter als der Team-Stempel um mindestens einen Export-Zyklus — und nicht
 * dieselben Bytes (dann gäbe es nichts zu importieren). Ohne Team-Zeit kein
 * Urteil. Bewusst ein BLOCK (mit „Trotzdem importieren"), anders als die
 * Divergenz derselben Nacht: eine ältere Datei über einen neueren Stand zu
 * legen ist nie richtig, egal welcher Rechner recht hat.
 */
export function istVeralteteDatei(
  team: TeamStempel,
  datei: { name: string; lastModified: number; size: number; checksum?: string },
): boolean {
  if (team.lastModified == null) return false;
  if (datei.checksum != null && team.checksum != null && datei.checksum === team.checksum) return false;
  return team.lastModified - datei.lastModified >= VERALTET_SCHWELLE_MS;
}

export function teamStempelAus(schema: CsvSchema): TeamStempel {
  return {
    fileName: schema.source_file_name ?? null,
    lastModified: schema.source_last_modified ?? null,
    size: schema.last_file_size ?? null,
    checksum: schema.file_checksum ?? null,
    von: schema.source_stamped_by ?? null,
  };
}

/**
 * Divergenz = Team-Checksum vorhanden und ungleich, dieselbe Export-Nacht,
 * und der Import hat wirklich Zeilen geändert. Ohne Änderungen war nur der
 * Stempel veraltet; mit einem Team-Stempel aus der Vornacht ist es der
 * normale Tages-Export.
 */
export function istQuellDivergenz(team: TeamStempel, datei: DateiSicht, geaenderteZeilen: number): boolean {
  if (geaenderteZeilen <= 0) return false;
  if (team.checksum == null || team.lastModified == null) return false;
  if (team.checksum === datei.checksum) return false;
  return Math.abs(team.lastModified - datei.lastModified) < DIVERGENZ_FENSTER_MS;
}

/**
 * Lokaler Import-Stempel — „DIESER Rechner hat DIESE Datei importiert".
 *
 * Der Team-Stempel im Schema (`source_last_modified` / `last_file_size` /
 * `file_checksum`) reist im Snapshot mit und wird beim Sync durch die Sicht des
 * Rechners ersetzt, der zuletzt publiziert hat. Sieht der die Quelle anders
 * (andere Kopie, andere Kodierung, Citrix-mtime), gilt die eigene, längst
 * importierte Datei danach wieder als „neu": Import, Publish — und beim anderen
 * Rechner dasselbe Spiel. Gemessen im Produktivsystem (Sept. 2026): fünf
 * pl-Rechner, jeder Start ein Voll-Import unveränderter Exporte mit ~1000
 * „geänderten" Zeilen, jedes Mal eine Team-Benachrichtigung.
 *
 * Dieser Beleg liegt darum im kv-Store des Rechners, NICHT im Schema: er ist
 * nie Teil des Snapshots, nie Teil eines Sidecars, und kein Sync überschreibt
 * ihn. Er beantwortet nur eine Frage: habe *ich* diese Bytes schon verarbeitet?
 * Was das Team daraus gemacht hat, steht weiter im Schema.
 *
 * Einziger Schreibpunkt für Importe ist `importCsvSource` (beide Pfade: voller
 * Import und Checksum-Skip); `checkSourceForUpdate` ergänzt den Beleg, wenn der
 * Team-Checksum die eigene Datei bestätigt hat — damit der nächste Start ohne
 * Hash-Lauf über 70 MB auskommt.
 */

import type { IDBStore } from '../storage/idb-store';
import { CSV_SOURCE_LOKAL_STEMPEL_IDB_KEY } from '../infrastructure/types';

export interface LokalerImportStempel {
  /** Dateiname im verknüpften Ordner — nur zur Anzeige/Diagnose. */
  fileName: string;
  /** `File.lastModified` der verarbeiteten Datei (epoch ms). */
  lastModified: number;
  /** `File.size` in Byte. */
  size: number;
  /** SHA-1 der Rohbytes — der autoritative Teil des Belegs. */
  checksum: string;
  /** Wann dieser Rechner die Datei verarbeitet bzw. als bekannt bestätigt hat (ISO). */
  importedAt: string;
}

export type LokaleStempel = Record<string, LokalerImportStempel>;

export async function leseLokaleStempel(idb: IDBStore): Promise<LokaleStempel> {
  return (await idb.get<LokaleStempel>(CSV_SOURCE_LOKAL_STEMPEL_IDB_KEY)) ?? {};
}

export async function schreibeLokalenStempel(
  idb: IDBStore,
  schemaId: string,
  stempel: LokalerImportStempel,
): Promise<void> {
  const alle = await leseLokaleStempel(idb);
  await idb.set(CSV_SOURCE_LOKAL_STEMPEL_IDB_KEY, { ...alle, [schemaId]: stempel });
}

/** Beleg aus einer gerade verarbeiteten Datei bauen (Importer + Bestätigung). */
export function stempelFuerDatei(file: File, checksum: string, importedAt = new Date().toISOString()): LokalerImportStempel {
  return { fileName: file.name, lastModified: file.lastModified, size: file.size, checksum, importedAt };
}

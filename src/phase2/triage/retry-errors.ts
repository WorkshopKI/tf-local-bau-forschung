/**
 * "Nur Errors triagieren" — listet Manifest-Eintraege mit triage_state='review'
 * + triage_reason startsWith 'parse_error:' und macht sie wieder triagierbar
 * (Manifest-Cache-Schnellpfad muss umgangen werden).
 *
 * Use-Case: Nach einem Bulk-Run mit Errors (oder Tab-Crash mitten drin) will
 * man die ~50–500 fehlgeschlagenen Dateien gezielt nachreichen, ohne den
 * ganzen 100k-Datenbestand erneut zu scannen.
 */
import type { IDBStore } from '../../core/services/storage/idb-store';
import {
  deleteManifestEntry,
  listManifestEntries,
} from '../scanner/manifest-store';
import type { ScanFile } from '../scanner/scan-roots';
import type { ManifestEntry } from '../types';

export interface ErrorManifestSummary {
  filename: string;
  filepath: string;
  message: string;
  classified_at: string;
}

/** Listet alle parse_error-Manifests (nicht-mutativ). */
export async function listParseErrorManifests(
  idb: IDBStore,
): Promise<ErrorManifestSummary[]> {
  const all = await listManifestEntries(idb);
  return all
    .filter(m => m.triage_reason.startsWith('parse_error:'))
    .map(m => ({
      filename: m.filename,
      filepath: m.filepath,
      message: m.triage_reason.replace(/^parse_error:\s*/, ''),
      classified_at: m.classified_at,
    }));
}

/**
 * Bereitet die parse_error-Files fuer Re-Triage vor:
 *  1. Liest die Manifest-Eintraege
 *  2. Loescht sie (sonst greift der Cache-Schnellpfad in triageFile())
 *  3. Konvertiert zu ScanFile[] das der Caller an bulkScanFiles uebergibt
 *
 * Caller ruft danach selber bulkScanFiles({ files: result, ... }) auf.
 */
export async function prepareErrorRetry(
  idb: IDBStore,
): Promise<{ files: ScanFile[]; cleared: number }> {
  const all = await listManifestEntries(idb);
  const errors: ManifestEntry[] = all.filter(m =>
    m.triage_reason.startsWith('parse_error:'),
  );
  for (const m of errors) {
    await deleteManifestEntry(idb, m.filename);
  }
  const files: ScanFile[] = errors.map(m => ({
    filename: m.filename,
    filepath: m.filepath,
    size_bytes: m.size_bytes,
    mtime: m.mtime,
  }));
  return { files, cleared: errors.length };
}

/**
 * Gemeinsamer loadBlob-Builder: aus einem Dokumentenquelle-Root-Handle macht
 * er die `(file: ScanFile) => Promise<Blob | null>`-Funktion, die
 * `bulkScanFiles()` als Lazy-Blob-Provider erwartet.
 *
 * Wird sowohl vom Dev-Triage-Panel als auch von der Kurator-Rescan-Card
 * verwendet. Faengt Handle-Errors (Datei wurde umbenannt/geloescht waehrend
 * des Bulk-Laufs) und liefert null zurueck — der Triage-Orchestrator schreibt
 * dann ein orphan-Manifest mit reason 'file_not_readable'.
 */
import type { ScanFile } from '../scanner/scan-roots';

export function makeLoadBlobFromHandle(
  root: FileSystemDirectoryHandle,
): (file: ScanFile) => Promise<Blob | null> {
  return async (file: ScanFile): Promise<Blob | null> => {
    try {
      const parts = file.filepath.split('/').filter(Boolean);
      if (parts.length === 0) return null;
      const fileName = parts[parts.length - 1];
      if (!fileName) return null;
      let dir: FileSystemDirectoryHandle = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const segment = parts[i];
        if (!segment) return null;
        dir = await dir.getDirectoryHandle(segment);
      }
      const fh = await dir.getFileHandle(fileName);
      return await fh.getFile();
    } catch {
      return null;
    }
  };
}

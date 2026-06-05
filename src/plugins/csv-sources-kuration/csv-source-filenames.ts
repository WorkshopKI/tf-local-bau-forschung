/**
 * v2.28: Geteilte schemaId → Dateiname-Zuordnung der CSV-Quellen auf dem
 * **Daten-Ordner** (`_intern/csv-source-filenames.json`).
 *
 * Zweck: Die Zuordnung „welche Datei im CSV-Ordner gehört zu welcher Quelle"
 * EINMAL team-weit festhalten, statt sie auf jedem PL-Rechner per teurem
 * Header-Scan (jede CSV lesen+parsen) neu zu ermitteln. Geschrieben von dem
 * Rechner, der die echten Dateien hat (erster PL beim Ordner-Verknüpfen, bzw.
 * Kurator bei der Erstregistrierung); gelesen von allen anderen PLs, die danach
 * NUR noch den Ordner freigeben müssen — die App weiß dann die exakten
 * Dateinamen und löst per `dirHandle.getFileHandle(name)` auf (nur Metadaten,
 * kein Scan/Parse).
 *
 * Schreib-Profil (Pitfall #23): Idempotent-overwrite (Single-Source-of-Truth,
 * kleines JSON) via `atomicWrite` mit Backup-Rotation.
 *
 * Robust gegen Abweichungen: passt ein hier hinterlegter Dateiname auf einem
 * bestimmten Rechner NICHT (umbenannt / anderer Export), schlägt `getFileHandle`
 * fehl → die App fällt auf den lokalen Scan+Heal (v2.27.2, lokale Filemap)
 * zurück. Best-effort beim Schreiben: Read-only-User (kein Daten-Share-
 * Schreibrecht) überspringen den Write still.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';

export const CSV_SOURCE_FILENAMES_PATH = '_intern/csv-source-filenames.json';

interface CsvSourceFilenamesFile {
  version: 1;
  updatedAt: string;
  /** schemaId → Dateiname (direkt im verknüpften CSV-Ordner, nicht rekursiv). */
  mappings: Record<string, string>;
}

/** Liest die geteilte Zuordnung vom Daten-Ordner. Leeres Objekt, wenn fehlend. */
export async function loadSharedCsvFilenames(idb: IDBStore): Promise<Record<string, string>> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return {};
  try {
    const text = await readText(handle, CSV_SOURCE_FILENAMES_PATH);
    if (!text) return {};
    const parsed = JSON.parse(text) as Partial<CsvSourceFilenamesFile>;
    return parsed.mappings ?? {};
  } catch {
    return {};
  }
}

/**
 * Merge-Update der geteilten Zuordnung (überschreibt nur die übergebenen
 * schemaIds). Best-effort — ohne Daten-Share-Schreibrecht still übersprungen.
 */
export async function saveSharedCsvFilenames(
  idb: IDBStore,
  entries: Record<string, string>,
): Promise<void> {
  if (Object.keys(entries).length === 0) return;
  const handle = await getDatenShareHandle(idb);
  if (!handle) return;
  try {
    const existing = await loadSharedCsvFilenames(idb);
    const next: CsvSourceFilenamesFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      mappings: { ...existing, ...entries },
    };
    await atomicWrite(handle, CSV_SOURCE_FILENAMES_PATH, JSON.stringify(next, null, 2));
  } catch {
    /* best-effort — Read-only-User / offline ignorieren */
  }
}

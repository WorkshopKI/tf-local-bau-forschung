/**
 * Export/Import der Dev-Scan-Konfiguration auf den Daten-Share.
 *
 * Erlaubt es, Pfad-Listen zwischen Geraeten / Devs auszutauschen, ohne dass
 * sie automatisch synchronisiert werden — Dev triggert beide Richtungen
 * explizit ueber Buttons im Picker.
 */
import type { IDBStore } from '../../core/services/storage/idb-store';
import { atomicWrite } from '../../core/services/infrastructure/atomic-write';
import { getScanConfig, saveScanConfig } from './store';
import { SCAN_CONFIG_SHARE_PATH, type ScanConfigEntry } from './types';

interface ShareFileV1 {
  version: 1;
  selected_paths: string[];
  exported_at: string;
}

export interface ScanConfigExportResult {
  path: string;
  bytes: number;
  paths: number;
}

export async function exportScanConfigToShare(
  idb: IDBStore,
  datenShare: FileSystemDirectoryHandle,
): Promise<ScanConfigExportResult> {
  const cfg = await getScanConfig(idb);
  const file: ShareFileV1 = {
    version: 1,
    selected_paths: cfg?.selected_paths ?? [],
    exported_at: new Date().toISOString(),
  };
  const json = JSON.stringify(file, null, 2);
  await atomicWrite(datenShare, SCAN_CONFIG_SHARE_PATH, json);
  return {
    path: SCAN_CONFIG_SHARE_PATH,
    bytes: json.length,
    paths: file.selected_paths.length,
  };
}

export interface ScanConfigImportResult {
  path: string;
  paths: number;
  entry: ScanConfigEntry;
}

async function readFileAtPath(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<File> {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) throw new Error('Leerer Pfad');
  const fileName = parts[parts.length - 1];
  if (!fileName) throw new Error('Kein Dateiname im Pfad');
  let dir: FileSystemDirectoryHandle = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const segment = parts[i];
    if (!segment) throw new Error('Leeres Pfad-Segment');
    dir = await dir.getDirectoryHandle(segment);
  }
  const fh = await dir.getFileHandle(fileName);
  return await fh.getFile();
}

export async function importScanConfigFromShare(
  idb: IDBStore,
  datenShare: FileSystemDirectoryHandle,
): Promise<ScanConfigImportResult> {
  const file = await readFileAtPath(datenShare, SCAN_CONFIG_SHARE_PATH);
  const text = await file.text();
  const parsed = JSON.parse(text) as ShareFileV1;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.selected_paths)) {
    throw new Error('Datei-Format unbekannt — version != 1 oder selected_paths fehlt.');
  }
  const entry = await saveScanConfig(idb, parsed.selected_paths);
  return {
    path: SCAN_CONFIG_SHARE_PATH,
    paths: parsed.selected_paths.length,
    entry,
  };
}

/**
 * Spiegelung des IDB-Scan-Manifests als JSONL auf den Daten-Share.
 *
 * Nutzt atomicWrite (Pflicht laut CLAUDE.md Pitfall #10) -- direkter
 * FileSystemWritableFileStream koennte bei Crash mitten im Schreiben
 * eine korrupte Datei hinterlassen.
 *
 * Wird vom Caller (Dev-Panel) explizit ausgeloest, nicht automatisch nach
 * jedem Bulk-Scan: bei 100k Eintraegen sind das ~200-300 MB Schreiben, das
 * soll der User bewusst triggern wenn er die Daten extern auswerten will.
 */
import type { IDBStore } from '../../core/services/storage/idb-store';
import { atomicWrite } from '../../core/services/infrastructure/atomic-write';
import { SCAN_MANIFEST_PATH } from '../../core/services/infrastructure/types';
import { listManifestEntries } from './manifest-store';

export interface ManifestMirrorResult {
  entries: number;
  bytes: number;
  path: string;
}

export async function mirrorManifestToShare(
  idb: IDBStore,
  datenShare: FileSystemDirectoryHandle,
): Promise<ManifestMirrorResult> {
  const entries = await listManifestEntries(idb);
  const jsonl = entries.length === 0
    ? ''
    : entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  await atomicWrite(datenShare, SCAN_MANIFEST_PATH, jsonl);
  return {
    entries: entries.length,
    bytes: jsonl.length,
    path: SCAN_MANIFEST_PATH,
  };
}

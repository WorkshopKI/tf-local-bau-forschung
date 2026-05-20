import type { IDBStore } from '../storage/idb-store';
import { atomicWrite } from '../infrastructure/atomic-write';
import {
  listAntraegeByProgramm,
  listAntragHistorieByProgramm,
  listVerbundsByProgramm,
  listVerbundHistorieByProgramm,
  listAkronymIndexByProgramm,
  listRowHashesBySchemas,
  listSchemasByProgramm,
  listUnterprogrammeByProgramm,
  getProgramm,
} from './idb-csv';

const SNAPSHOT_FILES = {
  antraege: 'antraege.jsonl',
  antrag_historie: 'antrag_historie.jsonl',
  verbuende: 'verbuende.jsonl',
  verbund_historie: 'verbund_historie.jsonl',
  akronym_index: 'akronym_index.jsonl',
  csv_row_hashes: 'csv_row_hashes.jsonl',
  programme: 'programme.jsonl',
  unterprogramme: 'unterprogramme.jsonl',
  csv_schemas: 'csv_schemas.jsonl',
} as const;

export type SnapshotStoreName = keyof typeof SNAPSHOT_FILES;

export interface ProgrammSnapshotManifest {
  version: 1;
  snapshotVersion: string;
  programmId: string;
  createdAt: string;
  createdBy: string;
  stores: Record<SnapshotStoreName, { count: number; hash: string }>;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return 'sha256-' + Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function toJsonl<T>(items: readonly T[], sortKey: (item: T) => string): string {
  const sorted = [...items].sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return sorted.map(it => JSON.stringify(it)).join('\n') + (sorted.length > 0 ? '\n' : '');
}

/**
 * Schreibt einen vollstaendigen Snapshot des Programms ins Daten-Share.
 * Manifest wird als letztes geschrieben (atomarer Marker).
 *
 * Pfad: <smbHandle>/programm/antraege/snapshot/<programmId>/{manifest.json, *.jsonl}
 */
export async function writeProgrammSnapshot(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  createdBy: string,
): Promise<{ snapshotVersion: string; manifest: ProgrammSnapshotManifest }> {
  const programm = await smbHandle.getDirectoryHandle('programm', { create: true });
  const antraegeDir = await programm.getDirectoryHandle('antraege', { create: true });
  const snapshotDir = await antraegeDir.getDirectoryHandle('snapshot', { create: true });
  const programmDir = await snapshotDir.getDirectoryHandle(programmId, { create: true });

  const programmObj = await getProgramm(idb, programmId);
  if (!programmObj) throw new Error(`Programm ${programmId} nicht in IDB`);

  const antraege = await listAntraegeByProgramm(idb, programmId);
  const antragHistorie = await listAntragHistorieByProgramm(idb, programmId);
  const verbuende = await listVerbundsByProgramm(idb, programmId);
  const verbundHistorie = await listVerbundHistorieByProgramm(idb, programmId);
  const akronymIndex = await listAkronymIndexByProgramm(idb, programmId);
  const csvSchemas = await listSchemasByProgramm(idb, programmId);
  const csvRowHashes = await listRowHashesBySchemas(idb, csvSchemas.map(s => s.id));
  const unterprogramme = await listUnterprogrammeByProgramm(idb, programmId);

  const data: Record<SnapshotStoreName, { jsonl: string; count: number }> = {
    antraege:         { jsonl: toJsonl(antraege,        a => String(a.aktenzeichen)), count: antraege.length },
    antrag_historie:  { jsonl: toJsonl(antragHistorie,  h => h.id),                   count: antragHistorie.length },
    verbuende:        { jsonl: toJsonl(verbuende,       v => v.verbund_id),           count: verbuende.length },
    verbund_historie: { jsonl: toJsonl(verbundHistorie, h => h.id),                   count: verbundHistorie.length },
    akronym_index:    { jsonl: toJsonl(akronymIndex,    e => `${e.programm_id}:${e.akronym}`), count: akronymIndex.length },
    csv_row_hashes:   { jsonl: toJsonl(csvRowHashes,    h => `${h.csv_schema_id}:${h.join_value}`), count: csvRowHashes.length },
    programme:        { jsonl: toJsonl([programmObj],   p => p.id),                   count: 1 },
    unterprogramme:   { jsonl: toJsonl(unterprogramme,  u => u.id),                   count: unterprogramme.length },
    csv_schemas:      { jsonl: toJsonl(csvSchemas,      s => s.id),                   count: csvSchemas.length },
  };

  const stores: ProgrammSnapshotManifest['stores'] = {} as ProgrammSnapshotManifest['stores'];
  for (const key of Object.keys(SNAPSHOT_FILES) as SnapshotStoreName[]) {
    stores[key] = { count: data[key].count, hash: await sha256Hex(data[key].jsonl) };
  }

  const written: SnapshotStoreName[] = [];
  try {
    for (const key of Object.keys(SNAPSHOT_FILES) as SnapshotStoreName[]) {
      await atomicWrite(programmDir, SNAPSHOT_FILES[key], data[key].jsonl, { skipBackup: true });
      written.push(key);
    }
  } catch (writeErr) {
    // Best-effort cleanup: bereits geschriebene JSONL-Files entfernen, damit kein
    // halb-konsistenter Snapshot stehen bleibt. Fehler beim Cleanup werden
    // verschluckt — der eigentliche Write-Error wird re-thrown.
    for (const key of written) {
      await programmDir.removeEntry(SNAPSHOT_FILES[key]).catch(() => undefined);
    }
    console.warn(`[snapshot] partial-write cleanup: ${written.length} files removed, original error:`, writeErr);
    throw writeErr;
  }

  const snapshotVersion = new Date().toISOString();
  const manifest: ProgrammSnapshotManifest = {
    version: 1,
    snapshotVersion,
    programmId,
    createdAt: snapshotVersion,
    createdBy,
    stores,
  };
  await atomicWrite(programmDir, 'manifest.json', JSON.stringify(manifest, null, 2), { skipBackup: true });

  return { snapshotVersion, manifest };
}

import type { IDBStore } from '../storage/idb-store';
import { atomicWrite, atomicWriteStream } from '../infrastructure/atomic-write';
import {
  forEachAntragByProgramm,
  listAntragHistorieByProgramm,
  listVerbundsByProgramm,
  listVerbundHistorieByProgramm,
  listAkronymIndexByProgramm,
  listRowHashesBySchemas,
  listSchemasByProgramm,
  listUnterprogrammeByProgramm,
  getProgramm,
} from './idb-csv';
import { SYNC_VERSION_KEY, SYNC_STORE_HASH_KEY } from './snapshot-keys';

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

/** Ein einzelnes Delta (v2): geänderte/neue Records + entfernte Keys je Store. */
export interface SnapshotDeltaStoreEntry {
  /** JSONL-Datei mit den geänderten/neuen Records (gleiches Record-Shape wie Basis). */
  changedFile: string;
  /** Entfernte Keys inline (kleine Mengen). Größere → `removedFile`. */
  removedKeys?: string[];
  removedFile?: string;
  /** SHA-256 der changedFile-Bytes (Integritäts-/Idempotenz-Check). */
  hash: string;
  count: number;
}

export interface SnapshotDeltaEntry {
  seq: number;
  createdAt: string;
  createdBy: string;
  stores: Partial<Record<SnapshotStoreName, SnapshotDeltaStoreEntry>>;
}

/** v2-Delta-Block: Basis + geordnete Deltas. Alte (v1-)Leser ignorieren ihn und
 *  lesen die vollen `stores`-Dateien (Basis) → valide, ggf. leicht veraltet. */
export interface SnapshotDeltaBlock {
  /** Generation der Basis-Dateien; ändert sich nur bei Compaction/Rebase. */
  baseVersion: string;
  /** Welche Stores per Delta gepflegt werden (aktuell nur `antraege`). */
  deltaStores: SnapshotStoreName[];
  /** Geordnete, lückenlose Deltas (seq ab 1), die NACH der Basis gelten. */
  deltas: SnapshotDeltaEntry[];
  /** Summe der Delta-Bytes seit der Basis (Compaction-Heuristik). */
  cumulativeBytes: number;
}

export interface ProgrammSnapshotManifest {
  version: 1 | 2;
  snapshotVersion: string;
  programmId: string;
  createdAt: string;
  createdBy: string;
  /** Voll-Stand jedes Stores. Für deltaisierte Stores = **Basis**-Datei (Hash =
   *  Basis-Hash) → alte Leser bekommen stets eine valide Basis. */
  stores: Record<SnapshotStoreName, { count: number; hash: string }>;
  /** v2: Delta-Block. Fehlt bei v1-Snapshots (voller Schreibpfad). */
  delta?: SnapshotDeltaBlock;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return 'sha256-' + Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SHA-256 über bereits UTF-8-kodierte Chunks (gestreamtes JSONL) — ohne den
 * vollständigen String im RAM neu aufzubauen. Liefert exakt denselben Hash wie
 * `sha256Hex(chunks.map(decode).join(''))`. Leere Chunk-Liste → Hash des
 * leeren Inputs (identisch zu `sha256Hex('')`).
 */
async function sha256HexFromChunks(chunks: Uint8Array[]): Promise<string> {
  let total = 0;
  for (const c of chunks) total += c.length;
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  const digest = await crypto.subtle.digest('SHA-256', all);
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

  // Alle Stores AUSSER antraege laden + serialisieren — diese sind klein.
  // antraege (13k × ~36 KB volle Records = ~470 MB als Array) wird getrennt per
  // Cursor gestreamt, damit nie alle Records gleichzeitig im RAM liegen (OOM-Fix).
  const antragHistorie = await listAntragHistorieByProgramm(idb, programmId);
  const verbuende = await listVerbundsByProgramm(idb, programmId);
  const verbundHistorie = await listVerbundHistorieByProgramm(idb, programmId);
  const akronymIndex = await listAkronymIndexByProgramm(idb, programmId);
  const csvSchemas = await listSchemasByProgramm(idb, programmId);
  const csvRowHashes = await listRowHashesBySchemas(idb, csvSchemas.map(s => s.id));
  const unterprogramme = await listUnterprogrammeByProgramm(idb, programmId);

  const smallData: Partial<Record<SnapshotStoreName, { jsonl: string; count: number }>> = {
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
  const written: SnapshotStoreName[] = [];
  try {
    // 1) antraege per Cursor gestreamt: jeder Record wird sofort serialisiert
    //    (volles Objekt danach GC-frei). Output byte-identisch zu toJsonl —
    //    Cursor liefert nach aktenzeichen aufsteigend = derselbe Sort.
    {
      let lines: string[] = [];
      await forEachAntragByProgramm(idb, programmId, a => { lines.push(JSON.stringify(a)); });
      const count = lines.length;
      const enc = new TextEncoder();
      const byteChunks: Uint8Array[] = [];
      await atomicWriteStream(programmDir, SNAPSHOT_FILES.antraege, async sink => {
        const BATCH = 2000;
        for (let i = 0; i < lines.length; i += BATCH) {
          const chunk = lines.slice(i, i + BATCH).join('\n') + '\n';
          await sink.write(chunk);
          byteChunks.push(enc.encode(chunk));
        }
      }, { skipBackup: true });
      written.push('antraege');
      lines = []; // vor dem Hash-Concat freigeben
      stores.antraege = { count, hash: await sha256HexFromChunks(byteChunks) };
    }

    // 2) Restliche (kleine) Stores klassisch: Hash + atomicWrite.
    for (const key of Object.keys(SNAPSHOT_FILES) as SnapshotStoreName[]) {
      if (key === 'antraege') continue;
      const d = smallData[key]!;
      stores[key] = { count: d.count, hash: await sha256Hex(d.jsonl) };
      await atomicWrite(programmDir, SNAPSHOT_FILES[key], d.jsonl, { skipBackup: true });
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

  // Lokales Sync-Tracking sofort auf den veroeffentlichten Stand setzen: der
  // schreibende Client (Kurator) hat exakt diese Daten bereits lokal. Ohne das
  // meldet useSnapshotWatcher den EIGENEN Snapshot als „neuer Datenbestand"
  // (Bug: Banner bei jedem Neustart, weil der auf 1x/Tag gedrosselte Startup-
  // Sync das Tracking am selben Tag nicht mehr nachzieht). Store-Hashes gleich
  // mitsetzen, damit ein spaeterer (force-)Sync die Stores nicht unnoetig neu
  // laedt. snapshotVersion + stores stammen aus genau diesen lokalen Daten.
  await idb.set(SYNC_VERSION_KEY(programmId), snapshotVersion);
  for (const key of Object.keys(SNAPSHOT_FILES) as SnapshotStoreName[]) {
    await idb.set(SYNC_STORE_HASH_KEY(programmId, key), stores[key].hash);
  }

  return { snapshotVersion, manifest };
}

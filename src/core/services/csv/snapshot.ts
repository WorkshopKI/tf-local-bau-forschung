import type { IDBStore } from '../storage/idb-store';
import { atomicWrite, atomicWriteStream, readText } from '../infrastructure/atomic-write';
import {
  forEachAntragByProgramm,
  getAntraegeByKeys,
  listAntragHistorieByProgramm,
  listVerbundsByProgramm,
  listVerbundHistorieByProgramm,
  listAkronymIndexByProgramm,
  listRowHashesBySchemas,
  listSchemasByProgramm,
  listUnterprogrammeByProgramm,
  listAntraegeListViewByProgramm,
  getVerbund,
  getProgramm,
} from './idb-csv';
import { murmurhash3 } from './hash';
import { sha256Praefixiert, sha256PraefixiertAusChunks } from './sha256';
import { healMissingVerbuende } from './verbuende-rebuild';
import { isFixtureSchemaId } from '../seed/fixture-ids';
import {
  SYNC_VERSION_KEY,
  SYNC_STORE_HASH_KEY,
  SYNC_DELTA_SEQ_KEY,
  SYNC_BASE_VERSION_KEY,
} from './snapshot-keys';
import { SNAPSHOT_RECORD_HASHES_KEY } from './incremental-antraege';

/** Delta-Compaction: nach so vielen Deltas (oder wenn die Delta-Bytes die Basis
 *  übersteigen) wird wieder eine volle Basis geschrieben + Deltas gelöscht. */
const MAX_DELTAS = 14;
/** Removals oberhalb dieser Größe → eigene Datei statt inline im Manifest. */
const REMOVED_INLINE_MAX = 500;
/** Absolute Untergrenze für den „Change-Set zu groß → Voll-Write"-Fallback:
 *  erst ab so vielen geänderten Records lohnt der gestreamte Voll-Write ggü.
 *  dem Delta (kleine Programme bleiben immer Delta). */
const DELTA_FULL_FALLBACK_MIN = 2000;

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

/**
 * Publish-Guard: Struktur-Stores, deren LEERE Version NICHT über einen bestehenden
 * nicht-leeren Snapshot geschrieben werden darf. Ein Fixture-/fehl-seedender Rechner
 * (dessen Schemas alle vom Fixture-Filter in `loadSmallStoreData` verworfen werden →
 * 0 `csv_schemas`) würde sonst die echten Schemas des Shares nullen; jeder Consumer
 * verlöre danach seine CSV-Quellen (Vorfall 2026-06). Spiegelbild des `NEVER_EMPTY_
 * STORES`-Guards in snapshot-sync (Consumer-Seite).
 */
const PUBLISH_PRESERVE_WHEN_EMPTY: ReadonlySet<SnapshotStoreName> = new Set(['csv_schemas', 'programme']);

/**
 * Struktur-Stores, für die eine versionierte Backup-Historie auf dem Share gehalten
 * wird: klein (KB–wenige MB) UND deren Verlust NICHT aus `antraege` rekonstruierbar
 * ist. Bewusst NICHT dabei: `antraege` (421 MB — pro Publish sichern zu teuer), die
 * append-wachsenden Historien (`antrag_historie`/`verbund_historie`) und der
 * rekonstruierbare `csv_row_hashes`-Cache. Defense-in-depth zum Empty-Guard — falls
 * eine Datei doch mal defekt/leer wird (Teil-Write, Fremd-Löschung), liegt der
 * letzte gute Stand griffbereit.
 */
const BACKUP_STORES: ReadonlySet<SnapshotStoreName> = new Set([
  'csv_schemas', 'programme', 'unterprogramme', 'verbuende', 'akronym_index',
]);

/** Wie viele DISTINKTE letzte Fassungen je Store aufbewahrt werden. */
export const SMALL_STORE_BACKUP_KEEP = 5;

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

// Die beiden Hash-Helfer standen bis v2.392 hier als private Kopien. Sie leben
// jetzt in `sha256.ts` — dasselbe Verfahren, dasselbe `sha256-`-Präfix, nur
// nicht mehr dreimal geschrieben.
const sha256Hex = sha256Praefixiert;
const sha256HexFromChunks = sha256PraefixiertAusChunks;

function toJsonl<T>(items: readonly T[], sortKey: (item: T) => string): string {
  const sorted = [...items].sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return sorted.map(it => JSON.stringify(it)).join('\n') + (sorted.length > 0 ? '\n' : '');
}

async function navigateSnapshotDir(
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  const programm = await smbHandle.getDirectoryHandle('programm', { create });
  const antraegeDir = await programm.getDirectoryHandle('antraege', { create });
  const snapshotDir = await antraegeDir.getDirectoryHandle('snapshot', { create });
  return snapshotDir.getDirectoryHandle(programmId, { create });
}

type SmallStoreData = Partial<Record<SnapshotStoreName, { jsonl: string; count: number }>>;

/** Distinkte, nicht-leere `verbund_id` über die List-View eines Programms —
 *  die Quelle-of-Truth-Sicht (Anträge), gegen die der abgeleitete verbuende-
 *  Cache beim Serialisieren abgeglichen wird (Invariant-Guard). */
async function distinctVerbundIdsFromAntraege(idb: IDBStore, programmId: string): Promise<Set<string>> {
  const items = await listAntraegeListViewByProgramm(idb, programmId);
  const out = new Set<string>();
  for (const it of items) {
    if (typeof it.verbund_id === 'string' && it.verbund_id.length > 0) out.add(it.verbund_id);
  }
  return out;
}

/** Kern der Snapshot-Invariante: welche von den Anträgen referenzierten
 *  `verbund_id` fehlen im serialisierten verbuende-Cache? Leeres Array =
 *  Invariante erfüllt (jeder Verbund der Anträge ist serialisiert). Rein +
 *  exportiert für den Regressionstest. */
export function findMissingVerbuende(
  distinctFromAntraege: Iterable<string>,
  serialized: Iterable<string>,
): string[] {
  const have = new Set(serialized);
  return [...new Set(distinctFromAntraege)].filter(v => !have.has(v)).sort();
}

/** Serialisiert alle Stores AUSSER antraege (klein) zu JSONL + Counts. */
async function loadSmallStoreData(idb: IDBStore, programmId: string): Promise<SmallStoreData> {
  const programmObj = await getProgramm(idb, programmId);
  if (!programmObj) throw new Error(`Programm ${programmId} nicht in IDB`);
  const antragHistorie = await listAntragHistorieByProgramm(idb, programmId);

  // Fix an der Quelle: der verbuende-Store ist ein abgeleiteter Cache. Vor dem
  // Serialisieren gegen die Quelle (Anträge) heilen, damit die veröffentlichte
  // verbuende.jsonl vollständig ist — egal ob der Writer-Cache lückenhaft
  // (fehlende Records) oder mis-filed (falsche programm_id) ist. `s.put` in
  // healMissingVerbuende überschreibt mis-filed Records per verbund_id-Key mit
  // korrekter programm_id, sodass der Index-Query unten sie findet. Billig,
  // wenn der Cache vollständig ist (Index-Read + früher Abbruch). EIN
  // Choke-Point für Voll- UND Delta-Write (beide via loadSmallStoreData).
  await healMissingVerbuende(idb, programmId);
  const verbuende = await listVerbundsByProgramm(idb, programmId);

  // Invariant-Guard: nach dem Heal MUSS jeder von den Anträgen referenzierte
  // Verbund serialisiert sein. Bleibt dennoch eine Lücke, ist sie nicht mehr
  // „nur" ein stiller Cache-Drift, sondern eine tiefere Divergenz (z.B.
  // List-View-Projektion ≠ Heal-Quelle) → im Dev lautstark fehlschlagen
  // (statt eine lückenhafte verbuende.jsonl zu veröffentlichen), zur Laufzeit
  // laut loggen (Write nicht blockieren, der Heal hat den Großteil gedeckt).
  const distinctVids = await distinctVerbundIdsFromAntraege(idb, programmId);
  const missing = findMissingVerbuende(distinctVids, verbuende.map(v => v.verbund_id));
  if (missing.length > 0) {
    const classified = await Promise.all(missing.slice(0, 10).map(async vid => {
      const rec = await getVerbund(idb, vid);
      if (!rec) return `${vid}=absent`;
      return rec.programm_id === programmId
        ? `${vid}=present-but-index-miss(programm_id="${rec.programm_id}")`
        : `${vid}=mis-filed(programm_id="${rec.programm_id}")`;
    }));
    const msg =
      `[snapshot-verbuende] Invariante verletzt — Programm ${programmId}: ` +
      `${verbuende.length} Verbünde serialisiert, aber ${distinctVids.size} distinkte ` +
      `verbund_id in Anträgen; ${missing.length} fehlen NACH Heal. Beispiele: ${classified.join(', ')}`;
    if (import.meta.env.DEV) throw new Error(msg);
    console.error(msg);
  }

  const verbundHistorie = await listVerbundHistorieByProgramm(idb, programmId);
  const akronymIndex = await listAkronymIndexByProgramm(idb, programmId);
  // Demo-/Fixture-Quellen (fixture-real-*) NIE in den publizierten Snapshot
  // schreiben: ein versehentlich gegen den echten Share geöffneter Dev-Build
  // (der die Fixtures auto-seedet) würde sonst die echten Quellen überschreiben
  // und alle pl/kurator-Rechner zögen sich die Demo-Daten (Vorfall 2026-06).
  // Defense-in-depth am Publish-Boundary — der lokale Store behält die Fixtures.
  const csvSchemas = (await listSchemasByProgramm(idb, programmId)).filter(s => !isFixtureSchemaId(s.id));
  const csvRowHashes = await listRowHashesBySchemas(idb, csvSchemas.map(s => s.id));
  const unterprogramme = await listUnterprogrammeByProgramm(idb, programmId);
  return {
    antrag_historie:  { jsonl: toJsonl(antragHistorie,  h => h.id),                   count: antragHistorie.length },
    verbuende:        { jsonl: toJsonl(verbuende,       v => v.verbund_id),           count: verbuende.length },
    verbund_historie: { jsonl: toJsonl(verbundHistorie, h => h.id),                   count: verbundHistorie.length },
    akronym_index:    { jsonl: toJsonl(akronymIndex,    e => `${e.programm_id}:${e.akronym}`), count: akronymIndex.length },
    csv_row_hashes:   { jsonl: toJsonl(csvRowHashes,    h => `${h.csv_schema_id}:${h.join_value}`), count: csvRowHashes.length },
    programme:        { jsonl: toJsonl([programmObj],   p => p.id),                   count: 1 },
    unterprogramme:   { jsonl: toJsonl(unterprogramme,  u => u.id),                   count: unterprogramme.length },
    csv_schemas:      { jsonl: toJsonl(csvSchemas,      s => s.id),                   count: csvSchemas.length },
  };
}

/** Schreibt die kleinen Stores (alle außer antraege) voll + liefert Manifest-
 *  Einträge. Von Voll-Write UND Delta-Write genutzt (im Delta-Fall bleibt die
 *  antraege-Basis unangetastet, nur diese kleinen Stores werden neu geschrieben). */
/**
 * Versionierte Best-Effort-Sicherung eines kleinen Struktur-Stores unter
 * `<snapshot>/backups/<store>.<version>.jsonl`. Nur NICHT-leerer Inhalt landet im
 * Backup (ein defekter/leerer Write wird nie die jüngste Sicherung) und nur, wenn er
 * sich von der jüngsten Sicherung unterscheidet (keine Duplikate bei unveränderten
 * Stores — csv_schemas ändert sich selten). Hält die letzten
 * `SMALL_STORE_BACKUP_KEEP` DISTINKTEN Fassungen. Fehler blockieren den Publish nie
 * (der eigentliche Snapshot steht schon).
 */
async function backupSmallStore(
  programmDir: FileSystemDirectoryHandle,
  storeFile: string,
  content: string,
  version: string,
): Promise<void> {
  try {
    const backupsDir = await programmDir.getDirectoryHandle('backups', { create: true });
    const prefix = `${storeFile.replace(/\.jsonl$/, '')}.`;
    const existing: string[] = [];
    const dir = backupsDir as unknown as { keys?: () => AsyncIterable<string> };
    if (typeof dir.keys === 'function') {
      for await (const name of dir.keys()) {
        if (name.startsWith(prefix) && name.endsWith('.jsonl')) existing.push(name);
      }
    }
    existing.sort(); // FS-sichere ISO-Version → lexikografisch = chronologisch
    // Unverändert gegenüber der jüngsten Sicherung? → nichts tun (keine Duplikate).
    const newest = existing.length > 0 ? existing[existing.length - 1]! : null;
    if (newest && (await readText(backupsDir, newest)) === content) return;

    const name = `${prefix}${version}.jsonl`;
    await atomicWrite(backupsDir, name, content, { skipBackup: true });
    // Prune: nur die neuesten SMALL_STORE_BACKUP_KEEP behalten.
    const after = [...new Set([...existing, name])].sort();
    for (const old of after.slice(0, Math.max(0, after.length - SMALL_STORE_BACKUP_KEEP))) {
      await backupsDir.removeEntry(old).catch(() => undefined);
    }
  } catch (e) {
    console.warn(`[snapshot] Backup ${storeFile} fehlgeschlagen (best-effort)`, e);
  }
}

async function writeSmallStores(
  programmDir: FileSystemDirectoryHandle,
  smallData: SmallStoreData,
  existingStores?: Partial<Record<SnapshotStoreName, { count: number; hash: string }>>,
): Promise<{ stores: Partial<Record<SnapshotStoreName, { count: number; hash: string }>>; written: SnapshotStoreName[] }> {
  const stores: Partial<Record<SnapshotStoreName, { count: number; hash: string }>> = {};
  const written: SnapshotStoreName[] = [];
  // Eine Version je Publish-Lauf (alle Stores derselben Sicherung teilen sie).
  const backupVersion = new Date().toISOString().replace(/[:.]/g, '-');
  for (const key of Object.keys(SNAPSHOT_FILES) as SnapshotStoreName[]) {
    if (key === 'antraege') continue;
    const d = smallData[key]!;
    // Publish-Guard: ein leeres csv_schemas NICHT über einen bestehenden nicht-
    // leeren Snapshot schreiben — sonst nullt ein Fixture-/fehl-seedender Rechner
    // die echten Schemas des Shares. Bestehende Datei + Manifest-Eintrag behalten.
    if (d.count === 0 && PUBLISH_PRESERVE_WHEN_EMPTY.has(key)) {
      const existing = existingStores?.[key];
      if (existing && existing.count > 0) {
        console.warn(
          `[snapshot] ${key}: lokal 0 Records, Share hat ${existing.count} — bestehende Datei NICHT überschrieben (Publish-Guard gegen Fixture-Kontamination).`,
        );
        stores[key] = existing;
        continue;
      }
    }
    stores[key] = { count: d.count, hash: await sha256Hex(d.jsonl) };
    await atomicWrite(programmDir, SNAPSHOT_FILES[key], d.jsonl, { skipBackup: true });
    written.push(key);
    // Versionierte Backup-Historie der kleinen Struktur-Stores (nur nicht-leer).
    if (d.count > 0 && BACKUP_STORES.has(key)) {
      await backupSmallStore(programmDir, SNAPSHOT_FILES[key], d.jsonl, backupVersion);
    }
  }
  return { stores, written };
}

/** Bestehendes Manifest (best-effort) — für den Publish-Guard (Bestands-Counts). */
async function readExistingManifest(
  programmDir: FileSystemDirectoryHandle,
): Promise<ProgrammSnapshotManifest | null> {
  try {
    const t = await readText(programmDir, 'manifest.json');
    return t ? (JSON.parse(t) as ProgrammSnapshotManifest) : null;
  } catch {
    return null;
  }
}

export interface WriteSnapshotOptions {
  /** v2-Basis schreiben: Manifest bekommt einen leeren `delta`-Block
   *  (`baseVersion = snapshotVersion`, `deltas: []`) und die lokalen
   *  Delta-Cursor (Basis-Version + seq 0 + Record-Hash-Map) werden gesetzt.
   *  Vom Delta-Schreiber für Bootstrap/Compaction genutzt. */
  emitDeltaBase?: boolean;
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
  opts: WriteSnapshotOptions = {},
): Promise<{ snapshotVersion: string; manifest: ProgrammSnapshotManifest }> {
  const programmDir = await navigateSnapshotDir(smbHandle, programmId, true);
  const smallData = await loadSmallStoreData(idb, programmId);
  // Publish-Guard: bestehende Store-Counts kennen, damit ein leeres csv_schemas den
  // nicht-leeren Bestand auf dem Share nicht überschreibt (Fixture-Kontamination).
  const existingManifest = await readExistingManifest(programmDir);

  const stores: ProgrammSnapshotManifest['stores'] = {} as ProgrammSnapshotManifest['stores'];
  const written: SnapshotStoreName[] = [];
  // Record-Hash-Map (aktenzeichen→murmur(line)) nur bauen, wenn als Delta-Basis
  // gebraucht — sonst spart der Voll-Write den 14k-Murmur-Durchlauf.
  const recordHashes: Record<string, string> = {};
  try {
    // 1) antraege per Cursor gestreamt: jeder Record wird sofort serialisiert
    //    (volles Objekt danach GC-frei). Output byte-identisch zu toJsonl —
    //    Cursor liefert nach aktenzeichen aufsteigend = derselbe Sort.
    {
      let lines: string[] = [];
      await forEachAntragByProgramm(idb, programmId, a => {
        const line = JSON.stringify(a);
        lines.push(line);
        if (opts.emitDeltaBase) recordHashes[String(a.aktenzeichen)] = murmurhash3(line);
      });
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
    const small = await writeSmallStores(programmDir, smallData, existingManifest?.stores);
    Object.assign(stores, small.stores);
    written.push(...small.written);
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
    version: opts.emitDeltaBase ? 2 : 1,
    snapshotVersion,
    programmId,
    createdAt: snapshotVersion,
    createdBy,
    stores,
    ...(opts.emitDeltaBase
      ? { delta: { baseVersion: snapshotVersion, deltaStores: ['antraege'], deltas: [], cumulativeBytes: 0 } }
      : {}),
  };
  // Bei Compaction können alte Delta-Dateien zurückbleiben — beste-effort weg.
  if (opts.emitDeltaBase) await removeStaleDeltaFiles(programmDir);
  await atomicWrite(programmDir, 'manifest.json', JSON.stringify(manifest, null, 2), { skipBackup: true });

  // Lokales Sync-Tracking sofort auf den veroeffentlichten Stand setzen (siehe
  // useSnapshotWatcher-Hinweis: sonst meldet der Schreiber seinen eigenen
  // Snapshot als „neu"). Store-Hashes + (bei Delta-Basis) Cursor mitsetzen.
  await idb.set(SYNC_VERSION_KEY(programmId), snapshotVersion);
  for (const key of Object.keys(SNAPSHOT_FILES) as SnapshotStoreName[]) {
    await idb.set(SYNC_STORE_HASH_KEY(programmId, key), stores[key].hash);
  }
  if (opts.emitDeltaBase) {
    await idb.set(SYNC_BASE_VERSION_KEY(programmId), snapshotVersion);
    await idb.set(SYNC_DELTA_SEQ_KEY(programmId), 0);
    await idb.set(SNAPSHOT_RECORD_HASHES_KEY(programmId), recordHashes);
  }

  return { snapshotVersion, manifest };
}

/** Entfernt zurückgebliebene `antraege.delta.*`-Dateien (Compaction/Bootstrap). */
async function removeStaleDeltaFiles(programmDir: FileSystemDirectoryHandle): Promise<void> {
  const dir = programmDir as unknown as { keys?: () => AsyncIterable<string> };
  if (typeof dir.keys !== 'function') return; // Mock/alte Umgebung ohne keys()
  try {
    const names: string[] = [];
    for await (const name of dir.keys()) {
      if (name.startsWith('antraege.delta.')) names.push(name);
    }
    for (const name of names) await programmDir.removeEntry(name).catch(() => undefined);
  } catch { /* best-effort */ }
}

/**
 * Schreibt ein **Delta** (nur geänderte/entfernte antraege-Records) statt des
 * vollen Snapshots — der Writer-Win (≈25 s → Sekunden) bei kleinen Tages-Deltas.
 * Die kleinen Stores (verbuende, akronym_index, csv_schemas, …) werden weiter
 * voll geschrieben (klein); die antraege-Basis bleibt unangetastet, ein
 * `antraege.delta.<seq>.jsonl` kommt hinzu.
 *
 * Fällt auf einen Voll-Write (mit v2-Basis) zurück, wenn kein kompatibles
 * v2-Manifest existiert, eine Compaction fällig ist (≥ MAX_DELTAS Deltas) ODER
 * das Change-Set groß ist (> 50 % der Basis-Records → Delta ≈ Voll-Datei, und
 * der gestreamte Voll-Write ist dann schneller als 14k Einzel-Gets). Hält
 * denselben Build-Lock wie der Aufrufer.
 */
export async function writeProgrammSnapshotDelta(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  createdBy: string,
  change: { touchedAz: readonly string[]; removedAz: readonly string[] },
): Promise<{ mode: 'delta' | 'full'; snapshotVersion: string }> {
  const programmDir = await navigateSnapshotDir(smbHandle, programmId, true);

  let existing: ProgrammSnapshotManifest | null = null;
  try {
    const t = await readText(programmDir, 'manifest.json');
    if (t) existing = JSON.parse(t) as ProgrammSnapshotManifest;
  } catch { existing = null; }

  const baseStoreEntry = existing?.stores?.antraege;
  const compatV2 = existing?.version === 2 && !!existing.delta
    && existing.delta.deltaStores.includes('antraege') && !!baseStoreEntry;
  // Bei einem GROSSEN Change-Set ist ein Delta ≈ die volle Datei — und
  // `getAntraegeByKeys` (Einzel-Gets) wäre langsamer als der gestreamte
  // Voll-Write. Dann lieber Compaction (Voll-Basis + Deltas weg). Schwelle:
  // > 50 % der Basis UND absolut > DELTA_FULL_FALLBACK_MIN (kleine Datensätze
  // bleiben immer Delta — dort ist auch ein „großes" Delta billig).
  const baseCount = baseStoreEntry?.count ?? 0;
  const tooManyChanges = change.touchedAz.length > Math.max(DELTA_FULL_FALLBACK_MIN, baseCount * 0.5);
  const needCompaction = !compatV2
    || (existing!.delta!.deltas.length >= MAX_DELTAS)
    || tooManyChanges;

  if (needCompaction) {
    const r = await writeProgrammSnapshot(idb, smbHandle, programmId, createdBy, { emitDeltaBase: true });
    return { mode: 'full', snapshotVersion: r.snapshotVersion };
  }

  const delta = existing!.delta!;
  const nextSeq = (delta.deltas.length ? delta.deltas[delta.deltas.length - 1]!.seq : 0) + 1;

  // Removals = entfernt UND nicht (von einer anderen Quelle) wieder berührt.
  const touchedSet = new Set(change.touchedAz);
  const removedKeys = [...new Set(change.removedAz)].filter(k => !touchedSet.has(k));

  // Nur die geänderten Records keyed laden (kein 14k-Cursor) + stabil sortieren.
  const changedRecords = await getAntraegeByKeys(idb, [...touchedSet]);
  changedRecords.sort((a, b) => (a.aktenzeichen < b.aktenzeichen ? -1 : a.aktenzeichen > b.aktenzeichen ? 1 : 0));
  const changedLines = changedRecords.map(a => JSON.stringify(a));
  const changedJsonl = changedLines.join('\n') + (changedLines.length ? '\n' : '');
  const changedFile = `antraege.delta.${nextSeq}.jsonl`;

  // Kleine Stores voll neu schreiben (ändern sich beim Import: schemas/verbuende/…).
  const smallData = await loadSmallStoreData(idb, programmId);
  // Publish-Guard: bestehende Counts (aus `existing`) durchreichen → leeres
  // csv_schemas überschreibt keinen nicht-leeren Bestand.
  const { stores: smallStores } = await writeSmallStores(programmDir, smallData, existing?.stores);

  await atomicWrite(programmDir, changedFile, changedJsonl, { skipBackup: true });
  let removedKeysField: string[] | undefined = removedKeys;
  let removedFileField: string | undefined;
  if (removedKeys.length > REMOVED_INLINE_MAX) {
    removedFileField = `antraege.delta.${nextSeq}.removed.txt`;
    await atomicWrite(programmDir, removedFileField, removedKeys.join('\n') + '\n', { skipBackup: true });
    removedKeysField = undefined;
  }

  const snapshotVersion = new Date().toISOString();
  const entry: SnapshotDeltaEntry = {
    seq: nextSeq,
    createdAt: snapshotVersion,
    createdBy,
    stores: {
      antraege: {
        changedFile,
        removedKeys: removedKeysField,
        removedFile: removedFileField,
        hash: await sha256Hex(changedJsonl),
        count: changedRecords.length,
      },
    },
  };
  const manifest: ProgrammSnapshotManifest = {
    ...existing!,
    version: 2,
    snapshotVersion,
    createdAt: snapshotVersion,
    createdBy,
    // antraege-Basis bleibt; kleine Stores frisch.
    stores: { ...existing!.stores, ...smallStores },
    delta: {
      ...delta,
      deltas: [...delta.deltas, entry],
      cumulativeBytes: delta.cumulativeBytes + changedJsonl.length,
    },
  };
  await atomicWrite(programmDir, 'manifest.json', JSON.stringify(manifest, null, 2), { skipBackup: true });

  // Lokale Cursor + Hash-Map nachziehen, damit der Schreiber sein eigenes Delta
  // nicht re-sync't und der Watcher keinen Fehlalarm gibt.
  await idb.set(SYNC_VERSION_KEY(programmId), snapshotVersion);
  await idb.set(SYNC_BASE_VERSION_KEY(programmId), delta.baseVersion);
  for (const [key, v] of Object.entries(smallStores)) {
    await idb.set(SYNC_STORE_HASH_KEY(programmId, key as SnapshotStoreName), v.hash);
  }
  const hashes = (await idb.get<Record<string, string>>(SNAPSHOT_RECORD_HASHES_KEY(programmId))) ?? {};
  for (let i = 0; i < changedRecords.length; i++) hashes[changedRecords[i]!.aktenzeichen] = murmurhash3(changedLines[i]!);
  for (const k of removedKeys) delete hashes[k];
  await idb.set(SNAPSHOT_RECORD_HASHES_KEY(programmId), hashes);
  await idb.set(SYNC_DELTA_SEQ_KEY(programmId), nextSeq);

  return { mode: 'delta', snapshotVersion };
}

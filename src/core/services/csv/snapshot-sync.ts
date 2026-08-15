import type { IDBStore } from '../storage/idb-store';
import { CSV_STORES, type CsvStoreName } from '../storage/idb-store';
import { readText, readTextLage } from '../infrastructure/atomic-write';
import type { ProgrammSnapshotManifest, SnapshotStoreName, SnapshotDeltaBlock } from './snapshot';
import {
  SYNC_VERSION_KEY,
  SYNC_STORE_HASH_KEY,
  SYNC_LAST_CHECK_DAY_KEY,
  SYNC_DELTA_SEQ_KEY,
  SYNC_BASE_VERSION_KEY,
} from './snapshot-keys';
import { MAX_WRITES_PER_TX } from './constants';
import { murmurhash3 } from './hash';
import type { Antrag } from './types';
import { isDatenShareWritable } from '@/config/feature-flags';
import { rebuildAntraegeListView, isListViewProjectionCurrent } from './list-view-migration';
import { listSchemasByProgramm } from './idb-csv';
import { resolveStatusDatumGruppen } from './status-datum-gruppen';
import { ladeAktiveVersion } from '@/core/status/katalog-store';
import { loeseKategorieSpalten } from '@/core/status/kategorie-projektion';
import { loeseFreieFelderFuer } from '@/core/spalten/programm';
import {
  diffAntraegeLines,
  buildAntraegeHashes,
  applyAntraegeDiff,
  applyListViewDiff,
  SNAPSHOT_RECORD_HASHES_KEY,
  type AntraegeDiff,
} from './incremental-antraege';

export interface SyncProgress {
  phase: 'manifest' | 'store' | 'finalizing' | 'done';
  currentStore?: SnapshotStoreName;
  storesDone: number;
  storesTotal: number;
  /**
   * Monotone Gesamt-Fraktion 0..1 über ALLE Phasen (Manifest → Stores →
   * List-View-Rebuild), inkl. Chunk-Fortschritt innerhalb großer Stores. Damit
   * bewegt sich der Banner-Balken von Anfang an, statt erst nach dem großen
   * antraege-Store (~4 s) zu springen.
   */
  fraction: number;
}

// Fortschritts-Budget der drei Phasen (Summe = 1.0). Der antraege-Store + der
// abschließende List-View-Rebuild dominieren die Wall-Clock-Zeit.
const PROG_MANIFEST = 0.05;
const PROG_STORES = 0.65;
const PROG_REBUILD = 0.30;

/**
 * Per-Phasen-Wall-Clock einer Snapshot-Sync — beantwortet „wo geht die Zeit
 * drauf": SMB-Netzwerk-I/O (manifestRead + smbRead) vs. JSON-Parse (parse) vs.
 * IDB-Integration (idbWrite + listViewRebuild). Werte sind Summen über alle
 * Stores des Programms (ms). Wird vom Daten-Update-Orchestrator in die
 * `[data-update]`-Zeile aggregiert.
 */
export interface SnapshotTimings {
  manifestReadMs: number;
  smbReadMs: number;
  parseMs: number;
  idbWriteMs: number;
  listViewRebuildMs: number;
}

export interface SyncResult {
  synced: boolean;
  snapshotVersion?: string;
  createdAt?: string;
  /** Welche Stores wirklich neu geladen wurden (Hash-Mismatch). */
  reloadedStores?: SnapshotStoreName[];
  /**
   * true, wenn mindestens ein Store oder Delta NICHT integriert werden konnte
   * (fehlende/unlesbare Datei, kaputtes JSONL). Der lokale Stand ist dann
   * älter als das Manifest; die Snapshot-Version wird bewusst nicht
   * festgeschrieben, damit der nächste Lauf es erneut versucht.
   *
   * `synced` bleibt in dem Fall `true` — die Stores, die geladen wurden, sind
   * geladen, und der In-Memory-Store muss sie nachziehen.
   */
  incomplete?: boolean;
  /** Per-Phasen-Timing (nur gesetzt, sobald das Manifest gelesen wurde). */
  timings?: SnapshotTimings;
}

/** YYYY-MM-DD im lokalen Zeit-Sinne (User-orientiert). */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STORE_FILES: Record<SnapshotStoreName, string> = {
  antraege: 'antraege.jsonl',
  antrag_historie: 'antrag_historie.jsonl',
  verbuende: 'verbuende.jsonl',
  verbund_historie: 'verbund_historie.jsonl',
  akronym_index: 'akronym_index.jsonl',
  csv_row_hashes: 'csv_row_hashes.jsonl',
  programme: 'programme.jsonl',
  unterprogramme: 'unterprogramme.jsonl',
  csv_schemas: 'csv_schemas.jsonl',
};

const STORE_TARGETS: Record<SnapshotStoreName, CsvStoreName> = {
  antraege: CSV_STORES.ANTRAEGE,
  antrag_historie: CSV_STORES.ANTRAG_HISTORIE,
  verbuende: CSV_STORES.VERBUENDE,
  verbund_historie: CSV_STORES.VERBUND_HISTORIE,
  akronym_index: CSV_STORES.AKRONYM_INDEX,
  csv_row_hashes: CSV_STORES.CSV_ROW_HASHES,
  programme: CSV_STORES.PROGRAMME,
  unterprogramme: CSV_STORES.UNTERPROGRAMME,
  csv_schemas: CSV_STORES.CSV_SCHEMAS,
};

/**
 * Struktur-Stores, die nie legitim leer sind. Ein LEERER Remote-Snapshot davon ist
 * ein Publish-Defekt (z.B. der Fixture-Filter im Publish nullt `csv_schemas`, wenn
 * ein fehl-seedender/Fixture-Rechner publiziert — Vorfall 2026-06). Ein solcher
 * leerer Remote-Store darf den nicht-leeren lokalen Stand NICHT wischen
 * (`replaceStore` ruft `clear()` bedingungslos) — sonst verliert JEDER Consumer
 * seine CSV-Quellen (0 Schemas → ● CSV grau, kein Re-Link-Prompt). `verbuende`/
 * `akronym_index`/`unterprogramme`/`csv_row_hashes` dürfen legitim leer sein und
 * bleiben bewusst außen vor.
 */
const NEVER_EMPTY_STORES: ReadonlySet<SnapshotStoreName> = new Set(['csv_schemas', 'programme']);

export interface SyncOptions {
  onProgress?: (p: SyncProgress) => void;
  /**
   * Day-Throttle ueberspringen — fuer User-getriggerte Refreshes (z.B.
   * Banner-Klick „Jetzt laden", wenn der Watcher einen neueren Snapshot
   * gefunden hat). Default `false`: 1x/Tag wie bisher.
   */
  force?: boolean;
}

/**
 * Synchronisiert einen Programm-Snapshot von Daten-Share → lokale IDB.
 *
 * Drosselung: maximal 1x pro Kalendertag (lokale Zeit), ueberspringbar mit
 * `force: true`. Beim ersten Aufruf des Tages wird der
 * `snapshot-last-check-day-<programmId>`-Marker SOFORT gesetzt — auch wenn
 * der Sync danach skipped, faillt oder kein Manifest findet. Damit prueft
 * jeder Client wirklich nur 1x pro Tag.
 */
export async function syncProgrammSnapshot(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  optsOrOnProgress?: SyncOptions | ((p: SyncProgress) => void),
): Promise<SyncResult> {
  const opts: SyncOptions = typeof optsOrOnProgress === 'function'
    ? { onProgress: optsOrOnProgress }
    : (optsOrOnProgress ?? {});
  const onProgress = opts.onProgress;

  // Day-Throttle (ueberspringbar via opts.force)
  const today = todayKey();
  if (!opts.force) {
    const lastCheckDay = await idb.get<string>(SYNC_LAST_CHECK_DAY_KEY(programmId));
    if (lastCheckDay === today) {
      return { synced: false };
    }
  }

  // Verzeichnisstruktur navigieren — bei jedem Step kann das Programm-Snapshot fehlen
  let programmDir: FileSystemDirectoryHandle;
  try {
    const programm = await smbHandle.getDirectoryHandle('programm');
    const antraegeDir = await programm.getDirectoryHandle('antraege');
    const snapshotDir = await antraegeDir.getDirectoryHandle('snapshot');
    programmDir = await snapshotDir.getDirectoryHandle(programmId);
  } catch {
    // Verzeichnis nicht reachable — keinen Marker setzen, naechster App-Start
    // versucht es erneut (transient outage darf nicht den ganzen Tag blockieren).
    return { synced: false };
  }

  const timings: SnapshotTimings = {
    manifestReadMs: 0, smbReadMs: 0, parseMs: 0, idbWriteMs: 0, listViewRebuildMs: 0,
  };

  // Manifest lesen
  onProgress?.({ phase: 'manifest', storesDone: 0, storesTotal: 0, fraction: 0 });
  let manifest: ProgrammSnapshotManifest;
  try {
    const tManifest = performance.now();
    const manifestText = await readText(programmDir, 'manifest.json');
    timings.manifestReadMs = performance.now() - tManifest;
    if (!manifestText) return { synced: false, timings };
    manifest = JSON.parse(manifestText) as ProgrammSnapshotManifest;
  } catch {
    return { synced: false, timings };
  }

  // Manifest erfolgreich gelesen — JETZT den Day-Marker setzen. Damit blockiert
  // ein transient SMB-Outage den User nicht fuer den ganzen Tag.
  await idb.set(SYNC_LAST_CHECK_DAY_KEY(programmId), today);

  // Idempotenz-Check
  const lastSyncedVersion = await idb.get<string>(SYNC_VERSION_KEY(programmId));
  if (lastSyncedVersion === manifest.snapshotVersion) {
    return { synced: false, timings };
  }

  // Pro Store: Hash-Check + bei Mismatch laden
  const storeKeys = Object.keys(manifest.stores) as SnapshotStoreName[];
  const reloadedStores: SnapshotStoreName[] = [];
  // Gesetzt, wenn ein Store wegen Read-/Parse-Fehler NICHT integriert werden
  // konnte. Dann darf SYNC_VERSION unten NICHT committet werden — sonst
  // überspringt der nächste (idempotente) Sync den fehlenden Store dauerhaft
  // (Strand-Bug: ein leerer Store, z.B. verbuende, der nie nachgeladen wird →
  // „Verbund nicht gefunden"). Intentionale Skips (csv_row_hashes in prod,
  // Hash-Match) setzen das NICHT.
  let incompleteLoad = false;
  // Inkrementeller antraege-Diff (falls dieser Pfad lief) — steuert unten, ob
  // die List-View inkrementell gepflegt oder voll neu gebaut wird.
  let antraegeDiff: AntraegeDiff | null = null;
  // v2-Delta-Snapshot: antraege wird per Basis + Deltas statt Voll-Datei gesynct.
  const deltaBlock: SnapshotDeltaBlock | null =
    manifest.version === 2 && manifest.delta && manifest.delta.deltaStores.includes('antraege')
      ? manifest.delta : null;
  // Wenn der Delta-Pfad antraege (inkl. List-View) komplett behandelt hat, darf
  // der Voll-List-View-Block unten ihn NICHT noch einmal anfassen.
  let antraegeHandledByDelta = false;
  let storesDone = 0;
  for (const storeKey of storeKeys) {
    // Fortschritt inkl. Chunk-Fraktion innerhalb des aktuellen Stores: der Balken
    // bewegt sich auch während des großen antraege-Stores (statt erst danach).
    const reportStore = (storeFraction: number): void => {
      const storesProg = storeKeys.length > 0 ? (storesDone + storeFraction) / storeKeys.length : 1;
      onProgress?.({
        phase: 'store',
        currentStore: storeKey,
        storesDone,
        storesTotal: storeKeys.length,
        fraction: PROG_MANIFEST + PROG_STORES * storesProg,
      });
    };
    reportStore(0);
    // csv_row_hashes braucht nur ein Writer-Build (Import-Diff in importer.ts);
    // read-only prod-Konsumenten lesen es nie zurück. Den Download (~14k Zeilen)
    // dort sparen — größter Teil der Konsumenten-Flotte (30×) lädt es täglich
    // sonst umsonst. Writer (pl/kurator/dev) laden es wie bisher.
    if (storeKey === 'csv_row_hashes' && !isDatenShareWritable()) {
      storesDone++;
      continue;
    }
    // v2-Delta-Pfad für antraege: NICHT über den Per-Store-Hash-Skip — die Basis
    // kann unverändert sein (Hash matched), während neue Deltas anzuwenden sind.
    if (storeKey === 'antraege' && deltaBlock) {
      const r = await syncAntraegeViaDelta(idb, programmDir, manifest, deltaBlock, programmId, timings);
      if (r.reloaded) reloadedStores.push('antraege');
      if (r.incomplete) incompleteLoad = true;
      antraegeHandledByDelta = true;
      storesDone++;
      reportStore(1);
      continue;
    }
    const localHash = await idb.get<string>(SYNC_STORE_HASH_KEY(programmId, storeKey));
    const remoteHash = manifest.stores[storeKey].hash;
    if (localHash === remoteHash) {
      storesDone++;
      continue;
    }

    const tRead = performance.now();
    const jsonl = await readText(programmDir, STORE_FILES[storeKey]);
    timings.smbReadMs += performance.now() - tRead;
    if (jsonl === null) {
      console.warn(`[snapshot-sync] ${storeKey} fehlt im Snapshot, skip`);
      incompleteLoad = true;
      storesDone++;
      continue;
    }
    // Rohe, nicht-leere Zeilen — der antraege-Pfad braucht sie unparsed (Hash je
    // Zeile fuer den inkrementellen Diff); die uebrigen Stores parsen direkt.
    const rawLines = jsonl.split('\n').filter(line => line.trim().length > 0);

    if (storeKey === 'antraege') {
      // Grosser Store: inkrementell schreiben, wenn eine Per-Record-Hash-Map
      // vorliegt — nur geaenderte Records put + entfernte delete statt clear +
      // rewrite aller ~14k (Messung v2.95: spart den ~18-s-Voll-Write, da ein
      // neuer Snapshot meist nur wenige Records aendert). Cold-Start / keine Map
      // → Voll-Replace + Map aufbauen.
      const tWork = performance.now();
      const storedHashes = await idb.get<Record<string, string>>(SNAPSHOT_RECORD_HASHES_KEY(programmId));
      if (storedHashes && Object.keys(storedHashes).length > 0) {
        let diff: AntraegeDiff;
        try {
          diff = diffAntraegeLines(rawLines, storedHashes);
        } catch (parseErr) {
          console.warn(`[snapshot-sync] antraege: malformed JSONL, skip store`, parseErr);
          incompleteLoad = true;
          storesDone++;
          continue;
        }
        timings.parseMs += performance.now() - tWork;
        const tWrite = performance.now();
        await applyAntraegeDiff(idb, diff);
        timings.idbWriteMs += performance.now() - tWrite;
        await idb.set(SNAPSHOT_RECORD_HASHES_KEY(programmId), diff.newHashes);
        antraegeDiff = diff;
        console.info(`[snapshot-sync] antraege inkrementell: changed=${diff.changed.length} removed=${diff.removedKeys.length} unchanged=${diff.unchanged}`);
      } else {
        let items: unknown[];
        try {
          items = rawLines.map(line => JSON.parse(line) as unknown);
        } catch (parseErr) {
          console.warn(`[snapshot-sync] antraege: malformed JSONL, skip store`, parseErr);
          incompleteLoad = true;
          storesDone++;
          continue;
        }
        timings.parseMs += performance.now() - tWork;
        const tWrite = performance.now();
        await replaceStore(idb, 'antraege', items, programmId, (done, total) => {
          reportStore(total > 0 ? done / total : 1);
        });
        timings.idbWriteMs += performance.now() - tWrite;
        await idb.set(SNAPSHOT_RECORD_HASHES_KEY(programmId), buildAntraegeHashes(rawLines));
        antraegeDiff = null; // Voll-Replace → List-View Voll-Rebuild unten
      }
      await idb.set(SYNC_STORE_HASH_KEY(programmId, storeKey), remoteHash);
      reloadedStores.push(storeKey);
      storesDone++;
      continue;
    }

    // Uebrige (kleine) Stores: unveraendert Voll-Replace.
    let items: unknown[];
    try {
      const tParse = performance.now();
      items = rawLines.map(line => JSON.parse(line) as unknown);
      timings.parseMs += performance.now() - tParse;
    } catch (parseErr) {
      console.warn(`[snapshot-sync] ${storeKey}: malformed JSONL, skip store`, parseErr);
      incompleteLoad = true;
      storesDone++;
      continue;
    }

    // Empty-Guard (Datenverlust-Schutz): Ein LEERER Remote-Struktur-Store darf den
    // nicht-leeren lokalen Stand NICHT wischen. `replaceStore` ruft `clear()`
    // bedingungslos → ein leer publiziertes `csv_schemas` (Fixture-Filter/Defekt)
    // würde sonst die CSV-Quellen JEDES Consumers auf 0 setzen. Store-Hash bewusst
    // NICHT vorschieben → ein späterer nicht-leerer Publish (neuer Hash) heilt
    // selbst; SYNC_VERSION der übrigen Stores bleibt unberührt (keine Re-Sync-
    // Schleife, `incompleteLoad` NICHT gesetzt — der lokale Stand ist ja intakt).
    if (items.length === 0 && NEVER_EMPTY_STORES.has(storeKey)) {
      const localCount = await countStore(idb, STORE_TARGETS[storeKey]);
      if (localCount > 0) {
        console.warn(
          `[snapshot-sync] ${storeKey}: Remote-Snapshot LEER, lokal ${localCount} Records — Wipe übersprungen (vermutlich defekter/Fixture-Publish). Lokalen Stand behalten.`,
        );
        storesDone++;
        continue;
      }
    }

    const tWrite = performance.now();
    await replaceStore(idb, storeKey, items, programmId, (done, total) => {
      reportStore(total > 0 ? done / total : 1);
    });
    timings.idbWriteMs += performance.now() - tWrite;
    await idb.set(SYNC_STORE_HASH_KEY(programmId, storeKey), remoteHash);
    reloadedStores.push(storeKey);
    storesDone++;
  }

  // Der Snapshot enthält nur den vollen ANTRAEGE-Store, NICHT die Slim-
  // Projektion ANTRAEGE_LIST_VIEW (die Listen/Dashboards/Home lesen). Nach
  // einem In-Session-Sync (Banner „Jetzt laden") muss sie hier neu projiziert
  // werden — sonst liest die Home die leere/stale Projektion und bleibt bis zum
  // nächsten App-Start (= manueller Reload, der ensureListViewProjection neu
  // laufen lässt) leer. Nur nötig, wenn der ANTRAEGE-Store wirklich neu kam.
  if (reloadedStores.includes('antraege') && !antraegeHandledByDelta) {
    const tRebuild = performance.now();
    if (antraegeDiff && await isListViewProjectionCurrent(idb)) {
      // Inkrementell: nur geaenderte Records projizieren + entfernte loeschen —
      // kein Voll-Re-Read+Reprojektion der ~14k (Messung v2.95: ~5 s). Nur sicher,
      // wenn die Projektion bereits auf aktueller Schema-Version liegt.
      const schemas = await listSchemasByProgramm(idb, programmId);
      const gruppen = resolveStatusDatumGruppen(schemas);
      const katSpalten = loeseKategorieSpalten(await ladeAktiveVersion(idb), schemas);
      // Auch der inkrementelle Pfad schreibt Vollersatz-Slim-Items — ohne die
      // freien Felder verlören genau die geänderten Anträge ihren `frei_roh`.
      const freieFelder = await loeseFreieFelderFuer(idb, schemas);
      await applyListViewDiff(idb, antraegeDiff, gruppen, katSpalten, freieFelder);
      onProgress?.({ phase: 'finalizing', storesDone: storeKeys.length, storesTotal: storeKeys.length, fraction: 1 });
    } else {
      // Voll-Rebuild: nach Voll-Replace (Cold-Start) ODER bei Schema-Mismatch der
      // Projektion (kompletter Neuaufbau zwingend).
      await rebuildAntraegeListView(idb, (done, total) => {
        const f = total > 0 ? done / total : 1;
        onProgress?.({
          phase: 'finalizing',
          storesDone: storeKeys.length,
          storesTotal: storeKeys.length,
          fraction: PROG_MANIFEST + PROG_STORES + PROG_REBUILD * f,
        });
      });
    }
    timings.listViewRebuildMs = performance.now() - tRebuild;
  }

  // Version nur festschreiben, wenn ALLE Stores integriert wurden. Bei einem
  // Read-/Parse-Fehler offen lassen, damit der nächste Sync den fehlenden Store
  // nachlädt (statt ihn idempotent dauerhaft zu überspringen).
  if (!incompleteLoad) {
    await idb.set(SYNC_VERSION_KEY(programmId), manifest.snapshotVersion);
  }
  onProgress?.({ phase: 'done', storesDone, storesTotal: storeKeys.length, fraction: 1 });

  return {
    synced: true,
    snapshotVersion: manifest.snapshotVersion,
    createdAt: manifest.createdAt,
    reloadedStores,
    incomplete: incompleteLoad,
    timings,
  };
}

/**
 * v2-Delta-Sync des antraege-Stores: lädt die Voll-Basis nur bei
 * Generation-Wechsel (Compaction) / Cold-Start / Seq-Lücke, sonst werden nur die
 * noch nicht angewandten Delta-Dateien (seq > lokalem Cursor) gelesen. Pflegt
 * Store, List-View, Record-Hash-Map und Sync-Cursor konsistent.
 *
 * Crash-Sicherheit pro Delta: erst Record-Hash-Map persistieren, dann den
 * Seq-Cursor — ein Crash dazwischen lässt den Seq zurück (Delta wird beim
 * nächsten Sync idempotent neu angewandt, put-by-key), nie voraus.
 */
async function syncAntraegeViaDelta(
  idb: IDBStore,
  programmDir: FileSystemDirectoryHandle,
  manifest: ProgrammSnapshotManifest,
  delta: SnapshotDeltaBlock,
  programmId: string,
  timings: SnapshotTimings,
): Promise<{ reloaded: boolean; incomplete: boolean }> {
  const deltas = [...delta.deltas].sort((a, b) => a.seq - b.seq);
  const lastSeq = deltas.length > 0 ? deltas[deltas.length - 1]!.seq : 0;
  const firstSeq = deltas.length > 0 ? deltas[0]!.seq : 0;

  const localBase = await idb.get<string>(SYNC_BASE_VERSION_KEY(programmId));
  let localSeq = (await idb.get<number>(SYNC_DELTA_SEQ_KEY(programmId))) ?? 0;
  const storedHashes = await idb.get<Record<string, string>>(SNAPSHOT_RECORD_HASHES_KEY(programmId));

  // Voll-Basis nötig? Generation-Wechsel (Compaction), kein/leerer Hash-State
  // (Cold-Start), Seq-Lücke (Deltas gepruned) oder Seq voraus (Korruption).
  const needFullBase =
    localBase !== delta.baseVersion
    || !storedHashes || Object.keys(storedHashes).length === 0
    || (deltas.length > 0 && localSeq < firstSeq - 1)
    || localSeq > lastSeq;

  const hashes: Record<string, string> = { ...(storedHashes ?? {}) };
  let reloaded = false;
  let baseReloaded = false;

  if (needFullBase) {
    const tRead = performance.now();
    const basisLage = await readTextLage(programmDir, STORE_FILES.antraege);
    timings.smbReadMs += performance.now() - tRead;
    if (basisLage.status !== 'ok') {
      // „fehlt" und „liess sich nicht lesen" sind verschiedene Lagen: die eine
      // ist ein unvollständiger Snapshot, die andere ein Aussetzer. Beide Male
      // bleibt der lokale Stand stehen — aber der Lauf gilt als unvollständig,
      // damit die Snapshot-Version nicht als integriert festgeschrieben wird.
      console.warn(`[snapshot-sync] antraege-Basis ${basisLage.status} im v2-Snapshot, skip`);
      return { reloaded: false, incomplete: true };
    }
    const rawLines = basisLage.text.split('\n').filter(l => l.trim().length > 0);
    let items: unknown[];
    try {
      const tParse = performance.now();
      items = rawLines.map(line => JSON.parse(line) as unknown);
      timings.parseMs += performance.now() - tParse;
    } catch (parseErr) {
      console.warn('[snapshot-sync] antraege-Basis: malformed JSONL, skip', parseErr);
      return { reloaded: false, incomplete: true };
    }
    const tWrite = performance.now();
    await replaceStore(idb, 'antraege', items, programmId);
    timings.idbWriteMs += performance.now() - tWrite;
    const baseHashes = buildAntraegeHashes(rawLines);
    Object.assign(hashes, baseHashes);
    // Bei Compaction können Keys verschwinden — Map sauber neu setzen.
    for (const k of Object.keys(hashes)) if (!(k in baseHashes)) delete hashes[k];
    await idb.set(SNAPSHOT_RECORD_HASHES_KEY(programmId), { ...hashes });
    await idb.set(SYNC_STORE_HASH_KEY(programmId, 'antraege'), manifest.stores.antraege.hash);
    await idb.set(SYNC_BASE_VERSION_KEY(programmId), delta.baseVersion);
    localSeq = 0;
    await idb.set(SYNC_DELTA_SEQ_KEY(programmId), 0);
    reloaded = true;
    baseReloaded = true;
  }

  // Nur Deltas mit seq > lokalem Cursor anwenden (Konsument lädt nur diese Dateien).
  const lvCurrent = !baseReloaded && await isListViewProjectionCurrent(idb);
  const pending = deltas.filter(d => d.seq > localSeq);
  let incomplete = false;
  for (const d of pending) {
    const entry = d.stores.antraege;
    if (!entry) { await idb.set(SYNC_DELTA_SEQ_KEY(programmId), d.seq); continue; }

    const tRead = performance.now();
    const changedLage = await readTextLage(programmDir, entry.changedFile);
    const removedLage = entry.removedFile
      ? await readTextLage(programmDir, entry.removedFile)
      : null;
    timings.smbReadMs += performance.now() - tRead;

    // Ein Delta, das sich nicht LESEN lässt, ist kein leeres Delta. Wer es als
    // solches verbucht und den Cursor weiterschiebt, verliert die Änderungen
    // dieses Tages endgültig — der nächste Sync hält sich für aktuell. Also:
    // abbrechen, Cursor stehen lassen, beim nächsten Lauf erneut versuchen.
    // Gilt für „unlesbar" (SMB-Aussetzer, Datei gesperrt) wie für „fehlt"
    // (Manifest verweist auf eine Datei, die es nicht gibt) — anwenden lässt
    // sich das Delta in beiden Fällen nicht.
    if (changedLage.status !== 'ok' || removedLage?.status === 'leer' || removedLage?.status === 'unlesbar') {
      const grund = changedLage.status !== 'ok'
        ? `${entry.changedFile}: ${changedLage.status}`
        : `${entry.removedFile}: ${removedLage?.status}`;
      console.warn(
        `[snapshot-sync] antraege.delta.${d.seq} nicht anwendbar (${grund})`
        + ` — Cursor bleibt bei ${localSeq}, kein leeres Delta verbucht.`,
      );
      incomplete = true;
      break;
    }

    const removedKeys = removedLage
      ? removedLage.text.split('\n').map(s => s.trim()).filter(Boolean)
      : (entry.removedKeys ?? []);
    const changedLines = changedLage.text.split('\n').filter(l => l.trim().length > 0);
    let changed: Antrag[];
    try {
      const tParse = performance.now();
      changed = changedLines.map(line => JSON.parse(line) as Antrag);
      timings.parseMs += performance.now() - tParse;
    } catch (parseErr) {
      console.warn(`[snapshot-sync] antraege.delta.${d.seq}: malformed JSONL → Voll-Basis beim nächsten Sync`, parseErr);
      await idb.delete(SNAPSHOT_RECORD_HASHES_KEY(programmId)); // erzwingt Voll-Basis
      incomplete = true;
      break; // nicht `return`: der List-View-Rebuild unten muss noch laufen
    }

    for (let i = 0; i < changed.length; i++) {
      const key = typeof changed[i]!.aktenzeichen === 'string' ? changed[i]!.aktenzeichen : '';
      if (key) hashes[key] = murmurhash3(changedLines[i]!);
    }
    for (const k of removedKeys) delete hashes[k];

    const diff: AntraegeDiff = { changed, removedKeys, newHashes: hashes, unchanged: 0 };
    const tWrite = performance.now();
    await applyAntraegeDiff(idb, diff);
    if (lvCurrent) {
      const schemas = await listSchemasByProgramm(idb, programmId);
      const gruppen = resolveStatusDatumGruppen(schemas);
      const katSpalten = loeseKategorieSpalten(await ladeAktiveVersion(idb), schemas);
      const freieFelder = await loeseFreieFelderFuer(idb, schemas);
      await applyListViewDiff(idb, diff, gruppen, katSpalten, freieFelder);
    }
    timings.idbWriteMs += performance.now() - tWrite;

    await idb.set(SNAPSHOT_RECORD_HASHES_KEY(programmId), { ...hashes });
    await idb.set(SYNC_DELTA_SEQ_KEY(programmId), d.seq);
    reloaded = true;
  }

  // Nach Voll-Basis-Reload die List-View komplett neu projizieren (Basis + bereits
  // angewandte Deltas sind im Store → ein Rebuild deckt alles ab).
  if (baseReloaded) {
    const tRebuild = performance.now();
    await rebuildAntraegeListView(idb);
    timings.listViewRebuildMs += performance.now() - tRebuild;
  }

  if (reloaded) {
    console.info(`[snapshot-sync] antraege delta: base=${baseReloaded} applied=${pending.length} (seq→${lastSeq})`);
  }
  return { reloaded, incomplete };
}

/** Record-Anzahl im lokalen Store — für den Empty-Guard (leeres Remote darf einen
 *  nicht-leeren lokalen Struktur-Store nicht wischen). */
async function countStore(idb: IDBStore, storeName: CsvStoreName): Promise<number> {
  const db = idb.getDb();
  return new Promise<number>((resolve, reject) => {
    const t = db.transaction(storeName, 'readonly');
    const req = t.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Stores, deren Records die Programm-Zugehörigkeit direkt tragen (mit Index). */
const PROGRAMM_INDEX: Partial<Record<SnapshotStoreName, string>> = {
  antraege: 'programm_id',
  verbuende: 'programm_id',
  unterprogramme: 'programm_id',
  csv_schemas: 'programm_id',
};

/** Primärschlüssel aller Treffer eines Index — ohne die Records zu laden. */
function keysViaIndex(
  db: IDBDatabase, storeName: CsvStoreName, indexName: string, wert: IDBValidKey,
): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const out: IDBValidKey[] = [];
    const t = db.transaction(storeName, 'readonly');
    const cur = t.objectStore(storeName).index(indexName).openKeyCursor(IDBKeyRange.only(wert));
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return;
      out.push(c.primaryKey);
      c.continue();
    };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** Alle Records eines Stores, gefiltert — für Stores ohne passenden Index. */
function keysGefiltert(
  db: IDBDatabase, storeName: CsvStoreName,
  passt: (key: IDBValidKey, wert: unknown) => boolean,
  brauchtWert: boolean,
): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const out: IDBValidKey[] = [];
    const t = db.transaction(storeName, 'readonly');
    const s = t.objectStore(storeName);
    const cur = brauchtWert ? s.openCursor() : s.openKeyCursor();
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return;
      const wert = brauchtWert ? (c as IDBCursorWithValue).value : undefined;
      if (passt(c.primaryKey, wert)) out.push(c.primaryKey);
      c.continue();
    };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/**
 * Welche Records im Ziel-Store gehören DIESEM Programm?
 *
 * Der Snapshot eines Programms enthält per Konstruktion nur dessen Records —
 * ein `clear()` auf den ganzen Store löschte deshalb auf einem Rechner mit
 * zwei Programmen den Bestand des Nachbarn mit (und weil `listProgramme` ihn
 * danach nicht mehr lieferte, wurde er nie wieder gesynct).
 *
 * Drei Fälle: eigener Index (billig, Key-Cursor), der Programm-Record selbst,
 * und die abgeleitet zugeordneten Stores (Historien über ihre Entität,
 * Row-Hashes über ihr Schema) — dort entscheidet die Bezugsmenge aus dem
 * Nachbar-Store, genau wie in `listAntragHistorieByProgramm`.
 */
async function keysDesProgramms(
  idb: IDBStore, storeKey: SnapshotStoreName, programmId: string,
): Promise<IDBValidKey[]> {
  const db = idb.getDb();
  const indexFeld = PROGRAMM_INDEX[storeKey];
  if (indexFeld) return keysViaIndex(db, STORE_TARGETS[storeKey], indexFeld, programmId);

  if (storeKey === 'programme') return [programmId];

  if (storeKey === 'akronym_index') {
    // keyPath [programm_id, akronym] — die Zugehörigkeit steht im Key selbst.
    return keysGefiltert(db, STORE_TARGETS.akronym_index,
      key => Array.isArray(key) && key[0] === programmId, false);
  }

  if (storeKey === 'csv_row_hashes') {
    const schemaIds = new Set(
      (await keysViaIndex(db, CSV_STORES.CSV_SCHEMAS, 'programm_id', programmId)).map(String),
    );
    return keysGefiltert(db, STORE_TARGETS.csv_row_hashes,
      key => Array.isArray(key) && schemaIds.has(String(key[0])), false);
  }

  if (storeKey === 'antrag_historie') {
    const az = new Set(
      (await keysViaIndex(db, CSV_STORES.ANTRAEGE, 'programm_id', programmId)).map(String),
    );
    return keysGefiltert(db, STORE_TARGETS.antrag_historie,
      (_k, wert) => az.has(String((wert as { aktenzeichen?: unknown }).aktenzeichen)), true);
  }

  // verbund_historie
  const vids = new Set(
    (await keysViaIndex(db, CSV_STORES.VERBUENDE, 'programm_id', programmId)).map(String),
  );
  return keysGefiltert(db, STORE_TARGETS.verbund_historie,
    (_k, wert) => vids.has(String((wert as { verbund_id?: unknown }).verbund_id)), true);
}

/**
 * Programm-weiser Ersatz: erst die Records DIESES Programms entfernen, dann die
 * neuen chunked schreiben — jeweils in eigener Transaction, weil Bulk-Inserts
 * mit 13k+ Items die TX-Lifetime ueberschreiten wuerden.
 */
async function replaceStore(
  idb: IDBStore,
  storeKey: SnapshotStoreName,
  items: unknown[],
  programmId: string,
  onChunk?: (done: number, total: number) => void,
): Promise<void> {
  const db = idb.getDb();
  const storeName = STORE_TARGETS[storeKey];

  // 1. nur die eigenen Records löschen (statt clear() auf den ganzen Store)
  const zuLoeschen = await keysDesProgramms(idb, storeKey, programmId);
  for (let i = 0; i < zuLoeschen.length; i += MAX_WRITES_PER_TX) {
    const chunk = zuLoeschen.slice(i, i + MAX_WRITES_PER_TX);
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(storeName, 'readwrite');
      const s = t.objectStore(storeName);
      for (const key of chunk) s.delete(key);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  // 2. chunked put
  for (let i = 0; i < items.length; i += MAX_WRITES_PER_TX) {
    const chunk = items.slice(i, i + MAX_WRITES_PER_TX);
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(storeName, 'readwrite');
      const s = t.objectStore(storeName);
      for (const item of chunk) {
        s.put(item);
      }
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
    onChunk?.(Math.min(i + MAX_WRITES_PER_TX, items.length), items.length);
  }
}

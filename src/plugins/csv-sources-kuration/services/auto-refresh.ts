/**
 * CSV-Auto-Refresh-Orchestrator.
 *
 * Wird vom Kurator-Banner aufgerufen, wenn der Background-Check
 * (useCsvAutoRefreshCheck) eine oder mehrere Quellen mit neuerem
 * `lastModified` gefunden hat.
 *
 * Ablauf pro Quelle (sequenziell):
 *   1. Datei via gespeichertem File-Handle laden (kein User-Picker).
 *   2. Header gegen Schema validieren. Bei Drift zuerst pruefen, ob sie nur ein
 *      ENCODING-Wechsel des Exports ist (`encodingHeilungTraegt`) — dann Schema
 *      korrigieren und normal weiter. Sonst entscheidet `entscheideDrift`:
 *      Zusatzspalten headless adoptieren, fehlende Spalten sammeln und die
 *      Quelle überspringen (oder importieren, wenn sie in
 *      `driftAkzeptiertFuer` steht).
 *   3. `importCsvSource()` aufrufen (Merge, Phase-2-Rematch; der Snapshot-Write
 *      ist gebuendelt und laeuft einmal nach der Schleife).
 *   4. `source_last_modified` + `source_file_name` im Schema nachziehen,
 *      damit der naechste Background-Check die Quelle nicht erneut
 *      flaggt.
 *
 * EIN Lock je Lauf (v3.46.1): `runAutoRefresh` nimmt den Build-Lock EINMAL vor
 * der Schleife und haelt ihn ueber alle Quellen plus den gebuendelten
 * Snapshot-Write (`lockHeldByCaller` am Importer). Vorher lockte jede Quelle
 * selbst — und in jedem Freigabe-Fenster dazwischen konnte ein noch laufender
 * Heartbeat-Schlag die geloeschte Lock-Datei neu anlegen, sodass die naechste
 * Quelle gegen den EIGENEN Nachhall lief und der Lauf abbrach (Pitfall #52).
 *
 * Lock-Konflikte: ein echter Fremd-Lock beendet den Lauf mit
 * `BuildLockBusyError`, BEVOR die erste Quelle importiert ist — es bleiben
 * also keine gestempelten, aber unpublizierten Quellen zurueck.
 *
 * Permission-Verlust / fehlende Datei: kommt in `errors[]`, blockt aber
 * den Rest der Pipeline nicht.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  importCsvSource,
  loadSchema,
  saveSchema,
  parseCsvPreview,
  listSchemas,
  listProgramme,
} from '@/core/services/csv';
import type { CsvEncoding, CsvSchema } from '@/core/services/csv/types';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  acquireBuildLock,
  forceLock,
  releaseLock,
  startHeartbeat,
  type LockBesitz,
} from '@/core/services/infrastructure/build-lock';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from '@/core/services/csv/snapshot';
import { isDeltaSnapshotWriteEnabled } from '@/config/feature-flags';
import { BUILD_LOCK_STUFE } from '@/core/services/csv/constants';
import { journalisiereImport, type AnbindungsErgebnis } from '@/core/status/journal';
import {
  loadFileFromStoredHandle,
  setCsvSourceHandle,
  checkSourceForUpdate,
  getCsvSourceDirHandle,
  getCsvDirFileMap,
  setCsvDirFileMapEntries,
  type UpdateCheckResult,
} from '../csv-source-handle';
import { loadSharedCsvFilenames } from '../csv-source-filenames';
import {
  validateHeaders,
  hasDrift,
  entscheideDrift,
  encodingHeilungTraegt,
  type HeaderValidation,
} from './csv-drift-check';
import { adoptNewColumnsAsIgnoredMapping } from './new-column-mapping';

export interface RefreshCandidate {
  schemaId: string;
  schema: CsvSchema;
}

export interface PermissionNeededEntry {
  schemaId: string;
  schemaName: string;
}

export interface FileMissingEntry {
  schemaId: string;
  schemaName: string;
  reason: string;
}

export interface UpToDateEntry {
  schemaId: string;
  schemaName: string;
  /** Zuletzt importierte Datei (aus dem Schema) — für „Export vom …"-Diagnose. */
  fileName: string | null;
  sourceLastModified: number | null;
}

export interface CollectResult {
  /** Quellen mit neuerem lastModified, bereit zum Auto-Update. */
  candidates: RefreshCandidate[];
  /** Quellen, deren Handle/Permission vom User neu erteilt werden muss. */
  permissionNeeded: PermissionNeededEntry[];
  /** Quellen ohne gespeichertes Datei-Handle (z.B. pl-Build: Schemas per
   *  Snapshot, aber nie eine Datei gepickt). */
  unlinked: PermissionNeededEntry[];
  /**
   * Fixture-Quellen (`fixture-real-*`) — HART vom Auto-Refresh ausgeschlossen
   * (`local_fixture`). Bisher still verworfen. In einem Produktions-Build ein
   * Fehlkonfigurations-Signal: die echten Exporte werden nie importiert (der
   * 2026-06-Vorfall). Sichtbar-machen statt schweigen.
   */
  fixtures: PermissionNeededEntry[];
  /** Verknüpfte Quellen, deren Datei nicht (mehr) erreichbar war (`file_missing`). */
  fileMissing: FileMissingEntry[];
  /**
   * Quellen, die als „unverändert" erkannt wurden (mtime/Größe-Fast-Path oder
   * Checksum-Treffer). Für die Diagnose „warum wurde 0 importiert" — bei einem
   * Citrix-False-Negative landet die eigentlich neue Datei hier.
   */
  upToDate: UpToDateEntry[];
}

/**
 * Sammelt über alle Programme + Schemas hinweg, welche CSV-Quellen ein neueres
 * `lastModified` haben (`candidates`), welche eine neue Permission/Handle
 * brauchen (`permissionNeeded`) und welche noch gar nicht verknüpft sind
 * (`unlinked`). React-frei, damit sowohl der Banner-Hook
 * (`useCsvAutoRefreshCheck`) als auch der Start-Orchestrator (`runDataUpdate`)
 * denselben Pfad nutzen.
 */
export async function collectCandidates(
  idb: IDBStore,
  opts?: { forceRecheck?: boolean },
): Promise<CollectResult> {
  const programme = await listProgramme(idb);
  const all: CsvSchema[] = [];
  for (const p of programme) {
    const s = await listSchemas(idb, p.id);
    all.push(...s);
  }

  // v2.28: lokale Filemap aus der geteilten Zuordnung (Daten-Ordner) seeden,
  // bevor wir prüfen — so löst ein frisch verknüpfter CSV-Ordner direkt per
  // Dateiname auf (kein teurer Header-Scan), auch auf einem neuen PL-Rechner.
  // Lokale Einträge (eigener Scan/Heal) haben Vorrang und werden NICHT überschrieben.
  try {
    const dir = await getCsvSourceDirHandle(idb);
    if (dir) {
      const [shared, local] = await Promise.all([loadSharedCsvFilenames(idb), getCsvDirFileMap(idb)]);
      const toSeed: Record<string, string> = {};
      for (const [sid, fn] of Object.entries(shared)) {
        if (!local[sid]) toSeed[sid] = fn;
      }
      if (Object.keys(toSeed).length > 0) await setCsvDirFileMapEntries(idb, toSeed);
    }
  } catch {
    /* best-effort — ein Seed-Fehler darf den Check nicht blockieren */
  }

  const candidates: RefreshCandidate[] = [];
  const permissionNeeded: PermissionNeededEntry[] = [];
  const unlinked: PermissionNeededEntry[] = [];
  const fixtures: PermissionNeededEntry[] = [];
  const fileMissing: FileMissingEntry[] = [];
  const upToDate: UpToDateEntry[] = [];
  for (const schema of all) {
    const r: UpdateCheckResult = await checkSourceForUpdate(idb, schema, opts);
    const base = { schemaId: schema.id, schemaName: schema.csv_source_name };
    switch (r.state) {
      case 'update_available':
        candidates.push({ schemaId: schema.id, schema });
        break;
      case 'permission_required':
        permissionNeeded.push(base);
        break;
      case 'no_handle':
        unlinked.push(base);
        break;
      case 'local_fixture':
        fixtures.push(base);
        break;
      case 'file_missing':
        fileMissing.push({ ...base, reason: r.reason });
        break;
      case 'up_to_date':
        upToDate.push({
          ...base,
          fileName: schema.source_file_name ?? null,
          sourceLastModified: schema.source_last_modified ?? null,
        });
        break;
    }
  }
  return { candidates, permissionNeeded, unlinked, fixtures, fileMissing, upToDate };
}

export interface DriftEntry {
  schemaId: string;
  schemaName: string;
  validation: HeaderValidation;
}

export interface ErrorEntry {
  schemaId: string;
  schemaName: string;
  message: string;
}

export interface ProcessedEntry {
  schemaId: string;
  schemaName: string;
  rowCount: number;
  skipped: boolean;
  /**
   * Reine neue CSV-Spalten, die im Auto-Refresh headless als `{ ignore: true }`
   * ins Schema übernommen wurden (nicht-blockierend — die Quelle landet NICHT in
   * `report.drift`, das Modal öffnet nicht). Undefiniert, wenn nichts adoptiert.
   */
  autoAdoptedColumns?: string[];
  /**
   * Fehlende Schema-Spalten, die der Nutzer für diesen Lauf bewusst übergangen
   * hat („Trotzdem importieren"). Undefiniert im Normalfall. Diese Felder liefert
   * die Quelle nicht mehr — der Merge baut jeden Antrag komplett neu auf, sie
   * werden also geleert, soweit keine andere Quelle dasselbe Feld trägt.
   */
  uebergangeneSpalten?: string[];
  /**
   * Das Schema-Encoding wurde vor dem Import auf den erkannten Wert korrigiert,
   * weil die Drift ein Lesefehler war (alle Umlaut-Spalten fehlten und standen
   * gleichzeitig als „neu" da). Undefiniert im Normalfall.
   */
  korrigiertesEncoding?: CsvEncoding;
}

export interface RefreshReport {
  processed: ProcessedEntry[];
  drift: DriftEntry[];
  errors: ErrorEntry[];
  /** Aufsummiertes Per-Phasen-Timing über alle importierten Quellen (ms) —
   *  fürs Performance-Logging des Daten-Update-Orchestrators. */
  importTimings: { parseMs: number; hashDiffMs: number; mergeMs: number; snapshotWriteMs: number };
  /**
   * Aufsummierte Zeilen, die der Master-Import wegen inaktivem/unbekanntem
   * Unterprogramm-Code verworfen hat. >0 heißt: die Unterprogramm-Allowlist
   * greift und schluckt Anträge — bei leerem/unvollständigem `unterprogramme`-
   * Store der stille Daten-Verlust (Prod-Vorfall 2026-07). Sichtbar für Diagnose.
   */
  skippedInactiveUnterprogramm: number;
  /**
   * Aufsummierte Löschungen, die zurückgehalten wurden, weil eine andere Quelle
   * den Antrag weiterführt (gelöscht wird erst, wenn er überall verschwunden
   * ist). >0 heisst: mindestens ein Export war kürzer als der Bestand — normal
   * bei unterschiedlich weit zurückreichenden Quellen, auffällig bei einer
   * Quelle, die sonst deckungsgleich ist.
   */
  heldRemovals: number;
  /**
   * Was der Journal-Schritt je Master-Quelle getan hat. Leer, wenn keine Quelle
   * journalisiert wurde (kein Master, keine Join-Spalte, keine `D_`-Spalten,
   * kein Schreibrecht).
   *
   * **Bewusst NICHT an `vorgangssystem` gebunden.** Das Journal begleitet den
   * Export, und ein Export, den niemand journalisiert hat, ist unwiederbringlich
   * — die Lücke ließe sich später nicht mehr schließen. Geschrieben wird deshalb
   * aus jedem Build mit Schreibrecht; ANGEZEIGT wird die Frische nur dort, wo
   * das Vorgangssystem läuft (dev/pl).
   */
  journal: (AnbindungsErgebnis & { schemaId: string })[];
}

export interface RefreshProgress {
  index: number;
  total: number;
  schemaName: string;
  phase: 'reading' | 'validating' | 'importing' | 'persisting' | 'publishing';
}

export interface RunAutoRefreshOptions {
  onProgress?: (p: RefreshProgress) => void;
  kuratorName?: string;
  /**
   * Nach allen Merges, ABER vor dem (sekundenlangen) gebündelten Snapshot-Write
   * aufgerufen — mit den Programm-IDs, die echte Deltas hatten. Der Caller
   * aktualisiert hier den In-Memory-Store, sodass der lokale User die neuen
   * Anträge sofort sieht und nicht auf das Publizieren für die anderen Rechner
   * wartet (v2.96.3). Best-effort: Fehler dürfen den Publish nicht verhindern.
   */
  onAfterMerge?: (programmIds: string[]) => Promise<void>;
  /**
   * Übergeht die Lock-Prüfung und übernimmt einen bestehenden (Fremd-)Lock per
   * `forceLock`. Wird vom „Trotzdem aktualisieren"-Button im Banner gesetzt
   * (v2.61.5), wenn ein abgestürzter Import einen Lock hinterlassen hat. Im
   * Normalfall (`false`) bricht ein Fremd-Lock den Lauf mit `BuildLockBusyError` ab.
   */
  force?: boolean;
  /**
   * Schema-Ids, deren FEHLENDE Spalten der Nutzer für diesen Lauf bewusst in
   * Kauf nimmt (Knopf „Trotzdem importieren" im Drift-Bericht). Ohne diese
   * Zustimmung bleibt `missingFromCsv > 0` blockierend.
   *
   * Bewusst pro Lauf und pro Quelle, NICHT persistiert: der Merge baut jeden
   * Antrag komplett neu aus allen CSVs auf — eine verschwundene Spalte leert
   * ihr Feld, soweit keine andere Quelle es trägt. Eine gespeicherte
   * „immer ignorieren"-Einstellung würde genau diesen Verlust ab dann
   * unbemerkt wiederholen. Nach dem Import ist die Quelle gestempelt und fällt
   * aus den Kandidaten; ein NEUER Export mit derselben Lücke fragt wieder.
   */
  driftAkzeptiertFuer?: string[];
}

/**
 * Geworfen wenn ein anderer Schreiber gerade einen Lock haelt.
 * Banner zeigt: "Kurator X aktualisiert gerade seit Y Min".
 *
 * `besitz` trennt den echten Fremd-Lock von „anderes Fenster unter deinem
 * Namen" und „dieses Fenster selbst" — ohne diese Unterscheidung beschuldigte
 * der Banner den Nutzer mit seinem eigenen Namen (v3.46.1).
 */
export class BuildLockBusyError extends Error {
  constructor(
    public blockingKurator: string,
    public ageMinutes: number,
    public besitz: LockBesitz = 'fremd',
  ) {
    super(`Lock besetzt von ${blockingKurator} seit ${Math.round(ageMinutes)} Min`);
    this.name = 'BuildLockBusyError';
  }
}

async function persistSourceMeta(
  idb: IDBStore,
  schemaId: string,
  file: File,
  handle: FileSystemFileHandle | null,
  kuratorName: string | undefined,
): Promise<void> {
  if (handle) {
    try {
      await setCsvSourceHandle(idb, schemaId, handle);
    } catch (e) {
      console.warn('[auto-refresh] persist handle failed', e);
    }
  }
  const fresh = await loadSchema(idb, schemaId);
  if (fresh) {
    await saveSchema(idb, {
      ...fresh,
      source_file_name: file.name,
      source_last_modified: file.lastModified,
      last_file_size: file.size,
    });
  }
  await logAudit(idb, {
    action: 'csv_source_auto_updated',
    user: kuratorName,
    details: {
      schemaId,
      fileName: file.name,
      lastModified: new Date(file.lastModified).toISOString(),
    },
  });
}

/**
 * Übernimmt reine neue CSV-Spalten headless als `{ ignore: true }` ins Schema
 * (kein Kurator-Dialog, spiegelt `CsvAddColumnsDialog` headless). Persistiert das
 * gemergte Mapping VOR dem Import — der Importer liest das Schema frisch aus der
 * IDB (`loadSchema` in importer.ts), sodass die adoptierten Spalten bekannt sind.
 * `loadSchema` bewusst FRISCH (nicht der in `collectCandidates` gefangene
 * `candidate.schema`, der zwischenzeitliche Writes verpassen könnte). Schreibt
 * einen Audit-Eintrag und liefert die adoptierten Spaltennamen zurück (für den
 * nicht-blockierenden Report). Wirft bei fehlendem Schema — der Aufrufer behandelt
 * den Fehler dann wie bisher blockierend.
 */
async function adoptNewColumnsAsIgnored(
  idb: IDBStore,
  schemaId: string,
  newColumns: string[],
  kuratorName: string | undefined,
): Promise<string[]> {
  const fresh = await loadSchema(idb, schemaId);
  if (!fresh) throw new Error(`Schema ${schemaId} nicht gefunden`);
  const merged = adoptNewColumnsAsIgnoredMapping(fresh.column_mapping, newColumns);
  await saveSchema(idb, { ...fresh, column_mapping: merged });
  await logAudit(idb, {
    action: 'csv_schema_columns_auto_ignored',
    user: kuratorName,
    details: { schemaId, columns: newColumns },
  });
  return newColumns;
}

/**
 * Zieht das erkannte Encoding ins Schema nach. Laedt frisch (nicht
 * `candidate.schema`) und schreibt VOR dem Import, damit `importCsvSource` es
 * ueber `loadSchema` selbst aufgreift — kein zweiter Uebergabeweg.
 */
async function uebernehmeErkanntesEncoding(
  idb: IDBStore,
  schemaId: string,
  encoding: CsvEncoding,
  kuratorName: string | undefined,
): Promise<void> {
  const fresh = await loadSchema(idb, schemaId);
  if (!fresh) throw new Error(`Schema ${schemaId} nicht gefunden`);
  await saveSchema(idb, { ...fresh, encoding });
  await logAudit(idb, {
    action: 'csv_schema_encoding_korrigiert',
    user: kuratorName,
    details: { schemaId, vorher: fresh.encoding ?? null, nachher: encoding },
  });
}

/**
 * Faehrt eine Liste von Refresh-Kandidaten sequenziell ab — unter EINEM
 * Build-Lock fuer den ganzen Lauf (Schleife + gebuendelter Snapshot-Write).
 *
 * Wirft `BuildLockBusyError`, wenn ein fremder Schreiber den Lock haelt. Das
 * passiert VOR dem ersten Import: es bleiben keine Quellen zurueck, die schon
 * gestempelt (`source_last_modified`), aber nie publiziert wurden.
 */
export async function runAutoRefresh(
  idb: IDBStore,
  candidates: RefreshCandidate[],
  opts: RunAutoRefreshOptions = {},
): Promise<RefreshReport> {
  const report: RefreshReport = {
    processed: [], drift: [], errors: [], journal: [],
    importTimings: { parseMs: 0, hashDiffMs: 0, mergeMs: 0, snapshotWriteMs: 0 },
    skippedInactiveUnterprogramm: 0,
    heldRemovals: 0,
  };
  if (candidates.length === 0) return report;

  // force = User-„Trotzdem aktualisieren": bestehenden Lock uebernehmen.
  // Kein `programm_id`: die Kandidaten koennen ueber Programme hinweg gehen,
  // und die Lock-Datei ist ohnehin share-weit.
  if (opts.force) {
    await forceLock(idb, BUILD_LOCK_STUFE, {});
  } else {
    const lockRes = await acquireBuildLock(idb, BUILD_LOCK_STUFE, {});
    if (!lockRes.acquired) {
      throw new BuildLockBusyError(
        lockRes.existing.kurator_name ?? 'unbekannt',
        lockRes.ageMinutes,
        lockRes.besitz,
      );
    }
  }

  const hb = startHeartbeat(idb);
  try {
    return await laufeKandidatenAb(idb, candidates, opts, report);
  } finally {
    // Erst den laufenden Heartbeat-Schlag abwarten, DANN freigeben — sonst legt
    // er die geloeschte Lock-Datei hinterher neu an (Pitfall #52).
    await hb.stop();
    await releaseLock(idb).catch(() => undefined);
  }
}

/**
 * Der eigentliche Lauf. Laeuft unter dem Lock, den `runAutoRefresh` haelt —
 * weder die Einzel-Importe noch der Snapshot-Write locken selbst.
 */
async function laufeKandidatenAb(
  idb: IDBStore,
  candidates: RefreshCandidate[],
  opts: RunAutoRefreshOptions,
  report: RefreshReport,
): Promise<RefreshReport> {
  // Programme, deren Snapshot nach dem Batch EINMAL geschrieben werden muss
  // (statt pro importierter Quelle, v2.96.2).
  const programmeToPublish = new Set<string>();
  // Pro Programm: Vereinigung der geänderten/entfernten Aktenzeichen über alle
  // importierten Quellen — Basis für EINEN Delta-Snapshot-Write (v2.97).
  const changeByProgramm = new Map<string, { touched: Set<string>; removed: Set<string> }>();
  // Quellen, deren fehlende Spalten der Nutzer für DIESEN Lauf abgenickt hat.
  const akzeptiert = new Set(opts.driftAkzeptiertFuer ?? []);

  await logAudit(idb, {
    action: 'csv_auto_refresh_started',
    user: opts.kuratorName,
    details: { count: candidates.length, schemaIds: candidates.map(c => c.schemaId) },
  });

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;
    const { schemaId, schema } = candidate;
    const name = schema.csv_source_name;

    opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'reading' });
    let file: File;
    let handle: FileSystemFileHandle | null;
    try {
      const loaded = await loadFileFromStoredHandle(idb, schemaId);
      file = loaded.file;
      handle = loaded.handle;
    } catch (err) {
      report.errors.push({ schemaId, schemaName: name, message: (err as Error).message });
      continue;
    }

    opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'validating' });
    let validation: HeaderValidation;
    let korrigiertesEncoding: CsvEncoding | undefined;
    try {
      const preview = await parseCsvPreview(file, 1, {
        encoding: schema.encoding,
        separator: schema.separator,
      });
      validation = validateHeaders(schema, preview.headers);

      // Bevor Drift ein Urteil wird: kann sie ein ENCODING-Wechsel sein?
      // Wechselt der Export von windows-1252 auf UTF-8, lesen sich alle
      // Umlaut-Spalten falsch — `Nachrücker` fehlt und `NachrÃ¼cker` ist neu,
      // dieselbe Spalte zweimal. Ein Import mit dem falschen Encoding
      // verstümmelte auch jeden WERT, nicht nur die Kopfzeile; hier zu
      // blockieren ist also richtig, aber es ist eine Sackgasse. Der
      // Re-Import-Dialog erkennt das seit je und stellt um — der automatische
      // Weg tat es nicht.
      if (hasDrift(validation)) {
        const auto = await parseCsvPreview(file, 1, { separator: schema.separator });
        if (auto.encoding !== (schema.encoding ?? 'UTF-8')) {
          const nachHeilung = validateHeaders(schema, auto.headers);
          if (encodingHeilungTraegt(validation, nachHeilung)) {
            await uebernehmeErkanntesEncoding(idb, schemaId, auto.encoding, opts.kuratorName);
            validation = nachHeilung;
            korrigiertesEncoding = auto.encoding;
          }
        }
      }
    } catch (err) {
      report.errors.push({ schemaId, schemaName: name, message: `Preview fehlgeschlagen: ${(err as Error).message}` });
      continue;
    }

    // Drift-Behandlung — die Regel selbst steht rein in `entscheideDrift`:
    //  - Reine `newColumns`-Drift (nichts fehlt, nur Zusatzspalten): headless als
    //    `{ ignore: true }` adoptieren, dann normal importieren. Unbeaufsichtigt,
    //    damit der tägliche Auto-Import nicht blockiert (Zusatzspalten werden beim
    //    Import ohnehin ignoriert).
    //  - `missingFromCsv > 0`: blockierend (report.drift → Modal), weil eine
    //    verschwundene gemappte Spalte echte Felder leert — ES SEI DENN, der
    //    Nutzer hat genau diese Quelle im Bericht auf „Trotzdem importieren"
    //    gesetzt. Dann läuft sie durch und der Bericht führt die übergangenen
    //    Spalten mit.
    const entscheidung = entscheideDrift(validation, akzeptiert.has(schemaId));
    let autoAdopted: string[] = [];
    if (!entscheidung.importieren) {
      report.drift.push({ schemaId, schemaName: name, validation });
      continue;
    }
    if (entscheidung.neueSpaltenAdoptieren) {
      try {
        autoAdopted = await adoptNewColumnsAsIgnored(idb, schemaId, validation.newColumns, opts.kuratorName);
      } catch (err) {
        // Adopt fehlgeschlagen → wie bisher blockierend behandeln, statt still
        // mit unvollständigem Schema zu importieren.
        console.warn('[auto-refresh] Auto-Adopt neuer Spalten fehlgeschlagen', err);
        report.drift.push({ schemaId, schemaName: name, validation });
        continue;
      }
    }
    if (entscheidung.uebergangeneSpalten.length > 0) {
      // Nachvollziehbar halten: wer später fragt, warum diese Felder leer sind,
      // findet hier die Zustimmung samt Spaltenliste.
      await logAudit(idb, {
        action: 'csv_auto_refresh_drift_akzeptiert',
        user: opts.kuratorName,
        details: { schemaId, fehlendeSpalten: entscheidung.uebergangeneSpalten },
      });
    }

    opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'importing' });
    try {
      // Store-Refresh erfolgt gebuendelt im aufrufenden Hook useCsvAutoRefreshCheck
      // nach Abschluss der N-Quellen-Pipeline — ein Refresh pro Quelle waere redundant.
      const result = await importCsvSource(idb, schemaId, file, { // allow-import-no-refresh: Refresh erfolgt gebuendelt im Caller-Hook useCsvAutoRefreshCheck
        // Der Lock haengt am LAUF, nicht an der Quelle — siehe Datei-Kopf.
        lockHeldByCaller: true,
        // Das Journal sieht den EXPORT, nicht das gemergte Ergebnis. Die Zeilen
        // liegen an dieser Stelle ohnehin im Speicher; Fehler bleiben folgenlos
        // (das Journal begleitet den Import, es bedingt ihn nicht).
        onRows: async (zeilen, headers) => {
          const j = await journalisiereImport(idb, file, schema, zeilen, headers);
          if (j) {
            report.journal.push({ schemaId, ...j });
            console.info(
              `[journal] ${j.art}: ${j.eintraege} Einträge, ${j.antraege} Anträge im Stand`
              + ` (ab ${j.journalAb}, Stempel ${j.stempel.id})`,
            );
          }
        },
        // Snapshot-Write bündeln: bei N Quellen schreibt sonst jede den vollen
        // Snapshot (~25 s, touched-unabhängig). Wir publizieren EINMAL nach dem
        // Batch (siehe unten).
        deferSnapshotWrite: true,
      });

      opts.onProgress?.({ index: i, total: candidates.length, schemaName: name, phase: 'persisting' });
      await persistSourceMeta(idb, schemaId, file, handle, opts.kuratorName);

      if (result.importTimings) {
        report.importTimings.parseMs += result.importTimings.parseMs;
        report.importTimings.hashDiffMs += result.importTimings.hashDiffMs;
        report.importTimings.mergeMs += result.importTimings.mergeMs;
        report.importTimings.snapshotWriteMs += result.importTimings.snapshotWriteMs;
      }
      report.skippedInactiveUnterprogramm += result.skippedInactiveUnterprogramm ?? 0;
      report.heldRemovals += result.heldRemovals ?? 0;

      // Programm zum Publizieren vormerken, wenn dieser Import echte Deltas hatte
      // (sonst ist der vorhandene Snapshot bereits aktuell). Geänderte/entfernte
      // Aktenzeichen je Programm sammeln (für den gebündelten Delta-Write).
      // Auch eine reine SCHEMA-Änderung muss publiziert werden. Bis v3.47.0 wuchs
      // `programmeToPublish` nur bei Zeilen-Deltas — eine korrigierte Kodierung
      // oder eine adoptierte Zusatzspalte blieb damit lokal, während der Snapshot
      // die alte Schema-Kopie weiterträgt. Folge: jeder andere Rechner bekommt sie
      // beim Sync zurück und heilt erneut. Selbstkorrigierend, aber endlos —
      // gemessen am 12.08.2026 (Share-Schemas UTF-8, Snapshot-Kopie windows-1252).
      const schemaGeaendert = korrigiertesEncoding != null || autoAdopted.length > 0;
      const hadDeltas = result.buckets.new + result.buckets.changed + result.buckets.removed > 0;
      if (schemaGeaendert && !hadDeltas) {
        programmeToPublish.add(schema.programm_id);
      }
      if (hadDeltas) {
        programmeToPublish.add(schema.programm_id);
        const acc = changeByProgramm.get(schema.programm_id) ?? { touched: new Set<string>(), removed: new Set<string>() };
        for (const k of result.changedAktenzeichen ?? []) acc.touched.add(k);
        for (const k of result.removedAktenzeichen ?? []) acc.removed.add(k);
        changeByProgramm.set(schema.programm_id, acc);
      }

      report.processed.push({
        schemaId,
        schemaName: name,
        rowCount: result.rowCount,
        skipped: result.skipped,
        ...(autoAdopted.length > 0 ? { autoAdoptedColumns: autoAdopted } : {}),
        ...(entscheidung.uebergangeneSpalten.length > 0
          ? { uebergangeneSpalten: entscheidung.uebergangeneSpalten }
          : {}),
        ...(korrigiertesEncoding ? { korrigiertesEncoding } : {}),
      });
    } catch (err) {
      // Der frühere Sonderfall „Anderer Import läuft" ist entfallen: der
      // Importer lockt hier nicht mehr (der Lauf hält den Lock), ein
      // Lock-Konflikt kann also nur noch VOR der Schleife auftreten. Eine
      // kaputte Quelle stoppt den Lauf damit nicht mehr.
      report.errors.push({ schemaId, schemaName: name, message: (err as Error).message });
    }
  }

  // Lokalen Store JETZT aktualisieren (nach allen Merges, vor dem ~25-s-Publish):
  // der lokale User sieht die neuen Anträge sofort, statt auf das Publizieren für
  // die anderen Rechner zu warten (v2.96.3). Best-effort.
  if (programmeToPublish.size > 0 && opts.onAfterMerge) {
    await opts.onAfterMerge([...programmeToPublish]).catch(err =>
      console.warn('[csv-auto-refresh] onAfterMerge fehlgeschlagen', err));
  }

  // Gebündelter Snapshot-Write: EINMAL pro betroffenem Programm statt pro Quelle
  // (v2.96.2). Laeuft unter dem Lauf-Lock des Aufrufers — der frühere
  // Eigen-Acquire mit `forceLock`-Notbehelf ist entfallen (v3.46.1): er existierte
  // nur, weil die Einzel-Importe den Lock je einzeln hielten und freigaben, und
  // er hätte im Zweifel einen ECHTEN Fremd-Lock gestampft.
  if (programmeToPublish.size > 0) {
    opts.onProgress?.({ index: 0, total: programmeToPublish.size, schemaName: 'Datenbestand', phase: 'publishing' });
    const handle = await getDatenShareHandle(idb);
    if (handle) {
      const tSnap = Date.now();
      try {
        const identity = opts.kuratorName ?? 'unbekannt';
        const deltaMode = isDeltaSnapshotWriteEnabled();
        for (const pid of programmeToPublish) {
          if (deltaMode) {
            const acc = changeByProgramm.get(pid) ?? { touched: new Set<string>(), removed: new Set<string>() };
            const r = await writeProgrammSnapshotDelta(idb, handle, pid, identity, { touchedAz: [...acc.touched], removedAz: [...acc.removed] });
            await logAudit(idb, { action: 'snapshot_written', details: { programmId: pid, source: 'csv_auto_refresh_batch', mode: r.mode } }).catch(() => undefined);
          } else {
            await writeProgrammSnapshot(idb, handle, pid, identity);
            await logAudit(idb, { action: 'snapshot_written', details: { programmId: pid, source: 'csv_auto_refresh_batch' } }).catch(() => undefined);
          }
        }
      } catch (e) {
        await logAudit(idb, {
          action: 'snapshot_failed',
          details: { error: (e as Error).message, source: 'csv_auto_refresh_batch' },
        }).catch(() => undefined);
        console.warn('[csv-auto-refresh] Snapshot-Batch-Write fehlgeschlagen:', e);
      }
      report.importTimings.snapshotWriteMs += Date.now() - tSnap;
    }
  }

  await logAudit(idb, {
    action: 'csv_auto_refresh_complete',
    user: opts.kuratorName,
    details: {
      processed: report.processed.length,
      drift: report.drift.length,
      errors: report.errors.length,
    },
  });

  return report;
}

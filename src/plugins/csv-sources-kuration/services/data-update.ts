/**
 * Daten-Update-Orchestrator — DER eine Pfad für die Start-Datenaktualisierung
 * (pl + kurator). Sequenziert die beiden bisher getrennten Subsysteme in der
 * vom Fachbereich gewünschten Reihenfolge:
 *
 *   1. „Datenbestand" — Snapshot-Sync je Programm (syncProgrammSnapshot):
 *      Manifest prüfen → bei neuer Version Stores laden → In-Memory-Store +
 *      Phase-2-Pending-Bucket aktualisieren.
 *   2. „Export-CSV" — neue Quell-CSVs erkennen (collectCandidates) und
 *      automatisch importieren (runAutoRefresh → importCsvSource, schreibt den
 *      Snapshot zurück auf den Share). Nur in pl/kurator (gleiche Gate wie der
 *      CSV-Banner). Build-Lock-Konflikt → kein Crash, `lockBusy` gesetzt.
 *
 * Beim Start (App.tsx) idle-deferred + non-blocking; ein manueller Button und
 * der Snapshot-Watcher rufen denselben Pfad. Emittiert eine always-on
 * `[data-update]`-Zeile mit Per-Phasen-Timing (SMB-I/O vs. Parse vs.
 * IDB-Integration) und legt den letzten Breakdown in localStorage ab — Basis
 * für die messwert-getriebene Optimierung (Schritt 2).
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import { ensureDefaultProgramm, listProgramme, loadSchema } from '@/core/services/csv';
import { syncProgrammSnapshot, type SnapshotTimings } from '@/core/services/csv/snapshot-sync';
import { refreshAntraegeStoreAfterSync } from '@/plugins/antraege/snapshot-refresh';
import { rematchOnSnapshotReload } from '@/phase2';
import { readKuratorName } from '@/core/services/infrastructure/kurator-config';
import { isKuratorMenusEnabled, isCsvAutoRefreshEnabled } from '@/config/feature-flags';
import { runtimeConfig } from '@/config/runtime-config';
import { runAutoRefresh, collectCandidates, BuildLockBusyError, type RefreshReport } from './auto-refresh';

const LAST_TIMING_KEY = 'teamflow_last_data_update_timing';

export interface DataUpdatePhase {
  phase: 'snapshot' | 'csv-check' | 'csv-import';
  /** 0..1 innerhalb der Phase. */
  fraction: number;
  /** Optionales Label (Programm-/Quellen-Name). */
  label?: string;
}

export interface DataUpdateResult {
  /** Mindestens ein Programm hat einen neueren Snapshot geladen. */
  snapshotSynced: boolean;
  /** Pro neu geladenem Programm: Name + Snapshot-Stand (für Toast). */
  snapshotInfo: { programmName: string; createdAt: string }[];
  /** CSV-Auto-Refresh-Report (nur gesetzt, wenn die CSV-Phase lief + importierte). */
  csvReport?: RefreshReport;
  /** Anderer Schreiber hielt den Build-Lock — CSV-Import übersprungen. */
  lockBusy?: { blockingKurator: string; ageMinutes: number };
  /** Gesamt-Wall-Clock (ms). */
  totalMs: number;
}

export interface RunDataUpdateOptions {
  onPhase?: (p: DataUpdatePhase) => void;
  /**
   * CSV-Phase ausführen? Default `true`. Der Snapshot-Watcher („Jetzt laden"
   * bei FREMD-Snapshot) setzt `false` — dort ist die Absicht „Kollegen-Stand
   * holen", nicht lokale CSVs re-importieren + Snapshot teamweit neu schreiben.
   */
  includeCsv?: boolean;
  /** Abbruch-Signal (App-Unmount / Gate öffnet wieder). */
  signal?: { cancelled: boolean };
}

// Modul-weiter In-Flight-Guard: Start-Sync + Watcher + Button dürfen sich
// nicht überlappen (paralleles clear()/put() auf denselben Stores). Der zweite
// Aufruf wird zum No-Op (liefert ein leeres Result).
let running = false;

function round(ms: number): number {
  return Math.round(ms);
}

function logTiming(
  result: DataUpdateResult,
  snap: SnapshotTimings,
  csv: { checkMs: number; enabled: boolean },
): void {
  const c = result.csvReport?.importTimings;
  const summary =
    `[data-update] total=${round(result.totalMs)}ms`
    + ` | snapshot synced=${result.snapshotSynced}`
    + ` manifest=${round(snap.manifestReadMs)}ms read=${round(snap.smbReadMs)}ms`
    + ` parse=${round(snap.parseMs)}ms idbWrite=${round(snap.idbWriteMs)}ms`
    + ` listView=${round(snap.listViewRebuildMs)}ms`
    + ` | csv enabled=${csv.enabled} check=${round(csv.checkMs)}ms`
    + ` imported=${result.csvReport?.processed.filter(p => !p.skipped).length ?? 0}`
    + (c ? ` parse=${round(c.parseMs)}ms hashDiff=${round(c.hashDiffMs)}ms merge=${round(c.mergeMs)}ms snapshotWrite=${round(c.snapshotWriteMs)}ms` : '')
    + (result.lockBusy ? ` lockBusy=${result.lockBusy.blockingKurator}` : '');
  // Always-on (wie das bestehende `[snapshot-sync]`-info) — soll auch im
  // pl/kurator-`file://`-Build sichtbar sein, ohne dev-Gate.
  console.info(summary);
  try {
    localStorage.setItem(LAST_TIMING_KEY, JSON.stringify({
      at: new Date().toISOString(),
      totalMs: round(result.totalMs),
      snapshot: {
        synced: result.snapshotSynced,
        manifestReadMs: round(snap.manifestReadMs),
        smbReadMs: round(snap.smbReadMs),
        parseMs: round(snap.parseMs),
        idbWriteMs: round(snap.idbWriteMs),
        listViewRebuildMs: round(snap.listViewRebuildMs),
      },
      csv: {
        enabled: csv.enabled,
        checkMs: round(csv.checkMs),
        imported: result.csvReport?.processed.filter(p => !p.skipped).length ?? 0,
        parseMs: c ? round(c.parseMs) : 0,
        hashDiffMs: c ? round(c.hashDiffMs) : 0,
        mergeMs: c ? round(c.mergeMs) : 0,
        snapshotWriteMs: c ? round(c.snapshotWriteMs) : 0,
      },
      lockBusy: result.lockBusy ?? null,
    }));
  } catch {
    /* localStorage best-effort */
  }
}

/**
 * Führt die komplette Start-Datenaktualisierung aus: Snapshot → CSV-Check →
 * CSV-Import. Wirft NICHT (alle Fehler werden gefangen + geloggt); liefert ein
 * Result für Toast/Diagnose.
 */
export async function runDataUpdate(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  opts: RunDataUpdateOptions = {},
): Promise<DataUpdateResult> {
  const { onPhase, includeCsv = true, signal } = opts;
  const result: DataUpdateResult = { snapshotSynced: false, snapshotInfo: [], totalMs: 0 };
  if (running) return result;
  running = true;

  const tTotal = performance.now();
  const snapAgg: SnapshotTimings = {
    manifestReadMs: 0, smbReadMs: 0, parseMs: 0, idbWriteMs: 0, listViewRebuildMs: 0,
  };
  let csvCheckMs = 0;
  // Build-konstante Gate: CSV-Import nur in pl (csvAutoRefresh) + kurator
  // (kuratorMenus) — identisch zur Banner-Sichtbarkeit in ShellLayout. Prod
  // (End-User) bekommt nur Snapshot-Sync wie bisher.
  const csvEnabled = includeCsv && (isKuratorMenusEnabled() || isCsvAutoRefreshEnabled());

  try {
    // ─── Phase 1: Datenbestand (Snapshot) ──────────────────────────────────
    await ensureDefaultProgramm(idb);
    const programme = await listProgramme(idb);
    for (let i = 0; i < programme.length; i++) {
      if (signal?.cancelled) return result;
      const p = programme[i];
      if (!p) continue;
      onPhase?.({ phase: 'snapshot', fraction: i / Math.max(programme.length, 1), label: p.name });
      // force: true ⇒ jeder Start prüft (Day-Throttle umgangen). Manifest-Read
      // ist billig (~1 KB); der teure Store-Load bleibt version-gated.
      const r = await syncProgrammSnapshot(idb, smbHandle, p.id, {
        force: true,
        onProgress: sp => onPhase?.({
          phase: 'snapshot',
          fraction: (i + sp.fraction) / Math.max(programme.length, 1),
          label: p.name,
        }),
      }).catch(err => {
        console.warn(`[data-update] snapshot ${p.id} fehlgeschlagen`, err);
        return { synced: false } as const;
      });

      if ('timings' in r && r.timings) {
        snapAgg.manifestReadMs += r.timings.manifestReadMs;
        snapAgg.smbReadMs += r.timings.smbReadMs;
        snapAgg.parseMs += r.timings.parseMs;
        snapAgg.idbWriteMs += r.timings.idbWriteMs;
        snapAgg.listViewRebuildMs += r.timings.listViewRebuildMs;
      }

      if (r.synced) {
        result.snapshotSynced = true;
        const reloaded = 'reloadedStores' in r ? (r.reloadedStores ?? []) : [];
        await refreshAntraegeStoreAfterSync(idb, p.id, reloaded);
        if (reloaded.includes('akronym_index') || reloaded.includes('antraege')) {
          await rematchOnSnapshotReload(idb, p.id).catch(err => {
            console.warn(`[data-update] phase2 rematch ${p.id} fehlgeschlagen`, err);
            return { resolved: 0, remaining: 0 };
          });
        }
        if ('createdAt' in r && r.createdAt) {
          result.snapshotInfo.push({ programmName: p.name, createdAt: r.createdAt });
        }
      }
    }
    onPhase?.({ phase: 'snapshot', fraction: 1 });

    // ─── Phase 2: Export-CSV (Check + Import) ───────────────────────────────
    if (csvEnabled && !signal?.cancelled) {
      onPhase?.({ phase: 'csv-check', fraction: 0 });
      const tCheck = performance.now();
      const collected = await collectCandidates(idb).catch(err => {
        console.warn('[data-update] csv-check fehlgeschlagen', err);
        return null;
      });
      csvCheckMs = performance.now() - tCheck;
      onPhase?.({ phase: 'csv-check', fraction: 1 });

      if (collected && collected.candidates.length > 0 && !signal?.cancelled) {
        // Audit-/Lock-Identität: Kurator-Name wenn vorhanden, sonst Build-Label
        // (z.B. „ZAH PL") — konsistent mit der Banner-Identität (v2.16).
        const identity = (await readKuratorName(idb).catch(() => null)) ?? runtimeConfig.build.label;
        try {
          const report = await runAutoRefresh(idb, collected.candidates, {
            kuratorName: identity,
            onProgress: rp => onPhase?.({
              phase: 'csv-import',
              fraction: rp.total > 0 ? rp.index / rp.total : 0,
              // Quelle + Zähler (2/3), damit der Toast Fortschritt zeigt — der
              // Einzel-Import (Merge + Snapshot-Write) kann je Quelle Sekunden
              // dauern.
              label: rp.total > 1 ? `${rp.schemaName} (${rp.index + 1}/${rp.total})` : rp.schemaName,
            }),
          });
          result.csvReport = report;

          // In-Memory-Store je betroffenem Programm nachladen (importCsvSource
          // schreibt nur IDB; der Store hat 5-Min-TTL-Skip).
          const reloadProgrammIds = new Set<string>();
          for (const proc of report.processed) {
            const schema = await loadSchema(idb, proc.schemaId);
            if (schema) reloadProgrammIds.add(schema.programm_id);
          }
          for (const pid of reloadProgrammIds) {
            await refreshAntraegeStoreAfterSync(idb, pid, ['antraege', 'verbuende'] as const);
          }
        } catch (err) {
          if (err instanceof BuildLockBusyError) {
            // Paralleler Schreiber gewinnt — kein Fehler. Dieser Client hat den
            // (älteren) Snapshot-Stand; den neueren holt der nächste Start/Watcher.
            result.lockBusy = { blockingKurator: err.blockingKurator, ageMinutes: err.ageMinutes };
            console.info(`[data-update] csv-import: Build-Lock besetzt von ${err.blockingKurator}, übersprungen`);
          } else {
            console.warn('[data-update] csv-import fehlgeschlagen', err);
          }
        }
      }
      onPhase?.({ phase: 'csv-import', fraction: 1 });
    }

    result.totalMs = performance.now() - tTotal;
    logTiming(result, snapAgg, { checkMs: csvCheckMs, enabled: csvEnabled });
    return result;
  } finally {
    running = false;
  }
}

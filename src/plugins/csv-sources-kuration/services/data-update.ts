/**
 * Daten-Update-Orchestrator — DER eine Pfad für die Start-Datenaktualisierung
 * (pl + kurator). Sequenziert die beiden bisher getrennten Subsysteme in der
 * vom Fachbereich gewünschten Reihenfolge:
 *
 *   0. „Status-Fassung" — hat das Team eine neuere veröffentlicht, wird sie
 *      übernommen und Projektion + Store ziehen nach (`zieheFassungNach`).
 *      Vor dem Snapshot, weil dessen Projektion die Fassung liest.
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
import { ensureDefaultProgramm, listProgramme, healMissingVerbuende } from '@/core/services/csv';
import { syncProgrammSnapshot, type SnapshotTimings } from '@/core/services/csv/snapshot-sync';
import { refreshAntraegeStoreAfterSync, zieheFassungNach } from '@/plugins/antraege/snapshot-refresh';
import { rematchOnSnapshotReload } from '@/phase2';
import { resolveSnapshotAuthor } from '@/core/services/infrastructure/update-author';
import { isKuratorMenusEnabled, isCsvAutoRefreshEnabled } from '@/config/feature-flags';
import { invalidateAggregateCache } from '@/core/services/skill-feedback/cache';
import { acquireDataMutation, releaseDataMutation } from '@/core/services/csv/data-mutation-gate';
import { runAutoRefresh, collectCandidates, BuildLockBusyError, type RefreshReport } from './auto-refresh';
import type { LockBesitz } from '@/core/services/infrastructure/build-lock';

const LAST_TIMING_KEY = 'teamflow_last_data_update_timing';

export interface DataUpdatePhase {
  phase: 'snapshot' | 'csv-check' | 'csv-import' | 'publishing';
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
  lockBusy?: { blockingKurator: string; ageMinutes: number; besitz: LockBesitz };
  /**
   * Der Lauf hat gar nicht stattgefunden. Ohne dieses Feld war das Ergebnis
   * BAUGLEICH mit „geprüft, nichts gefunden" — beide Türen (● CSV-Ampel,
   * Einstellungen → Speicher) meldeten daraufhin Frische, obwohl nichts
   * geprüft wurde.
   */
  nichtGelaufen?: 'gate-belegt';
  /**
   * Mindestens ein Programm konnte seinen Snapshot nicht vollständig
   * integrieren (`SyncResult.incomplete`). Die Version wird dann bewusst NICHT
   * festgeschrieben — der nächste Lauf holt nach. Ohne dieses Feld meldete der
   * Toast Erfolg samt neuem Stand, und der Banner kam sofort wieder.
   */
  snapshotUnvollstaendig?: boolean;
  /**
   * Nummer der Status-Fassung, die dieser Lauf vom Share übernommen hat
   * (`zieheFassungNach`) — fehlt, wenn die geltende schon die des Teams war.
   */
  fassungUebernommen?: number;
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
  /**
   * „Erzwungen neu prüfen/importieren" (v2.155): umgeht den mtime/Größe/Checksum-
   * Fast-Path in der CSV-Erkennung → jede erreichbare, verknüpfte Quelle wird
   * re-importiert (der Importer difft per Row-Hash, schreibt nur bei echtem
   * Delta). Selbstbedienungs-Weg für pl gegen einen Citrix-False-Negative, ohne
   * kurator-Build. Fixtures/Permission bleiben ausgeschlossen.
   */
  forceRecheck?: boolean;
  /**
   * „Trotzdem importieren" pro Quelle — reicht die Zustimmung des Nutzers an
   * `runAutoRefresh` durch (die fehlenden Spalten werden bewusst in Kauf
   * genommen, siehe dort). Nötig, damit auch die Türen, die über DIESEN
   * Orchestrator laufen (● CSV-Dialog, Einstellungen → Speicher), einen
   * Drift-Nachlauf anbieten können statt in einer Sackgasse zu enden — der
   * Banner-Pfad ruft `runAutoRefresh` direkt und konnte es immer schon.
   */
  driftAkzeptiertFuer?: string[];
  /** Abbruch-Signal (App-Unmount / Gate öffnet wieder). */
  signal?: { cancelled: boolean };
}

function round(ms: number): number {
  return Math.round(ms);
}

function logTiming(
  result: DataUpdateResult,
  snap: SnapshotTimings,
  csv: { checkMs: number; enabled: boolean; fixtures: number; fileMissing: number; upToDate: number },
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
    // Warum evtl. 0 importiert: still-übersprungene Quellen (Fixtures ausgeschlossen,
    // Datei fehlt, als „unverändert" erkannt). fixtures>0 in prod = Fehlkonfiguration.
    + ` skipped(fixtures=${csv.fixtures} fileMissing=${csv.fileMissing} upToDate=${csv.upToDate}`
    + ` inaktivesUP=${result.csvReport?.skippedInactiveUnterprogramm ?? 0})`
    + ` zurueckgehalteneLoeschungen=${result.csvReport?.heldRemovals ?? 0}`
    + ` unbekanntesUP=${result.csvReport?.unknownUnterprogramm ?? 0}`
    // Was der Lauf am Bestand geändert, verweigert oder als abweichende Datei-Sicht
    // erkannt hat — der Produktiv-Fall Sept. 2026 stand mit `imported=3` da, ohne
    // dass die Zeile sagte, ob das Daten waren oder ein Konfigurationsproblem.
    + ` changed=${result.csvReport?.changedAntraege ?? 0}`
    + ` errors=${result.csvReport?.errors.length ?? 0}`
    + ` divergenz=${result.csvReport?.divergenzen.length ?? 0}`
    + ` veraltet=${result.csvReport?.veraltet.length ?? 0}`
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
        // Still-übersprungen (Diagnose ohne IDB-Dump): fixturesExcluded>0 in prod =
        // echte Exporte werden nie importiert (Fehlkonfiguration, 2026-06-Vorfall).
        fixturesExcluded: csv.fixtures,
        fileMissing: csv.fileMissing,
        upToDate: csv.upToDate,
        // >0 = Master-Import verwirft Anträge wegen inaktivem/unbekanntem
        // Unterprogramm-Code (leerer/lückenhafter unterprogramme-Store).
        skippedInactiveUnterprogramm: result.csvReport?.skippedInactiveUnterprogramm ?? 0,
        // >0 = eine Quelle hat Zeilen verloren, die eine andere noch trägt; der
        // Antrag bleibt stehen, bis er überall weg ist.
        heldRemovals: result.csvReport?.heldRemovals ?? 0,
        // >0 = Codes im Export, die der Katalog nicht kennt: nicht importiert,
        // aber auch nicht gelöscht.
        unknownUnterprogramm: result.csvReport?.unknownUnterprogramm ?? 0,
        // Inhaltlich geänderte Anträge, abgewiesene Quellen, abweichende Datei-Sichten.
        changedAntraege: result.csvReport?.changedAntraege ?? 0,
        errors: result.csvReport?.errors.length ?? 0,
        divergenzen: result.csvReport?.divergenzen.length ?? 0,
        veraltet: result.csvReport?.veraltet.length ?? 0,
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
  const { onPhase, includeCsv = true, forceRecheck = false, driftAkzeptiertFuer, signal } = opts;
  const result: DataUpdateResult = { snapshotSynced: false, snapshotInfo: [], totalMs: 0 };
  // Geteiltes In-Tab-Gate: Start-Sync + Watcher-Banner + CSV-Banner + Sidebar/
  // Einstellungen dürfen sich nicht überlappen (paralleles clear()/put() +
  // atomicWrite-Rennen auf denselben Stores/Share-Dateien). Der zweite Aufruf
  // wird zum No-Op (leeres Result). Ersetzt die frühere modulweite `running`-Flag,
  // die NUR runDataUpdate schützte — die Banner-CTAs liefen daran vorbei.
  if (!acquireDataMutation()) return { ...result, nichtGelaufen: 'gate-belegt' };

  const tTotal = performance.now();
  const snapAgg: SnapshotTimings = {
    manifestReadMs: 0, smbReadMs: 0, parseMs: 0, idbWriteMs: 0, listViewRebuildMs: 0,
  };
  let csvCheckMs = 0;
  // Still-übersprungene Quellen für die Diagnose-Zeile (warum wurde 0 importiert):
  // Fixtures (ausgeschlossen), fehlende Dateien, als „unverändert" erkannte.
  const csvSkips = { fixtures: 0, fileMissing: 0, upToDate: 0 };
  // Build-konstante Gate: CSV-Import nur in pl (csvAutoRefresh) + kurator
  // (kuratorMenus) — identisch zur Banner-Sichtbarkeit in ShellLayout. Prod
  // (End-User) bekommt nur Snapshot-Sync wie bisher.
  const csvEnabled = includeCsv && (isKuratorMenusEnabled() || isCsvAutoRefreshEnabled());

  try {
    // ─── Phase 0: Status-Fassung ───────────────────────────────────────────
    // Vor dem Snapshot: die Projektion löst ihre Ordner-Spalten aus der aktiven
    // Fassung auf. Billig, wenn nichts neu ist (4 KB Dateikopf).
    await ensureDefaultProgramm(idb);
    const fassung = await zieheFassungNach(idb);
    if (fassung !== null) result.fassungUebernommen = fassung;

    // ─── Phase 1: Datenbestand (Snapshot) ──────────────────────────────────
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

      if ('incomplete' in r && r.incomplete) result.snapshotUnvollstaendig = true;

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

      // Self-Heal des abgeleiteten verbuende-Caches — UNABHÄNGIG von r.synced,
      // weil ein leerer/gestrandeter Cache gerade dann bestehen bleibt, wenn der
      // Sync idempotent übersprungen wurde (sonst zeigt jede Verbund-Detailseite
      // „nicht gefunden"). Billig, wenn der Cache schon vorhanden ist.
      await healMissingVerbuende(idb, p.id).catch(err =>
        console.warn(`[data-update] verbuende self-heal ${p.id} fehlgeschlagen`, err),
      );
    }
    onPhase?.({ phase: 'snapshot', fraction: 1 });

    // ─── Phase 2: Export-CSV (Check + Import) ───────────────────────────────
    if (csvEnabled && !signal?.cancelled) {
      onPhase?.({ phase: 'csv-check', fraction: 0 });
      const tCheck = performance.now();
      const collected = await collectCandidates(idb, { forceRecheck }).catch(err => {
        console.warn('[data-update] csv-check fehlgeschlagen', err);
        return null;
      });
      csvCheckMs = performance.now() - tCheck;
      if (collected) {
        csvSkips.fixtures = collected.fixtures.length;
        csvSkips.fileMissing = collected.fileMissing.length;
        csvSkips.upToDate = collected.upToDate.length;
      }
      onPhase?.({ phase: 'csv-check', fraction: 1 });

      if (collected && collected.candidates.length > 0 && !signal?.cancelled) {
        // Urheber-Identität fürs Snapshot-`createdBy` (Anzeige „… von X"):
        // Kurator-Name → echtes Profil-Kürzel → Nachname (persönl. Ordner) →
        // Build-Label → „unbekannt". In pl/as ist das Kürzel meist „alle" und es
        // gibt keinen Kurator-Namen → ohne den Nachname-Fallback sähe niemand,
        // WER aktualisiert hat (resolveSnapshotAuthor).
        const identity = await resolveSnapshotAuthor(idb);
        try {
          const report = await runAutoRefresh(idb, collected.candidates, {
            kuratorName: identity,
            // Der Nachlauf gilt genau den Quellen, die der Nutzer im Bericht
            // abgenickt hat — die Zustimmung ist die Auswahl selbst.
            ...(driftAkzeptiertFuer ? { driftAkzeptiertFuer } : {}),
            // Nach den Merges, VOR dem Publish: In-Memory-Store je betroffenem
            // Programm nachladen → der lokale User sieht die neuen Anträge sofort
            // (importCsvSource schreibt nur IDB; der Store hat 5-Min-TTL-Skip).
            onAfterMerge: async programmIds => {
              for (const pid of programmIds) {
                await refreshAntraegeStoreAfterSync(idb, pid, ['antraege', 'verbuende'] as const);
              }
            },
            onProgress: rp => onPhase?.(rp.phase === 'publishing'
              ? { phase: 'publishing', fraction: 1 }
              : {
                  phase: 'csv-import',
                  fraction: rp.total > 0 ? rp.index / rp.total : 0,
                  // Quelle + Zähler (2/3), damit der Toast Fortschritt zeigt — der
                  // Einzel-Import (Merge) kann je Quelle Sekunden dauern.
                  label: rp.total > 1 ? `${rp.schemaName} (${rp.index + 1}/${rp.total})` : rp.schemaName,
                }),
          });
          result.csvReport = report;
        } catch (err) {
          if (err instanceof BuildLockBusyError) {
            // Paralleler Schreiber gewinnt — kein Fehler. Dieser Client hat den
            // (älteren) Snapshot-Stand; den neueren holt der nächste Start/Watcher.
            result.lockBusy = {
              blockingKurator: err.blockingKurator,
              ageMinutes: err.ageMinutes,
              besitz: err.besitz,
            };
            console.info(
              `[data-update] csv-import: Build-Lock besetzt (${err.besitz}: ${err.blockingKurator}), übersprungen`,
            );
          } else {
            console.warn('[data-update] csv-import fehlgeschlagen', err);
          }
        }
      }
      onPhase?.({ phase: 'csv-import', fraction: 1 });
    }

    // Skill-Feedback-Aggregat invalidieren: nach dem Share-Sync können neue
    // Signal-Dateien anderer Nutzer auf der Share liegen → der nächste
    // readAggregate rechnet frisch (best-effort, kippt den Update nie).
    await invalidateAggregateCache(idb);

    result.totalMs = performance.now() - tTotal;
    logTiming(result, snapAgg, { checkMs: csvCheckMs, enabled: csvEnabled, ...csvSkips });
    return result;
  } finally {
    releaseDataMutation();
  }
}

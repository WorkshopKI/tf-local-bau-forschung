/**
 * Kurator-Card im Suchindex-Plugin: startet die Phase-2-Dokumenten-Triage
 * ueber die vom Dev konfigurierten Pfade. Keine Pfad-Auswahl im UI — die
 * Konfiguration kommt aus dem IDB-Store phase2_scan_config (Dev-Domaene).
 *
 * Pipeline: DMS-Index laden -> Scanner -> bulkScanFiles. Live-Progress mit
 * Abbrechen-Button.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileSearch, Loader2, Square } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { computeEta, formatDuration } from '@/core/utils/eta';
import {
  getDatenShareHandle,
  getDokumentenquelleHandle,
} from '@/core/services/infrastructure/smb-handle';
import { scanConfig } from '@/config/feature-flags';
import {
  BulkRunLogger,
  CLASSIFIER_VERSION,
  bulkScanFiles,
  getScanConfig,
  listManifestEntries,
  listParseErrorManifests,
  loadDmsCsvFromShare,
  makeLoadBlobFromHandle,
  mirrorManifestToShare,
  prepareErrorRetry,
  scanDocSource,
  type BulkScanStats,
} from '@/phase2';
import type { AktenplanLookup, DmsEntry } from '@/phase2/types';

export function Phase2RescanCard(): React.ReactElement {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);

  const [pathCount, setPathCount] = useState<number | null>(null);
  const [manifestCount, setManifestCount] = useState<number | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<BulkScanStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [tick, setTick] = useState<number>(Date.now());
  const abortRef = useRef<AbortController | null>(null);

  // 1Hz-Tick fuer Live-ETA waehrend des Runs.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const refreshCounts = useCallback(async (): Promise<void> => {
    try {
      const [cfg, entries, errs] = await Promise.all([
        getScanConfig(storage.idb),
        listManifestEntries(storage.idb),
        listParseErrorManifests(storage.idb),
      ]);
      setPathCount(cfg?.selected_paths.length ?? 0);
      setManifestCount(entries.length);
      setErrorCount(errs.length);
    } catch (e) {
      setError(`Status konnte nicht gelesen werden: ${(e as Error).message}`);
    }
  }, [storage.idb]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  const onStart = useCallback(async (): Promise<void> => {
    setError(null);
    setInfo(null);
    setStats(null);

    if (!activeProgrammId) {
      setError('Kein aktives Programm — bitte erst eines im Sidebar-Switcher waehlen.');
      return;
    }
    const datenShare = await getDatenShareHandle(storage.idb);
    if (!datenShare) {
      setError('Kein Daten-Share-Handle. Onboarding nicht abgeschlossen?');
      return;
    }
    const dokQuelle = await getDokumentenquelleHandle(storage.idb);
    if (!dokQuelle) {
      setError('Kein Dokumentenquelle-Handle — muss vom Dev im Infra-Panel verbunden werden.');
      return;
    }
    const cfg = await getScanConfig(storage.idb);
    const paths = cfg?.selected_paths ?? [];
    if (paths.length === 0) {
      setError('Keine Pfade konfiguriert — der Dev muss im Infra-Panel die Sub-Roots waehlen.');
      return;
    }

    if (!scanConfig.file_extensions || scanConfig.file_extensions.length === 0) {
      setError('Build-Config: scan.file_extensions ist leer.');
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setLogPath(null);

    try {
      // 1. DMS-Index laden (kann ~30 s dauern bei 1M Zeilen)
      setInfo('DMS-Index wird geladen…');
      const dms = await loadDmsCsvFromShare(datenShare);
      if (ctrl.signal.aborted) return;

      // 2. Scanner ueber konfigurierte Pfade
      setInfo('Verzeichnisse werden gescannt…');
      const files = await scanDocSource(dokQuelle, {
        sub_roots: paths,
        file_extensions: scanConfig.file_extensions,
        max_depth: scanConfig.max_depth ?? 20,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      setInfo(null);

      if (files.length === 0) {
        setError('Scanner hat keine Dateien gefunden — Pfade pruefen.');
        return;
      }

      // 3. Run-Logger fuer persistentes Crash-sicheres Logging
      let runLog: BulkRunLogger | undefined;
      try {
        runLog = await BulkRunLogger.create(
          datenShare,
          paths,
          files.length,
          CLASSIFIER_VERSION,
        );
        setLogPath(runLog.relPath);
      } catch (logErr) {
        console.warn('[phase2] Run-Logger konnte nicht erstellt werden', logErr);
      }

      // 4. Bulk-Triage (idempotent dank IDB-Schnellpfaden)
      const ak: Map<string, AktenplanLookup> = dms.aktenplan ?? new Map();
      const dmsMap: Map<string, DmsEntry> = dms.entries ?? new Map();
      const ctx = {
        idb: storage.idb,
        programmId: activeProgrammId,
        dmsMap,
        aktenplan: ak,
        llmTransport: null,
      };
      const loadBlob = makeLoadBlobFromHandle(dokQuelle);
      const final = await bulkScanFiles({
        ctx,
        files,
        loadBlob,
        signal: ctrl.signal,
        progressEvery: 25,
        runLog,
        onProgress: s => setStats({ ...s }),
      });
      setStats({ ...final });
      await refreshCounts();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('aborted')) {
        setInfo(null);
      } else {
        setError(`Triage-Fehler: ${msg}`);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [activeProgrammId, storage.idb, refreshCounts]);

  const onAbort = (): void => {
    abortRef.current?.abort();
  };

  const onRetryErrors = useCallback(async (): Promise<void> => {
    setError(null);
    setInfo(null);
    setStats(null);
    setLogPath(null);

    if (!activeProgrammId) {
      setError('Kein aktives Programm.');
      return;
    }
    const datenShare = await getDatenShareHandle(storage.idb);
    if (!datenShare) {
      setError('Kein Daten-Share-Handle.');
      return;
    }
    const dokQuelle = await getDokumentenquelleHandle(storage.idb);
    if (!dokQuelle) {
      setError('Kein Dokumentenquelle-Handle.');
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);

    try {
      setInfo('Sammle parse_error-Manifests…');
      const prep = await prepareErrorRetry(storage.idb);
      if (prep.files.length === 0) {
        setInfo('Keine parse_error-Manifests gefunden.');
        await refreshCounts();
        return;
      }

      setInfo('DMS-Index wird geladen…');
      const dms = await loadDmsCsvFromShare(datenShare);
      if (ctrl.signal.aborted) return;
      setInfo(null);

      let runLog: BulkRunLogger | undefined;
      try {
        runLog = await BulkRunLogger.create(
          datenShare,
          ['__retry_errors__'],
          prep.files.length,
          CLASSIFIER_VERSION,
        );
        setLogPath(runLog.relPath);
      } catch (logErr) {
        console.warn('[phase2] Run-Logger konnte nicht erstellt werden', logErr);
      }

      const ctx = {
        idb: storage.idb,
        programmId: activeProgrammId,
        dmsMap: dms.entries ?? new Map<string, DmsEntry>(),
        aktenplan: dms.aktenplan ?? new Map<string, AktenplanLookup>(),
        llmTransport: null,
      };
      const loadBlob = makeLoadBlobFromHandle(dokQuelle);
      const final = await bulkScanFiles({
        ctx,
        files: prep.files,
        loadBlob,
        signal: ctrl.signal,
        progressEvery: 25,
        runLog,
        onProgress: s => setStats({ ...s }),
      });
      setStats({ ...final });
      await refreshCounts();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('aborted')) {
        setInfo(null);
      } else {
        setError(`Retry-Fehler: ${msg}`);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [activeProgrammId, storage.idb, refreshCounts]);

  const onMirror = useCallback(async (): Promise<void> => {
    setMirrorBusy(true);
    setError(null);
    try {
      const datenShare = await getDatenShareHandle(storage.idb);
      if (!datenShare) {
        setError('Kein Daten-Share-Handle.');
        return;
      }
      const r = await mirrorManifestToShare(storage.idb, datenShare);
      const kb = (r.bytes / 1024).toFixed(1);
      setInfo(`Manifest gespiegelt: ${r.entries} Eintraege (${kb} KB) → ${r.path}`);
    } catch (e) {
      setError(`Mirror-Fehler: ${(e as Error).message}`);
    } finally {
      setMirrorBusy(false);
    }
  }, [storage.idb]);

  const noPathsConfigured = pathCount !== null && pathCount === 0;

  return (
    <div
      className="p-[14px] rounded-[var(--tf-radius)] space-y-3"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--tf-text)] flex items-center gap-1.5">
            <FileSearch className="h-3.5 w-3.5" />
            Dokumenten-Triage
          </p>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            {pathCount === null
              ? 'lade Status…'
              : noPathsConfigured
                ? 'Keine Pfade konfiguriert — Dev muss im Infra-Panel die Sub-Roots waehlen.'
                : `${pathCount} Pfad${pathCount === 1 ? '' : 'e'} konfiguriert · ${(manifestCount ?? 0).toLocaleString('de-DE')} Dateien klassifiziert${errorCount > 0 ? ` · ${errorCount.toLocaleString('de-DE')} mit parse_error` : ''}`}
          </p>
        </div>
      </div>

      {!running && !stats && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void onStart()}
            disabled={running || noPathsConfigured || pathCount === null}
            icon={FileSearch}
          >
            Triage neu starten
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onRetryErrors()}
            disabled={running || errorCount === 0}
            title={errorCount === 0 ? 'Keine parse_error-Manifests' : undefined}
          >
            Nur Errors retriagieren ({errorCount.toLocaleString('de-DE')})
          </Button>
          <Button
            variant="secondary"
            onClick={() => void onMirror()}
            disabled={mirrorBusy || (manifestCount ?? 0) === 0}
            loading={mirrorBusy}
          >
            Manifest auf Share spiegeln
          </Button>
        </div>
      )}

      {running && (
        <div className="space-y-2">
          {info && (
            <p className="text-[12px] text-[var(--tf-text-secondary)] flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {info}
            </p>
          )}
          {stats && (
            <>
              <div className="h-2 w-full overflow-hidden rounded bg-[var(--tf-bg-secondary)]">
                <div
                  className="h-full bg-[var(--tf-primary)] transition-[width] duration-200"
                  style={{
                    width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--tf-text-secondary)]">
                <span>{stats.done.toLocaleString('de-DE')}/{stats.total.toLocaleString('de-DE')}</span>
                <span>cache(skip): {stats.cache_hit_skip}</span>
                <span>cache(manifest): {stats.cache_hit_manifest}</span>
                <span>relevant: {stats.classified_relevant}</span>
                <span>irrelevant: {stats.classified_irrelevant}</span>
                <span>pending: {stats.classified_pending}</span>
                <span>review: {stats.classified_review}</span>
                <span className={stats.errors > 0 ? 'text-amber-700' : ''}>
                  errors: {stats.errors}
                </span>
              </div>
              {(() => {
                const startedAtMs = new Date(stats.started_at).getTime();
                const elapsedMs = Math.max(0, tick - startedAtMs);
                const ratePerSec = elapsedMs > 0 ? (stats.done * 1000) / elapsedMs : 0;
                const eta = computeEta(elapsedMs, stats.done, stats.total);
                return (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--tf-text-secondary)]">
                    <span>{ratePerSec.toFixed(1)} Files/s</span>
                    <span>vergangen: {formatDuration(elapsedMs)}</span>
                    {eta && <span className="text-[var(--tf-text)] font-medium">{eta}</span>}
                  </div>
                );
              })()}
              {stats.current_file && (
                <div className="truncate text-[11px] text-[var(--tf-text-tertiary)]">
                  aktuell: {stats.current_file}
                </div>
              )}
            </>
          )}
          <Button variant="danger" onClick={onAbort} icon={Square}>
            Abbrechen
          </Button>
        </div>
      )}

      {!running && stats && (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded bg-[var(--tf-bg-secondary)]">
            <div
              className="h-full bg-[var(--tf-primary)]"
              style={{
                width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            {stats.aborted ? 'Abgebrochen — ' : 'Fertig — '}
            {stats.classified_relevant + stats.classified_irrelevant
              + stats.classified_pending + stats.classified_review} klassifiziert,{' '}
            {stats.cache_hit_skip + stats.cache_hit_manifest} aus Cache,{' '}
            {stats.errors} Fehler.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void onStart()} icon={FileSearch}>
              Erneut starten
            </Button>
            <Button
              variant="secondary"
              onClick={() => void onMirror()}
              disabled={mirrorBusy || (manifestCount ?? 0) === 0}
              loading={mirrorBusy}
            >
              Manifest auf Share spiegeln
            </Button>
          </div>
        </div>
      )}

      {logPath && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">
          Run-Log: <code>{logPath}</code> (auf dem Daten-Share, ueberlebt Tab-Crash)
        </p>
      )}
      {error && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">{error}</p>
      )}
      {info && !running && (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">{info}</p>
      )}
    </div>
  );
}

/**
 * State-Machine und Handler-Sammlung fuer das Phase-2 Triage-Test-Panel.
 *
 * Aus `TriagePanel.tsx` extrahiert (CLAUDE.md File-Size-Regel). Der TriagePanel
 * konsumiert dieses Hook und rendert nur noch JSX. Die ~14 useState-Slots, drei
 * useEffects und ein Dutzend asynchrone Handler bilden eine in sich geschlossene
 * State-Machine — Aufteilung in Sub-Hooks ist hier kuenstlich, weil viele Actions
 * lesend/schreibend auf denselben State (dmsMap, scanFiles, bulkStats, abortRef)
 * zugreifen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import {
  getSmbHandle,
  getDatenShareHandle,
  getDmsSourceHandle,
} from '@/core/services/infrastructure/smb-handle';
import {
  listDmsSources,
  type DmsSourceEntry,
} from '@/core/services/dms-sources';
import { scanConfig } from '@/config/feature-flags';
import {
  loadDmsCsvFromShare,
  triageFile,
  listAllSkipEntries,
  listAllPending,
  clearAllPending,
  resetSkipListByVersion,
  cleanDocId,
  getLastParseDmsCsvStats,
  scanDocSource,
  bulkScanFiles,
  mirrorManifestToShare,
  makeLoadBlobFromHandle,
  getLastScanRun,
  recordScanRun,
  BulkRunLogger,
  CLASSIFIER_VERSION,
  listParseErrorManifests,
  prepareErrorRetry,
  listManifestEntries,
  clearAllManifest,
  type ScanFile,
  type ManifestEntry,
  type BulkScanStats,
} from '@/phase2';
import { formatDuration } from '@/core/utils/eta';
import type { AktenplanLookup, DmsEntry } from '@/phase2/types';

export interface ScanProgressState {
  filesSoFar: number;
  dir: string;
  startedAt: number;
  estimatedTotal: number | null;
  lastTick: number;
}

export interface UseTriagePanelResult {
  // Identitaet & Diagnose
  activeProgrammId: string | null;
  activeProgrammName: string | null;
  // DMS-Index
  dmsMap: Map<string, DmsEntry> | null;
  aktenplan: Map<string, AktenplanLookup> | null;
  dmsSource: 'shared' | 'absent' | null;
  // Sources
  sources: DmsSourceEntry[];
  selectedSourceId: string | null;
  selectedSource: DmsSourceEntry | null;
  selectedRoots: readonly string[];
  setSelectedSourceId: (id: string | null) => void;
  // Counter-Cards
  skipCount: number;
  pendingCount: number;
  manifestCount: number;
  errorCount: number;
  // Run-State
  scanFiles: ScanFile[] | null;
  scanRunning: boolean;
  scanProgress: ScanProgressState | null;
  bulkStats: BulkScanStats | null;
  bulkRunning: boolean;
  bulkTick: number;
  // UI-Helfer
  busy: boolean;
  mirrorBusy: boolean;
  lookupQuery: string;
  setLookupQuery: (q: string) => void;
  lastManifest: ManifestEntry | null;
  logLines: string[];
  // Actions
  onLoadDmsIndex: () => Promise<void>;
  onPickAndTriage: () => Promise<void>;
  onScanRoots: () => Promise<void>;
  onAbortScan: () => void;
  onBulkTriage: () => Promise<void>;
  onAbortBulk: () => void;
  onRetryErrors: () => Promise<void>;
  onMirrorManifest: () => Promise<void>;
  onShowSkipList: () => Promise<void>;
  onShowPending: () => Promise<void>;
  onClearSkipList: () => Promise<void>;
  onClearPending: () => Promise<void>;
  onClearManifest: () => Promise<void>;
  onFullReset: () => Promise<void>;
  onLookupDocId: () => void;
}

export function useTriagePanel(): UseTriagePanelResult {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const programme = useActiveProgramm(s => s.programme);
  const activeProgrammName = programme.find(p => p.id === activeProgrammId)?.name ?? null;

  const [dmsMap, setDmsMap] = useState<Map<string, DmsEntry> | null>(null);
  const [aktenplan, setAktenplan] = useState<Map<string, AktenplanLookup> | null>(null);
  const [dmsSource, setDmsSource] = useState<'shared' | 'absent' | null>(null);
  const [lastManifest, setLastManifest] = useState<ManifestEntry | null>(null);
  const [skipCount, setSkipCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lookupQuery, setLookupQuery] = useState<string>('');

  const [scanFiles, setScanFiles] = useState<ScanFile[] | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressState | null>(null);
  const [bulkStats, setBulkStats] = useState<BulkScanStats | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkTick, setBulkTick] = useState<number>(Date.now());
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [manifestCount, setManifestCount] = useState<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  const [sources, setSources] = useState<DmsSourceEntry[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const selectedSource = selectedSourceId
    ? sources.find(s => s.id === selectedSourceId) ?? null
    : null;
  const selectedRoots = selectedSource?.sub_roots ?? [];

  useEffect(() => {
    if (!scanProgress) return;
    const id = setInterval(() => {
      setScanProgress(p => (p ? { ...p, lastTick: Date.now() } : p));
    }, 1000);
    return () => clearInterval(id);
  }, [scanProgress !== null]);

  useEffect(() => {
    if (!bulkRunning) return;
    const id = setInterval(() => setBulkTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [bulkRunning]);

  const log = useCallback((s: string) => {
    setLogLines(prev => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${s}`]);
  }, []);

  const refreshCounts = useCallback(async () => {
    const skip = await listAllSkipEntries(storage.idb);
    setSkipCount(skip.length);
    const pending = await listAllPending(storage.idb);
    setPendingCount(pending.length);
    const errs = await listParseErrorManifests(storage.idb);
    setErrorCount(errs.length);
    const manifests = await listManifestEntries(storage.idb);
    setManifestCount(manifests.length);
  }, [storage.idb]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    void (async () => {
      const all = await listDmsSources(storage.idb);
      setSources(all);
      if (all.length === 0) {
        setSelectedSourceId(null);
        return;
      }
      const preferred = all.find(s => s.is_active) ?? all[0];
      setSelectedSourceId(preferred?.id ?? null);
    })();
  }, [storage.idb]);

  const onLoadDmsIndex = async (): Promise<void> => {
    setBusy(true);
    log('Lade DMS-Index — kann bei großen CSVs (~1M Zeilen) 10–30 s dauern…');
    try {
      const handle = await getSmbHandle(storage.idb);
      if (!handle) {
        log('Kein Daten-Share-Handle. Erst SMB-Panel verbinden.');
        return;
      }
      const r = await loadDmsCsvFromShare(handle);
      setDmsMap(r.entries);
      setAktenplan(r.aktenplan);
      setDmsSource(r.source);
      log(`DMS-Index geladen: ${r.entries.size} Einträge (source=${r.source}).`);
      const stats = getLastParseDmsCsvStats();
      if (stats) {
        log(`  ${stats.skippedEmpty} Zeilen mit leerer DocID übersprungen.`);
        log(`  Erste 3 Map-Keys: ${stats.firstKeys.join(', ') || '(leer)'}`);
      }
    } catch (e) {
      log(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onPickAndTriage = async (): Promise<void> => {
    if (!activeProgrammId) {
      log('Kein aktives Programm — bitte erst eines im Sidebar-Switcher auswählen.');
      return;
    }
    setBusy(true);
    try {
      const win = window as unknown as {
        showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
      };
      if (!win.showOpenFilePicker) {
        log('File System Access API nicht verfügbar.');
        return;
      }
      const [fh] = await win.showOpenFilePicker({
        types: [{ description: 'PDF / DOCX', accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }],
        multiple: false,
      });
      if (!fh) return;
      const file = await fh.getFile();
      const scanFile: ScanFile = {
        filename: file.name,
        filepath: file.name,
        size_bytes: file.size,
        mtime: new Date(file.lastModified).toISOString(),
      };

      const map = dmsMap ?? new Map<string, DmsEntry>();
      const ak = aktenplan ?? new Map<string, AktenplanLookup>();
      const r = await triageFile(
        {
          idb: storage.idb,
          programmId: activeProgrammId,
          dmsMap: map,
          aktenplan: ak,
          llmTransport: null,
        },
        scanFile,
        async () => file,
      );
      setLastManifest(r.manifest);
      log(`Triage abgeschlossen: ${r.manifest.doc_type} / ${r.manifest.triage_state} (Stage ${r.manifest.triage_stage}, Source ${r.manifest.triage_source})`);
      await refreshCounts();
    } catch (e) {
      log(`Fehler: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onScanRoots = async (): Promise<void> => {
    setScanRunning(true);
    setScanFiles(null);
    setScanProgress(null);
    try {
      if (!selectedSourceId) {
        log('Keine DMS-Quelle gewaehlt. Im Plugin „Dokumentenquellen" verbinden.');
        return;
      }
      const handle = await getDmsSourceHandle(storage.idb, selectedSourceId);
      if (!handle) {
        log(`DMS-Quelle "${selectedSource?.label ?? selectedSourceId}" nicht verbunden.`);
        return;
      }
      if (!scanConfig.file_extensions || scanConfig.file_extensions.length === 0) {
        log('scanConfig.file_extensions ist leer — Build-Config pruefen.');
        return;
      }

      const lastRun = await getLastScanRun(storage.idb, selectedRoots);
      const estimatedTotal = lastRun?.total ?? null;
      const startedAt = Date.now();
      setScanProgress({ filesSoFar: 0, dir: '', startedAt, estimatedTotal, lastTick: startedAt });
      if (estimatedTotal !== null) {
        log(`Scan startet — letzter Run: ${estimatedTotal.toLocaleString('de-DE')} Dateien in ${formatDuration(lastRun!.duration_ms)}`);
      } else {
        log('Scan startet — kein vorheriger Run, ETA wird erst beim naechsten Mal verfuegbar.');
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const files = await scanDocSource(handle, {
        sub_roots: selectedRoots,
        file_extensions: scanConfig.file_extensions,
        max_depth: scanConfig.max_depth ?? 20,
        signal: ctrl.signal,
        onProgress: info => {
          setScanProgress(p => p && {
            ...p,
            filesSoFar: info.filesSoFar,
            dir: info.dir,
            lastTick: Date.now(),
          });
          if (info.filesSoFar > 0 && info.filesSoFar % 1000 === 0) {
            log(`[scan] ${info.dir}: ${info.filesSoFar.toLocaleString('de-DE')} Dateien bisher`);
          }
        },
      });
      abortRef.current = null;
      const durationMs = Date.now() - startedAt;
      setScanFiles(files);
      log(`Scan abgeschlossen: ${files.length.toLocaleString('de-DE')} Dateien in ${formatDuration(durationMs)}.`);
      try {
        await recordScanRun(storage.idb, selectedRoots, files.length, durationMs);
      } catch (e) {
        console.warn('[phase2] recordScanRun fehlgeschlagen', e);
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('aborted')) {
        log('Scan abgebrochen.');
      } else {
        log(`Scan-Fehler: ${msg}`);
      }
    } finally {
      setScanRunning(false);
      setScanProgress(null);
      abortRef.current = null;
    }
  };

  const onAbortScan = (): void => {
    abortRef.current?.abort();
  };

  const onBulkTriage = async (): Promise<void> => {
    if (!activeProgrammId) {
      log('Kein aktives Programm — bitte erst eines im Sidebar-Switcher auswaehlen.');
      return;
    }
    if (!scanFiles || scanFiles.length === 0) {
      log('Keine Dateiliste — erst „Roots scannen".');
      return;
    }
    if (!dmsMap) {
      log('DMS-Index nicht geladen — erst „Index laden".');
      return;
    }
    if (!selectedSourceId) {
      log('Keine DMS-Quelle gewaehlt.');
      return;
    }
    const handle = await getDmsSourceHandle(storage.idb, selectedSourceId);
    if (!handle) {
      log(`DMS-Quelle "${selectedSource?.label ?? selectedSourceId}" nicht verbunden.`);
      return;
    }

    const map = dmsMap;
    const ak = aktenplan ?? new Map<string, AktenplanLookup>();
    const ctx = {
      idb: storage.idb,
      programmId: activeProgrammId,
      dmsMap: map,
      aktenplan: ak,
      llmTransport: null,
    };

    const loadBlob = makeLoadBlobFromHandle(handle);

    let runLog: BulkRunLogger | undefined;
    try {
      const datenShare = await getDatenShareHandle(storage.idb);
      if (datenShare) {
        runLog = await BulkRunLogger.create(
          datenShare, selectedRoots, scanFiles.length, CLASSIFIER_VERSION,
        );
        log(`Run-Log: ${runLog.relPath}`);
      } else {
        log('Run-Log deaktiviert (kein Daten-Share).');
      }
    } catch (e) {
      log(`Run-Log konnte nicht erstellt werden: ${(e as Error).message}`);
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBulkRunning(true);
    setBulkStats(null);
    log(`Bulk-Triage gestartet: ${scanFiles.length.toLocaleString('de-DE')} Dateien.`);

    try {
      let lastLogged = 0;
      const final = await bulkScanFiles({
        ctx, files: scanFiles, loadBlob,
        signal: ctrl.signal, progressEvery: 25, runLog,
        onProgress: (s, lastError) => {
          setBulkStats({ ...s });
          if (lastError) {
            log(`[error] ${lastError}`);
          } else if (s.done - lastLogged >= 200) {
            lastLogged = s.done;
            log(`[bulk] ${s.done}/${s.total} (cache=${s.cache_hit_skip + s.cache_hit_manifest}, errors=${s.errors})`);
          }
        },
      });
      log(
        `Bulk-Triage ${final.aborted ? 'abgebrochen' : 'fertig'}: ` +
        `done=${final.done}/${final.total}, ` +
        `cache(skip)=${final.cache_hit_skip}, cache(manifest)=${final.cache_hit_manifest}, ` +
        `relevant=${final.classified_relevant}, irrelevant=${final.classified_irrelevant}, ` +
        `pending=${final.classified_pending}, review=${final.classified_review}, ` +
        `errors=${final.errors}`
      );
      await refreshCounts();
    } catch (e) {
      log(`Bulk-Fehler: ${(e as Error).message}`);
    } finally {
      setBulkRunning(false);
      abortRef.current = null;
    }
  };

  const onAbortBulk = (): void => {
    abortRef.current?.abort();
  };

  const onRetryErrors = async (): Promise<void> => {
    if (!activeProgrammId) {
      log('Kein aktives Programm.');
      return;
    }
    if (!dmsMap) {
      log('DMS-Index nicht geladen — erst „Index laden".');
      return;
    }
    if (!selectedSourceId) {
      log('Keine DMS-Quelle gewaehlt.');
      return;
    }
    const handle = await getDmsSourceHandle(storage.idb, selectedSourceId);
    if (!handle) {
      log(`DMS-Quelle "${selectedSource?.label ?? selectedSourceId}" nicht verbunden.`);
      return;
    }

    log('Sammle parse_error-Manifests…');
    const prep = await prepareErrorRetry(storage.idb);
    if (prep.files.length === 0) {
      log('Keine parse_error-Manifests gefunden.');
      await refreshCounts();
      return;
    }
    log(`${prep.cleared.toLocaleString('de-DE')} Manifest-Eintraege geloescht — werden jetzt neu triagiert.`);

    const ctx = {
      idb: storage.idb,
      programmId: activeProgrammId,
      dmsMap,
      aktenplan: aktenplan ?? new Map<string, AktenplanLookup>(),
      llmTransport: null,
    };
    const loadBlob = makeLoadBlobFromHandle(handle);

    let runLog: BulkRunLogger | undefined;
    try {
      const datenShare = await getDatenShareHandle(storage.idb);
      if (datenShare) {
        runLog = await BulkRunLogger.create(
          datenShare, ['__retry_errors__'], prep.files.length, CLASSIFIER_VERSION,
        );
        log(`Retry-Run-Log: ${runLog.relPath}`);
      }
    } catch (e) {
      log(`Run-Log konnte nicht erstellt werden: ${(e as Error).message}`);
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBulkRunning(true);
    setBulkStats(null);

    try {
      let lastLogged = 0;
      const final = await bulkScanFiles({
        ctx, files: prep.files, loadBlob,
        signal: ctrl.signal, progressEvery: 25, runLog,
        onProgress: (s, lastError) => {
          setBulkStats({ ...s });
          if (lastError) {
            log(`[retry-error] ${lastError}`);
          } else if (s.done - lastLogged >= 50) {
            lastLogged = s.done;
            log(`[retry] ${s.done}/${s.total} errors=${s.errors}`);
          }
        },
      });
      log(
        `Retry ${final.aborted ? 'abgebrochen' : 'fertig'}: ` +
        `${final.done}/${final.total}, errors=${final.errors}, ` +
        `relevant=${final.classified_relevant}, irrelevant=${final.classified_irrelevant}`
      );
      await refreshCounts();
    } catch (e) {
      log(`Retry-Fehler: ${(e as Error).message}`);
    } finally {
      setBulkRunning(false);
      abortRef.current = null;
    }
  };

  const onMirrorManifest = async (): Promise<void> => {
    setMirrorBusy(true);
    try {
      const datenShare = await getDatenShareHandle(storage.idb);
      if (!datenShare) {
        log('Kein Daten-Share-Handle — erst SMB-Panel verbinden.');
        return;
      }
      const r = await mirrorManifestToShare(storage.idb, datenShare);
      const kb = (r.bytes / 1024).toFixed(1);
      log(`Manifest gespiegelt: ${r.entries} Eintraege (${kb} KB) → ${r.path}`);
    } catch (e) {
      log(`Mirror-Fehler: ${(e as Error).message}`);
    } finally {
      setMirrorBusy(false);
    }
  };

  const onShowSkipList = async (): Promise<void> => {
    const items = await listAllSkipEntries(storage.idb);
    log(`Skip-Liste: ${items.length} Einträge`);
    items.slice(0, 10).forEach(e => log(`  - ${e.filename} → ${e.doc_type} (${e.reason})`));
    setSkipCount(items.length);
  };

  const onShowPending = async (): Promise<void> => {
    const items = await listAllPending(storage.idb);
    log(`Pending-Antraege: ${items.length} Einträge`);
    items.slice(0, 10).forEach(e => log(`  - ${e.filename} (akronym=${e.akronym ?? '–'}, fkz=${e.fkz_candidate ?? '–'})`));
    setPendingCount(items.length);
  };

  const onClearSkipList = async (): Promise<void> => {
    const removed = await resetSkipListByVersion(storage.idb, Number.MAX_SAFE_INTEGER);
    log(`Skip-Liste geleert: ${removed} Einträge entfernt.`);
    await refreshCounts();
  };

  const onClearPending = async (): Promise<void> => {
    await clearAllPending(storage.idb);
    log('Pending-Antraege geleert.');
    await refreshCounts();
  };

  const onClearManifest = async (): Promise<void> => {
    if (!window.confirm(`Wirklich ${manifestCount.toLocaleString('de-DE')} Manifest-Eintraege loeschen? Beim naechsten Bulk-Run werden alle Files neu klassifiziert.`)) return;
    const removed = await clearAllManifest(storage.idb);
    log(`Manifest geleert: ${removed.toLocaleString('de-DE')} Eintraege entfernt.`);
    setLastManifest(null);
    await refreshCounts();
  };

  const onFullReset = async (): Promise<void> => {
    if (!window.confirm('Wirklich alle Phase-2-Caches leeren? Manifest + Skip-Liste + Pending werden geloescht. Run-Logs auf dem Share bleiben.')) return;
    const m = await clearAllManifest(storage.idb);
    const s = await resetSkipListByVersion(storage.idb, Number.MAX_SAFE_INTEGER);
    await clearAllPending(storage.idb);
    setBulkStats(null);
    setScanFiles(null);
    setLastManifest(null);
    await refreshCounts();
    log(`Reset komplett: Manifest=${m.toLocaleString('de-DE')}, Skip=${s.toLocaleString('de-DE')}, Pending geleert.`);
  };

  const onLookupDocId = (): void => {
    const raw = lookupQuery;
    if (!raw.trim()) {
      log('Bitte DocID eingeben.');
      return;
    }
    if (!dmsMap || dmsMap.size === 0) {
      log('Index nicht geladen. Erst „Index laden" klicken.');
      return;
    }
    const cleaned = cleanDocId(raw);
    const lookupKey = cleaned.toLowerCase();
    const codes = Array.from(raw).map(ch => ch.charCodeAt(0));
    log(`Lookup für "${raw}" (clean → "${cleaned}", lookup-key "${lookupKey}", char-codes [${codes.join(',')}])`);
    log(`  map.size: ${dmsMap.size}`);

    const hit = dmsMap.get(lookupKey);
    if (hit) {
      log(`  HIT:`);
      log(`    docId        = ${hit.docId}`);
      log(`    bezeichnung  = ${hit.bezeichnung}`);
      log(`    aktenplan    = ${hit.aktenplan || '(leer)'}`);
      log(`    typ          = ${hit.typ || '(leer)'}`);
      log(`    von          = ${hit.von ?? '(null)'}`);
      log(`    extractedFkz = ${hit.extractedFkz ?? '(null)'}`);
      return;
    }

    log(`  MISS — kein exakter Lookup-Hit.`);
    const stem = lookupKey.replace(/\.[^.]+$/, '').slice(0, 12);
    const needle = stem.length >= 4 ? stem : lookupKey;
    let found = 0;
    for (const k of dmsMap.keys()) {
      if (k.includes(needle)) {
        log(`  ähnlicher key: "${k}"`);
        found++;
        if (found >= 5) break;
      }
    }
    if (found === 0) {
      log(`  Auch keine Substring-Treffer für "${needle}" — DocID ist nicht in der Map.`);
      const samples: string[] = [];
      for (const k of dmsMap.keys()) {
        samples.push(k);
        if (samples.length >= 3) break;
      }
      log(`  Beispiel-Keys aus dem Index: ${samples.join(', ')}`);
    }
  };

  return {
    activeProgrammId, activeProgrammName,
    dmsMap, aktenplan, dmsSource,
    sources, selectedSourceId, selectedSource, selectedRoots, setSelectedSourceId,
    skipCount, pendingCount, manifestCount, errorCount,
    scanFiles, scanRunning, scanProgress, bulkStats, bulkRunning, bulkTick,
    busy, mirrorBusy,
    lookupQuery, setLookupQuery,
    lastManifest, logLines,
    onLoadDmsIndex, onPickAndTriage, onScanRoots, onAbortScan,
    onBulkTriage, onAbortBulk, onRetryErrors, onMirrorManifest,
    onShowSkipList, onShowPending,
    onClearSkipList, onClearPending, onClearManifest, onFullReset,
    onLookupDocId,
  };
}

/**
 * Phase-2 Triage-Test-Panel.
 *
 * Erlaubt es, einzelne Dokumente per File-Picker durch die volle
 * Triage-Pipeline zu schicken und das resultierende Manifest-Objekt
 * inspizierbar zu machen. Außerdem: Skip-List + Pending-Antrag-Bucket-
 * Inhalte einsehen und DMS-CSV-Index aus dem Daten-Share laden.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import {
  getSmbHandle,
  getDatenShareHandle,
  getDokumentenquelleHandle,
} from '@/core/services/infrastructure/smb-handle';
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
import { DevLog, DevRow, StatusPill } from './shared';
import { ScanRootsPicker } from './ScanRootsPicker';

export function TriagePanel(): React.ReactElement {
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

  // Bulk-Scan State
  const [scanFiles, setScanFiles] = useState<ScanFile[] | null>(null);
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    filesSoFar: number;
    dir: string;
    startedAt: number;
    estimatedTotal: number | null;
    lastTick: number;
  } | null>(null);
  const [bulkStats, setBulkStats] = useState<BulkScanStats | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [manifestCount, setManifestCount] = useState<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  // 1-Hz-Tick fuer Live-Update der "vergangen"-Zeit zwischen onProgress-Ticks.
  // onProgress feuert nur pro Verzeichnis — bei tiefen Hierarchien koennen
  // Sekunden zwischen Updates liegen; ohne Tick bleibt die Anzeige stehen.
  useEffect(() => {
    if (!scanProgress) return;
    const id = setInterval(() => {
      setScanProgress(p => (p ? { ...p, lastTick: Date.now() } : p));
    }, 1000);
    return () => clearInterval(id);
  }, [scanProgress !== null]);
  // Auswahl kommt jetzt aus dem ScanRootsPicker (persistiert in IDB).
  // Default leer — User muss explizit Pfade waehlen, sonst kein Scan moeglich.
  const [selectedRoots, setSelectedRoots] = useState<string[]>([]);

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
      // Diagnose: Stats aus dem Parser ins Panel-Log spiegeln, damit der User
      // nicht in die Browser-Console muss.
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
          llmTransport: null,    // Stage 3 hier nicht aktiv — Dev-Test kann LLM-Endpoint später optional einhängen
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
      const handle = await getDokumentenquelleHandle(storage.idb);
      if (!handle) {
        log('Kein Dokumentenquelle-Handle. Erst SMB-Panel: Dokumentenquelle waehlen.');
        return;
      }
      if (!scanConfig.file_extensions || scanConfig.file_extensions.length === 0) {
        log('scanConfig.file_extensions ist leer — Build-Config pruefen.');
        return;
      }

      // ETA-Schaetzwert aus dem letzten Run derselben Pfad-Liste (sofern vorhanden).
      const lastRun = await getLastScanRun(storage.idb, selectedRoots);
      const estimatedTotal = lastRun?.total ?? null;
      const startedAt = Date.now();
      setScanProgress({
        filesSoFar: 0,
        dir: '',
        startedAt,
        estimatedTotal,
        lastTick: startedAt,
      });
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
      // History fuer naechste ETA aufzeichnen (best-effort, Fehler nicht propagieren)
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
    const handle = await getDokumentenquelleHandle(storage.idb);
    if (!handle) {
      log('Kein Dokumentenquelle-Handle.');
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

    // Run-Logger initialisieren (best-effort — wenn der Share fehlt, laeuft
    // der Triage-Run trotzdem, nur ohne persistentes Log).
    let runLog: BulkRunLogger | undefined;
    try {
      const datenShare = await getDatenShareHandle(storage.idb);
      if (datenShare) {
        runLog = await BulkRunLogger.create(
          datenShare,
          selectedRoots,
          scanFiles.length,
          CLASSIFIER_VERSION,
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
        ctx,
        files: scanFiles,
        loadBlob,
        signal: ctrl.signal,
        progressEvery: 25,
        runLog,
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
    const handle = await getDokumentenquelleHandle(storage.idb);
    if (!handle) {
      log('Kein Dokumentenquelle-Handle.');
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
          datenShare,
          ['__retry_errors__'],
          prep.files.length,
          CLASSIFIER_VERSION,
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
        ctx,
        files: prep.files,
        loadBlob,
        signal: ctrl.signal,
        progressEvery: 25,
        runLog,
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
    // resetSkipListByVersion löscht alle Einträge mit version < threshold;
    // mit MAX_SAFE_INTEGER trifft das alle.
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
    // Substring-Suche: alle Map-Keys, die `cleaned.toLowerCase()` als
    // Substring enthalten. Bei MISS auf der ganzen DocID auch nach den
    // ersten 8 Zeichen suchen (typisch der DocID-Stamm ohne Endung).
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
      // Als Sanity: erste 3 Map-Keys ausgeben, damit der User sieht was generell
      // im Index liegt
      const samples: string[] = [];
      for (const k of dmsMap.keys()) {
        samples.push(k);
        if (samples.length >= 3) break;
      }
      log(`  Beispiel-Keys aus dem Index: ${samples.join(', ')}`);
    }
  };

  return (
    <>
      <DevRow label="DMS-CSV-Index">
        <Button size="xs" variant="outline" onClick={() => void onLoadDmsIndex()} disabled={busy}>
          {busy ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Lädt…
            </span>
          ) : (
            'Index laden'
          )}
        </Button>
        {busy && !dmsMap && <StatusPill label="liest CSV…" tone="neutral" />}
        {dmsMap && <StatusPill label={`${dmsMap.size.toLocaleString('de-DE')} Einträge`} tone="ok" />}
        {dmsSource === 'absent' && <StatusPill label="dms-index-filtered.csv fehlt" tone="warn" />}
      </DevRow>

      <DevRow label="Aktives Programm (für Akronym-Lookup)">
        {activeProgrammId
          ? <StatusPill label={activeProgrammName ?? activeProgrammId} tone="ok" />
          : <StatusPill label="kein Programm aktiv — Switcher in der Sidebar" tone="warn" />
        }
      </DevRow>

      <DevRow label="DocID nachschlagen (Diagnose)">
        <Input
          value={lookupQuery}
          onChange={e => setLookupQuery(e.target.value)}
          placeholder="z.B. GMKZSZ01.docx"
          className="h-7 text-[12px] flex-1 min-w-[160px]"
          onKeyDown={e => { if (e.key === 'Enter') onLookupDocId(); }}
        />
        <Button size="xs" variant="outline" onClick={onLookupDocId} disabled={!dmsMap}>
          Suchen
        </Button>
      </DevRow>

      <DevRow label="Datei testen">
        <Button
          size="xs"
          variant="default"
          onClick={() => void onPickAndTriage()}
          disabled={busy || !dmsMap}
          title={!dmsMap ? 'Erst „Index laden" anklicken' : undefined}
        >
          Datei wählen + Triage
        </Button>
        {!dmsMap && (
          <StatusPill label="Index nicht geladen" tone="warn" />
        )}
      </DevRow>

      <ScanRootsPicker
        idb={storage.idb}
        log={log}
        onSelectionChange={setSelectedRoots}
      />

      <DevRow label="Bulk-Scan: Roots scannen + Triagieren">
        <Button
          size="xs"
          variant="outline"
          onClick={() => void onScanRoots()}
          disabled={scanRunning || bulkRunning || selectedRoots.length === 0}
        >
          {scanRunning ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Scanne…
            </span>
          ) : (
            'Roots scannen'
          )}
        </Button>
        {scanRunning && (
          <Button size="xs" variant="destructive" onClick={onAbortScan}>
            Abbrechen
          </Button>
        )}
        {scanFiles && !scanRunning && (
          <StatusPill label={`${scanFiles.length.toLocaleString('de-DE')} Dateien gefunden`} tone="ok" />
        )}
        <Button
          size="xs"
          variant="default"
          onClick={() => void onBulkTriage()}
          disabled={!scanFiles || !dmsMap || bulkRunning || scanRunning}
          title={!scanFiles ? 'Erst „Roots scannen" klicken' : !dmsMap ? 'Erst DMS-Index laden' : undefined}
        >
          Bulk-Triage starten
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => void onRetryErrors()}
          disabled={errorCount === 0 || !dmsMap || bulkRunning || scanRunning}
          title={errorCount === 0 ? 'Keine parse_error-Manifests' : !dmsMap ? 'Erst DMS-Index laden' : undefined}
        >
          Nur Errors retriagieren ({errorCount.toLocaleString('de-DE')})
        </Button>
        {bulkRunning && (
          <Button size="xs" variant="destructive" onClick={onAbortBulk}>
            Abbrechen
          </Button>
        )}
      </DevRow>

      {scanProgress && (
        <DevRow label="Scan-Progress">
          <div className="w-full">
            {scanProgress.estimatedTotal !== null && (
              <div className="h-2 w-full overflow-hidden rounded bg-[var(--tf-bg-secondary)]">
                <div
                  className="h-full bg-[var(--tf-primary)] transition-[width] duration-200"
                  style={{
                    width: `${Math.min(100, (scanProgress.filesSoFar / scanProgress.estimatedTotal) * 100)}%`,
                  }}
                />
              </div>
            )}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--tf-text-secondary)]">
              <span>Files: {scanProgress.filesSoFar.toLocaleString('de-DE')}</span>
              {scanProgress.estimatedTotal !== null && (
                <span>~ {scanProgress.estimatedTotal.toLocaleString('de-DE')} erwartet</span>
              )}
              {(() => {
                const elapsedMs = scanProgress.lastTick - scanProgress.startedAt;
                const ratePerSec = elapsedMs > 0 ? (scanProgress.filesSoFar * 1000) / elapsedMs : 0;
                const etaMs = scanProgress.estimatedTotal !== null
                  && ratePerSec > 0
                  && scanProgress.estimatedTotal > scanProgress.filesSoFar
                  ? ((scanProgress.estimatedTotal - scanProgress.filesSoFar) / ratePerSec) * 1000
                  : null;
                return (
                  <>
                    <span>{Math.round(ratePerSec).toLocaleString('de-DE')} Files/s</span>
                    <span>vergangen: {formatDuration(elapsedMs)}</span>
                    {etaMs !== null && <span>ETA: {formatDuration(etaMs)}</span>}
                  </>
                );
              })()}
            </div>
            {scanProgress.dir && (
              <div className="mt-0.5 truncate text-[10.5px] text-[var(--tf-text-tertiary)]">
                aktuell: {scanProgress.dir || '<root>'}
              </div>
            )}
          </div>
        </DevRow>
      )}

      {bulkStats && (
        <DevRow label="Bulk-Progress">
          <div className="w-full">
            <div className="h-2 w-full overflow-hidden rounded bg-[var(--tf-bg-secondary)]">
              <div
                className="h-full bg-[var(--tf-primary)] transition-[width] duration-200"
                style={{
                  width: `${bulkStats.total > 0 ? (bulkStats.done / bulkStats.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--tf-text-secondary)]">
              <span>{bulkStats.done}/{bulkStats.total}</span>
              <span>cache(skip): {bulkStats.cache_hit_skip}</span>
              <span>cache(manifest): {bulkStats.cache_hit_manifest}</span>
              <span>relevant: {bulkStats.classified_relevant}</span>
              <span>irrelevant: {bulkStats.classified_irrelevant}</span>
              <span>pending: {bulkStats.classified_pending}</span>
              <span>review: {bulkStats.classified_review}</span>
              <span className={bulkStats.errors > 0 ? 'text-amber-700' : ''}>
                errors: {bulkStats.errors}
              </span>
              {bulkStats.aborted && <span className="text-amber-700">(abgebrochen)</span>}
              {bulkStats.finished_at && !bulkStats.aborted && <span>(fertig)</span>}
            </div>
            {bulkStats.current_file && (
              <div className="mt-0.5 truncate text-[10.5px] text-[var(--tf-text-tertiary)]">
                aktuell: {bulkStats.current_file}
              </div>
            )}
          </div>
        </DevRow>
      )}

      <DevRow label="Manifest spiegeln">
        <Button
          size="xs"
          variant="outline"
          onClick={() => void onMirrorManifest()}
          disabled={mirrorBusy || bulkRunning}
        >
          Manifest auf Share spiegeln
        </Button>
        {mirrorBusy && <StatusPill label="schreibe…" tone="neutral" />}
      </DevRow>

      <DevRow label="Stores">
        <Button size="xs" variant="outline" onClick={() => void onShowSkipList()}>Skip-Liste</Button>
        <StatusPill label={`${skipCount.toLocaleString('de-DE')}`} tone="neutral" />
        <Button size="xs" variant="outline" onClick={() => void onShowPending()}>Pending</Button>
        <StatusPill label={`${pendingCount.toLocaleString('de-DE')}`} tone="neutral" />
        <StatusPill label={`Manifest: ${manifestCount.toLocaleString('de-DE')}`} tone="neutral" />
        <Button size="xs" variant="destructive" onClick={() => void onClearSkipList()} disabled={skipCount === 0}>
          Skip-Liste leeren
        </Button>
        <Button size="xs" variant="destructive" onClick={() => void onClearPending()} disabled={pendingCount === 0}>
          Pending leeren
        </Button>
        <Button size="xs" variant="destructive" onClick={() => void onClearManifest()} disabled={manifestCount === 0}>
          Manifest leeren
        </Button>
      </DevRow>

      <DevRow label="Komplett-Reset fuer Re-Test">
        <Button
          size="xs"
          variant="destructive"
          onClick={() => void onFullReset()}
          disabled={manifestCount === 0 && skipCount === 0 && pendingCount === 0}
        >
          Alle Phase-2-Caches leeren
        </Button>
        <span className="text-[10px] text-[var(--tf-text-tertiary)]">
          Loescht Manifest + Skip-Liste + Pending. Run-Logs auf dem Share bleiben.
        </span>
      </DevRow>

      {lastManifest && (
        <DevRow label="Letztes Triage-Manifest">
          <pre
            className="w-full overflow-x-auto rounded-md bg-[var(--tf-bg-secondary)] p-2 font-mono text-[10.5px] leading-snug text-[var(--tf-text-secondary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {JSON.stringify(lastManifest, null, 2)}
          </pre>
        </DevRow>
      )}

      <DevRow label="Log">
        <DevLog lines={logLines} />
      </DevRow>
    </>
  );
}

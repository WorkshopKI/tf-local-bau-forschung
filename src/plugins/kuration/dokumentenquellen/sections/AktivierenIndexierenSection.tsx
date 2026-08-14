/**
 * Kurator-Bereich: aktive DMS-Quellen waehlen + Indexierung anstossen.
 *
 * Pro Source ein `is_active`-Switch + Indexierungs-Status (last_indexed_at,
 * last_index_stats). Footer-Aktion: "Alle aktiven indexieren" + "Manifest
 * auf Share spiegeln".
 */
import { useCallback, useRef, useState } from 'react';
import { FileSearch, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  getDatenShareHandle,
} from '@/core/services/infrastructure/smb-handle';
import {
  updateDmsSource,
  type DmsSourceEntry,
  type DmsSourceHandleStatus,
} from '@/core/services/dms-sources';
import {
  mirrorManifestToShare,
  type BulkScanStats,
} from '@/phase2';
import { scanConfig } from '@/config/feature-flags';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { runBulkTriageForSources } from '../services/bulk-run';

export interface AktivierenIndexierenSectionProps {
  sources: DmsSourceEntry[];
  handleStatus: Record<string, DmsSourceHandleStatus>;
  handleNames: Record<string, string | null>;
  onChanged: () => Promise<void> | void;
}

interface PerSourceProgress {
  source: DmsSourceEntry;
  stats: BulkScanStats;
}

export function AktivierenIndexierenSection({
  sources,
  handleStatus,
  handleNames,
  onChanged,
}: AktivierenIndexierenSectionProps): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);

  const [running, setRunning] = useState(false);
  const [perSource, setPerSource] = useState<PerSourceProgress[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [mirrorBusy, setMirrorBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sorted = [...sources].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.label.localeCompare(b.label, 'de');
  });

  const activeCount = sources.filter(s => s.is_active).length;
  const activeWithHandle = sources.filter(
    s => s.is_active && handleStatus[s.id] === 'connected',
  );

  const onToggleActive = useCallback(
    async (s: DmsSourceEntry, next: boolean): Promise<void> => {
      try {
        await updateDmsSource(storage.idb, s.id, { is_active: next });
        await logAudit(storage.idb, {
          action: next ? 'dms_source_activated' : 'dms_source_deactivated',
          user: session.kuratorName ?? undefined,
          details: { id: s.id, label: s.label },
        });
        await onChanged();
      } catch (e) {
        setError(`Status-Wechsel fehlgeschlagen: ${(e as Error).message}`);
      }
    },
    [storage.idb, session.kuratorName, onChanged],
  );

  const onStartIndexing = useCallback(async (): Promise<void> => {
    setError(null);
    setInfo(null);
    setLogPath(null);
    setPerSource([]);

    if (!activeProgrammId) {
      setError('Kein aktives Programm — bitte erst eines im Sidebar-Switcher wählen.');
      return;
    }
    if (!scanConfig.file_extensions || scanConfig.file_extensions.length === 0) {
      setError('Build-Config: scan.file_extensions ist leer.');
      return;
    }

    if (activeWithHandle.length === 0) {
      setError(
        activeCount === 0
          ? 'Keine Quelle aktiv — bitte mindestens eine Quelle aktivieren.'
          : 'Keine aktive Quelle hat einen verbundenen Handle. Erst verbinden.',
      );
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);

    try {
      const result = await runBulkTriageForSources({
        idb: storage.idb,
        programmId: activeProgrammId,
        sources: activeWithHandle,
        fileExtensions: scanConfig.file_extensions,
        maxDepth: scanConfig.max_depth ?? 20,
        signal: ctrl.signal,
        onSourceStart: (source, idx, total) => {
          setInfo(`Quelle ${idx + 1}/${total}: „${source.label}"`);
        },
        onSourceProgress: (source, stats) => {
          setPerSource(prev => {
            const others = prev.filter(p => p.source.id !== source.id);
            return [...others, { source, stats }].sort((a, b) =>
              a.source.label.localeCompare(b.source.label, 'de'),
            );
          });
        },
        onSourceFinish: (source, stats) => {
          setPerSource(prev => {
            const others = prev.filter(p => p.source.id !== source.id);
            return [...others, { source, stats }];
          });
        },
        onLogPath: setLogPath,
        onInfo: setInfo,
      });
      setInfo(
        result.aborted
          ? 'Abgebrochen.'
          : `Fertig — ${result.aggregate.classified_relevant + result.aggregate.classified_irrelevant + result.aggregate.classified_pending + result.aggregate.classified_review} klassifiziert über ${activeWithHandle.length} Quelle${activeWithHandle.length === 1 ? '' : 'n'}.`,
      );
      await onChanged();
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.toLowerCase().includes('abort')) {
        setError(`Indexierung fehlgeschlagen: ${msg}`);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [activeProgrammId, activeCount, activeWithHandle, storage.idb, onChanged]);

  const onAbort = (): void => {
    abortRef.current?.abort();
  };

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
      setInfo(`Manifest gespiegelt: ${r.entries} Einträge (${kb} KB) → ${r.path}`);
    } catch (e) {
      setError(`Mirror-Fehler: ${(e as Error).message}`);
    } finally {
      setMirrorBusy(false);
    }
  }, [storage.idb]);

  return (
    <div>
      <SectionHeader label={`Aktivieren & indexieren (${activeCount}/${sources.length} aktiv)`} />

      {sources.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-[var(--tf-text-tertiary)]">
          Es gibt noch keine konfigurierten DMS-Quellen.
        </div>
      ) : (
        <ul className="space-y-2 mt-3">
          {sorted.map(s => {
            const status = handleStatus[s.id] ?? 'missing';
            const progress = perSource.find(p => p.source.id === s.id);
            return (
              <li
                key={s.id}
                className="rounded-md p-3"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={next => void onToggleActive(s, next)}
                        disabled={running}
                      />
                      <span className="text-[14px] font-medium text-[var(--tf-text)] truncate">
                        {s.label}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
                      {status === 'connected'
                        ? `Verbunden · ${s.sub_roots.length === 0 ? 'ganzer Ordner' : `${s.sub_roots.length} Sub-Root${s.sub_roots.length === 1 ? '' : 's'}`}`
                        : status === 'permission_lost'
                          ? 'Berechtigung verloren — Dev muss neu verbinden'
                          : 'Kein Handle — Dev muss verbinden'}
                    </div>
                    {handleNames[s.id] && (
                      <div className="mt-0.5 text-[11.5px] text-[var(--tf-text-secondary)] font-mono truncate" title={handleNames[s.id] ?? undefined}>
                        Ordner: {handleNames[s.id]}
                      </div>
                    )}
                    {s.last_indexed_at && s.last_index_stats && (
                      <div className="mt-1 text-[11.5px] text-[var(--tf-text-secondary)]">
                        Zuletzt indexiert {new Date(s.last_indexed_at).toLocaleString('de-DE')} · {s.last_index_stats.docs_total.toLocaleString('de-DE')} Dateien (
                        {s.last_index_stats.docs_relevant} relevant, {s.last_index_stats.docs_irrelevant} irrelevant, {s.last_index_stats.docs_review} review, {s.last_index_stats.docs_errors} Fehler)
                      </div>
                    )}
                    {progress && progress.stats.total > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded bg-[var(--tf-bg-secondary)]">
                          <div
                            className="h-full bg-[var(--tf-primary)] transition-[width] duration-200"
                            style={{
                              width: `${(progress.stats.done / progress.stats.total) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--tf-text-secondary)]">
                          <span>{progress.stats.done}/{progress.stats.total}</span>
                          <span>relevant: {progress.stats.classified_relevant}</span>
                          <span>irrelevant: {progress.stats.classified_irrelevant}</span>
                          {progress.stats.errors > 0 && (
                            <span className="text-amber-700">errors: {progress.stats.errors}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!running ? (
          <>
            <Button
              onClick={() => void onStartIndexing()}
              disabled={running || activeWithHandle.length === 0}
            >
              <FileSearch className="h-3.5 w-3.5 mr-1" />
              Alle aktiven indexieren ({activeWithHandle.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onMirror()}
              disabled={mirrorBusy}
            >
              {mirrorBusy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Manifest auf Share spiegeln
            </Button>
          </>
        ) : (
          <Button variant="destructive" size="sm" onClick={onAbort}>
            <Square className="h-3.5 w-3.5 mr-1" />
            Abbrechen
          </Button>
        )}
      </div>

      {info && (
        <p className="mt-2 text-[12px] text-[var(--tf-text-secondary)] flex items-center gap-1.5">
          {running && <Loader2 className="h-3 w-3 animate-spin" />}
          {info}
        </p>
      )}
      {logPath && (
        <p className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
          Run-Log: <code>{logPath}</code> (auf dem Daten-Share, überlebt Tab-Crash)
        </p>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-[var(--tf-danger-text)]">{error}</p>
      )}
    </div>
  );
}

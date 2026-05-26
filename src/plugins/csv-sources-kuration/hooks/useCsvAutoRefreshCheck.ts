/**
 * Background-Check beim Kurator-Login: hat eine registrierte CSV-Quelle ein
 * neueres `lastModified` als beim letzten Import?
 *
 * Triggert wenn:
 *  - `features.kuratorMenus` aktiv (nur kurator/dev Build)
 *  - Kurator-Session aktiv (rehydrate ODER fresh activate)
 *  - SMB-Status online
 *  - Pro Session noch nicht gepruefft
 *
 * Liefert Banner-State + Aktionen. Der Banner ruft `runRefresh()` (das
 * delegiert an `runAutoRefresh()` aus `services/auto-refresh.ts`), sammelt
 * Progress + Report und kann manuell dismisst werden.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { isKuratorMenusEnabled } from '@/config/feature-flags';
import { listSchemas, listProgramme } from '@/core/services/csv';
import type { CsvSchema } from '@/core/services/csv/types';
import { checkSourceForUpdate, type UpdateCheckResult } from '../csv-source-handle';
import {
  runAutoRefresh,
  BuildLockBusyError,
  type RefreshCandidate,
  type RefreshReport,
  type RefreshProgress,
} from '../services/auto-refresh';

export interface PermissionNeededEntry {
  schemaId: string;
  schemaName: string;
}

export interface AutoRefreshCheckState {
  /** Quellen mit neuerem lastModified, bereit zum Auto-Update. */
  candidates: RefreshCandidate[];
  /** Quellen, deren Handle/Permission vom User neu erteilt werden muss. */
  permissionNeeded: PermissionNeededEntry[];
  /** Hintergrund-Check laeuft gerade. */
  checking: boolean;
  /** Banner vom User dismisst. */
  dismissed: boolean;

  /** Aktiver Refresh-Lauf. */
  refreshing: boolean;
  refreshProgress: RefreshProgress | null;
  /** Letzter Refresh-Report (gefuellt nach Lauf-Ende). */
  report: RefreshReport | null;
  /** Konflikt-Info, wenn anderer Kurator gerade aktualisiert. */
  lockConflict: { blockingKurator: string; ageMinutes: number } | null;
  /** Allgemeiner Fehler im Refresh-Lauf (nicht-Lock-Konflikt). */
  refreshError: string | null;

  /** Banner ausblenden (bis zur naechsten Login-Activation). */
  dismiss: () => void;
  /** Report nach Anzeige schliessen — Banner verschwindet danach. */
  clearReport: () => void;
  /** Refresh starten. Returnt true, wenn erfolgreich abgeschlossen. */
  runRefresh: () => Promise<void>;
}

async function collectCandidates(
  idb: ReturnType<typeof useStorage>['idb'],
): Promise<{ candidates: RefreshCandidate[]; permissionNeeded: PermissionNeededEntry[] }> {
  const programme = await listProgramme(idb);
  const all: CsvSchema[] = [];
  for (const p of programme) {
    const s = await listSchemas(idb, p.id);
    all.push(...s);
  }
  const candidates: RefreshCandidate[] = [];
  const permissionNeeded: PermissionNeededEntry[] = [];
  for (const schema of all) {
    const r: UpdateCheckResult = await checkSourceForUpdate(idb, schema);
    if (r.state === 'update_available') {
      candidates.push({ schemaId: schema.id, schema });
    } else if (r.state === 'permission_required') {
      permissionNeeded.push({ schemaId: schema.id, schemaName: schema.csv_source_name });
    }
  }
  return { candidates, permissionNeeded };
}

export function useCsvAutoRefreshCheck(): AutoRefreshCheckState {
  const storage = useStorage();
  const session = useKuratorSession();
  const smbStatus = useSmbStatus();

  const [candidates, setCandidates] = useState<RefreshCandidate[]>([]);
  const [permissionNeeded, setPermissionNeeded] = useState<PermissionNeededEntry[]>([]);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<RefreshProgress | null>(null);
  const [report, setReport] = useState<RefreshReport | null>(null);
  const [lockConflict, setLockConflict] = useState<{ blockingKurator: string; ageMinutes: number } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const checkedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Session-Ende → State reset, damit der naechste Login wieder pruefft.
  useEffect(() => {
    if (!session.isActive) {
      checkedRef.current = false;
      setCandidates([]);
      setPermissionNeeded([]);
      setDismissed(false);
      setReport(null);
      setLockConflict(null);
      setRefreshError(null);
    }
  }, [session.isActive]);

  // Background-Check sobald alle Vorbedingungen erfuellt sind.
  useEffect(() => {
    if (!isKuratorMenusEnabled()) return;
    if (!session.isActive) return;
    if (smbStatus.status !== 'online') return;
    if (checkedRef.current) return;
    checkedRef.current = true;

    let alive = true;
    (async () => {
      if (mountedRef.current) setChecking(true);
      try {
        const r = await collectCandidates(storage.idb);
        if (!alive || !mountedRef.current) return;
        setCandidates(r.candidates);
        setPermissionNeeded(r.permissionNeeded);
      } catch (err) {
        console.warn('[csv-auto-refresh] check failed', err);
      } finally {
        if (alive && mountedRef.current) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [session.isActive, smbStatus.status, storage.idb]);

  const dismiss = useCallback(() => setDismissed(true), []);
  const clearReport = useCallback(() => {
    setReport(null);
    setCandidates([]);
    setPermissionNeeded([]);
    setRefreshError(null);
    setLockConflict(null);
    setDismissed(true);
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshing) return;
    if (candidates.length === 0) return;
    setRefreshing(true);
    setRefreshError(null);
    setLockConflict(null);
    setRefreshProgress(null);
    try {
      const r = await runAutoRefresh(storage.idb, candidates, {
        kuratorName: session.kuratorName ?? undefined,
        onProgress: p => {
          if (mountedRef.current) setRefreshProgress(p);
        },
      });
      if (mountedRef.current) {
        setReport(r);
        // Kandidaten leeren — der Background-Check beim naechsten Login
        // baut die Liste erneut auf (Quellen mit Drift werden dann wieder
        // gefunden, sind aber im Drift-Report bereits sichtbar).
        setCandidates([]);
      }
    } catch (err) {
      if (err instanceof BuildLockBusyError) {
        if (mountedRef.current) setLockConflict({ blockingKurator: err.blockingKurator, ageMinutes: err.ageMinutes });
      } else if (mountedRef.current) {
        setRefreshError((err as Error).message);
      }
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
        setRefreshProgress(null);
      }
    }
  }, [candidates, refreshing, session.kuratorName, storage.idb]);

  return {
    candidates,
    permissionNeeded,
    checking,
    dismissed,
    refreshing,
    refreshProgress,
    report,
    lockConflict,
    refreshError,
    dismiss,
    clearReport,
    runRefresh,
  };
}

/**
 * Background-Check: hat eine registrierte CSV-Quelle ein neueres `lastModified`
 * als beim letzten Import?
 *
 * Triggert wenn:
 *  - `features.kuratorMenus` ODER `features.csvAutoRefresh` aktiv
 *  - Kurator-Modus (`kuratorMenus`): zusätzlich Kurator-Session aktiv
 *    (rehydrate ODER fresh activate). pl-Modus (`csvAutoRefresh` ohne
 *    `kuratorMenus`): keine Session nötig, läuft beim Mount.
 *  - SMB-Status online
 *  - Pro Session/Mount noch nicht geprüft
 *
 * Liefert Banner-State + Aktionen. Der Banner ruft `runRefresh()` (delegiert an
 * `runAutoRefresh()` aus `services/auto-refresh.ts`), sammelt Progress + Report
 * und kann manuell dismisst werden. In Nicht-Kurator-Builds (pl) bekommt der
 * User die Schemas per Snapshot, aber nie ein Datei-Handle — `unlinked` listet
 * diese Quellen, `linkSource()` verknüpft sie per Picker (v2.18).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { isKuratorMenusEnabled, isCsvAutoRefreshEnabled } from '@/config/feature-flags';
import { runtimeConfig } from '@/config/runtime-config';
import { loadSchema } from '@/core/services/csv';
import type { CsvSchema } from '@/core/services/csv/types';
import {
  pickAndLinkCsvSource,
  pickAndLinkCsvFolder,
} from '../csv-source-handle';
import { refreshAntraegeStoreAfterSync } from '@/plugins/antraege/snapshot-refresh';
import { useCsvSourcesSignal } from '@/core/services/csv/csv-sources-signal';
import { useStartupDataStatus } from '@/core/services/csv/startup-data-status';
import {
  runAutoRefresh,
  collectCandidates,
  BuildLockBusyError,
  type RefreshCandidate,
  type RefreshReport,
  type RefreshProgress,
  type PermissionNeededEntry,
} from '../services/auto-refresh';

export type { PermissionNeededEntry };

export interface AutoRefreshCheckState {
  /** Quellen mit neuerem lastModified, bereit zum Auto-Update. */
  candidates: RefreshCandidate[];
  /** Quellen, deren Handle/Permission vom User neu erteilt werden muss. */
  permissionNeeded: PermissionNeededEntry[];
  /** Quellen ohne gespeichertes Datei-Handle (z.B. pl-Build: Schemas per
   *  Snapshot, aber nie eine Datei gepickt). Über `linkSource()` verknüpfbar. */
  unlinked: PermissionNeededEntry[];
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
  /** Refresh erzwingen — übernimmt einen bestehenden (ggf. abgestürzten) Lock
   *  per forceLock. Für den „Trotzdem aktualisieren"-Button im Lock-Konflikt. */
  forceRefresh: () => Promise<void>;
  /** Eine Quelle ohne Handle (oder mit abgelaufener Permission) mit einer
   *  lokalen Datei verknüpfen — öffnet den Datei-Picker (User-Gesture nötig).
   *  Wirft bei Datei-Mismatch; bei Abbruch passiert nichts. */
  linkSource: (schemaId: string) => Promise<void>;
  /** Alle offenen Quellen über EINEN Ordner verknüpfen (v2.27) — öffnet den
   *  Verzeichnis-Picker (User-Gesture nötig). Bevorzugter Weg auf der pl: das
   *  Ordner-Handle wird beim Start mit EINEM Prompt re-granted (Kaskade), statt
   *  pro Datei. Wirft, wenn keine Datei passt; bei Abbruch passiert nichts. */
  linkFolder: () => Promise<void>;
}

export function useCsvAutoRefreshCheck(): AutoRefreshCheckState {
  const storage = useStorage();
  const session = useKuratorSession();
  const smbStatus = useSmbStatus();

  // Build-konstante Gates: Kurator-Banner läuft über `kuratorMenus`, der pl-
  // Banner über `csvAutoRefresh`. Im Kurator-Modus ist zusätzlich eine aktive
  // Kurator-Session Vorbedingung; im reinen csvAutoRefresh-Modus (pl) nicht.
  const enabled = isKuratorMenusEnabled() || isCsvAutoRefreshEnabled();
  const requireSession = isKuratorMenusEnabled();

  const [candidates, setCandidates] = useState<RefreshCandidate[]>([]);
  const [permissionNeeded, setPermissionNeeded] = useState<PermissionNeededEntry[]>([]);
  const [unlinked, setUnlinked] = useState<PermissionNeededEntry[]>([]);
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

  const runCheck = useCallback(async () => {
    if (mountedRef.current) setChecking(true);
    try {
      const r = await collectCandidates(storage.idb);
      if (!mountedRef.current) return;
      setCandidates(r.candidates);
      setPermissionNeeded(r.permissionNeeded);
      setUnlinked(r.unlinked);
    } catch (err) {
      console.warn('[csv-auto-refresh] check failed', err);
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, [storage.idb]);

  // Session-Ende → State reset, damit der naechste Login wieder pruefft. Nur im
  // Kurator-Modus relevant — die pl hat keine Session (session.isActive bleibt
  // dauerhaft false, sonst würden wir den Check-Lock endlos resetten).
  useEffect(() => {
    if (!requireSession) return;
    if (!session.isActive) {
      checkedRef.current = false;
      setCandidates([]);
      setPermissionNeeded([]);
      setUnlinked([]);
      setDismissed(false);
      setReport(null);
      setLockConflict(null);
      setRefreshError(null);
    }
  }, [requireSession, session.isActive]);

  // Solange der Start-Datenaktualisierungs-Pass (App.tsx runDataUpdate) noch
  // nicht 'done' ist, NICHT prüfen: der Orchestrator importiert die neuen CSVs
  // bereits automatisch (Toast). Sonst zeigte der Banner „X CSV-Quellen haben
  // neue Daten — Jetzt aktualisieren" parallel zum laufenden Auto-Import. Nach
  // 'done' bumpt App.tsx das Quellen-Signal → Re-Check zeigt nur, was wirklich
  // übrig ist (unverknüpfte Quellen / Drift). Mirror der Watcher-Logik (v2.95.1).
  const startupPhase = useStartupDataStatus(s => s.phase);

  // Background-Check sobald alle Vorbedingungen erfuellt sind.
  useEffect(() => {
    if (startupPhase !== 'done') return;
    if (!enabled) return;
    if (requireSession && !session.isActive) return;
    if (smbStatus.status !== 'online') return;
    if (checkedRef.current) return;
    checkedRef.current = true;
    void runCheck();
  }, [startupPhase, enabled, requireSession, session.isActive, smbStatus.status, runCheck]);

  // Re-Check bei externem Signal: Snapshot-Sync (Schemas kamen erst nach dem
  // Erst-Check in die IDB — Cold-Start) ODER Ordner-Verknüpfen in Einstellungen.
  // Ohne das erscheint der „CSV-Ordner verknüpfen"-Banner nach „clear site data"
  // nicht und das Verknüpfen wirkt erst nach Browser-Reload.
  const sourcesSignal = useCsvSourcesSignal(s => s.version);
  useEffect(() => {
    if (sourcesSignal === 0) return; // 0 = noch kein Signal → Erst-Check oben
    if (startupPhase !== 'done') return; // Start-Pass läuft → kein paralleler Check
    if (!enabled) return;
    if (requireSession && !session.isActive) return;
    if (smbStatus.status !== 'online') return;
    checkedRef.current = true;
    void runCheck();
  }, [sourcesSignal, startupPhase, enabled, requireSession, session.isActive, smbStatus.status, runCheck]);

  const dismiss = useCallback(() => setDismissed(true), []);
  const clearReport = useCallback(() => {
    setReport(null);
    setCandidates([]);
    setPermissionNeeded([]);
    setRefreshError(null);
    setLockConflict(null);
    setDismissed(true);
  }, []);

  const doRefresh = useCallback(async (force: boolean) => {
    if (refreshing) return;
    if (candidates.length === 0) return;
    setRefreshing(true);
    setRefreshError(null);
    setLockConflict(null);
    setRefreshProgress(null);
    try {
      // Audit-/Lock-Identität: Kurator-Name wenn vorhanden, sonst das Build-Label
      // (z.B. „ZAH PL") — konsistent mit der v2.16-Audit-Identität bei Shared-
      // Passwort-Rollen (Build-Label statt Person).
      const identity = session.kuratorName ?? runtimeConfig.build.label;
      const r = await runAutoRefresh(storage.idb, candidates, {
        kuratorName: identity,
        force,
        // Nach den Merges, VOR dem Publish: In-Memory-Antraege-Store je
        // betroffenem Programm neu laden — die Home zeigt die neuen Daten sofort
        // (importCsvSource schreibt nur IDB; der Store hat einen 5-Min-TTL-Skip).
        // refreshAntraegeStoreAfterSync deckt Cold-Start + „aktuelles Programm
        // betroffen" ab; unabhängig von mountedRef (globaler Store lebt weiter).
        onAfterMerge: async programmIds => {
          for (const pid of programmIds) {
            await refreshAntraegeStoreAfterSync(storage.idb, pid, ['antraege', 'verbuende'] as const);
          }
        },
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

  const runRefresh = useCallback(() => doRefresh(false), [doRefresh]);
  const forceRefresh = useCallback(() => doRefresh(true), [doRefresh]);

  const linkSource = useCallback(async (schemaId: string) => {
    const schema = await loadSchema(storage.idb, schemaId);
    if (!schema) return;
    const res = await pickAndLinkCsvSource(storage.idb, schema);
    // Nach erfolgreichem Verknüpfen neu prüfen: die Quelle wandert je nach
    // lastModified von `unlinked` nach `candidates` oder fällt (up_to_date) raus.
    if (res.linked) {
      if (mountedRef.current) setDismissed(false);
      await runCheck();
    }
  }, [storage.idb, runCheck]);

  const linkFolder = useCallback(async () => {
    // Alle aktuell offenen Quellen einsammeln (ohne Handle ODER permission-bedürftig).
    const entries = [...unlinked, ...permissionNeeded];
    const schemas: CsvSchema[] = [];
    for (const e of entries) {
      const schema = await loadSchema(storage.idb, e.schemaId);
      if (schema) schemas.push(schema);
    }
    if (schemas.length === 0) return;
    const res = await pickAndLinkCsvFolder(storage.idb, schemas);
    if (res.linked) {
      if (mountedRef.current) setDismissed(false);
      await runCheck();
    }
  }, [unlinked, permissionNeeded, storage.idb, runCheck]);

  return {
    candidates,
    permissionNeeded,
    unlinked,
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
    forceRefresh,
    linkSource,
    linkFolder,
  };
}

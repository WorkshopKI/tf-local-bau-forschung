/**
 * Auto-Refresh-Banner.
 *
 * Globaler Sticky-Banner im ShellLayout (oberhalb Content), sichtbar wenn
 * `useCsvAutoRefreshCheck()` Quellen mit neuerem `lastModified` findet.
 * Klick "Aktualisieren" laeuft die Pipeline durch — Quellen ohne Drift
 * silent, Quellen mit Drift kommen in den Sammel-Report.
 *
 * Rollen-bewusst (v2.18): Im Kurator-Build (`kuratorMenus`) verweisen Quellen
 * mit fehlender Berechtigung auf das CSV-Sources-Plugin. Im pl-Build
 * (`csvAutoRefresh` ohne `kuratorMenus`) gibt es dieses Plugin nicht — dort
 * verknüpft ein schlanker Picker (`CsvSourceLinkDialog`) Quellen ohne
 * gespeichertes Datei-Handle.
 *
 * Lock-Konflikt-Hinweis bleibt inline (Banner verschwindet nicht), damit
 * der User nach 2-3 Min erneut versuchen kann.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import { useCsvAutoRefreshCheck } from '../hooks/useCsvAutoRefreshCheck';
import { CsvAutoRefreshDriftDialog } from './CsvAutoRefreshDriftDialog';
import { CsvSourceLinkDialog } from './CsvSourceLinkDialog';
import { isCsvAutoRefreshEnabled, isKuratorMenusEnabled } from '@/config/feature-flags';
import { pluginIdToRoute } from '@/core/routes';
import { ProgressBar } from '@/ui';
import type { RefreshProgress } from '../services/auto-refresh';

/** Kurzes Verb je Pipeline-Phase fuer das Banner. */
const PHASE_LABEL: Record<RefreshProgress['phase'], string> = {
  reading: 'lese',
  validating: 'prüfe',
  importing: 'importiere',
  persisting: 'speichere',
};

/**
 * Feinanteil innerhalb der aktuellen Quelle, damit der Balken mit den Phasen
 * weiterwandert statt nur je Quelle zu springen. Determinierter Fortschritt
 * fuer eine Kurator-Indexierung (per DESIGN_GUIDE erlaubt).
 */
const PHASE_FRACTION: Record<RefreshProgress['phase'], number> = {
  reading: 0,
  validating: 0.3,
  importing: 0.6,
  persisting: 0.85,
};

function refreshFraction(p: RefreshProgress): number {
  return (p.index + (PHASE_FRACTION[p.phase] ?? 0)) / Math.max(1, p.total);
}

export function CsvAutoRefreshBanner(): React.ReactElement | null {
  const state = useCsvAutoRefreshCheck();
  const navigate = useNavigate();
  const [driftDialogOpen, setDriftDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  // Rollen: der Picker steht in Builds mit `csvAutoRefresh` (pl + dev), die
  // Navigation ins CSV-Sources-Plugin nur mit `kuratorMenus` (kurator + dev).
  const showLinkPicker = isCsvAutoRefreshEnabled();
  const canNavigateToKuration = isKuratorMenusEnabled();

  // Quellen, die der Picker verknüpfen/re-granten kann (fehlendes Handle ODER
  // abgelaufene Permission — ein Re-Pick erneuert beides).
  const linkSources = showLinkPicker ? [...state.unlinked, ...state.permissionNeeded] : [];
  // „Zu CSV-Sources"-Hinweis nur im reinen Kurator-Build (kein Picker da).
  const showKurationHint = !showLinkPicker && canNavigateToKuration && state.permissionNeeded.length > 0;

  const hasReport = state.report !== null;
  const reportHasDrift = (state.report?.drift.length ?? 0) > 0;
  const total =
    state.candidates.length +
    (showLinkPicker ? state.unlinked.length + state.permissionNeeded.length : state.permissionNeeded.length);

  // Drift-Dialog automatisch oeffnen, sobald Report mit Drift da ist.
  useEffect(() => {
    if (hasReport && reportHasDrift) setDriftDialogOpen(true);
  }, [hasReport, reportHasDrift]);

  // Banner ausblenden, wenn nichts zu tun und kein Report/Dialog aktiv.
  if (state.dismissed && !state.refreshing && !state.lockConflict && !linkDialogOpen) return null;
  if (total === 0 && !hasReport && !state.lockConflict && !state.refreshError && !linkDialogOpen) return null;

  const openCsvSources = (): void => {
    navigate(pluginIdToRoute('csv-sources-kuration'));
    setDriftDialogOpen(false);
    state.clearReport();
  };

  return (
    <>
      <div
        className="w-full px-4 py-2 flex items-center gap-2.5 text-[12.5px]"
        style={{
          background: 'var(--tf-primary-light)',
          color: 'var(--tf-text)',
          borderBottom: '0.5px solid var(--tf-primary)',
        }}
        role="status"
        aria-live="polite"
      >
        <Sparkles size={14} className="shrink-0" style={{ color: 'var(--tf-primary)' }} />

        {state.refreshing ? (
          state.refreshProgress ? (
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <span className="shrink-0 truncate max-w-[50%]">
                Aktualisiere {state.refreshProgress.schemaName} · {PHASE_LABEL[state.refreshProgress.phase]}…
              </span>
              <div className="flex-1 min-w-0">
                <ProgressBar value={refreshFraction(state.refreshProgress)} />
              </div>
              <span className="shrink-0 tabular-nums text-[var(--tf-text-secondary)]">
                {state.refreshProgress.index + 1}/{state.refreshProgress.total}
              </span>
            </div>
          ) : (
            <span className="flex-1">Aktualisierung startet…</span>
          )
        ) : state.lockConflict ? (
          <span className="flex-1 inline-flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0" />
            <strong>{state.lockConflict.blockingKurator}</strong> aktualisiert gerade
            (seit {Math.round(state.lockConflict.ageMinutes)} Min). Bitte in 2-3 Min erneut versuchen.
          </span>
        ) : state.refreshError ? (
          <span className="flex-1 inline-flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0" />
            Aktualisierung fehlgeschlagen: {state.refreshError}
          </span>
        ) : hasReport ? (
          <span className="flex-1 inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="shrink-0" style={{ color: '#15803d' }} />
            {state.report!.processed.length} Quelle{state.report!.processed.length === 1 ? '' : 'n'} aktualisiert
            {reportHasDrift ? ` — ${state.report!.drift.length} brauchen deine Aufmerksamkeit` : ''}
            {state.report!.errors.length > 0 ? ` — ${state.report!.errors.length} Fehler` : ''}.
          </span>
        ) : (
          <span className="flex-1">
            {state.candidates.length > 0 ? (
              <>
                <strong>{state.candidates.length}</strong> CSV-Quelle{state.candidates.length === 1 ? '' : 'n'} {state.candidates.length === 1 ? 'hat' : 'haben'} neue Daten.
              </>
            ) : null}
            {linkSources.length > 0 ? (
              <> {linkSources.length} CSV-Quelle{linkSources.length === 1 ? '' : 'n'} {linkSources.length === 1 ? 'braucht' : 'brauchen'} eine verknüpfte Datei.</>
            ) : null}
            {showKurationHint ? (
              <> {state.permissionNeeded.length} brauchen erneute Datei-Berechtigung (siehe „CSV-Sources").</>
            ) : null}
          </span>
        )}

        {!state.refreshing && state.candidates.length > 0 && !hasReport && !state.lockConflict ? (
          <button
            type="button"
            onClick={() => { void state.runRefresh(); }}
            disabled={state.refreshing}
            className="shrink-0 px-2.5 py-1 rounded text-[11.5px] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            style={{
              background: 'var(--tf-primary)',
              color: 'white',
              border: '0.5px solid var(--tf-primary)',
            }}
          >
            Jetzt aktualisieren
          </button>
        ) : null}

        {hasReport && reportHasDrift ? (
          <button
            type="button"
            onClick={() => setDriftDialogOpen(true)}
            className="shrink-0 px-2.5 py-1 rounded text-[11.5px] cursor-pointer bg-[var(--tf-bg)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Details ansehen
          </button>
        ) : null}

        {showLinkPicker && linkSources.length > 0 && !state.refreshing && !hasReport ? (
          <button
            type="button"
            onClick={() => setLinkDialogOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11.5px] cursor-pointer bg-[var(--tf-bg)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <Link2 size={12} />
            CSV-Datei verknüpfen
          </button>
        ) : null}

        {showKurationHint && !state.refreshing ? (
          <button
            type="button"
            onClick={openCsvSources}
            className="shrink-0 px-2.5 py-1 rounded text-[11.5px] cursor-pointer bg-[var(--tf-bg)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Zu CSV-Sources
          </button>
        ) : null}

        {!state.refreshing ? (
          <button
            type="button"
            onClick={state.dismiss}
            aria-label="Schließen"
            title="Schließen"
            className="shrink-0 p-1 rounded hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)] cursor-pointer"
          >
            <X size={13} />
          </button>
        ) : null}
      </div>

      {driftDialogOpen && state.report ? (
        <CsvAutoRefreshDriftDialog
          report={state.report}
          onClose={() => {
            setDriftDialogOpen(false);
            state.clearReport();
          }}
          onOpenWizard={canNavigateToKuration ? openCsvSources : undefined}
        />
      ) : null}

      {linkDialogOpen ? (
        <CsvSourceLinkDialog
          sources={linkSources}
          onLink={state.linkSource}
          onClose={() => setLinkDialogOpen(false)}
        />
      ) : null}
    </>
  );
}

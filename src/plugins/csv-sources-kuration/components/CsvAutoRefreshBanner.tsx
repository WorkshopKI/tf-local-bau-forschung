/**
 * Kurator-Auto-Refresh-Banner.
 *
 * Globaler Sticky-Banner im ShellLayout (oberhalb Content), sichtbar wenn
 * `useCsvAutoRefreshCheck()` Quellen mit neuerem `lastModified` findet.
 * Klick "Aktualisieren" laeuft die Pipeline durch — Quellen ohne Drift
 * silent, Quellen mit Drift kommen in den Sammel-Report.
 *
 * Lock-Konflikt-Hinweis bleibt inline (Banner verschwindet nicht), damit
 * der Kurator nach 2-3 Min erneut versuchen kann.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCsvAutoRefreshCheck } from '../hooks/useCsvAutoRefreshCheck';
import { CsvAutoRefreshDriftDialog } from './CsvAutoRefreshDriftDialog';
import { pluginIdToRoute } from '@/core/routes';

export function CsvAutoRefreshBanner(): React.ReactElement | null {
  const state = useCsvAutoRefreshCheck();
  const navigate = useNavigate();
  const [driftDialogOpen, setDriftDialogOpen] = useState(false);

  const total = state.candidates.length + state.permissionNeeded.length;
  const hasReport = state.report !== null;
  const reportHasDrift = (state.report?.drift.length ?? 0) > 0;

  // Drift-Dialog automatisch oeffnen, sobald Report mit Drift da ist.
  useEffect(() => {
    if (hasReport && reportHasDrift) setDriftDialogOpen(true);
  }, [hasReport, reportHasDrift]);

  // Banner ausblenden, wenn nichts zu tun und kein Report aktiv.
  if (state.dismissed && !state.refreshing && !state.lockConflict) return null;
  if (total === 0 && !hasReport && !state.lockConflict && !state.refreshError) return null;

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
          <span className="flex-1">
            {state.refreshProgress
              ? `Aktualisiere ${state.refreshProgress.index + 1}/${state.refreshProgress.total}: ${state.refreshProgress.schemaName}…`
              : 'Aktualisierung startet…'}
          </span>
        ) : state.lockConflict ? (
          <span className="flex-1 inline-flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0" />
            Kurator <strong>{state.lockConflict.blockingKurator}</strong> aktualisiert gerade
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
            {state.permissionNeeded.length > 0 ? (
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

        {state.permissionNeeded.length > 0 && !state.refreshing ? (
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
          onOpenWizard={openCsvSources}
        />
      ) : null}
    </>
  );
}

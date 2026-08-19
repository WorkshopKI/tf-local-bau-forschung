/**
 * Auto-Refresh-Banner (präsentational).
 *
 * Globaler Sticky-Banner im ShellLayout (oberhalb Content), sichtbar wenn der
 * State (aus `useCsvAutoRefreshCheck()`, gehalten vom `DataUpdateBanners`-
 * Koordinator und als `state`-Prop hereingereicht) Quellen mit neuerem
 * `lastModified` meldet. Klick "Aktualisieren" laeuft die Pipeline durch —
 * Quellen ohne Drift silent, Quellen mit Drift kommen in den Sammel-Report.
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
import { X, AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import type { AutoRefreshCheckState } from '../hooks/useCsvAutoRefreshCheck';
import { CsvAutoRefreshDriftDialog } from './CsvAutoRefreshDriftDialog';
import { CsvSourceLinkDialog } from './CsvSourceLinkDialog';
import { isCsvAutoRefreshEnabled } from '@/config/feature-flags';
import { isKuratorFreigeschaltet } from '@/core/modul-freischaltung';
import { useDataMutationBusy } from '@/core/services/csv/data-mutation-gate';
import { pluginIdToRoute } from '@/core/routes';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { beschreibeLockKonflikt } from './lockKonfliktText';
import type { RefreshProgress } from '../services/auto-refresh';

/** Kurzes Verb je Pipeline-Phase fuer das Banner. */
const PHASE_LABEL: Record<RefreshProgress['phase'], string> = {
  reading: 'lese',
  validating: 'prüfe',
  importing: 'importiere',
  persisting: 'speichere',
  publishing: 'veröffentliche',
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
  publishing: 0.95,
};

function refreshFraction(p: RefreshProgress): number {
  return (p.index + (PHASE_FRACTION[p.phase] ?? 0)) / Math.max(1, p.total);
}

export function CsvAutoRefreshBanner({ state }: { state: AutoRefreshCheckState }): React.ReactElement | null {
  const navigate = useNavigate();
  // Busy = ein FREMDER Daten-Mutations-Flow läuft (z.B. Sidebar/Einstellungen).
  // Der eigene Lauf ist über `state.refreshing` abgedeckt.
  const busy = useDataMutationBusy();
  const [driftDialogOpen, setDriftDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  // Rollen: der Picker steht in Builds mit `csvAutoRefresh` (pl + dev), die
  // Navigation ins CSV-Sources-Plugin nur mit `kuratorMenus` (kurator + dev).
  const showLinkPicker = isCsvAutoRefreshEnabled();
  const canNavigateToKuration = isKuratorFreigeschaltet();

  // Quellen, die der Picker verknüpfen/re-granten kann (fehlendes Handle ODER
  // abgelaufene Permission — ein Re-Pick erneuert beides).
  const linkSources = showLinkPicker ? [...state.unlinked, ...state.permissionNeeded] : [];
  // „Zu CSV-Sources"-Hinweis nur im reinen Kurator-Build (kein Picker da).
  const showKurationHint = !showLinkPicker && canNavigateToKuration && state.permissionNeeded.length > 0;

  const hasReport = state.report !== null;
  const reportHasDrift = (state.report?.drift.length ?? 0) > 0;
  // Nach einem „Trotzdem importieren"-Lauf gibt es keine Drift mehr, aber sehr
  // wohl etwas zu berichten: welche Spalten übergangen wurden. Sonst verschwände
  // genau diese Information mit dem Erfolgs-Banner.
  const reportHatUebergangene = (state.report?.processed ?? []).some(
    p => (p.uebergangeneSpalten?.length ?? 0) > 0,
  );
  // Dasselbe für eine automatisch korrigierte Encoding-Drift: der Import lief
  // durch, aber das Schema wurde dabei geändert — das gehört gesagt.
  const reportHatEncodingKorrektur = (state.report?.processed ?? []).some(p => p.korrigiertesEncoding);
  const reportZeigenswert = reportHasDrift || reportHatUebergangene || reportHatEncodingKorrektur;
  // Wortlaut kommt aus der reinen `beschreibeLockKonflikt` — der Banner nennt
  // nie den eigenen Namen als Fremd-Blockierer (v3.46.1).
  const lockAnzeige = state.lockConflict ? beschreibeLockKonflikt(state.lockConflict) : null;
  const total =
    state.candidates.length +
    (showLinkPicker ? state.unlinked.length + state.permissionNeeded.length : state.permissionNeeded.length);

  // Drift-Dialog automatisch oeffnen, sobald ein berichtenswerter Report da ist.
  useEffect(() => {
    if (hasReport && reportZeigenswert) setDriftDialogOpen(true);
  }, [hasReport, reportZeigenswert]);

  // Banner ausblenden, wenn nichts zu tun und kein Report/Dialog aktiv.
  if (state.dismissed && !state.refreshing && !state.lockConflict && !linkDialogOpen) return null;
  if (total === 0 && !hasReport && !state.lockConflict && !state.refreshError && !linkDialogOpen) return null;

  /**
   * Zu den registrierten Quellen — seit v4.36 ein Panel des Kuration-Hubs.
   *
   * Bis v4.119 stand hier `pluginIdToRoute('csv-sources-kuration')`. Diese
   * Plugin-Id gibt es seit dem Umzug nicht mehr; `PLUGIN_ROUTES` kennt sie
   * nicht und der `?? '/'`-Rueckfall schickte den Klick auf die Startseite —
   * waehrend der Dialog zwei Zeilen tiefer schon richtig „Datenpflege →
   * CSV-Quellen" sagte. Der Text war nachgezogen, der Klick nicht.
   *
   * Der Bericht BLEIBT stehen: wer die Quellen ansehen geht, braucht ihn dort.
   * Der Banner behaelt darum „Details ansehen" (das Auto-Oeffnen haengt an
   * `hasReport`/`reportZeigenswert` und feuert durch das Schliessen nicht neu).
   */
  const openCsvSources = (): void => {
    navigate(`${pluginIdToRoute('kuration')}?panel=csv-quellen`);
    setDriftDialogOpen(false);
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
        ) : lockAnzeige ? (
          <span className="flex-1 inline-flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0" />
            <span>
              {lockAnzeige.vorText}
              {lockAnzeige.name ? <strong>{lockAnzeige.name}</strong> : null}
              {lockAnzeige.nachText}
            </span>
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
            {!reportHasDrift && reportHatUebergangene ? ' — mit übergangenen Spalten' : ''}
            {!reportHasDrift && !reportHatUebergangene && reportHatEncodingKorrektur
              ? ' — Encoding korrigiert' : ''}
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
            disabled={state.refreshing || busy}
            title={busy ? 'Andere Aktualisierung läuft…' : undefined}
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

        {lockAnzeige?.kannUebernehmen && !state.refreshing && state.candidates.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              const frage = lockAnzeige.bestaetigung;
              // `null` = eigenes Ueberbleibsel, Uebernahme gefahrlos.
              if (frage && !window.confirm(frage)) return;
              void state.forceRefresh();
            }}
            disabled={busy}
            title={busy ? 'Andere Aktualisierung läuft…' : undefined}
            className="shrink-0 px-2.5 py-1 rounded text-[11.5px] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            style={{
              background: 'var(--tf-primary)',
              color: 'white',
              border: '0.5px solid var(--tf-primary)',
            }}
          >
            Trotzdem aktualisieren
          </button>
        ) : null}

        {hasReport && reportZeigenswert ? (
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
            CSV-Ordner verknüpfen
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
          onTrotzdemImportieren={ids => {
            setDriftDialogOpen(false);
            void state.runRefreshTrotzDrift(ids);
          }}
        />
      ) : null}

      {linkDialogOpen ? (
        <CsvSourceLinkDialog
          sources={linkSources}
          onLink={state.linkSource}
          onLinkFolder={state.linkFolder}
          onClose={() => setLinkDialogOpen(false)}
        />
      ) : null}
    </>
  );
}

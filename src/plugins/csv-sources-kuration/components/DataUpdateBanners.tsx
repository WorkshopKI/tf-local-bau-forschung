/**
 * Koordinator für die beiden Daten-Update-Banner (oberhalb des Contents im
 * ShellLayout). Ersetzt die früher direkt gemounteten `CsvAutoRefreshBanner`
 * (neue CSV-Quellen) + `NewSnapshotBanner` (neuer Datenbestand vom Team).
 *
 * Warum ein Koordinator: früher konnten BEIDE Banner gleichzeitig mit je einem
 * CTA erscheinen. Klickte der User beide, liefen zwei Daten-Mutations-Flows echt
 * parallel gegen dieselben IDB-Stores/Share-Dateien → „2 Quellen aktualisiert —
 * 1 Fehler" (Rennbedingung, siehe `data-mutation-gate.ts`).
 *
 * Fix (UX): stehen BEIDE Aktualisierungen an, zeigt der Koordinator EINEN Banner
 * mit EINEM Knopf „Datenbestand aktualisieren", der den vereinten `runDataUpdate`-
 * Pfad fährt (Snapshot → CSV-Import in der fachlich korrekten Reihenfolge, in
 * EINEM serialisierten Lauf). Steht nur eines an, rendert wie bisher der jeweilige
 * Einzel-Banner. Das geteilte `data-mutation-gate` bleibt als Rückgrat gegen alle
 * übrigen Kollisionsvektoren (Banner-vs-Sidebar/Einstellungen).
 *
 * Beide Hooks werden hier EINMAL gehalten (kein Doppel-Check) und als `state` in
 * die jetzt präsentationalen Banner gereicht.
 */

import { useCallback, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSnapshotWatcher } from '@/core/hooks/useSnapshotWatcher';
import { useDataMutationBusy } from '@/core/services/csv/data-mutation-gate';
import { useStartupDataStatus } from '@/core/services/csv/startup-data-status';
import { bumpCsvSourcesSignal } from '@/core/services/csv/csv-sources-signal';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { isDataShareEnabled, isKuratorMenusEnabled, isCsvAutoRefreshEnabled } from '@/config/feature-flags';
import { useCsvAutoRefreshCheck } from '../hooks/useCsvAutoRefreshCheck';
import { runDataUpdate } from '../services/data-update';
import { phaseToastLabel } from '../services/data-update-toast';
import type { RefreshReport } from '../services/auto-refresh';
import { NewSnapshotBanner } from '@/core/components/NewSnapshotBanner';
import { CsvAutoRefreshBanner } from './CsvAutoRefreshBanner';
import { CsvAutoRefreshDriftDialog } from './CsvAutoRefreshDriftDialog';

export function DataUpdateBanners(): React.ReactElement | null {
  const storage = useStorage();
  const csv = useCsvAutoRefreshCheck();
  const snapshot = useSnapshotWatcher({ enabled: isDataShareEnabled() });
  const busy = useDataMutationBusy();

  const [combinedRunning, setCombinedRunning] = useState(false);
  // Drift-Report des kombinierten Laufs (Quellen, die Aufmerksamkeit brauchen) —
  // im Dialog zeigen, damit die Zusammenfassung den Drift nicht verschluckt.
  const [combinedDrift, setCombinedDrift] = useState<RefreshReport | null>(null);

  // Build-konstante Sichtbarkeits-Gates (identisch zu den früheren Einzel-Mounts).
  const csvGate = isKuratorMenusEnabled() || isCsvAutoRefreshEnabled();
  const snapGate = isDataShareEnabled();

  // „Aktualisierbar" = es gibt konkret importierbare/ladbare neue Daten (nicht nur
  // unverknüpfte Quellen / Lock-Konflikt / bereits gezeigter Report / dismissed).
  const csvActionable =
    csv.candidates.length > 0 && !csv.refreshing && !csv.report && !csv.lockConflict && !csv.refreshError && !csv.dismissed;
  const snapActionable =
    snapshot.availableUpdates.length > 0 && !snapshot.applying && !snapshot.applyError && !snapshot.dismissed;
  const both = csvActionable && snapActionable && !combinedRunning;

  const runCombined = useCallback(async () => {
    const handle = await getDatenShareHandle(storage.idb);
    if (!handle) return;
    setCombinedRunning(true);
    // Phase 'running' pausiert die Einzel-Checks + koordiniert den Watcher; der
    // bereits gemountete StartupDataUpdateBanner zeigt den Fortschritt.
    useStartupDataStatus.getState().setPhase('running');
    let lastLabel: string | null = null;
    let lastPct = -1;
    try {
      const r = await runDataUpdate(storage.idb, handle, {
        includeCsv: true,
        onPhase: p => {
          const label = phaseToastLabel(p);
          const pct = Math.round(p.fraction * 100);
          // Gedrosselt in den Store (nur bei Label-/Prozent-Wechsel) — kein
          // Re-Render-Sturm bei feinkörnigen fraction-Ticks.
          if (label !== lastLabel || pct !== lastPct) {
            lastLabel = label;
            lastPct = pct;
            useStartupDataStatus.getState().setProgress({ label, fraction: p.fraction });
          }
        },
      });
      if ((r.csvReport?.drift.length ?? 0) > 0) setCombinedDrift(r.csvReport ?? null);
    } catch (err) {
      console.warn('[data-update-banners] kombinierter Lauf fehlgeschlagen', err);
    } finally {
      useStartupDataStatus.getState().setProgress(null);
      // 'done' triggert den Watcher-Recheck (Effekt) → Banner #2 klärt sich.
      useStartupDataStatus.getState().setPhase('done');
      // Re-Check der CSV-Quellen → Banner #1 klärt sich (importierte Kandidaten weg).
      bumpCsvSourcesSignal();
      setCombinedRunning(false);
    }
  }, [storage.idb]);

  // Während des kombinierten Laufs zeigt allein der StartupDataUpdateBanner den
  // Fortschritt — eigene Banner ausblenden. Der Drift-Dialog erscheint erst NACH
  // dem Lauf (dann ist combinedRunning bereits false, Render-Pfad unten).
  if (combinedRunning) return null;

  return (
    <>
      {both ? (
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
          <RefreshCw size={14} className="shrink-0" style={{ color: 'var(--tf-primary)' }} />
          <span className="flex-1">
            <strong>Neuer Datenbestand</strong>
            {snapshot.availableUpdates.length > 1 ? ` (${snapshot.availableUpdates.length} Programme)` : ''}
            {' '}und <strong>{csv.candidates.length}</strong> CSV-Quelle{csv.candidates.length === 1 ? '' : 'n'} mit neuen Daten verfügbar.
          </span>
          <button
            type="button"
            onClick={() => { void runCombined(); }}
            disabled={busy}
            title={busy ? 'Andere Aktualisierung läuft…' : undefined}
            className="shrink-0 px-2.5 py-1 rounded text-[11.5px] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            style={{ background: 'var(--tf-primary)', color: 'white', border: '0.5px solid var(--tf-primary)' }}
          >
            Datenbestand aktualisieren
          </button>
          <button
            type="button"
            onClick={() => { csv.dismiss(); snapshot.dismiss(); }}
            aria-label="Schließen"
            title="Schließen"
            className="shrink-0 p-1 rounded hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)] cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          {csvGate ? <CsvAutoRefreshBanner state={csv} /> : null}
          {snapGate ? <NewSnapshotBanner state={snapshot} /> : null}
        </>
      )}

      {combinedDrift ? (
        <CsvAutoRefreshDriftDialog
          report={combinedDrift}
          onClose={() => setCombinedDrift(null)}
          // Auch der kombinierte Lauf endet sonst in einer Sackgasse: der
          // Nachlauf baut seine Kandidaten frisch aus den Schema-Ids, ist also
          // nicht an den Hook-Lauf gebunden, der den Bericht erzeugt hat.
          onTrotzdemImportieren={ids => {
            setCombinedDrift(null);
            void csv.runRefreshTrotzDrift(ids);
          }}
        />
      ) : null}
    </>
  );
}

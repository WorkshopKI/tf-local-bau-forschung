import { useState, useEffect, useRef } from 'react';
import { Database, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { useConnectionState } from '@/core/services/connection-status';
import { useStartupDataStatus } from '@/core/services/csv/startup-data-status';
import { useCsvSourcesSignal, bumpCsvSourcesSignal } from '@/core/services/csv/csv-sources-signal';
import { listProgramme, listSchemas } from '@/core/services/csv';
import { collectCandidates } from '@/plugins/csv-sources-kuration/services/auto-refresh';
import { runDataUpdate } from '@/plugins/csv-sources-kuration/services/data-update';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';

/**
 * Sidebar-Fußzeilen-Indikator „CSV-Import aktuell?" (neben Sync + KI, Variante D).
 *
 * Inhaltsbasierter Stand der täglichen Legacy-CSV-Exporte gegen den importierten
 * Datenbestand — über `collectCandidates` (Checksumme + Größen-Guard, derselbe
 * Pfad wie „Jetzt aktualisieren"). Punktfarbe via Theme-Tokens:
 *   grün  = alle verknüpften Exporte importiert
 *   rot   = es gibt geänderte/neuere Exporte (mind. eine Quelle `update_available`)
 *   grau  = nicht prüfbar (offline / kein Handle / vor dem ersten Check)
 *   amber+pulse = Import läuft gerade
 *
 * Die Wochenend-Datei (Projektbeschreibung) braucht keinen Sonderfall: sie zählt
 * nur als „neuer", wenn ihr Inhalt sich seit dem letzten Import wirklich geändert
 * hat — ein älterer, unveränderter Stand bleibt grün. Kein Kalendertag-Vergleich
 * (Datei-mtime über SMB ist unzuverlässig, vgl. v2.137.1).
 *
 * Klick öffnet einen Detail-Dialog (analog `BridgeStatusIndicator`) mit „Jetzt
 * importieren" (`runDataUpdate` — wie der Einstellungen-Button) + Einstellungen.
 */

type CsvFreshnessState = 'fresh' | 'stale' | 'unknown';

interface CsvFreshnessResult {
  state: CsvFreshnessState;
  /** Quellen-Namen mit neueren Export-Daten (für die Dialog-Liste). */
  pendingNames: string[];
  /** Jüngstes `last_imported_at` über alle Schemas (ISO) oder null. */
  lastImport: string | null;
}

/**
 * Hintergrund-Check ohne Permission-Prompt (`collectCandidates` nutzt nur
 * `queryPermission`). Liefert Farb-State + Daten für den Dialog.
 */
async function checkCsvFreshness(idb: IDBStore): Promise<CsvFreshnessResult> {
  // Alle Schemas für „Letzter Import" (jüngstes last_imported_at) + Gesamtzahl.
  const all: CsvSchema[] = [];
  for (const p of await listProgramme(idb)) {
    all.push(...(await listSchemas(idb, p.id)));
  }
  const importIsos = all
    .map(s => s.last_imported_at)
    .filter((x): x is string => !!x)
    .sort();
  const lastImport = importIsos.length > 0 ? importIsos[importIsos.length - 1]! : null;

  const { candidates, permissionNeeded, unlinked } = await collectCandidates(idb);
  const pendingNames = candidates.map(c => c.schema.csv_source_name);

  // „erreichbar" = Quellen, die wir tatsächlich prüfen konnten (nicht ohne
  // Handle / Permission). Nur dann ist ein leeres `candidates` wirklich „grün";
  // sonst (alles unverknüpft / offline) bleibt es „unbekannt".
  const reachable = all.length - permissionNeeded.length - unlinked.length;

  let state: CsvFreshnessState;
  if (candidates.length > 0) state = 'stale';
  else if (all.length > 0 && reachable > 0) state = 'fresh';
  else state = 'unknown';

  return { state, pendingNames, lastImport };
}

export function CsvFreshnessIndicator(): React.ReactElement {
  const { navigate } = useNavigation();
  const storage = useStorage();
  const startupPhase = useStartupDataStatus(s => s.phase);
  const smbStatus = useSmbStatus(s => s.status);
  const dsAvailable = useConnectionState(s => s.datenShareAvailable);
  const sourcesSignal = useCsvSourcesSignal(s => s.version);

  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CsvFreshnessResult>({ state: 'unknown', pendingNames: [], lastImport: null });
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Background-Check sobald der Start-Pass 'done' ist + SMB online; re-run bei
  // jedem CSV-Quellen-Signal (Snapshot-Sync, Ordner-Verknüpfen, nach Import).
  useEffect(() => {
    if (startupPhase !== 'done') return;
    if (smbStatus !== 'online') return;
    if (runningRef.current) return;
    runningRef.current = true;
    (async () => {
      try {
        const r = await checkCsvFreshness(storage.idb);
        if (mountedRef.current) setResult(r);
      } catch (err) {
        console.warn('[csv-freshness] check failed', err);
      } finally {
        runningRef.current = false;
      }
    })();
  }, [startupPhase, smbStatus, sourcesSignal, storage.idb]);

  // Import = derselbe Orchestrator wie „Jetzt aktualisieren" (Snapshot → CSV).
  const importAction = useAsyncAction(async () => {
    setImportMsg(null);
    const handle = await getDatenShareHandle(storage.idb);
    if (!handle) throw new Error('Datenordner nicht verbunden.');
    const r = await runDataUpdate(storage.idb, handle, {});
    const parts: string[] = [];
    if (r.snapshotSynced) parts.push('Datenbestand aktualisiert');
    const imported = r.csvReport?.processed.filter(p => !p.skipped).length ?? 0;
    if (imported > 0) parts.push(`${imported} CSV-Quelle(n) importiert`);
    if (r.lockBusy) parts.push(`Übersprungen — ${r.lockBusy.blockingKurator} aktualisiert gerade`);
    if (mountedRef.current) setImportMsg(parts.length > 0 ? parts.join(' · ') : 'Bereits aktuell.');
    // Re-Check anstoßen → Punkt + „Letzter Import" frisch.
    bumpCsvSourcesSignal();
  });

  const state = result.state;
  const dotColor = importAction.busy
    ? 'bg-[var(--tf-warning-text)] animate-pulse'
    : state === 'fresh'
      ? 'bg-[var(--tf-success-text)]'
      : state === 'stale'
        ? 'bg-[var(--tf-danger-text)]'
        : 'bg-[var(--tf-text-tertiary)]';

  const statusColor = state === 'fresh'
    ? 'text-[var(--tf-success-text)]'
    : state === 'stale'
      ? 'text-[var(--tf-danger-text)]'
      : 'text-[var(--tf-text-tertiary)]';
  const statusLabel = state === 'fresh'
    ? 'Aktuell'
    : state === 'stale'
      ? 'Neue Exporte verfügbar'
      : 'Status unbekannt';

  const tip = state === 'stale'
    ? 'Neue CSV-Exporte verfügbar — klicken zum Importieren'
    : state === 'fresh'
      ? 'CSV-Exporte sind importiert'
      : 'CSV-Import-Status unbekannt';

  const lastImportStr = result.lastImport ? new Date(result.lastImport).toLocaleString('de-DE') : null;

  return (
    <>
      {/* Punkt + Wort („● CSV") — Stand der CSV-Exporte. Farbe = Live-Status. */}
      <button
        onClick={() => setOpen(true)}
        title={tip}
        aria-label={tip}
        className="inline-flex items-center gap-[5px] px-1.5 py-[3px] rounded-[var(--tf-radius-sm)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer shrink-0"
      >
        <span className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${dotColor}`} />
        CSV
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="CSV-Datenimport">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Database size={16} className={statusColor} />
            <span className="text-[13px] text-[var(--tf-text)]">{statusLabel}</span>
          </div>

          {lastImportStr && (
            <p className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
              Letzter CSV-Import: <span className="font-medium text-[var(--tf-text)]">{lastImportStr}</span>
            </p>
          )}

          {state === 'stale' && result.pendingNames.length > 0 && (
            <div className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
              <p className="mb-1">Neuere Export-Dateien:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {result.pendingNames.slice(0, 5).map(n => (
                  <li key={n} className="text-[var(--tf-text)]">{n}</li>
                ))}
                {result.pendingNames.length > 5 && (
                  <li className="text-[var(--tf-text-tertiary)]">+{result.pendingNames.length - 5} weitere</li>
                )}
              </ul>
            </div>
          )}

          {state === 'stale' && (
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => importAction.run()}
              disabled={importAction.busy || !dsAvailable}
            >
              {importAction.busy ? 'Importiere…' : 'Jetzt importieren'}
            </Button>
          )}

          <Button
            variant="ghost"
            icon={Settings}
            onClick={() => { navigate('einstellungen'); setOpen(false); }}
          >
            Zu den Einstellungen
          </Button>

          {importMsg && (
            <p className="text-[12px] text-[var(--tf-success-text)] leading-snug">{importMsg}</p>
          )}
          {importAction.error && (
            <p className="text-[12px] text-[var(--tf-danger-text)] leading-snug">Fehler: {importAction.error}</p>
          )}

          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] leading-snug">
            Vergleicht die verknüpften CSV-Exporte mit dem importierten Datenbestand.
            Eine Quelle (Projektbeschreibung) wird nur am Wochenende neu exportiert —
            ein älterer Stand dort ist normal.
          </p>
        </div>
      </Dialog>
    </>
  );
}

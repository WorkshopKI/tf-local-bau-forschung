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
import { deriveCsvFreshnessState, type CsvFreshnessState } from '@/plugins/csv-sources-kuration/services/csv-freshness-state';
import { getCsvSourceDirHandle, requestCsvSourceDirPermission, pickAndLinkCsvFolder } from '@/plugins/csv-sources-kuration/csv-source-handle';
import { isDevFixturesEnabled, isKuratorMenusEnabled } from '@/config/feature-flags';
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

/** Pro importierter Quelle: welche Datei mit welchem Datum tatsächlich drin ist. */
interface ImportedSourceInfo {
  name: string;
  /** Dateiname der zuletzt importierten Export-Datei. */
  fileName: string | null;
  /** `File.lastModified` (epoch ms) dieser Datei = „Export vom …". */
  sourceLastModified: number | null;
  /** Wann der Import gelaufen ist (ISO). */
  lastImportedAt: string | null;
  /** Zeilen im letzten Import. */
  rowCount: number | null;
}

interface CsvFreshnessResult {
  state: CsvFreshnessState;
  /**
   * Fehlkonfiguration (prod-Fixtures / unerreichbare Dateien) — echte Daten kommen
   * nicht an. Erzwingt einen roten Punkt + Warn-Zeile statt stiller „grün".
   */
  misconfig: boolean;
  /** Quellen-Namen mit neueren Export-Daten (für die Dialog-Liste). */
  pendingNames: string[];
  /** Fixture-Quellen (`fixture-real-*`) in einem Prod-Build — vom Import ausgeschlossen. */
  fixtureNames: string[];
  /** Verknüpfte Quellen, deren Datei nicht erreichbar war. */
  fileMissingNames: string[];
  /** Jüngstes `last_imported_at` über alle Schemas (ISO) oder null. */
  lastImport: string | null;
  /** Pro Quelle: importierte Datei + Datei-Datum + Zeilen (für den Detail-Dialog). */
  sources: ImportedSourceInfo[];
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

  // Pro Quelle: welche Datei mit welchem Datum tatsächlich importiert wurde.
  // Nur verknüpfte/importierte Quellen (haben Datei oder Import). Master zuerst,
  // sonst alphabetisch.
  const sources: ImportedSourceInfo[] = all
    .filter(s => s.source_file_name || s.last_imported_at)
    .sort((a, b) =>
      a.is_master === b.is_master
        ? a.csv_source_name.localeCompare(b.csv_source_name, 'de')
        : a.is_master ? -1 : 1,
    )
    .map(s => ({
      name: s.csv_source_name,
      fileName: s.source_file_name ?? null,
      sourceLastModified: s.source_last_modified ?? null,
      lastImportedAt: s.last_imported_at ?? null,
      rowCount: s.last_row_count ?? null,
    }));

  const { candidates, permissionNeeded, unlinked, fixtures, fileMissing } = await collectCandidates(idb);
  const pendingNames = candidates.map(c => c.schema.csv_source_name);
  // Fixtures sind NUR in einem Produktions-Build ein Problem — in dev sind sie
  // erwartet/gebündelt (`demoDataBundled`).
  const isProd = !isDevFixturesEnabled();
  const fixtureNames = isProd ? fixtures.map(f => f.schemaName) : [];
  const fileMissingNames = fileMissing.map(f => f.schemaName);

  const { state, misconfig } = deriveCsvFreshnessState({
    totalSchemas: all.length,
    candidates: candidates.length,
    permissionNeeded: permissionNeeded.length,
    unlinked: unlinked.length,
    fixtures: fixtures.length,
    fileMissing: fileMissing.length,
    isProd,
    // Der Check läuft nur, wenn der Share online + geprüft ist (Effekt-Gate:
    // startupPhase 'done' + smbStatus 'online'). Der 'offline'-Zustand kommt daher
    // aus dem Initial-Result, nicht aus diesem (erreichbaren) Durchlauf.
    shareReachable: true,
  });

  return { state, misconfig, pendingNames, fixtureNames, fileMissingNames, lastImport, sources };
}

export function CsvFreshnessIndicator({ compact = false }: { compact?: boolean } = {}): React.ReactElement {
  const { navigate } = useNavigation();
  const storage = useStorage();
  const startupPhase = useStartupDataStatus(s => s.phase);
  const smbStatus = useSmbStatus(s => s.status);
  const dsAvailable = useConnectionState(s => s.datenShareAvailable);
  const sourcesSignal = useCsvSourcesSignal(s => s.version);

  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CsvFreshnessResult>({ state: 'offline', misconfig: false, pendingNames: [], fixtureNames: [], fileMissingNames: [], lastImport: null, sources: [] });
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

  // „Erzwungen neu prüfen/importieren": umgeht den mtime/Größe/Checksum-Fast-Path
  // (forceRecheck). Selbstbedienungs-Weg gegen einen Citrix-False-Negative, auch
  // wenn der Punkt fälschlich „grün" zeigt. Der Importer difft per Row-Hash und
  // schreibt nur bei echtem Delta — ein Force-Klick ohne Änderung ist ein No-Op.
  const forceAction = useAsyncAction(async () => {
    setImportMsg(null);
    const handle = await getDatenShareHandle(storage.idb);
    if (!handle) throw new Error('Datenordner nicht verbunden.');
    const r = await runDataUpdate(storage.idb, handle, { forceRecheck: true });
    const imported = r.csvReport?.processed.filter(p => !p.skipped).length ?? 0;
    if (mountedRef.current) {
      setImportMsg(imported > 0
        ? `Erzwungen: ${imported} CSV-Quelle(n) re-importiert`
        : 'Erzwungen geprüft — keine inhaltlichen Änderungen gefunden.');
    }
    bumpCsvSourcesSignal();
  });

  // „CSV-Ordner verknüpfen / Zugriff erneuern" (state === 'needs_link'): Ordner-
  // Handle vorhanden aber Zugriff verloren → Permission neu anfordern; sonst Ordner
  // neu wählen + verknüpfen. Beides braucht das Klick-Gesture.
  const linkAction = useAsyncAction(async () => {
    setImportMsg(null);
    const dirHandle = await getCsvSourceDirHandle(storage.idb);
    if (dirHandle) {
      const perm = await requestCsvSourceDirPermission(dirHandle);
      if (perm !== 'granted') throw new Error('Ordner-Zugriff nicht erlaubt.');
    } else {
      const all: CsvSchema[] = [];
      for (const p of await listProgramme(storage.idb)) all.push(...(await listSchemas(storage.idb, p.id)));
      const r = await pickAndLinkCsvFolder(storage.idb, all);
      if (!r.linked) return; // abgebrochen
    }
    if (mountedRef.current) setImportMsg('CSV-Ordner verknüpft.');
    bumpCsvSourcesSignal();
  });

  const busy = importAction.busy || forceAction.busy || linkAction.busy;
  const state = result.state;
  const dotColor = busy
    ? 'bg-[var(--tf-warning-text)] animate-pulse'
    : state === 'fresh'
      ? 'bg-[var(--tf-success-text)]'
      : state === 'stale' || state === 'no_sources'
        ? 'bg-[var(--tf-danger-text)]'
        : state === 'needs_link'
          ? 'bg-[var(--tf-warning-text)]'
          : 'bg-[var(--tf-text-tertiary)]';

  const misconfig = result.misconfig;
  const statusColor = state === 'fresh'
    ? 'text-[var(--tf-success-text)]'
    : state === 'stale' || state === 'no_sources'
      ? 'text-[var(--tf-danger-text)]'
      : state === 'needs_link'
        ? 'text-[var(--tf-warning-text)]'
        : 'text-[var(--tf-text-tertiary)]';
  const statusLabel = misconfig
    ? 'Achtung — Quellen ausgeschlossen'
    : state === 'fresh'
      ? 'Aktuell'
      : state === 'stale'
        ? 'Neue Exporte verfügbar'
        : state === 'no_sources'
          ? 'Keine CSV-Quellen — Datenbestand prüfen'
          : state === 'needs_link'
            ? 'CSV-Ordner verknüpfen'
            : 'Status offline';

  const tip = misconfig
    ? 'CSV-Quellen werden nicht importiert — klicken für Details'
    : state === 'stale'
      ? 'Neue CSV-Exporte verfügbar — klicken zum Importieren'
      : state === 'fresh'
        ? 'CSV-Exporte sind importiert'
        : state === 'no_sources'
          ? 'Keine CSV-Quellen im Datenbestand — klicken für Details'
          : state === 'needs_link'
            ? 'CSV-Ordner nicht verknüpft — klicken zum Verknüpfen'
            : 'CSV-Status offline / nicht prüfbar';

  const lastImportStr = result.lastImport ? new Date(result.lastImport).toLocaleString('de-DE') : null;

  return (
    <>
      {/* Punkt + Wort („● CSV") — Stand der CSV-Exporte. Farbe = Live-Status. */}
      <button
        onClick={() => setOpen(true)}
        title={tip}
        aria-label={tip}
        className={`inline-flex items-center gap-[5px] ${compact ? 'px-0.5' : 'px-1.5'} py-[3px] rounded-[var(--tf-radius-sm)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer shrink-0`}
      >
        <span className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${dotColor}`} />
        {!compact && 'CSV'}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="CSV-Datenimport">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Database size={16} className={statusColor} />
            <span className="text-[13px] text-[var(--tf-text)]">{statusLabel}</span>
          </div>

          {result.fixtureNames.length > 0 && (
            <div className="rounded-md border-[0.5px] border-[var(--tf-danger-border)] bg-[var(--tf-danger-bg)] px-2.5 py-2 text-[12px] leading-snug">
              <p className="font-medium text-[var(--tf-danger-text)]">
                {result.fixtureNames.length} Quelle(n) sind Demo-/Fixture-Quellen — vom Import ausgeschlossen
              </p>
              <p className="mt-1 text-[var(--tf-text-secondary)]">
                Die echten CSV-Exporte werden für diese Quellen NIE importiert. In den echten
                Quellen umwandeln (Kurator-Build → CSV-Quellen). Betroffen:{' '}
                <span className="text-[var(--tf-text)]">{result.fixtureNames.slice(0, 5).join(', ')}</span>
                {result.fixtureNames.length > 5 ? ` +${result.fixtureNames.length - 5} weitere` : ''}
              </p>
            </div>
          )}

          {result.fileMissingNames.length > 0 && (
            <div className="rounded-md border-[0.5px] border-[var(--tf-danger-border)] bg-[var(--tf-danger-bg)] px-2.5 py-2 text-[12px] leading-snug">
              <p className="font-medium text-[var(--tf-danger-text)]">
                {result.fileMissingNames.length} Quelle(n): Datei nicht erreichbar
              </p>
              <p className="mt-1 text-[var(--tf-text-secondary)]">
                Datei fehlt im verknüpften Ordner oder Zugriff verloren. Betroffen:{' '}
                <span className="text-[var(--tf-text)]">{result.fileMissingNames.slice(0, 5).join(', ')}</span>
                {result.fileMissingNames.length > 5 ? ` +${result.fileMissingNames.length - 5} weitere` : ''}
              </p>
            </div>
          )}

          {state === 'no_sources' && (
            <div className="rounded-md border-[0.5px] border-[var(--tf-danger-border)] bg-[var(--tf-danger-bg)] px-2.5 py-2 text-[12px] leading-snug">
              <p className="font-medium text-[var(--tf-danger-text)]">
                Keine CSV-Quellen im Datenbestand
              </p>
              <p className="mt-1 text-[var(--tf-text-secondary)]">
                Der geladene Datenbestand enthält keine CSV-Quellen-Definitionen — der
                tägliche Import kann nicht laufen. Ursache liegt meist am veröffentlichten
                Snapshot (leer publizierte Quellen). Kurator/PL: die CSV-Quellen neu
                einlesen und den Datenbestand neu veröffentlichen.
              </p>
            </div>
          )}

          {state === 'needs_link' && (
            <div className="rounded-md border-[0.5px] border-[var(--tf-warning-border)] bg-[var(--tf-warning-bg)] px-2.5 py-2 text-[12px] leading-snug">
              <p className="font-medium text-[var(--tf-warning-text)]">
                CSV-Ordner nicht verknüpft / Zugriff verloren
              </p>
              <p className="mt-1 text-[var(--tf-text-secondary)]">
                Die CSV-Quellen sind da, aber der Export-Ordner ist nicht (mehr)
                erreichbar. Verknüpfen bzw. Zugriff erneuern, damit die täglichen
                Exporte wieder importiert werden.
              </p>
            </div>
          )}

          {lastImportStr && (
            <p className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
              Letzter CSV-Import: <span className="font-medium text-[var(--tf-text)]">{lastImportStr}</span>
            </p>
          )}

          {result.sources.length > 0 && (
            <div className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
              <p className="mb-1.5">Importierte Dateien:</p>
              <ul className="space-y-1.5">
                {result.sources.map(s => (
                  <li
                    key={s.name}
                    className="rounded-md border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-2.5 py-1.5"
                  >
                    <div className="font-medium text-[var(--tf-text)]">{s.name}</div>
                    <div className="text-[11px] text-[var(--tf-text-tertiary)] break-all">
                      {s.fileName ? (
                        <span className="font-mono text-[var(--tf-text-secondary)]">{s.fileName}</span>
                      ) : (
                        'keine Datei verknüpft'
                      )}
                      {s.sourceLastModified != null && (
                        <> · Export vom{' '}
                          <span className="text-[var(--tf-text-secondary)]">
                            {new Date(s.sourceLastModified).toLocaleString('de-DE')}
                          </span>
                        </>
                      )}
                    </div>
                    {(s.lastImportedAt || s.rowCount != null) && (
                      <div className="text-[11px] text-[var(--tf-text-tertiary)]">
                        {s.lastImportedAt && <>importiert {new Date(s.lastImportedAt).toLocaleString('de-DE')}</>}
                        {s.lastImportedAt && s.rowCount != null ? ' · ' : ''}
                        {s.rowCount != null && <>{s.rowCount.toLocaleString('de-DE')} Zeilen</>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
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
              disabled={busy || !dsAvailable}
            >
              {importAction.busy ? 'Importiere…' : 'Jetzt importieren'}
            </Button>
          )}

          {state === 'needs_link' && (
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => linkAction.run()}
              disabled={busy || !dsAvailable}
            >
              {linkAction.busy ? 'Verknüpfe…' : 'CSV-Ordner verknüpfen'}
            </Button>
          )}

          {/* Erzwungen — umgeht die „unverändert"-Erkennung (Citrix-False-Negative).
             Nur dev + kurator (isKuratorMenusEnabled): ein Diagnose-/Kurations-Werkzeug,
             das End-User in pl/as/prod nur verwirrt. Immer verfügbar, sobald
             verknüpfte Quellen existieren, auch bei „grün". */}
          {isKuratorMenusEnabled() && result.sources.length > 0 && (
            <Button
              variant="ghost"
              icon={RefreshCw}
              onClick={() => forceAction.run()}
              disabled={busy || !dsAvailable}
              title="Alle verknüpften Quellen neu einlesen und die Unverändert-Erkennung (mtime/Größe/Checksum) ignorieren. Importiert nur bei echter Inhaltsänderung."
            >
              {forceAction.busy ? 'Prüfe erzwungen…' : 'Erzwungen neu prüfen'}
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
          {(importAction.error || forceAction.error || linkAction.error) && (
            <p className="text-[12px] text-[var(--tf-danger-text)] leading-snug">Fehler: {importAction.error ?? forceAction.error ?? linkAction.error}</p>
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

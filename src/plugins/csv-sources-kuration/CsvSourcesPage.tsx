// TODO(refactor v2.4+): mischt Datei-Picker (FS-API), Schema-Liste, Wartungs-/Reset-Sektion und 4 Dialog-Orchestrierungen — entlang dieser Grenzen aufteilen (opportunistisch beim nächsten Anfassen).
// Vorschlag: SourceList.tsx + SourceDetailPanel.tsx + SourceModals.tsx; Plugin-Page wird zum Layout-Container.
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, Sparkles, Columns3, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDevFixturesEnabled } from '@/config/feature-flags';
import { fixtureSourceWarning } from './services/fixture-source-warning';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  ensureDefaultProgramm,
  listSchemas,
  removeSchema,
  clearAntragData,
  countAntragData,
} from '@/core/services/csv';
import type { CsvSchema } from '@/core/services/csv/types';
import type { ClearAntragDataResult } from '@/core/services/csv';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CsvSourceWizard } from './wizard/CsvSourceWizard';
import { CsvSourceReimportDialog } from './CsvSourceReimportDialog';
import { CsvAddColumnsDialog } from './CsvAddColumnsDialog';
import { RemapCsvColumnsDialog } from './RemapCsvColumnsDialog';
import { CsvSchemaDetailDialog } from './CsvSchemaDetailDialog';
import {
  checkSourceForUpdate,
  loadFileFromStoredHandle,
  removeCsvSourceHandle,
  type UpdateCheckResult,
} from './csv-source-handle';

interface ReimportRequest {
  schema: CsvSchema;
  file: File;
  sourceHandle: FileSystemFileHandle | null;
  trigger: 'reselect' | 'auto-update';
}

interface AddColumnsRequest {
  schema: CsvSchema;
  file: File;
  sourceHandle: FileSystemFileHandle | null;
  newColumns: string[];
}

function isFsApiSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

interface PickedFile {
  file: File;
  handle: FileSystemFileHandle | null;
}

async function pickCsvFile(): Promise<PickedFile | null> {
  if (!isFsApiSupported()) {
    // Fallback: lege ein verstecktes Input-Element an. Liefert kein
    // persistierbares Handle (Auto-Update bleibt für diese Source aus).
    return await new Promise<PickedFile | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,text/csv';
      input.onchange = () => {
        const f = input.files?.[0];
        resolve(f ? { file: f, handle: null } : null);
      };
      input.click();
    });
  }
  try {
    const handles = await (window as typeof window & {
      showOpenFilePicker(opts?: {
        types?: { description?: string; accept: Record<string, string[]> }[];
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
      }): Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker({
      types: [{ description: 'CSV-Datei', accept: { 'text/csv': ['.csv'] } }],
      multiple: false,
    });
    const handle = handles[0];
    if (!handle) return null;
    const file = await handle.getFile();
    return { file, handle };
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}

export function CsvSourcesPage(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [programmId, setProgrammId] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reimportRequest, setReimportRequest] = useState<ReimportRequest | null>(null);
  const [addColumnsRequest, setAddColumnsRequest] = useState<AddColumnsRequest | null>(null);
  const [remapSchema, setRemapSchema] = useState<CsvSchema | null>(null);
  const [detailSchema, setDetailSchema] = useState<CsvSchema | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetCounts, setResetCounts] = useState<ClearAntragDataResult | null>(null);
  const [resetResult, setResetResult] = useState<ClearAntragDataResult | null>(null);
  const [updateChecks, setUpdateChecks] = useState<Record<string, UpdateCheckResult>>({});
  const [pickError, setPickError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const id = activeProgrammId ?? (await ensureDefaultProgramm(storage.idb)).id;
    setProgrammId(id);
    setSchemas(await listSchemas(storage.idb, id));
  }, [storage.idb, activeProgrammId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Auto-Update-Check beim Mount und nach jedem Schema-Refresh: prüft für
  // jedes Schema mit persistiertem FileSystemFileHandle, ob die Original-CSV
  // einen neueren `lastModified`-Stempel hat. Banner mit "Aktualisieren"-
  // Button erscheint pro Schema mit Treffer (siehe Liste unten).
  useEffect(() => {
    let alive = true;
    if (schemas.length === 0) {
      setUpdateChecks({});
      return () => { alive = false; };
    }
    (async () => {
      const results = await Promise.all(
        schemas.map(async s => [s.id, await checkSourceForUpdate(storage.idb, s)] as const),
      );
      if (!alive) return;
      setUpdateChecks(Object.fromEntries(results));
    })();
    return () => { alive = false; };
  }, [schemas, storage.idb]);

  const onConfirmDelete = async (s: CsvSchema): Promise<void> => {
    await removeSchema(storage.idb, s.id);
    await removeCsvSourceHandle(storage.idb, s.id);
    await logAudit(storage.idb, { action: 'csv_schema_deleted', user: session.kuratorName ?? undefined, details: { schemaId: s.id } });
    setDeleteConfirmId(null);
    await refresh();
  };

  const openResetConfirm = useAsyncAction(async () => {
    setResetResult(null);
    const c = await countAntragData(storage.idb);
    setResetCounts(c);
    setResetConfirmOpen(true);
  });

  const confirmReset = useAsyncAction(async () => {
    const r = await clearAntragData(storage.idb);
    await logAudit(storage.idb, {
      action: 'antrag_data_cleared',
      user: session.kuratorName ?? undefined,
      details: { ...r },
    });
    setResetResult(r);
    setResetConfirmOpen(false);
  });

  async function handleReselect(schema: CsvSchema): Promise<void> {
    setPickError(null);
    try {
      const picked = await pickCsvFile();
      if (!picked) return;
      setReimportRequest({
        schema,
        file: picked.file,
        sourceHandle: picked.handle,
        trigger: 'reselect',
      });
    } catch (err) {
      setPickError((err as Error).message);
    }
  }

  async function handleAutoUpdate(schema: CsvSchema): Promise<void> {
    setPickError(null);
    try {
      const { file, handle } = await loadFileFromStoredHandle(storage.idb, schema.id);
      setReimportRequest({
        schema,
        file,
        sourceHandle: handle,
        trigger: 'auto-update',
      });
    } catch (err) {
      setPickError(`Auto-Update fehlgeschlagen: ${(err as Error).message}. Bitte „CSV neu wählen".`);
    }
  }


  const fixtureWarn = fixtureSourceWarning(schemas, isDevFixturesEnabled());

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">CSV-Sources</h1>
        <Button
          variant="default"
          size="sm"
          onClick={() => setWizardOpen(true)}
          disabled={!session.isActive || !programmId}
        >
          Neu registrieren
        </Button>
      </div>

      {!session.isActive ? (
        <div className="mb-4 text-[12.5px] text-[var(--tf-text-secondary)]">
          Kurator-Modus nicht aktiv. Schemas sind nur lesbar. Aktivierung in Einstellungen → Profil → Kurator-Bereich.
        </div>
      ) : null}

      {pickError ? (
        <div className="mb-4 rounded-md border-[0.5px] border-red-300 bg-red-50 p-2.5 text-[12px] text-red-800">
          {pickError}
        </div>
      ) : null}

      {fixtureWarn ? (
        <div className="mb-4 rounded-md border-[0.5px] border-red-300 bg-red-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-red-700" />
            <div className="text-[12px] text-red-900">
              <div className="font-medium mb-0.5">
                {fixtureWarn.allFixtures
                  ? 'Nur Demo-/Fixture-Quellen registriert — keine echten CSV-Quellen.'
                  : `${fixtureWarn.fixtureCount} von ${fixtureWarn.total} Quellen sind Demo-/Fixture-Quellen.`}
              </div>
              Diese <span className="font-mono">fixture-real-*</span>-Quellen sind vom Auto-Refresh
              ausgeschlossen — die echten CSV-Exporte werden so <strong>nie importiert</strong>. Lege die
              echten Quellen über <strong>„Neu registrieren"</strong> an (Encoding ggf. Windows-1252) und
              lösche danach die Fixture-Quellen{fixtureWarn.allFixtures ? ' + „Antrags-Daten zurücksetzen"' : ''}.
            </div>
          </div>
        </div>
      ) : null}

      <SectionHeader label={`Registrierte Schemas (${schemas.length})`} />

      {schemas.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
          Noch keine CSV-Source registriert.
        </div>
      ) : (
        <div>
          {schemas.sort((a, b) => b.priority - a.priority).map((s, i) => {
            const isConfirming = deleteConfirmId === s.id;
            const update = updateChecks[s.id];
            const hasUpdate = update?.state === 'update_available';
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailSchema(s)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDetailSchema(s);
                  }
                }}
                className="flex items-center justify-between py-3 px-2 -mx-2 rounded-md cursor-pointer hover:bg-[var(--tf-bg-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]"
                style={i === schemas.length - 1 ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
              >
                <div className="min-w-0">
                  <div className="text-[14px] text-[var(--tf-text)] flex items-center gap-2">
                    {s.csv_source_name}
                    {s.is_master ? <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-800">Master</span> : null}
                  </div>
                  <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                    <span className="font-mono">{s.id}</span> · join={s.join_key} · priority={s.priority}
                    {s.last_imported_at ? ` · letzter Import ${new Date(s.last_imported_at).toLocaleString('de-DE')}` : ''}
                    {typeof s.last_row_count === 'number' ? ` · ${s.last_row_count} Zeilen` : ''}
                    {hasUpdate && update.state === 'update_available' ? (
                      <>
                        {' · '}
                        <span
                          className="inline-flex items-center gap-1 font-medium"
                          style={{ color: 'var(--tf-primary)' }}
                        >
                          <Sparkles size={11} />
                          neue CSV vom {new Date(update.lastModified).toLocaleString('de-DE')}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                {isConfirming ? (
                  <div
                    className="flex items-center gap-2 max-w-[60%]"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="text-[11.5px] text-[var(--tf-text-secondary)] text-right">
                      Schema dauerhaft löschen?<br />
                      Re-Import-Konfiguration geht verloren. Importierte Anträge bleiben.
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); setDeleteConfirmId(null); }}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={e => { e.stopPropagation(); void onConfirmDelete(s); }}
                    >
                      Endgültig löschen
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={e => { e.stopPropagation(); if (hasUpdate) void handleAutoUpdate(s); }}
                      disabled={!session.isActive || !hasUpdate}
                      title={
                        hasUpdate && update.state === 'update_available'
                          ? `Neuere Version vom ${new Date(update.lastModified).toLocaleString('de-DE')} importieren`
                          : update?.state === 'local_fixture'
                            ? 'Dev-Test-Fixture (docs/fixtures) — keine externe Quelle zum Aktualisieren'
                            : update?.state === 'no_handle'
                            ? "Noch keine Quelldatei registriert — einmal 'CSV neu wählen' nutzen, damit Auto-Update aktiv wird"
                            : update?.state === 'permission_required'
                              ? "Datei-Zugriff nicht erlaubt — 'CSV neu wählen' nutzen, um die Quelldatei neu zuzuweisen"
                              : update?.state === 'file_missing'
                                ? "Quelldatei am alten Speicherort nicht gefunden — 'CSV neu wählen' nutzen"
                                : "Keine neuere Version am Ablageort erkannt"
                      }
                    >
                      <Sparkles size={13} /> CSV Daten aktualisieren
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); setRemapSchema(s); }}
                      disabled={!session.isActive || !s.last_imported_at}
                      title={
                        s.last_imported_at
                          ? 'Spalten der gespeicherten CSV neu zuordnen (z.B. Eigenes Feld → Standardfeld) — ohne Datei neu zu wählen'
                          : 'Noch kein Import — zuerst „CSV neu wählen" nutzen'
                      }
                    >
                      <Columns3 size={13} /> Spalten neu mappen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); void handleReselect(s); }}
                      disabled={!session.isActive}
                      title="Andere CSV-Datei wählen — z.B. wenn die Datei an einem neuen Ort liegt"
                    >
                      <RefreshCw size={13} /> CSV neu wählen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={e => { e.stopPropagation(); setDeleteConfirmId(s.id); }}
                      disabled={!session.isActive}
                      title="Schema löschen"
                      aria-label="Schema löschen"
                      className="h-8 w-8 p-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <section
        className="mt-10 rounded-[12px] p-[18px]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <h3 className="text-[13px] font-medium text-[var(--tf-text)] mb-1">Wartung</h3>
        <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3">
          Wenn importierte Antrags-Daten unleserlich erscheinen
          (z.B. <code className="font-mono">Ã+ã€™Ãƒâ€¡</code> statt Umlauten), liegt fast immer ein
          Encoding-Problem an der Quell-CSV vor. Bereinige die Quelldatei extern
          (Excel: „CSV UTF-8 (durch Semikolon getrennt)" beim Speichern, oder
          <code className="font-mono"> iconv -f WINDOWS-1252 -t UTF-8</code>) und nutze danach diesen Reset:
        </p>

        {resetResult ? (
          <div className="text-[12px] text-emerald-700 mb-3">
            Reset abgeschlossen: {resetResult.antraege.toLocaleString('de-DE')} Anträge,{' '}
            {resetResult.verbuende.toLocaleString('de-DE')} Verbünde,{' '}
            {resetResult.historie.toLocaleString('de-DE')} Historie-Einträge,{' '}
            {resetResult.rowHashes.toLocaleString('de-DE')} Row-Hashes gelöscht.
            Du kannst jetzt über „CSV neu wählen" oder „Neu registrieren" die CSVs erneut einspielen.
          </div>
        ) : null}

        {resetConfirmOpen && resetCounts ? (
          <div className="flex flex-col gap-2 p-3 rounded-[8px] bg-[var(--tf-bg-secondary)]">
            <p className="text-[12px] text-[var(--tf-text)]">
              Löscht{' '}
              <strong>{resetCounts.antraege.toLocaleString('de-DE')}</strong> Anträge,{' '}
              <strong>{resetCounts.verbuende.toLocaleString('de-DE')}</strong> Verbünde,{' '}
              <strong>{resetCounts.historie.toLocaleString('de-DE')}</strong> Historie-Einträge und{' '}
              <strong>{resetCounts.rowHashes.toLocaleString('de-DE')}</strong> Row-Hashes.
              CSV-Schemas und Programme bleiben erhalten — die importierten Quellen kannst du
              danach unverändert re-importieren.
            </p>
            {confirmReset.error ? (
              <div className="text-[12px] text-[var(--tf-danger-text)]">
                Fehler: {confirmReset.error}
              </div>
            ) : null}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetConfirmOpen(false)}
                disabled={confirmReset.busy}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => confirmReset.run()}
                disabled={confirmReset.busy}
              >
                {confirmReset.busy ? 'Lösche…' : 'Antrags-Daten löschen'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openResetConfirm.run()}
              disabled={!session.isActive || openResetConfirm.busy}
            >
              Antrags-Daten zurücksetzen
            </Button>
            {openResetConfirm.error ? (
              <div className="mt-2 text-[12px] text-[var(--tf-danger-text)]">
                Fehler: {openResetConfirm.error}
              </div>
            ) : null}
          </>
        )}
      </section>

      {programmId ? (
        <CsvSourceWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          programmId={programmId}
          onCompleted={() => { void refresh(); }}
          onUseExistingSchema={(schema, file) => setReimportRequest({
            schema,
            file,
            sourceHandle: null,
            trigger: 'reselect',
          })}
        />
      ) : null}

      {reimportRequest ? (
        <CsvSourceReimportDialog
          schema={reimportRequest.schema}
          file={reimportRequest.file}
          sourceHandle={reimportRequest.sourceHandle}
          trigger={reimportRequest.trigger}
          onClose={() => setReimportRequest(null)}
          onCompleted={() => { void refresh(); }}
          onAddNewColumns={newColumns => {
            if (!reimportRequest) return;
            setAddColumnsRequest({
              schema: reimportRequest.schema,
              file: reimportRequest.file,
              sourceHandle: reimportRequest.sourceHandle,
              newColumns,
            });
            setReimportRequest(null);
          }}
        />
      ) : null}

      {addColumnsRequest ? (
        <CsvAddColumnsDialog
          schema={addColumnsRequest.schema}
          file={addColumnsRequest.file}
          sourceHandle={addColumnsRequest.sourceHandle}
          newColumns={addColumnsRequest.newColumns}
          onClose={() => setAddColumnsRequest(null)}
          onCompleted={() => { void refresh(); }}
        />
      ) : null}

      {remapSchema ? (
        <RemapCsvColumnsDialog
          schema={remapSchema}
          onClose={() => setRemapSchema(null)}
          onCompleted={() => { void refresh(); }}
        />
      ) : null}

      {detailSchema ? (
        <CsvSchemaDetailDialog
          schema={detailSchema}
          onClose={() => setDetailSchema(null)}
          onSaved={() => { void refresh(); }}
        />
      ) : null}
    </div>
  );
}

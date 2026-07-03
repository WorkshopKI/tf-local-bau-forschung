import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDevFixturesEnabled } from '@/config/feature-flags';
import { fixtureSourceWarning } from './services/fixture-source-warning';
import { convertAllFixtureSources, type ConvertedSource } from './services/convert-fixture-source';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { ensureDefaultProgramm, listSchemas, removeSchema } from '@/core/services/csv';
import type { CsvSchema } from '@/core/services/csv/types';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  checkSourceForUpdate,
  loadFileFromStoredHandle,
  removeCsvSourceHandle,
  type UpdateCheckResult,
} from './csv-source-handle';
import { pickCsvFile } from './csv-file-picker';
import { SourceList } from './SourceList';
import { MaintenanceSection } from './MaintenanceSection';
import { SourceModals, type ReimportRequest, type AddColumnsRequest } from './SourceModals';

/**
 * Container der CSV-Sources-Kurationsseite: hält Programm-/Schema-Zustand +
 * Auto-Update-Checks + Datei-Picker-Verkettung und komponiert die extrahierten
 * Bausteine (SourceList, MaintenanceSection, SourceModals). Die Verantwortungen
 * wurden 2026-07 entlang der TODO-Grenzen aufgeteilt.
 */
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
  const [updateChecks, setUpdateChecks] = useState<Record<string, UpdateCheckResult>>({});
  const [pickError, setPickError] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertedSource[] | null>(null);

  const refresh = useCallback(async () => {
    const id = activeProgrammId ?? (await ensureDefaultProgramm(storage.idb)).id;
    setProgrammId(id);
    setSchemas(await listSchemas(storage.idb, id));
  }, [storage.idb, activeProgrammId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Auto-Update-Check beim Mount und nach jedem Schema-Refresh: prüft für
  // jedes Schema mit persistiertem FileSystemFileHandle, ob die Original-CSV
  // einen neueren `lastModified`-Stempel hat.
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

  // Demo-/Fixture-Quellen in echte Quellen umwandeln (Mapping bleibt, neue
  // Nicht-Fixture-ID). Danach läuft der Auto-Refresh.
  const convertFixtures = useAsyncAction(async () => {
    const res = await convertAllFixtureSources(storage.idb, schemas);
    if (res.length > 0) {
      await logAudit(storage.idb, {
        action: 'csv_fixture_converted',
        user: session.kuratorName ?? undefined,
        details: { converted: res.map(r => ({ from: r.oldId, to: r.newId })) },
      });
    }
    setConvertResult(res);
    await refresh();
  });

  // FS-API-Geste (Bug-Klasse 2): pickCsvFile / loadFileFromStoredHandle werden
  // synchron aus der Klick-Geste heraus aufgerufen (setPickError davor ist sync).
  // KEIN zusätzliches await davor einfügen — sonst öffnet der Datei-Dialog nicht.
  async function handleReselect(schema: CsvSchema): Promise<void> {
    setPickError(null);
    try {
      const picked = await pickCsvFile();
      if (!picked) return;
      setReimportRequest({ schema, file: picked.file, sourceHandle: picked.handle, trigger: 'reselect' });
    } catch (err) {
      setPickError((err as Error).message);
    }
  }

  async function handleAutoUpdate(schema: CsvSchema): Promise<void> {
    setPickError(null);
    try {
      const { file, handle } = await loadFileFromStoredHandle(storage.idb, schema.id);
      setReimportRequest({ schema, file, sourceHandle: handle, trigger: 'auto-update' });
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

      {convertResult && convertResult.length > 0 ? (
        <div className="mb-4 rounded-md border-[0.5px] border-emerald-300 bg-emerald-50 p-3 text-[12px] text-emerald-900">
          <div className="font-medium mb-0.5">
            {convertResult.length} Demo-Quelle{convertResult.length === 1 ? '' : 'n'} in echte Quellen umgewandelt — Mappings übernommen.
          </div>
          <div className="font-mono text-[11px] mb-1">{convertResult.map(r => `${r.name} → ${r.newId}`).join(' · ')}</div>
          Nächste Schritte: pro Quelle <strong>„CSV neu wählen"</strong> → echte Datei → <strong>Windows-1252</strong> → importieren;
          danach <strong>„Antrags-Daten zurücksetzen"</strong> (löscht die Demo-Anträge).
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
              ausgeschlossen — die echten CSV-Exporte werden so <strong>nie importiert</strong>.
              Wandle sie in echte Quellen um (Mapping bleibt erhalten) oder lege sie über
              „Neu registrieren" neu an.
              {session.isActive ? (
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => convertFixtures.run()}
                    disabled={convertFixtures.busy}
                  >
                    {convertFixtures.busy ? 'Wandle um…' : 'In echte Quellen umwandeln (Mapping bleibt)'}
                  </Button>
                  {convertFixtures.error ? (
                    <span className="text-[11.5px] text-red-700">Fehler: {convertFixtures.error}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <SourceList
        schemas={schemas}
        sessionActive={session.isActive}
        updateChecks={updateChecks}
        deleteConfirmId={deleteConfirmId}
        setDeleteConfirmId={setDeleteConfirmId}
        onOpenDetail={setDetailSchema}
        onAutoUpdate={handleAutoUpdate}
        onRemap={setRemapSchema}
        onReselect={handleReselect}
        onConfirmDelete={onConfirmDelete}
      />

      <MaintenanceSection />

      <SourceModals
        programmId={programmId}
        wizardOpen={wizardOpen}
        onCloseWizard={() => setWizardOpen(false)}
        reimportRequest={reimportRequest}
        setReimportRequest={setReimportRequest}
        addColumnsRequest={addColumnsRequest}
        setAddColumnsRequest={setAddColumnsRequest}
        remapSchema={remapSchema}
        setRemapSchema={setRemapSchema}
        detailSchema={detailSchema}
        setDetailSchema={setDetailSchema}
        onRefresh={() => { void refresh(); }}
      />
    </div>
  );
}

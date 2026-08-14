/**
 * Panel „CSV-Quellen" — bis v4.36 die eigene Seite `/kuration/csv-quellen`.
 *
 * Der ORDNER `src/plugins/csv-sources-kuration/` bleibt, wo er ist, und das ist
 * kein Versehen: dort liegt neben der Seite auch die Auto-Refresh- und
 * Datenupdate-Maschine, die `App.tsx` und `ShellLayout` beim Start hochfahren.
 * Umgezogen ist, was NUR Seite war (Programme, Filter, Suchindex,
 * Dokumentenquellen); geblieben ist, was zugleich Dienst der ganzen App ist.
 * Was hier steht, ist der Seiten-Rumpf — die Bausteine kommen von drueben.
 *
 * Links die Quellen mit ihren Aktionen, rechts der Zustand: derselbe Satz, den
 * der Punkt „● CSV" in der Fusszeile und die Kuration-Uebersicht zeigen
 * (`csvFreshnessAussage`), damit die Seite und der Ort, der auf sie zeigt,
 * nicht zwei Dinge behaupten.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDevContext, isDevFixturesEnabled } from '@/config/feature-flags';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { ensureDefaultProgramm, listSchemas } from '@/core/services/csv';
import type { CsvSchema } from '@/core/services/csv/types';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  SettingsGruppe,
  SettingsGruppenAktion,
  SettingsKennzahl,
  SettingsKlappe,
  SettingsOption,
  SettingsStatusBadge,
  SettingsZweiSpalten,
  type SettingsBadgeTon,
} from '@/components/settings';
import { useCsvFreshness } from '@/components/ui/CsvFreshnessIndicator';
import { fixtureSourceWarning } from '@/plugins/csv-sources-kuration/services/fixture-source-warning';
import {
  convertAllFixtureSources,
  type ConvertedSource,
} from '@/plugins/csv-sources-kuration/services/convert-fixture-source';
import {
  csvFreshnessAussage,
  type CsvFreshnessTon,
} from '@/plugins/csv-sources-kuration/services/csv-freshness-state';
import { entferneQuelle } from '@/plugins/csv-sources-kuration/services/quelle-entfernen';
import {
  checkSourceForUpdate,
  loadFileFromStoredHandle,
  type UpdateCheckResult,
} from '@/plugins/csv-sources-kuration/csv-source-handle';
import { pickCsvFile } from '@/plugins/csv-sources-kuration/csv-file-picker';
import { SourceList } from '@/plugins/csv-sources-kuration/SourceList';
import { MaintenanceSection } from '@/plugins/csv-sources-kuration/MaintenanceSection';
import { SchemaRecoverySection } from '@/plugins/csv-sources-kuration/SchemaRecoverySection';
import {
  SourceModals,
  type ReimportRequest,
  type AddColumnsRequest,
} from '@/plugins/csv-sources-kuration/SourceModals';

/** „Nicht pruefbar" (offline, kein Handle) heisst am Badge `neutral`. */
const CSV_ZU_TON: Record<CsvFreshnessTon, SettingsBadgeTon> = {
  ok: 'ok',
  warnung: 'warnung',
  fehler: 'fehler',
  unbekannt: 'neutral',
};

export function CsvQuellenPanel(): React.ReactElement {
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

  const csv = useCsvFreshness();
  const aussage = csvFreshnessAussage({ state: csv.state, misconfig: csv.misconfig });

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
    const abraeumung = await entferneQuelle(storage.idb, s);
    await logAudit(storage.idb, {
      action: 'csv_schema_deleted',
      user: session.kuratorName ?? undefined,
      details: { schemaId: s.id, ...abraeumung },
    });
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
  const offeneUpdates = Object.values(updateChecks).filter(u => u.state === 'update_available').length;
  const zeilen = schemas.reduce((s, x) => s + (x.last_row_count ?? 0), 0);

  return (
    <SettingsZweiSpalten
      haupt={
        <>
          {pickError ? (
            <div className="rounded-[var(--tf-radius)] p-2.5 text-[12px]" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>
              {pickError}
            </div>
          ) : null}

          {convertResult && convertResult.length > 0 ? (
            <div className="rounded-[var(--tf-radius)] p-3 text-[12px]" style={{ background: 'var(--tf-success-bg)', color: 'var(--tf-success-text)' }}>
              <div className="font-medium mb-0.5">
                {convertResult.length} Demo-Quelle{convertResult.length === 1 ? '' : 'n'} in echte Quellen umgewandelt — Mappings übernommen.
              </div>
              <div className="font-mono text-[11px] mb-1">{convertResult.map(r => `${r.name} → ${r.newId}`).join(' · ')}</div>
              Die Demo-Anträge sind dabei bereits entfernt worden. Nächster und einziger Schritt: pro
              Quelle <strong>„CSV neu wählen"</strong> → echte Datei → <strong>Windows-1252</strong> →
              importieren. <strong>„Antrags-Daten zurücksetzen"</strong> wird dafür nicht gebraucht — es
              löscht herkunftsblind alles, also auch die echten Daten, die eben eingespielt wurden.
            </div>
          ) : null}

          {fixtureWarn ? (
            <div className="rounded-[var(--tf-radius)] p-3" style={{ background: 'var(--tf-danger-bg)' }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-[var(--tf-danger-text)]" />
                <div className="text-[12px] text-[var(--tf-danger-text)]">
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
                        <span className="text-[11.5px]">Fehler: {convertFixtures.error}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <SettingsGruppe
            id="sec-csv-quellen"
            titel="Registrierte Quellen"
            unterzeile="Welche CSV-Exporte des Fachsystems in die App laufen."
            hint="Jede Quelle merkt sich ihre Datei, das Spalten-Mapping und den letzten Import. Der Knopf CSV Daten aktualisieren wird aktiv, sobald am Ablageort eine neuere Datei liegt; Spalten neu mappen ordnet die gespeicherte Datei ohne neuen Dateidialog zu. Ein Klick auf die Zeile öffnet die Details der Quelle."
            rechts={schemas.length > 0 ? `${schemas.length} Quellen` : undefined}
            aktion={
              <SettingsGruppenAktion
                onClick={() => setWizardOpen(true)}
                disabled={!session.isActive || !programmId}
              >
                Neu registrieren
              </SettingsGruppenAktion>
            }
          >
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
          </SettingsGruppe>

          <SettingsGruppe titel="Selten gebraucht">
            <SettingsKlappe
              id="sec-csv-wartung"
              label="Antrags-Daten zurücksetzen"
              storageKey="teamflow_kuration_csv_wartung"
            >
              <MaintenanceSection />
            </SettingsKlappe>
            {isDevContext() && (
              <SettingsKlappe
                id="sec-csv-wiederherstellen"
                label="CSV-Schemas wiederherstellen (dev)"
                storageKey="teamflow_kuration_csv_recovery"
              >
                <SchemaRecoverySection
                  programmId={programmId}
                  onRestored={() => { void refresh(); }}
                />
              </SettingsKlappe>
            )}
          </SettingsGruppe>

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
        </>
      }
      neben={
        <SettingsGruppe
          id="sec-csv-zustand"
          titel="Zustand"
          rechts={<SettingsStatusBadge ton={CSV_ZU_TON[aussage.ton]}>{aussage.label}</SettingsStatusBadge>}
        >
          <div className="grid grid-cols-2 gap-2 pt-1 pb-1">
            <SettingsKennzahl label="Quellen" wert={schemas.length.toLocaleString('de-DE')} />
            <SettingsKennzahl label="Zeilen" wert={zeilen.toLocaleString('de-DE')} />
          </div>
          <SettingsOption
            label="Letzter Import"
            kurzzeile={csv.lastImport ? undefined : 'Noch kein Import verzeichnet.'}
          >
            <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
              {csv.lastImport ? new Date(csv.lastImport).toLocaleString('de-DE') : '—'}
            </span>
          </SettingsOption>
          <SettingsOption
            label="Neuere Datei am Ablageort"
            kurzzeile={
              offeneUpdates > 0
                ? 'In der Zeile der Quelle steht „CSV Daten aktualisieren".'
                : undefined
            }
          >
            <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
              {offeneUpdates > 0 ? `${offeneUpdates} Quelle${offeneUpdates === 1 ? '' : 'n'}` : 'keine'}
            </span>
          </SettingsOption>
        </SettingsGruppe>
      }
    />
  );
}

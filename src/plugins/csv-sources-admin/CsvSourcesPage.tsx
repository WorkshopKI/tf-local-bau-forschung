import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
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
import { SectionHeader } from '@/ui/SectionHeader';
import { CsvSourceWizard } from './wizard/CsvSourceWizard';
import { CsvSourceReimportDialog } from './CsvSourceReimportDialog';

export function CsvSourcesPage(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [programmId, setProgrammId] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reimportSchema, setReimportSchema] = useState<CsvSchema | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetCounts, setResetCounts] = useState<ClearAntragDataResult | null>(null);
  const [resetRunning, setResetRunning] = useState(false);
  const [resetResult, setResetResult] = useState<ClearAntragDataResult | null>(null);

  const refresh = useCallback(async () => {
    const id = activeProgrammId ?? (await ensureDefaultProgramm(storage.idb)).id;
    setProgrammId(id);
    setSchemas(await listSchemas(storage.idb, id));
  }, [storage.idb, activeProgrammId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onDelete = async (s: CsvSchema): Promise<void> => {
    if (!confirm(`Schema "${s.csv_source_name}" löschen? (Row-Hashes bleiben erhalten, können später aufgeräumt werden)`)) return;
    await removeSchema(storage.idb, s.id);
    await logAudit(storage.idb, { action: 'csv_schema_deleted', user: session.kuratorName ?? undefined, details: { schemaId: s.id } });
    await refresh();
  };

  const onOpenResetConfirm = async (): Promise<void> => {
    setResetResult(null);
    const c = await countAntragData(storage.idb);
    setResetCounts(c);
    setResetConfirmOpen(true);
  };

  const onConfirmReset = async (): Promise<void> => {
    setResetRunning(true);
    try {
      const r = await clearAntragData(storage.idb);
      await logAudit(storage.idb, {
        action: 'antrag_data_cleared',
        user: session.kuratorName ?? undefined,
        details: { ...r },
      });
      setResetResult(r);
      setResetConfirmOpen(false);
    } finally {
      setResetRunning(false);
    }
  };


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
          Kurator-Modus nicht aktiv. Schemas sind nur lesbar. Kurator-Login im Dev-Panel.
        </div>
      ) : null}

      <SectionHeader label={`Registrierte Schemas (${schemas.length})`} />

      {schemas.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
          Noch keine CSV-Source registriert.
        </div>
      ) : (
        <div>
          {schemas.sort((a, b) => b.priority - a.priority).map((s, i) => (
            <div
              key={s.id}
              className="flex items-center justify-between py-3"
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
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setReimportSchema(s)} disabled={!session.isActive}>
                  Re-Import
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onDelete(s)} disabled={!session.isActive}>
                  Löschen
                </Button>
              </div>
            </div>
          ))}
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
          (Excel: „CSV UTF-8 (durch Komma getrennt)" beim Speichern, oder
          <code className="font-mono"> iconv -f WINDOWS-1252 -t UTF-8</code>) und nutze danach diesen Reset:
        </p>

        {resetResult ? (
          <div className="text-[12px] text-emerald-700 mb-3">
            Reset abgeschlossen: {resetResult.antraege.toLocaleString('de-DE')} Anträge,{' '}
            {resetResult.verbuende.toLocaleString('de-DE')} Verbünde,{' '}
            {resetResult.historie.toLocaleString('de-DE')} Historie-Einträge,{' '}
            {resetResult.rowHashes.toLocaleString('de-DE')} Row-Hashes gelöscht.
            Du kannst jetzt über „Re-Import" oder „Neu registrieren" die CSVs erneut einspielen.
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
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetConfirmOpen(false)}
                disabled={resetRunning}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void onConfirmReset()}
                disabled={resetRunning}
              >
                {resetRunning ? 'Lösche…' : 'Antrags-Daten löschen'}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onOpenResetConfirm()}
            disabled={!session.isActive}
          >
            Antrags-Daten zurücksetzen
          </Button>
        )}
      </section>

      {programmId ? (
        <CsvSourceWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          programmId={programmId}
          onCompleted={() => { void refresh(); }}
        />
      ) : null}

      {reimportSchema ? (
        <CsvSourceReimportDialog
          schema={reimportSchema}
          onClose={() => setReimportSchema(null)}
          onCompleted={() => { void refresh(); }}
        />
      ) : null}
    </div>
  );
}

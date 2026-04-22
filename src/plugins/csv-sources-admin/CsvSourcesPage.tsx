import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  ensureDefaultProgramm,
  listSchemas,
  importCsvSource,
  loadCsvSourceFile,
  removeSchema,
  type ImportProgress,
} from '@/core/services/csv';
import type { CsvSchema } from '@/core/services/csv/types';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { SectionHeader } from '@/ui/SectionHeader';
import { CsvSourceWizard } from './wizard/CsvSourceWizard';
import { Step4Progress } from './wizard/Step4Progress';
import { Dialog } from '@/components/ui/dialog';

export function CsvSourcesPage(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [programmId, setProgrammId] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<CsvSchema[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reimport, setReimport] = useState<{ schema: CsvSchema; progress: ImportProgress | null; error: string | null; result: import('@/core/services/csv/types').ImportResult | null } | null>(null);

  const refresh = useCallback(async () => {
    const p = await ensureDefaultProgramm(storage.idb);
    setProgrammId(p.id);
    setSchemas(await listSchemas(storage.idb, p.id));
  }, [storage.idb]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onDelete = async (s: CsvSchema): Promise<void> => {
    if (!confirm(`Schema "${s.csv_source_name}" löschen? (Row-Hashes bleiben erhalten, können später aufgeräumt werden)`)) return;
    await removeSchema(storage.idb, s.id);
    await logAudit(storage.idb, { action: 'csv_schema_deleted', user: session.kuratorName ?? undefined, details: { schemaId: s.id } });
    await refresh();
  };

  const onReimport = async (schema: CsvSchema): Promise<void> => {
    const text = await loadCsvSourceFile(storage.idb, schema.id);
    if (!text) {
      alert('Keine gespeicherte CSV-Datei gefunden. Bitte Wizard nutzen und neu uploaden.');
      return;
    }
    const blob = new Blob([text], { type: 'text/csv' });
    setReimport({ schema, progress: null, error: null, result: null });
    try {
      const result = await importCsvSource(storage.idb, schema.id, blob, {
        onProgress: p => setReimport(r => r ? { ...r, progress: p } : r),
      });
      setReimport(r => r ? { ...r, result } : r);
      await refresh();
    } catch (e) {
      setReimport(r => r ? { ...r, error: (e as Error).message } : r);
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
                <Button size="sm" variant="outline" onClick={() => void onReimport(s)} disabled={!session.isActive}>
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

      {programmId ? (
        <CsvSourceWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          programmId={programmId}
          onCompleted={() => { void refresh(); }}
        />
      ) : null}

      <Dialog
        open={!!reimport}
        onClose={() => setReimport(null)}
        title={`Re-Import: ${reimport?.schema.csv_source_name ?? ''}`}
        footer={
          <Button size="sm" variant="default" onClick={() => setReimport(null)}>Schließen</Button>
        }
      >
        {reimport ? (
          <Step4Progress progress={reimport.progress} result={reimport.result} error={reimport.error} />
        ) : null}
      </Dialog>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  saveSchema,
  findMasterSchema,
  importCsvSource,
  scanDistinctColumnValues,
  listUnterprogrammeByProgramm,
  saveUnterprogramm,
  type ImportProgress,
} from '@/core/services/csv';
import type { CsvSchema, ImportResult, Unterprogramm } from '@/core/services/csv/types';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { Step1Metadata } from './Step1Metadata';
import { Step2Columns } from './Step2Columns';
import { Step3Unterprogramme } from './Step3Unterprogramme';
import { Step3Review } from './Step3Review';
import { Step4Progress } from './Step4Progress';
import { useCsvWizardState } from './useCsvWizardState';
import { UnterprogrammDiffDialog, type DiffEntry } from './UnterprogrammDiffDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  programmId: string;
  onCompleted: () => void;
}

/**
 * 5-Schritt-Wizard:
 *   1  Metadata
 *   2  Column-Mapping
 *   3  Unterprogramm-Auswahl (nur Master, sonst übersprungen)
 *   4  Review
 *   5  Progress
 */
export function CsvSourceWizard({ open, onClose, programmId, onCompleted }: Props): React.ReactElement | null {
  const storage = useStorage();
  const session = useKuratorSession();
  const api = useCsvWizardState();
  const { state, goto, back, setErrors, reset, buildColumnMapping, setUpScan, setUpScanLoading } = api;
  const [existingMasterId, setExistingMasterId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lockConflict, setLockConflict] = useState<{ ageMinutes: number; resolve: (d: 'force' | 'abort') => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const [diff, setDiff] = useState<{ added: DiffEntry[]; removed: DiffEntry[]; onConfirm: () => void } | null>(null);

  useEffect(() => {
    if (!open) return;
    reset();
    setProgress(null);
    setImportResult(null);
    setImportError(null);
    void findMasterSchema(storage.idb, programmId).then(m => setExistingMasterId(m?.id ?? null));
  }, [open, programmId, reset, storage.idb]);

  const validateStep1 = useCallback((): string[] => {
    const errs: string[] = [];
    if (!state.displayName.trim()) errs.push('Anzeigename darf nicht leer sein.');
    if (!state.schemaId.trim()) errs.push('Schema-ID darf nicht leer sein.');
    if (!state.preview) errs.push('Bitte CSV-Datei laden.');
    return errs;
  }, [state]);

  const validateStep2 = useCallback((): string[] => {
    const errs: string[] = [];
    const decisions = state.decisions;
    const joinMapped = Object.values(decisions).some(
      d => d.mode === 'canonical' && d.canonical === state.joinKey,
    );
    if (!joinMapped) {
      errs.push(`Die Join-Key-Spalte (${state.joinKey}) muss als Standardfeld gemappt sein.`);
    }
    if (state.isMaster) {
      const azMapped = Object.values(decisions).some(
        d => d.mode === 'canonical' && d.canonical === 'aktenzeichen',
      );
      if (!azMapped) errs.push('Master-Source braucht zwingend ein Mapping auf "aktenzeichen".');
      const upMapped = Object.values(decisions).some(
        d => d.mode === 'canonical' && d.canonical === 'unterprogramm_id',
      );
      if (!upMapped) {
        errs.push('Master-Source braucht ein Mapping auf "unterprogramm_id" (z.B. FM-Nummer-Spalte).');
      }
    }
    return errs;
  }, [state]);

  const findUpColumn = useCallback((): string | null => {
    const entry = Object.entries(state.decisions).find(
      ([, d]) => d.mode === 'canonical' && d.canonical === 'unterprogramm_id',
    );
    return entry ? entry[0] : null;
  }, [state.decisions]);

  const scanUp = useCallback(async (): Promise<void> => {
    if (!state.file) return;
    const col = findUpColumn();
    if (!col) return;
    setUpScanLoading(true);
    try {
      const counts = await scanDistinctColumnValues(state.file, col);
      const existing = await listUnterprogrammeByProgramm(storage.idb, programmId);
      const existingMap = new Map(existing.map(u => [u.code, u]));
      const initialActive: Record<string, boolean> = {};
      const entries = Array.from(counts.entries()).map(([code, count]) => {
        const ex = existingMap.get(code);
        // Erst-Import: default aktiv=true. Re-Import neue: default false (bewusst entscheiden).
        // Re-Import bereits registriert: Status aus IDB.
        let aktiv: boolean;
        if (ex) aktiv = ex.aktiv;
        else aktiv = !existingMasterId; // kein Master-Vorgänger → alle aktiv; Master existiert → neue defaultmäßig inaktiv
        initialActive[code] = ex?.aktiv ?? false;
        return {
          code,
          count,
          existing: !!ex,
          aktiv,
          name: ex?.name,
          zeitraum_von: ex?.zeitraum_von,
          zeitraum_bis: ex?.zeitraum_bis,
        };
      });
      setUpScan(entries, initialActive);
    } catch (e) {
      setErrors([`Fehler beim Scannen der Unterprogramm-Spalte: ${(e as Error).message}`]);
      setUpScanLoading(false);
    }
  }, [state.file, findUpColumn, programmId, storage.idb, existingMasterId, setUpScan, setUpScanLoading, setErrors]);

  const handleNext = async (): Promise<void> => {
    if (state.step === 1) {
      const errs = validateStep1();
      if (errs.length > 0) { setErrors(errs); return; }
      goto(2);
    } else if (state.step === 2) {
      const errs = validateStep2();
      if (errs.length > 0) { setErrors(errs); return; }
      if (state.isMaster) {
        goto(3);
        void scanUp();
      } else {
        goto(4);
      }
    } else if (state.step === 3) {
      // UP-Auswahl → Review
      goto(4);
    } else if (state.step === 4) {
      await handleSave(false);
    }
  };

  const collectDiff = useCallback((): { added: DiffEntry[]; removed: DiffEntry[] } => {
    const added: DiffEntry[] = [];
    const removed: DiffEntry[] = [];
    if (!state.upScan) return { added, removed };
    for (const e of state.upScan) {
      const before = state.upInitialActive[e.code] ?? false;
      if (e.aktiv && !before) {
        added.push({ code: e.code, name: e.name, impactRows: e.count });
      } else if (!e.aktiv && before) {
        // Anzahl aktueller Anträge = grob count aus CSV (wird beim Import echt deleted)
        removed.push({ code: e.code, name: e.name, impactRows: e.count });
      }
    }
    return { added, removed };
  }, [state.upScan, state.upInitialActive]);

  const persistUnterprogrammeChanges = useCallback(async (): Promise<void> => {
    if (!state.upScan) return;
    for (const e of state.upScan) {
      const up: Partial<Unterprogramm> & { id: string; programm_id: string; code: string; aktiv: boolean } = {
        id: e.code,
        programm_id: programmId,
        code: e.code,
        aktiv: e.aktiv,
        name: e.name,
        zeitraum_von: e.zeitraum_von,
        zeitraum_bis: e.zeitraum_bis,
      };
      await saveUnterprogramm(storage.idb, up);
    }
  }, [state.upScan, programmId, storage.idb]);

  const handleSave = async (skipImport: boolean): Promise<void> => {
    setSaving(true);
    try {
      const hasLabelXlsx = state.labelEntries.length > 0;
      const schema: CsvSchema = {
        id: state.schemaId,
        programm_id: programmId,
        csv_source_name: state.displayName,
        is_master: state.isMaster,
        join_key: state.joinKey,
        priority: state.priority,
        column_mapping: buildColumnMapping(),
        encoding: state.encoding,
        separator: state.separator,
        ...(hasLabelXlsx ? { label_xlsx_header_rows: state.headerRowCount } : {}),
        created_at: new Date().toISOString(),
      };
      await saveSchema(storage.idb, schema);
      const ambiguousMergesLog = state.ambiguousMerges.map(m => ({
        value: m.value,
        columns: m.affected_columns.length,
        resolution: state.ambiguousResolutions[m.signature] ?? m.default_resolution,
      }));
      await logAudit(storage.idb, {
        action: 'csv_schema_saved',
        user: session.kuratorName ?? undefined,
        details: {
          schemaId: schema.id,
          isMaster: schema.is_master,
          ...(hasLabelXlsx ? { label_xlsx_header_rows: state.headerRowCount } : {}),
          ...(ambiguousMergesLog.length > 0 ? { ambiguous_merges: ambiguousMergesLog } : {}),
        },
      });

      // Re-Import-Diff: wenn Master-Änderung, Diff-Dialog zeigen
      if (state.isMaster && state.upScan) {
        const d = collectDiff();
        if (d.added.length > 0 || d.removed.length > 0) {
          const proceed = await new Promise<boolean>(resolve => {
            setDiff({
              added: d.added,
              removed: d.removed,
              onConfirm: () => { setDiff(null); resolve(true); },
            });
          });
          if (!proceed) {
            setSaving(false);
            return;
          }
        }
        // UP-Einträge persistieren (auch ohne Diff — Counts/Aktiv-Flag aktualisieren)
        await persistUnterprogrammeChanges();
      }

      if (skipImport || !state.file) {
        setImportResult({ skipped: false, buckets: { new: 0, changed: 0, unchanged: 0, removed: 0 }, durationMs: 0, rowCount: 0 });
        goto(5);
        onCompleted();
        return;
      }

      goto(5);
      const result = await importCsvSource(storage.idb, schema.id, state.file, {
        onProgress: p => setProgress(p),
        onLockConflict: ageMinutes =>
          new Promise(resolve => setLockConflict({ ageMinutes, resolve })),
      });
      setImportResult(result);
      onCompleted();
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const closeWizard = (): void => {
    onClose();
  };

  const diffDialogCancel = (): void => {
    if (diff) {
      setDiff(null);
      setSaving(false);
    }
  };

  const totalSteps = state.isMaster ? 5 : 4;
  const displayStep = state.isMaster ? state.step : state.step > 2 ? state.step - 1 : state.step;

  return (
    <>
      <Dialog
        open={open}
        onClose={closeWizard}
        title={`Neue CSV-Source — Schritt ${displayStep}/${totalSteps}`}
        className="max-w-[760px]"
        dismissOnOverlayClick={false}
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
                <span
                  key={s}
                  className={
                    s <= displayStep
                      ? 'h-2 w-2 rounded-full bg-[var(--tf-text)]'
                      : 'h-2 w-2 rounded-full bg-[var(--tf-text-tertiary)] opacity-40'
                  }
                />
              ))}
            </div>
            <div className="flex gap-2">
              {state.step > 1 && state.step < 5 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (state.step === 4 && !state.isMaster) goto(2);
                    else back();
                  }}
                  disabled={saving}
                >
                  Zurück
                </Button>
              ) : null}
              {state.step === 4 ? (
                <Button size="sm" variant="outline" onClick={() => void handleSave(true)} disabled={saving}>
                  Nur speichern
                </Button>
              ) : null}
              {state.step < 4 ? (
                <Button size="sm" variant="default" onClick={() => void handleNext()} disabled={saving || state.upScanLoading}>Weiter</Button>
              ) : state.step === 4 ? (
                <Button size="sm" variant="default" onClick={() => void handleNext()} disabled={saving}>
                  Speichern + Import
                </Button>
              ) : (
                <Button size="sm" variant="default" onClick={closeWizard}>Schließen</Button>
              )}
            </div>
          </div>
        }
      >
        {state.step === 1 ? (
          <Step1Metadata api={api} existingMasterId={existingMasterId} />
        ) : state.step === 2 ? (
          <Step2Columns api={api} />
        ) : state.step === 3 ? (
          <Step3Unterprogramme api={api} />
        ) : state.step === 4 ? (
          <Step3Review api={api} />
        ) : (
          <Step4Progress progress={progress} result={importResult} error={importError} />
        )}

        {state.errors.length > 0 ? (
          <div className="mt-3 text-[12px] text-red-700">
            <ul className="list-disc pl-5">
              {state.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={!!lockConflict}
        onClose={() => { lockConflict?.resolve('abort'); setLockConflict(null); }}
        title="Import läuft bereits"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => { lockConflict?.resolve('abort'); setLockConflict(null); }}>
              Abbrechen
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { lockConflict?.resolve('force'); setLockConflict(null); }}>
              Force
            </Button>
          </>
        }
      >
        <div className="text-[13px]">
          Ein anderer Import-Lock ist aktiv (seit {lockConflict?.ageMinutes} min). Möchtest du den Lock
          überschreiben und den Import jetzt starten?
        </div>
      </Dialog>

      <UnterprogrammDiffDialog
        open={!!diff}
        added={diff?.added ?? []}
        removed={diff?.removed ?? []}
        onConfirm={() => diff?.onConfirm()}
        onCancel={diffDialogCancel}
      />
    </>
  );
}

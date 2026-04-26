import { useRef, useState } from 'react';
import { Upload, FileText, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import {
  importCsvSource,
  loadCsvSourceFile,
  parseCsvPreview,
  type ImportProgress,
} from '@/core/services/csv';
import type { CsvSchema, ImportResult } from '@/core/services/csv/types';
import { Step4Progress } from './wizard/Step4Progress';

interface Props {
  schema: CsvSchema;
  onClose: () => void;
  onCompleted: () => void;
}

type Phase = 'choose' | 'reviewing' | 'importing';

interface HeaderValidation {
  matched: string[];
  missingFromCsv: string[];
  newColumns: string[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateHeaders(schema: CsvSchema, csvHeaders: string[]): HeaderValidation {
  const schemaCols = Object.keys(schema.column_mapping);
  const csvSet = new Set(csvHeaders);
  const schemaSet = new Set(schemaCols);
  return {
    matched: schemaCols.filter(c => csvSet.has(c)),
    missingFromCsv: schemaCols.filter(c => !csvSet.has(c)),
    newColumns: csvHeaders.filter(c => !schemaSet.has(c)),
  };
}

export function CsvSourceReimportDialog({ schema, onClose, onCompleted }: Props): React.ReactElement {
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<HeaderValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runImport(blob: Blob): Promise<void> {
    setPhase('importing');
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const r = await importCsvSource(storage.idb, schema.id, blob, {
        onProgress: p => setProgress(p),
      });
      setResult(r);
      onCompleted();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function useStoredFile(): Promise<void> {
    const text = await loadCsvSourceFile(storage.idb, schema.id);
    if (!text) {
      setError('Keine gespeicherte CSV-Datei gefunden. Bitte „Neue CSV-Datei wählen…" verwenden.');
      setPhase('importing');
      return;
    }
    await runImport(new Blob([text], { type: 'text/csv' }));
  }

  async function handleNewFile(file: File): Promise<void> {
    setValidating(true);
    setError(null);
    try {
      const preview = await parseCsvPreview(file, 1, {
        encoding: schema.encoding,
        separator: schema.separator,
      });
      const v = validateHeaders(schema, preview.headers);
      setSelectedFile(file);
      setValidation(v);
      setPhase('reviewing');
    } catch (e) {
      setError(`Datei konnte nicht gelesen werden: ${(e as Error).message}`);
    } finally {
      setValidating(false);
    }
  }

  function reset(): void {
    setSelectedFile(null);
    setValidation(null);
    setError(null);
    setPhase('choose');
  }

  const lastImportInfo = schema.last_imported_at
    ? `${new Date(schema.last_imported_at).toLocaleString('de-DE')}${typeof schema.last_row_count === 'number' ? ` · ${schema.last_row_count} Zeilen` : ''}`
    : 'noch nie importiert';

  const isImporting = phase === 'importing' && !result && !error;

  return (
    <Dialog
      open
      onClose={isImporting ? () => {} : onClose}
      title={`Re-Import: ${schema.csv_source_name}`}
      className="max-w-[640px]"
      dismissOnOverlayClick={false}
      footer={
        phase === 'reviewing' ? (
          <div className="flex w-full items-center justify-between">
            <Button size="sm" variant="ghost" onClick={reset}>Zurück</Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => selectedFile && void runImport(selectedFile)}
              disabled={!selectedFile || (validation?.matched.length ?? 0) === 0}
            >
              Importieren mit gespeicherten Mappings
            </Button>
          </div>
        ) : phase === 'importing' ? (
          <Button size="sm" variant="default" onClick={onClose} disabled={isImporting}>
            Schließen
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onClose}>Abbrechen</Button>
        )
      }
    >
      {phase === 'choose' ? (
        <div>
          <div className="text-[12.5px] text-[var(--tf-text-secondary)] mb-4">
            Letzter Import: {lastImportInfo}.<br />
            Die {Object.keys(schema.column_mapping).length} Spalten-Zuordnungen aus dem Schema werden in beiden Fällen automatisch wiederverwendet.
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void useStoredFile()}
              className="flex items-start gap-3 rounded-lg border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-subtle)] px-4 py-3 text-left transition hover:bg-[var(--tf-bg-secondary)]"
            >
              <RefreshCw size={16} className="mt-0.5 flex-shrink-0 text-[var(--tf-text-secondary)]" />
              <div>
                <div className="text-[13px] font-medium text-[var(--tf-text)]">Gespeicherte Datei erneut importieren</div>
                <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                  Nutzt die zuletzt hochgeladene CSV. Sinnvoll, wenn nur Filter, Unterprogramme oder das Schema geändert wurden.
                </div>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void handleNewFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={validating}
              className="flex items-start gap-3 rounded-lg border-[1.5px] border-dashed border-[var(--tf-border)] bg-[var(--tf-bg-subtle)] px-4 py-3 text-left transition hover:border-[var(--tf-text-tertiary)] hover:bg-[var(--tf-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload size={16} className="mt-0.5 flex-shrink-0 text-[var(--tf-text-secondary)]" />
              <div>
                <div className="text-[13px] font-medium text-[var(--tf-text)]">Neue CSV-Datei wählen…</div>
                <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                  Frische Version derselben CSV (z.B. mit zusätzlichen Datensätzen). Spalten werden gegen das Schema abgeglichen, alle bestehenden Mappings übernommen.
                </div>
              </div>
            </button>
          </div>

          {validating ? (
            <div className="mt-3 text-[12px] text-[var(--tf-text-tertiary)]">Datei wird geprüft …</div>
          ) : null}
          {error ? <div className="mt-3 text-[12px] text-red-700">{error}</div> : null}
        </div>
      ) : null}

      {phase === 'reviewing' && selectedFile && validation ? (
        <div>
          <div className="flex items-center gap-2 rounded-lg border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-subtle)] px-3 py-2 mb-4">
            <FileText size={15} className="flex-shrink-0 text-[var(--tf-text-secondary)]" />
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-[var(--tf-text)]">{selectedFile.name}</div>
              <div className="text-[11px] text-[var(--tf-text-tertiary)]">{formatBytes(selectedFile.size)}</div>
            </div>
          </div>

          <div className="text-[12.5px] mb-3">
            <span className="font-medium text-[var(--tf-text)]">{validation.matched.length}</span>
            <span className="text-[var(--tf-text-secondary)]"> von {Object.keys(schema.column_mapping).length} Schema-Spalten gefunden — bestehende Mappings werden 1:1 übernommen.</span>
          </div>

          {validation.missingFromCsv.length > 0 ? (
            <div className="mb-3 rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-2.5">
              <div className="flex items-start gap-2 mb-1">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-700" />
                <div className="text-[12px] font-medium text-amber-900">
                  {validation.missingFromCsv.length} Spalte{validation.missingFromCsv.length === 1 ? '' : 'n'} aus dem Schema fehlt in der neuen Datei
                </div>
              </div>
              <div className="text-[11.5px] text-amber-900 ml-6 mb-1">
                Diese Felder bleiben beim Import leer:
              </div>
              <div className="ml-6 max-h-[100px] overflow-y-auto text-[11px] font-mono text-amber-900">
                {validation.missingFromCsv.join(', ')}
              </div>
            </div>
          ) : null}

          {validation.newColumns.length > 0 ? (
            <div className="mb-3 rounded-md border-[0.5px] border-blue-300 bg-blue-50 p-2.5">
              <div className="flex items-start gap-2 mb-1">
                <Info size={14} className="mt-0.5 flex-shrink-0 text-blue-700" />
                <div className="text-[12px] font-medium text-blue-900">
                  {validation.newColumns.length} neue Spalte{validation.newColumns.length === 1 ? '' : 'n'} in der CSV (nicht im Schema)
                </div>
              </div>
              <div className="text-[11.5px] text-blue-900 ml-6 mb-1">
                Werden beim Import ignoriert. Wenn übernommen werden sollen, Schema neu registrieren.
              </div>
              <div className="ml-6 max-h-[100px] overflow-y-auto text-[11px] font-mono text-blue-900">
                {validation.newColumns.join(', ')}
              </div>
            </div>
          ) : null}

          {validation.matched.length === 0 ? (
            <div className="mb-3 rounded-md border-[0.5px] border-red-300 bg-red-50 p-2.5 text-[12px] text-red-800">
              Keine einzige Schema-Spalte in der CSV gefunden. Wahrscheinlich falsche Datei oder Encoding/Separator-Mismatch — Re-Import wird abgebrochen.
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === 'importing' ? (
        <Step4Progress progress={progress} result={result} error={error} />
      ) : null}
    </Dialog>
  );
}

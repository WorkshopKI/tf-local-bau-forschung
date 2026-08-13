import { useEffect, useRef, useState } from 'react';
import { FileText, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  importCsvSource,
  parseCsvPreview,
  type ImportOptions,
  type ImportProgress,
} from '@/core/services/csv';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import type { CsvSchema, CsvEncoding, ImportResult } from '@/core/services/csv/types';
import { Step4Progress } from './wizard/Step4Progress';
import { persistCsvSourceMeta } from './csv-source-handle';
import { confirmLockConflict } from './lock-conflict';
import { validateHeaders, type HeaderValidation } from './services/csv-drift-check';
import { refreshAntraegeStoreAfterSync } from '@/plugins/antraege/snapshot-refresh';

interface Props {
  schema: CsvSchema;
  /** Bereits vom Aufrufer gewählte/geladene Datei. */
  file: File;
  /** Persistierbares Handle der Quelldatei (für künftige Auto-Update-Checks). `null`, wenn Browser keinen Handle liefert. */
  sourceHandle: FileSystemFileHandle | null;
  /** Auslöser des Dialogs — beeinflusst Titel + Audit-Log. */
  trigger: 'reselect' | 'auto-update';
  onClose: () => void;
  onCompleted: () => void;
  /** Öffnet den „neue Spalten ins Schema übernehmen"-Dialog (Link in der New-Columns-Warnung). */
  onAddNewColumns: (newColumns: string[]) => void;
}

type Phase = 'reviewing' | 'importing';

const ENCODING_LABEL: Record<CsvEncoding, string> = {
  'UTF-8': 'UTF-8',
  'windows-1252': 'Windows-1252',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CsvSourceReimportDialog({
  schema,
  file,
  sourceHandle,
  trigger,
  onClose,
  onCompleted,
  onAddNewColumns,
}: Props): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [phase, setPhase] = useState<Phase>('reviewing');
  const [validation, setValidation] = useState<HeaderValidation | null>(null);
  const [validating, setValidating] = useState(true);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [cancelled, setCancelled] = useState(false);
  // Encoding-Auswahl: startet beim gespeicherten Schema-Wert, wird aber unten
  // einmalig auf das automatisch erkannte Encoding korrigiert (z.B. Schema=UTF-8,
  // Datei aber Windows-1252 → sonst Mojibake in den Umlaut-Werten).
  const [encoding, setEncoding] = useState<CsvEncoding>(schema.encoding ?? 'UTF-8');
  const [detectedEncoding, setDetectedEncoding] = useState<CsvEncoding | null>(null);
  const autoSelectedRef = useRef(false);

  // Encoding-Auto-Erkennung beim Mount (kein Force → readWithEncodingFallback).
  // Weicht das erkannte Encoding vom gespeicherten Schema-Wert ab, stellen wir
  // die Auswahl EINMAL automatisch um (User-Overrides danach respektiert).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const probe = await parseCsvPreview(file, 1, { separator: schema.separator });
        if (!alive) return;
        setDetectedEncoding(probe.detected.encoding);
        if (!autoSelectedRef.current && probe.detected.encoding !== (schema.encoding ?? 'UTF-8')) {
          autoSelectedRef.current = true;
          setEncoding(probe.detected.encoding);
        }
      } catch {
        /* Erkennung best-effort — die Validierung unten meldet echte Lesefehler. */
      }
    })();
    return () => { alive = false; };
  }, [file, schema]);

  // Header-Validierung — läuft beim Mount und bei jedem Encoding-Wechsel neu.
  useEffect(() => {
    let alive = true;
    (async () => {
      setValidating(true);
      setError(null);
      try {
        const preview = await parseCsvPreview(file, 1, {
          encoding,
          separator: schema.separator,
        });
        if (!alive) return;
        setValidation(validateHeaders(schema, preview.headers));
      } catch (e) {
        if (!alive) return;
        setError(`Datei konnte nicht gelesen werden: ${(e as Error).message}`);
      } finally {
        if (alive) setValidating(false);
      }
    })();
    return () => { alive = false; };
  }, [file, schema, encoding]);

  // Beim Unmount laufenden Import sauber abbrechen.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function persistSourceMeta(): Promise<void> {
    await persistCsvSourceMeta(storage.idb, { schema, file, sourceHandle, encoding });
    await logAudit(storage.idb, {
      action: trigger === 'auto-update' ? 'csv_source_auto_updated' : 'csv_source_reselected',
      user: session.kuratorName ?? undefined,
      details: {
        schemaId: schema.id,
        fileName: file.name,
        lastModified: new Date(file.lastModified).toISOString(),
        handlePersisted: sourceHandle != null,
      },
    });
  }

  async function runImport(extraOpts: Partial<ImportOptions> = {}): Promise<void> {
    setPhase('importing');
    setError(null);
    setResult(null);
    setProgress(null);
    setCancelled(false);
    abortRef.current = new AbortController();
    try {
      const r = await importCsvSource(storage.idb, schema.id, file, {
        signal: abortRef.current.signal,
        onProgress: p => setProgress(p),
        // Gewähltes Encoding für DIESEN Import erzwingen (überschreibt schema.encoding).
        encodingOverride: encoding,
        // Expliziter „CSV neu wählen"-Re-Import → Checksum-Skip umgehen (z.B.
        // wenn nur das Mapping geändert wurde, die Datei aber identisch ist).
        force: true,
        // Belegter Build-Lock (z.B. von einem abgestürzten Import): nachfragen
        // statt hart abzubrechen. Ohne diesen Handler ist man bis zur 2h-Stale-
        // Grenze ausgesperrt (es gibt im Prod-Build keine Lock-UI).
        onLockConflict: confirmLockConflict,
        ...extraOpts,
      });
      setResult(r);
      await persistSourceMeta();
      // v2.28.2: In-Memory-Antraege-Store neu laden, sonst zeigt die Home die
      // importierten Daten erst nach manuellem Reload (cold-start-store-refresh).
      await refreshAntraegeStoreAfterSync(storage.idb, schema.programm_id, ['antraege', 'verbuende'] as const);
      onCompleted();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setCancelled(true);
      } else {
        setError((e as Error).message);
      }
    } finally {
      abortRef.current = null;
    }
  }

  const isImporting = phase === 'importing' && !result && !error && !cancelled;
  const cancelAvailable = isImporting && (
    progress === null ||
    progress.phase === 'parsing' ||
    progress.phase === 'diffing'
  );

  const title = trigger === 'auto-update'
    ? `Datenaktualisierung: ${schema.csv_source_name}`
    : `CSV neu wählen: ${schema.csv_source_name}`;

  return (
    <Dialog
      open
      onClose={isImporting
        ? (cancelAvailable ? () => abortRef.current?.abort() : () => {})
        : onClose}
      title={title}
      className="max-w-[640px]"
      dismissOnOverlayClick={false}
      footer={
        phase === 'reviewing' ? (
          <div className="flex w-full items-center justify-between">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={validating}>Abbrechen</Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => void runImport()}
              disabled={
                validating || !validation || validation.matched.length === 0
                || validation.mehrdeutigeSpalten.length > 0
              }
            >
              Importieren mit gespeicherten Mappings
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-3">
            {isImporting && !cancelAvailable ? (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                Schreibvorgang läuft — kann nicht mehr abgebrochen werden.
              </span>
            ) : <span />}
            {cancelAvailable ? (
              <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>
                Abbrechen
              </Button>
            ) : (
              <Button size="sm" variant="default" onClick={onClose} disabled={isImporting}>
                Schließen
              </Button>
            )}
          </div>
        )
      }
    >
      {phase === 'reviewing' ? (
        <div>
          <div className="flex items-center gap-2 rounded-lg border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3 py-2 mb-4">
            <FileText size={15} className="flex-shrink-0 text-[var(--tf-text-secondary)]" />
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-[var(--tf-text)]">{file.name}</div>
              <div className="text-[11px] text-[var(--tf-text-tertiary)]">
                {formatBytes(file.size)} · geändert {new Date(file.lastModified).toLocaleString('de-DE')}
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)]">
              Encoding:
              <select
                value={encoding}
                onChange={e => setEncoding(e.target.value as CsvEncoding)}
                disabled={validating}
                className="text-[12px] px-1.5 py-1 rounded border border-[var(--tf-border)] bg-[var(--tf-bg)]"
              >
                <option value="UTF-8">UTF-8</option>
                <option value="windows-1252">Windows-1252</option>
              </select>
            </label>
            {detectedEncoding && detectedEncoding !== (schema.encoding ?? 'UTF-8') ? (
              <span className="text-[11px] text-amber-700">
                Erkannt: {ENCODING_LABEL[detectedEncoding]} (Schema war {ENCODING_LABEL[schema.encoding ?? 'UTF-8']}) — automatisch umgestellt.
              </span>
            ) : detectedEncoding ? (
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">Erkannt: {ENCODING_LABEL[detectedEncoding]}</span>
            ) : null}
          </div>

          {validating ? (
            <div className="text-[12px] text-[var(--tf-text-tertiary)]">Datei wird geprüft …</div>
          ) : validation ? (
            <>
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
                    Werden beim Import ignoriert.{' '}
                    <button
                      type="button"
                      onClick={() => onAddNewColumns(validation.newColumns)}
                      className="font-medium underline text-blue-800 hover:text-blue-900 cursor-pointer"
                    >
                      Diese Spalten jetzt ins Schema übernehmen
                    </button>
                  </div>
                  <div className="ml-6 max-h-[100px] overflow-y-auto text-[11px] font-mono text-blue-900">
                    {validation.newColumns.join(', ')}
                  </div>
                </div>
              ) : null}

              {validation.mehrdeutigeSpalten.length > 0 ? (
                <div className="mb-3 rounded-md border-[0.5px] border-red-300 bg-red-50 p-2.5">
                  <div className="flex items-start gap-2 mb-1">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-red-700" />
                    <div className="text-[12px] font-medium text-red-900">
                      Gleichnamige Spalten stehen jetzt anders in der Datei
                    </div>
                  </div>
                  <div className="ml-6 text-[11.5px] text-red-900">
                    Betroffen: <span className="font-mono">{validation.mehrdeutigeSpalten.join(', ')}</span>.
                    Bei mehrfach vergebenen Spaltennamen entscheidet die Reihenfolge, welche
                    Spalte welches Feld füllt — mit den gespeicherten Zuordnungen läse der
                    Import stillschweigend aus der falschen Spalte. Bitte über „Spalten neu
                    zuordnen" nachziehen.
                  </div>
                </div>
              ) : null}

              {validation.matched.length === 0 ? (
                <div className="mb-3 rounded-md border-[0.5px] border-red-300 bg-red-50 p-2.5 text-[12px] text-red-800">
                  Keine einzige Schema-Spalte in der CSV gefunden. Wahrscheinlich falsche Datei oder Encoding/Separator-Mismatch — Import wird abgebrochen.
                </div>
              ) : null}
            </>
          ) : null}

          {error ? <div className="mt-3 text-[12px] text-red-700">{error}</div> : null}
        </div>
      ) : null}

      {phase === 'importing' ? (
        <Step4Progress progress={progress} result={result} error={error} cancelled={cancelled} />
      ) : null}
    </Dialog>
  );
}

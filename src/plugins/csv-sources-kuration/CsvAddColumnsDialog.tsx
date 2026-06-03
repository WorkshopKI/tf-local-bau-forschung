import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  importCsvSource,
  parseCsvPreview,
  saveSchema,
  type ImportProgress,
} from '@/core/services/csv';
import { getCanonicalLabel } from '@/core/services/csv/constants';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import type { CsvSchema, ImportResult } from '@/core/services/csv/types';
import { Step4Progress } from './wizard/Step4Progress';
import { guessDecision, type PerColumnDecision } from './wizard/useCsvWizardState';
import { mergeNewColumns } from './services/new-column-mapping';
import { persistCsvSourceMeta } from './csv-source-handle';
import { confirmLockConflict } from './lock-conflict';
import { NewColumnRow } from './NewColumnRow';

interface Props {
  schema: CsvSchema;
  /** Bereits geladene Quelldatei (mit den neuen Spalten) — kein erneutes Picker-Klicken nötig. */
  file: File;
  sourceHandle: FileSystemFileHandle | null;
  /** Spaltennamen, die in der CSV stehen, aber (noch) nicht im Schema gemappt sind. */
  newColumns: string[];
  onClose: () => void;
  onCompleted: () => void;
}

type Phase = 'reviewing' | 'importing';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Übernimmt nachträglich neue CSV-Spalten in ein bestehendes Schema, ohne die
 * bereits gemappten Spalten (inkl. Label-Hierarchie) anzutasten: pro neuer
 * Spalte wird eine Mapping-Entscheidung getroffen, additiv ins `column_mapping`
 * gemerged und anschließend re-importiert. Einstieg über den Link in der
 * „neue Spalten"-Warnung des `CsvSourceReimportDialog`.
 */
export function CsvAddColumnsDialog({
  schema,
  file,
  sourceHandle,
  newColumns,
  onClose,
  onCompleted,
}: Props): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [decisions, setDecisions] = useState<Record<string, PerColumnDecision>>({});
  const [loading, setLoading] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('reviewing');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Preview laden + Default-Mapping pro neuer Spalte raten (Schema-Encoding/-Separator).
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setParseError(null);
      try {
        const preview = await parseCsvPreview(file, 5, {
          encoding: schema.encoding,
          separator: schema.separator,
        });
        if (!alive) return;
        const init: Record<string, PerColumnDecision> = {};
        for (const col of newColumns) {
          const samples = preview.rows.map(r => (r[col] ?? '').trim());
          init[col] = guessDecision(col, samples);
        }
        setDecisions(init);
      } catch (e) {
        if (!alive) return;
        setParseError(`Datei konnte nicht gelesen werden: ${(e as Error).message}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [file, schema, newColumns]);

  // Laufenden Import beim Unmount sauber abbrechen.
  useEffect(() => () => abortRef.current?.abort(), []);

  const update = (col: string, patch: Partial<PerColumnDecision>): void =>
    setDecisions(prev => {
      const base: PerColumnDecision = prev[col] ?? { mode: 'ignore' };
      const next: PerColumnDecision = { ...base, ...patch };
      return { ...prev, [col]: next };
    });

  // Canonical-Konflikte: Ziel bereits im Schema belegt ODER mehrfach unter den neuen Spalten.
  const existingCanonicals = useMemo(() => {
    const s = new Set<string>();
    for (const e of Object.values(schema.column_mapping)) {
      if (e.canonical) s.add(String(e.canonical));
    }
    return s;
  }, [schema]);

  const conflictCanonicals = useMemo(() => {
    const used = new Map<string, number>();
    for (const d of Object.values(decisions)) {
      if (d.mode === 'canonical' && d.canonical) used.set(d.canonical, (used.get(d.canonical) ?? 0) + 1);
    }
    const set = new Set<string>();
    for (const [canon, count] of used) {
      if (count > 1 || existingCanonicals.has(canon)) set.add(canon);
    }
    return set;
  }, [decisions, existingCanonicals]);

  const confirm = useAsyncAction(async () => {
    const merged = mergeNewColumns(schema.column_mapping, decisions);
    await saveSchema(storage.idb, { ...schema, column_mapping: merged });
    await logAudit(storage.idb, {
      action: 'csv_schema_columns_added',
      user: session.kuratorName ?? undefined,
      details: {
        schemaId: schema.id,
        added: Object.entries(decisions).map(([col, d]) => ({
          col,
          mode: d.mode,
          target: d.canonical ?? d.custom ?? null,
        })),
      },
    });
    // Re-Import: die zuvor ignorierten Spalten werden jetzt auf allen Anträgen befüllt.
    setPhase('importing');
    setProgress(null);
    setCancelled(false);
    setImportError(null);
    abortRef.current = new AbortController();
    try {
      const r = await importCsvSource(storage.idb, schema.id, file, {
        signal: abortRef.current.signal,
        onProgress: p => setProgress(p),
        // Mapping wurde gerade geaendert → byte-gleiche Datei trotzdem neu
        // verarbeiten (sonst Checksum-Skip, neue Spalten blieben leer).
        force: true,
        // Belegter Build-Lock (z.B. abgestürzter Import) → nachfragen statt abbrechen.
        onLockConflict: confirmLockConflict,
      });
      setResult(r);
      await persistCsvSourceMeta(storage.idb, { schema, file, sourceHandle });
      onCompleted();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setCancelled(true);
      else setImportError((e as Error).message);
    } finally {
      abortRef.current = null;
    }
  });

  const isImporting = phase === 'importing' && !result && !importError && !cancelled;
  const cancelAvailable = isImporting && (
    progress === null ||
    progress.phase === 'parsing' ||
    progress.phase === 'diffing'
  );

  return (
    <Dialog
      open
      onClose={isImporting
        ? (cancelAvailable ? () => abortRef.current?.abort() : () => {})
        : onClose}
      title={`Neue Spalten übernehmen: ${schema.csv_source_name}`}
      className="max-w-[760px]"
      dismissOnOverlayClick={false}
      footer={
        phase === 'reviewing' ? (
          <div className="flex w-full items-center justify-between">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={confirm.busy}>Abbrechen</Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => confirm.run()}
              disabled={loading || confirm.busy || !!parseError}
            >
              {confirm.busy ? 'Speichern…' : 'Übernehmen + Import'}
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
          <div className="flex items-center gap-2 rounded-lg border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-subtle)] px-3 py-2 mb-4">
            <FileText size={15} className="flex-shrink-0 text-[var(--tf-text-secondary)]" />
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-[var(--tf-text)]">{file.name}</div>
              <div className="text-[11px] text-[var(--tf-text-tertiary)]">
                {formatBytes(file.size)} · geändert {new Date(file.lastModified).toLocaleString('de-DE')}
              </div>
            </div>
          </div>

          <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3 leading-relaxed">
            Die folgenden Spalten stehen in der CSV, sind aber noch nicht im Schema. Lege pro Spalte fest,
            wie sie übernommen wird — die <strong>{Object.keys(schema.column_mapping).length}</strong> bereits
            gemappten Spalten bleiben unverändert. Anschließend wird die Datei neu importiert, damit die neuen
            Felder auf allen Anträgen befüllt werden.
          </div>

          {loading ? (
            <div className="text-[12px] text-[var(--tf-text-tertiary)]">Datei wird geprüft …</div>
          ) : parseError ? (
            <div className="rounded-md border-[0.5px] border-red-300 bg-red-50 p-2.5 text-[12px] text-red-800">
              {parseError}
            </div>
          ) : (
            <>
              {conflictCanonicals.size > 0 ? (
                <div className="mb-3 rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900">
                  <div className="font-medium mb-1">⚠ Standardfeld doppelt belegt</div>
                  <div className="text-[11.5px]">
                    {Array.from(conflictCanonicals).map(c => getCanonicalLabel(c)).join(', ')} — beim Import gewinnt
                    die in der CSV-Reihenfolge zuletzt stehende Spalte, die anderen Werte gehen verloren.
                    Ggf. eine der Spalten auf <em>Eigenes Feld</em> umstellen.
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border-[0.5px] border-[var(--tf-border)] px-3 py-1">
                {newColumns.map(col => (
                  <NewColumnRow
                    key={col}
                    column={col}
                    decision={decisions[col] ?? { mode: 'ignore' }}
                    conflict={
                      decisions[col]?.mode === 'canonical' &&
                      !!decisions[col]?.canonical &&
                      conflictCanonicals.has(decisions[col].canonical as string)
                    }
                    onChange={patch => update(col, patch)}
                  />
                ))}
              </div>
            </>
          )}

          {confirm.error ? (
            <div className="mt-3 text-[12px] text-red-700">Fehler: {confirm.error}</div>
          ) : null}
        </div>
      ) : null}

      {phase === 'importing' ? (
        <Step4Progress progress={progress} result={result} error={importError} cancelled={cancelled} />
      ) : null}
    </Dialog>
  );
}

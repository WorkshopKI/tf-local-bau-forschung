import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  importCsvSource,
  parseCsvPreview,
  saveSchema,
  loadCsvSourceFile,
  type ImportProgress,
} from '@/core/services/csv';
import { getCanonicalLabel } from '@/core/services/csv/constants';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { refreshAntraegeStoreAfterSync } from '@/plugins/antraege/snapshot-refresh';
import type { CsvSchema, ImportResult } from '@/core/services/csv/types';
import { Step4Progress } from './wizard/Step4Progress';
import { guessDecision, type PerColumnDecision } from './wizard/useCsvWizardState';
import { decisionFromEntry, rebuildMapping } from './services/new-column-mapping';
import { confirmLockConflict } from './lock-conflict';
import { NewColumnRow } from './NewColumnRow';

interface Props {
  schema: CsvSchema;
  onClose: () => void;
  onCompleted: () => void;
}

type Phase = 'reviewing' | 'importing';
type KindFilter = 'all' | 'canonical' | 'custom' | 'ignore';

const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'canonical', label: 'Standardfeld' },
  { key: 'custom', label: 'Eigenes Feld' },
  { key: 'ignore', label: 'Ignoriert' },
];

const PILL_ACTIVE = 'px-2.5 py-1 rounded-full text-[11px] bg-[var(--tf-text)] text-[var(--tf-bg)]';
const PILL_INACTIVE = 'px-2.5 py-1 rounded-full text-[11px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)] hover:bg-[var(--tf-bg-secondary)]';

/**
 * Pflicht-Standardfelder, die nach dem Re-Mapping weiter belegt sein MÜSSEN,
 * sonst bricht die Identität/Verbund-Zuordnung. Spiegelt die Step-2-Validierung
 * des Wizards (`CsvSourceWizard`). Die Quellspalten, die diese Felder aktuell
 * liefern, werden im Editor gesperrt (read-only) — Änderungen daran gehen über
 * den vollen Wizard.
 */
function requiredCanonicals(schema: CsvSchema): string[] {
  return schema.is_master ? ['aktenzeichen', 'unterprogramm_id'] : [schema.join_key];
}

/**
 * „Spalten neu mappen": lädt die zuletzt importierte CSV vom Share (kein Datei-
 * Picker), zeigt ALLE Spalten mit ihrem aktuellen Mapping vorbefüllt, lässt den
 * Kurator beliebige Zuordnungen ändern (z.B. Custom → Standardfeld) und löst in
 * einem Schritt Schema-Speichern + force-Re-Import aus. Generalisiert den
 * additiven `CsvAddColumnsDialog` auf das vollständige Re-Mapping.
 */
export function RemapCsvColumnsDialog({ schema, onClose, onCompleted }: Props): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [decisions, setDecisions] = useState<Record<string, PerColumnDecision>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleByCol, setSampleByCol] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterTerm, setFilterTerm] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [phase, setPhase] = useState<Phase>('reviewing');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Gesperrte Spalten: die aktuell ein Pflicht-Standardfeld liefern.
  const lockedColumns = useMemo(() => {
    const req = new Set(requiredCanonicals(schema));
    const locked = new Set<string>();
    for (const [col, e] of Object.entries(schema.column_mapping)) {
      if (e.canonical && req.has(String(e.canonical))) locked.add(col);
    }
    return locked;
  }, [schema]);

  // Gespeicherte CSV laden + Decisions aus dem aktuellen Mapping vorbefüllen.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const text = await loadCsvSourceFile(storage.idb, schema.id);
        if (!alive) return;
        if (text === null) {
          setLoadError(
            'Keine gespeicherte CSV gefunden (oder Daten-Share nicht erreichbar). ' +
              'Bitte zuerst über „CSV neu wählen" einmal importieren.',
          );
          return;
        }
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        blobRef.current = blob;
        // Stored-File ist immer UTF-8 (siehe saveCsvSourceFile) — Encoding erzwingen.
        const preview = await parseCsvPreview(blob, 8, { encoding: 'UTF-8', separator: schema.separator });
        if (!alive) return;
        const init: Record<string, PerColumnDecision> = {};
        const samples: Record<string, string> = {};
        for (const col of preview.headers) {
          const entry = schema.column_mapping[col];
          init[col] = entry
            ? decisionFromEntry(entry)
            : guessDecision(col, preview.rows.map(r => (r[col] ?? '').trim()));
          const firstNonEmpty = preview.rows.map(r => (r[col] ?? '').trim()).find(v => v.length > 0);
          if (firstNonEmpty) samples[col] = firstNonEmpty;
        }
        setHeaders(preview.headers);
        setSampleByCol(samples);
        setDecisions(init);
      } catch (e) {
        if (!alive) return;
        setLoadError(`CSV konnte nicht gelesen werden: ${(e as Error).message}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [storage.idb, schema]);

  // Laufenden Import beim Unmount sauber abbrechen.
  useEffect(() => () => abortRef.current?.abort(), []);

  const update = (col: string, patch: Partial<PerColumnDecision>): void =>
    setDecisions(prev => {
      const base: PerColumnDecision = prev[col] ?? { mode: 'ignore' };
      return { ...prev, [col]: { ...base, ...patch } };
    });

  // Canonical-Doppelbelegung über ALLE Spalten erkennen.
  const conflictCanonicals = useMemo(() => {
    const used = new Map<string, number>();
    for (const d of Object.values(decisions)) {
      if (d.mode === 'canonical' && d.canonical) used.set(d.canonical, (used.get(d.canonical) ?? 0) + 1);
    }
    const set = new Set<string>();
    for (const [canon, count] of used) if (count > 1) set.add(canon);
    return set;
  }, [decisions]);

  const visibleHeaders = useMemo(() => {
    const term = filterTerm.trim().toLowerCase();
    return headers.filter(col => {
      const d = decisions[col];
      if (kindFilter !== 'all' && (d?.mode ?? 'ignore') !== kindFilter) return false;
      if (!term) return true;
      if (col.toLowerCase().includes(term)) return true;
      const label = schema.column_mapping[col]?.label;
      if (label && label.toLowerCase().includes(term)) return true;
      if (d?.mode === 'custom' && d.custom && d.custom.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [headers, decisions, kindFilter, filterTerm, schema]);

  const confirm = useAsyncAction(async () => {
    // Pflicht-Standardfelder müssen weiter belegt sein.
    const assigned = new Set<string>();
    for (const d of Object.values(decisions)) {
      if (d.mode === 'canonical' && d.canonical) assigned.add(d.canonical);
    }
    const missing = requiredCanonicals(schema).filter(c => !assigned.has(c));
    if (missing.length > 0) {
      throw new Error(
        `Pflichtfeld${missing.length > 1 ? 'er' : ''} nicht mehr gemappt: ` +
          `${missing.map(getCanonicalLabel).join(', ')}. Re-Mapping abgebrochen.`,
      );
    }
    const blob = blobRef.current;
    if (!blob) throw new Error('Keine geladene CSV.');

    const mapping = rebuildMapping(schema.column_mapping, decisions);
    await saveSchema(storage.idb, { ...schema, column_mapping: mapping });
    await logAudit(storage.idb, {
      action: 'csv_schema_remapped',
      user: session.kuratorName ?? undefined,
      details: {
        schemaId: schema.id,
        columns: headers.length,
      },
    });

    setPhase('importing');
    setProgress(null);
    setCancelled(false);
    setImportError(null);
    abortRef.current = new AbortController();
    try {
      const r = await importCsvSource(storage.idb, schema.id, blob, {
        signal: abortRef.current.signal,
        onProgress: p => setProgress(p),
        // Mapping geändert → byte-gleiche Datei trotzdem neu verarbeiten.
        // Stored-File ist UTF-8 → Encoding erzwingen (sonst Mojibake).
        force: true,
        encodingOverride: 'UTF-8',
        onLockConflict: confirmLockConflict,
      });
      setResult(r);
      // Cold-Start-Store-Refresh (recurring-bug-classes Klasse 1): nach dem
      // Re-Import den In-Memory-Antraege-Store neu laden, sonst zeigt die Home
      // die neu gemappten Daten erst nach manuellem Reload (wie CsvSourceReimportDialog).
      await refreshAntraegeStoreAfterSync(storage.idb, schema.programm_id, ['antraege', 'verbuende'] as const);
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
    progress === null || progress.phase === 'parsing' || progress.phase === 'diffing'
  );

  return (
    <Dialog
      open
      onClose={isImporting
        ? (cancelAvailable ? () => abortRef.current?.abort() : () => {})
        : onClose}
      title={`Spalten neu mappen: ${schema.csv_source_name}`}
      className="max-w-[820px]"
      dismissOnOverlayClick={false}
      footer={
        phase === 'reviewing' ? (
          <div className="flex w-full items-center justify-between">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={confirm.busy}>Abbrechen</Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => confirm.run()}
              disabled={loading || confirm.busy || !!loadError}
            >
              {confirm.busy ? 'Speichern…' : 'Speichern & neu verarbeiten'}
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
              <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>Abbrechen</Button>
            ) : (
              <Button size="sm" variant="default" onClick={onClose} disabled={isImporting}>Schließen</Button>
            )}
          </div>
        )
      }
    >
      {phase === 'reviewing' ? (
        <div>
          <div className="flex items-center gap-2 rounded-lg border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3 py-2 mb-3">
            <FileText size={15} className="flex-shrink-0 text-[var(--tf-text-secondary)]" />
            <div className="min-w-0 text-[11.5px] text-[var(--tf-text-tertiary)]">
              Gespeicherte CSV vom Daten-Share
              {typeof schema.last_row_count === 'number' ? ` · ${schema.last_row_count} Zeilen` : ''}
              {schema.last_imported_at ? ` · zuletzt importiert ${new Date(schema.last_imported_at).toLocaleString('de-DE')}` : ''}
            </div>
          </div>

          <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3 leading-relaxed">
            Ordne beliebige Spalten neu zu (z.B. ein <em>Eigenes Feld</em> auf ein <em>Standardfeld</em> umstellen).
            Beim Speichern wird die gespeicherte CSV neu verarbeitet — die geänderten Felder erscheinen danach auf allen Anträgen.
            Pflicht-Spalten (Identität/Verbund) sind gesperrt.
          </div>

          {loading ? (
            <div className="text-[12px] text-[var(--tf-text-tertiary)]">CSV wird geladen …</div>
          ) : loadError ? (
            <div className="rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900">
              {loadError}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
                  <Input
                    value={filterTerm}
                    onChange={e => setFilterTerm(e.target.value)}
                    placeholder="Spalte suchen …"
                    className="h-8 pl-7 text-[12px]"
                  />
                </div>
                <div className="flex gap-1">
                  {KIND_FILTERS.map(k => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setKindFilter(k.key)}
                      className={kindFilter === k.key ? PILL_ACTIVE : PILL_INACTIVE}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              {conflictCanonicals.size > 0 ? (
                <div className="mb-2 rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900">
                  <span className="font-medium">⚠ Standardfeld doppelt belegt: </span>
                  {Array.from(conflictCanonicals).map(getCanonicalLabel).join(', ')} — beim Import gewinnt die
                  in der CSV zuletzt stehende Spalte, die anderen Werte gehen verloren.
                </div>
              ) : null}

              <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-1">
                {visibleHeaders.length} von {headers.length} Spalten
              </div>

              <div className="max-h-[46vh] overflow-y-auto rounded-md border-[0.5px] border-[var(--tf-border)] px-3 py-1">
                {visibleHeaders.length === 0 ? (
                  <div className="py-4 text-center text-[12px] text-[var(--tf-text-tertiary)]">
                    Keine Spalte passt zum Filter.
                  </div>
                ) : (
                  visibleHeaders.map(col => (
                    <NewColumnRow
                      key={col}
                      column={col}
                      decision={decisions[col] ?? { mode: 'ignore' }}
                      sampleHint={sampleByCol[col]}
                      locked={lockedColumns.has(col)}
                      conflict={
                        decisions[col]?.mode === 'canonical' &&
                        !!decisions[col]?.canonical &&
                        conflictCanonicals.has(decisions[col].canonical as string)
                      }
                      onChange={patch => update(col, patch)}
                    />
                  ))
                )}
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

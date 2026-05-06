import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { parseLabelXlsx } from '@/core/services/csv';
import type { LabelParseResult } from '@/core/services/csv';
import type { AmbiguousMergeResolution } from '@/core/services/csv/types';
import type { WizardApi } from './useCsvWizardState';

interface Props {
  api: WizardApi;
}

const HEADER_ROW_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export function XlsLabelUpload({ api }: Props): React.ReactElement {
  const { state, setHeaderRowCount, setLabelParseResult, setAllAmbiguousResolutions, clearLabelResult } = api;
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showMergeDetails, setShowMergeDetails] = useState(false);

  const handleFile = async (file: File, headerRows: number): Promise<void> => {
    setLoading(true);
    setErr(null);
    setPendingFile(file);
    try {
      const result: LabelParseResult = await parseLabelXlsx(file, headerRows);
      if (result.columnEntries.length === 0) {
        setErr(
          'Keine Spalten erkannt. Struktur passt nicht — die letzte Zeile sollte die CSV-Spaltennamen enthalten. Versuche eine andere Zeilen-Anzahl.',
        );
        clearLabelResult();
        return;
      }
      setLabelParseResult(result, file.name);
    } catch (e) {
      setErr(`Parse-Fehler: ${(e as Error).message}`);
      clearLabelResult();
    } finally {
      setLoading(false);
    }
  };

  const handleHeaderRowChange = async (n: number): Promise<void> => {
    setHeaderRowCount(n);
    if (pendingFile) {
      await handleFile(pendingFile, n);
    }
  };

  const hasAmbig = state.ambiguousMerges.length > 0;

  const effectiveResolutions = state.ambiguousMerges.map(
    m => state.ambiguousResolutions[m.signature] ?? m.default_resolution,
  );
  const allMergesAtGroup = hasAmbig && effectiveResolutions.every(r => r === 'group');
  const allMergesAtIgnore = hasAmbig && effectiveResolutions.every(r => r === 'ignore');

  const resolutionLabel = (r: AmbiguousMergeResolution): string =>
    r === 'group' ? 'Als Gruppe' : r === 'label_repeated' ? 'Als Label wiederholt' : 'Ignorieren';

  return (
    <div
      className="mb-4 p-3 rounded-md"
      style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[12.5px] font-medium text-[var(--tf-text)]">Label-XLS hochladen (optional)</div>
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)] leading-relaxed">
            Konvention: <span className="font-medium">letzte Zeile</span> = CSV-Spaltennamen,{' '}
            <span className="font-medium">vorletzte Zeile</span> = individuelles Label pro Spalte,{' '}
            <span className="font-medium">Zeilen darüber</span> = Gruppen-Ebenen (merged cells).
            Bei leerem Label → CSV-Spaltenname wird als Label verwendet.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11.5px] text-[var(--tf-text-secondary)]">
            Header-Zeilen:
            <select
              value={state.headerRowCount}
              onChange={e => void handleHeaderRowChange(Number(e.target.value))}
              className="ml-1 h-7 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-1.5 text-[12px]"
            >
              {HEADER_ROW_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <input
            type="file"
            id="xls-label-upload"
            accept=".xls,.xlsx"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f, state.headerRowCount);
            }}
            className="hidden"
          />
          <label htmlFor="xls-label-upload">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] cursor-pointer bg-transparent text-[var(--tf-text)]"
              style={{ border: '0.5px solid var(--tf-border-hover)' }}
            >
              Upload…
            </span>
          </label>
        </div>
      </div>

      {state.labelFileName ? (
        <div className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Geladen: <span className="font-mono">{state.labelFileName}</span> · {state.labelEntries.length} Spalten
          {hasAmbig ? ` · ${state.ambiguousMerges.length} mehrdeutige Merges` : ''}
        </div>
      ) : null}
      {loading ? <div className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">Parse läuft…</div> : null}
      {err ? <div className="mt-2 text-[11.5px] text-amber-700">{err}</div> : null}

      {hasAmbig ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowMergeDetails(v => !v)}
            className="flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] transition"
          >
            {showMergeDetails ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Info size={12} className="text-[var(--tf-text-tertiary)]" />
            <span>
              {state.ambiguousMerges.length} Mehrfach-Merge{state.ambiguousMerges.length === 1 ? '' : 's'} erkannt
              {' — Standard '}
              <span className="italic">Als Gruppe</span>
              {' angewendet. '}
              <span className="text-[var(--tf-text-secondary)] underline-offset-2 group-hover:underline">Anpassen</span>
            </span>
          </button>

          {showMergeDetails ? (
            <div className="mt-2 ml-5 space-y-1">
              {state.ambiguousMerges.map(m => {
                const current = state.ambiguousResolutions[m.signature] ?? m.default_resolution;
                return (
                  <div
                    key={m.signature}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded text-[11.5px]"
                    style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
                  >
                    <div className="flex items-center gap-2 text-[var(--tf-text)]">
                      <span className="font-medium">{m.value}</span>
                      <span className="text-[var(--tf-text-tertiary)]">
                        ({m.affected_columns.length} Spalten, Merge über {m.span_header_rows} Header-Zeilen)
                      </span>
                    </div>
                    <select
                      value={current}
                      onChange={e => api.setAmbiguousResolution(m.signature, e.target.value as AmbiguousMergeResolution)}
                      className="h-6 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-1 text-[11.5px]"
                    >
                      <option value="group">{resolutionLabel('group')}</option>
                      <option value="label_repeated">{resolutionLabel('label_repeated')}</option>
                      <option value="ignore">{resolutionLabel('ignore')}</option>
                    </select>
                  </div>
                );
              })}
              {state.ambiguousMerges.length > 1 ? (
                <div className="flex gap-2 pt-1 text-[11px] text-[var(--tf-text-tertiary)]">
                  <span>Bulk:</span>
                  <button
                    type="button"
                    onClick={() => setAllAmbiguousResolutions('group')}
                    disabled={allMergesAtGroup}
                    className="hover:text-[var(--tf-text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed underline-offset-2 hover:underline"
                  >
                    {allMergesAtGroup ? 'alle als Gruppe (aktuell)' : 'alle als Gruppe'}
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setAllAmbiguousResolutions('ignore')}
                    disabled={allMergesAtIgnore}
                    className="hover:text-[var(--tf-text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed underline-offset-2 hover:underline"
                  >
                    {allMergesAtIgnore ? 'alle ignoriert (aktuell)' : 'alle ignorieren'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

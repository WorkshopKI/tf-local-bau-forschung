import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseLabelXlsx, buildSuggestions } from '@/core/services/csv';
import type { LabelSuggestion, LabelParseResult } from '@/core/services/csv';
import { CANONICAL_FIELDS } from '@/core/services/csv/constants';
import type { AmbiguousMergeResolution } from '@/core/services/csv/types';
import type { PerColumnDecision, WizardApi } from './useCsvWizardState';

interface Props {
  previewHeaders: string[];
  api: WizardApi;
  onApply: (updates: Record<string, PerColumnDecision>) => void;
}

const HEADER_ROW_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export function XlsLabelUpload({ previewHeaders, api, onApply }: Props): React.ReactElement {
  const { state, setHeaderRowCount, setLabelParseResult, setAllAmbiguousResolutions, clearLabelResult } = api;
  const [suggestions, setSuggestions] = useState<LabelSuggestion[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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
        setSuggestions([]);
        return;
      }
      setLabelParseResult(result, file.name);
      const suggs = buildSuggestions(previewHeaders, result);
      setSuggestions(suggs);
      if (suggs.length === 0) {
        setErr('Labels geladen, aber keine Vorschläge für bekannte Spalten gefunden.');
      }
    } catch (e) {
      setErr(`Parse-Fehler: ${(e as Error).message}`);
      clearLabelResult();
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleHeaderRowChange = async (n: number): Promise<void> => {
    setHeaderRowCount(n);
    setSuggestions([]);
    // Falls bereits eine Datei geladen wurde, sofort neu parsen
    if (pendingFile) {
      await handleFile(pendingFile, n);
    }
  };

  const applySuggestion = (s: LabelSuggestion): Record<string, PerColumnDecision> => {
    if (!s.canonical) return {};
    const type = CANONICAL_FIELDS.find(f => f.key === s.canonical)?.type ?? 'string';
    return {
      [s.csvColumn]: {
        mode: 'canonical' as const,
        canonical: s.canonical,
        type,
      },
    };
  };

  const applyOne = (s: LabelSuggestion): void => {
    onApply(applySuggestion(s));
  };

  const applyAll = (): void => {
    const merged: Record<string, PerColumnDecision> = {};
    for (const s of suggestions) {
      Object.assign(merged, applySuggestion(s));
    }
    onApply(merged);
  };

  const confident = suggestions.filter(s => s.canonical && s.confidence >= 0.6);
  const hasAmbig = state.ambiguousMerges.length > 0;

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

      {hasAmbig && state.ambiguousMerges.length > 1 ? (
        <div
          className="mt-3 p-2 rounded flex items-center justify-between gap-3 text-[11.5px]"
          style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
        >
          <div className="flex items-center gap-2 text-[var(--tf-text-secondary)]">
            <AlertTriangle size={14} className="text-amber-600" />
            {state.ambiguousMerges.length} mehrdeutige Gruppen erkannt (Merge über Gruppen- und Label-Zeile).
          </div>
          <div className="flex gap-1">
            <Button size="xs" variant="outline" onClick={() => setAllAmbiguousResolutions('group')}>
              Alle als Gruppe
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setAllAmbiguousResolutions('ignore')}>
              Alle ignorieren
            </Button>
          </div>
        </div>
      ) : null}

      {hasAmbig ? (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Mehrdeutige Gruppen — Behandlung
          </div>
          <div className="space-y-1">
            {state.ambiguousMerges.map(m => {
              const current = state.ambiguousResolutions[m.signature] ?? m.default_resolution;
              return (
                <div
                  key={m.signature}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded text-[11.5px]"
                  style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={12} className="text-amber-600" />
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
          </div>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11.5px] text-[var(--tf-text-secondary)]">
              {suggestions.length} Vorschläge · {confident.length} mit hoher Konfidenz
            </div>
            <Button size="xs" variant="default" onClick={applyAll} disabled={confident.length === 0}>
              Alle Vorschläge akzeptieren ({confident.length})
            </Button>
          </div>
          <div className="overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 6, background: 'var(--tf-bg)' }}>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                  <th className="p-1.5">CSV-Spalte</th>
                  <th className="p-1.5">Label</th>
                  <th className="p-1.5">Vorgeschlagen</th>
                  <th className="p-1.5">Konfidenz</th>
                  <th className="p-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, i) => (
                  <tr key={s.csvColumn} style={{ borderTop: i === 0 ? undefined : '0.5px solid var(--tf-border)' }}>
                    <td className="p-1.5 font-mono">{s.csvColumn}</td>
                    <td className="p-1.5">{s.label}</td>
                    <td className="p-1.5">{s.canonical ?? <span className="text-[var(--tf-text-tertiary)]">–</span>}</td>
                    <td className="p-1.5 tabular-nums">
                      {s.canonical ? (
                        <span className={s.confidence >= 0.7 ? 'text-emerald-700' : s.confidence >= 0.5 ? 'text-amber-700' : 'text-[var(--tf-text-tertiary)]'}>
                          {Math.round(s.confidence * 100)}%
                        </span>
                      ) : (
                        <span className="text-[var(--tf-text-tertiary)]">–</span>
                      )}
                    </td>
                    <td className="p-1.5 text-right">
                      {s.canonical ? (
                        <Button size="xs" variant="ghost" onClick={() => applyOne(s)}>
                          Übernehmen
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

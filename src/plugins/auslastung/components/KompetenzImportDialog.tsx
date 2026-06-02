/**
 * KompetenzImportDialog (v2.15) — PL lädt die Kompetenz-XLSX hoch.
 *
 * Drag & Drop / File-Picker → Validierungs-Preview pro Zeile → Übernehmen.
 * Spiegelt das Muster von `ImportDialog` (Kapazitäten), aber für das
 * Wide-Kompetenz-Schema (`parseKompetenzXlsx` / `applyKompetenzImport`).
 */
import { useCallback, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useDialogEsc } from './useDialogEsc';
import { useAuslastungData } from '../hooks/useAuslastungData';
import type { AnonymMap } from '../services/anonym-map';
import {
  applyKompetenzImport,
  parseKompetenzXlsx,
  type KompetenzImportPreview,
} from '../services/kompetenz-import';

interface Props {
  open: boolean;
  anonymMap: AnonymMap;
  onClose: () => void;
}

export function KompetenzImportDialog({ open, anonymMap, onClose }: Props): React.ReactElement | null {
  const storage = useStorage();
  const data = useAuslastungData(s => s.data);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<KompetenzImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setParsing(true);
    try {
      setPreview(await parseKompetenzXlsx(f, data, anonymMap));
    } finally {
      setParsing(false);
    }
  }, [data, anonymMap]);

  const apply = useAsyncAction(async () => {
    if (!preview || preview.fatal) return;
    const r = await applyKompetenzImport(storage, preview);
    setResult(`${r.applied} MAs vorbelegt (${r.created} neu angelegt), ${r.skipped} übersprungen.`);
    setPreview(null);
    setFile(null);
  });

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }

  function reset(): void {
    setFile(null);
    setPreview(null);
    setResult(null);
    apply.clearError();
  }

  useDialogEsc(open, parsing || apply.busy, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="w-[680px] max-h-[82vh] rounded-[16px] p-5 flex flex-col gap-3 overflow-hidden"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium">Kompetenz-Vorbelegung importieren</h3>
          <button type="button" onClick={onClose} disabled={parsing || apply.busy} className="cursor-pointer text-[var(--tf-text-tertiary)]">×</button>
        </div>

        {!preview && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="rounded-[12px] p-8 text-center"
            style={{
              border: dragging ? '1.5px dashed var(--tf-primary)' : '1.5px dashed var(--tf-border)',
              background: dragging ? 'var(--tf-bg-secondary)' : 'transparent',
            }}
          >
            <p className="text-[13px] mb-1">PL-Kompetenz-XLSX hier ablegen</p>
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-3">
              Spalten: Antragstyp-Kontingent in Stunden/Jahr (DL/DS/NW/FuE), TIB_KUERZ, Abschlag, dann je Überkategorie die Unterkategorie-Level (1–3).
            </p>
            <label className="inline-block px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer" style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}>
              {parsing ? 'Lese…' : 'Datei wählen'}
              <input type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} className="hidden" />
            </label>
          </div>
        )}

        {preview && (
          <div className="flex flex-col gap-3 overflow-hidden">
            {file && (
              <div className="text-[11.5px] text-[var(--tf-text-secondary)]">
                Datei: <span className="font-mono">{file.name}</span>
                <button type="button" onClick={reset} className="ml-3 cursor-pointer underline">Andere wählen</button>
              </div>
            )}
            {preview.fatal && (
              <div className="rounded p-3 text-[12px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>
                {preview.fatal}
              </div>
            )}
            {!preview.fatal && (
              <>
                <div className="grid grid-cols-4 gap-2 text-[12px]">
                  <Metric label="Gesamt" value={preview.summary.total} />
                  <Metric label="Gültig" value={preview.summary.valid} color="emerald" />
                  <Metric label="Warnungen" value={preview.summary.warnings} color="amber" />
                  <Metric label="Unbekannt" value={preview.summary.unknownMa} color="rose" />
                </div>
                <div className="overflow-y-auto max-h-[320px] rounded" style={{ border: '0.5px solid var(--tf-border)' }}>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                        <th className="px-2 py-1.5">Kürzel</th>
                        <th className="px-2 py-1.5">MA</th>
                        <th className="px-2 py-1.5">Hauptkat.</th>
                        <th className="px-2 py-1.5">Neben</th>
                        <th className="px-2 py-1.5">Komp.</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r, i) => (
                        <tr key={`${r.kuerzel}-${i}`} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                          <td className="px-2 py-1 font-mono">{r.kuerzel}</td>
                          <td className="px-2 py-1 font-mono text-[var(--tf-text-tertiary)]">{r.anonId ?? '—'}</td>
                          <td className="px-2 py-1">{r.hauptKategorie || '—'}</td>
                          <td className="px-2 py-1 text-[var(--tf-text-tertiary)]">{r.nebenKategorien.join(', ') || '—'}</td>
                          <td className="px-2 py-1 text-[var(--tf-text-tertiary)]">{r.subCount}</td>
                          <td className="px-2 py-1">
                            {r.warnings.length > 0
                              ? <span className="text-amber-700 text-[11px]" title={r.warnings.join('; ')}>⚠ {r.warnings.length}</span>
                              : <span className="text-emerald-700 text-[11px]">✓</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {result && (
          <div className="rounded p-2.5 text-[12px]" style={{ background: '#d1fae5', color: '#065f46' }}>✓ {result}</div>
        )}
        {apply.error && (
          <div className="rounded p-2.5 text-[12px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>
            ⚠ Übernahme fehlgeschlagen: <span className="font-mono">{apply.error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <button type="button" onClick={onClose} disabled={parsing || apply.busy} className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50" style={{ border: '0.5px solid var(--tf-border)' }}>
            Schließen
          </button>
          {preview && !preview.fatal && (
            <button
              type="button"
              onClick={() => apply.run()}
              disabled={apply.busy || preview.summary.valid === 0}
              className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              {apply.busy ? 'Übernehme…' : `${preview.summary.valid} MAs übernehmen`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color?: 'emerald' | 'amber' | 'rose' }): React.ReactElement {
  const c = color === 'emerald' ? 'text-emerald-700' : color === 'amber' ? 'text-amber-700' : color === 'rose' ? 'text-rose-700' : 'text-[var(--tf-text)]';
  return (
    <div className="rounded p-2" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className={`text-[18px] font-semibold ${c}`}>{value}</div>
      <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">{label}</div>
    </div>
  );
}

/**
 * Generischer Import-Dialog: Drag & Drop oder File-Picker + Validierungs-
 * Preview + Apply-Bestaetigung.
 *
 * Aktuell verwendet vom Kapazitaets-Import. Kann fuer Onboarding-Import
 * (multi-file) erweitert werden, dort gibt es aber einen eigenen Dialog
 * mit Preview pro Datei.
 */
import { useCallback, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useDialogEsc } from './useDialogEsc';
import { useAuslastungData } from '../hooks/useAuslastungData';
import {
  applyKapazitaetsImport,
  parseKapazitaetsXlsx,
  type KapazitaetsImportPreview,
} from '../services/kapazitaets-import';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportDialog({ open, onClose }: Props): React.ReactElement | null {
  const storage = useStorage();
  const data = useAuslastungData(s => s.data);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<KapazitaetsImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setBusy(true);
    try {
      const p = await parseKapazitaetsXlsx(f, data);
      setPreview(p);
    } finally {
      setBusy(false);
    }
  }, [data]);

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void handleFile(f);
  }

  async function apply(): Promise<void> {
    if (!preview || preview.fatal) return;
    setBusy(true);
    try {
      const r = await applyKapazitaetsImport(storage, preview);
      setResult(`${r.applied} Zeilen angewendet, ${r.skipped} übersprungen.`);
      setPreview(null);
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  function reset(): void {
    setFile(null);
    setPreview(null);
    setResult(null);
  }

  useDialogEsc(open, busy, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)' }}
    >
      <div
        className="w-[600px] max-h-[80vh] rounded-[12px] p-5 flex flex-col gap-3 overflow-hidden"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium">Kapazitäten importieren</h3>
          <button type="button" onClick={onClose} disabled={busy} className="cursor-pointer text-[var(--tf-text-tertiary)]">×</button>
        </div>

        {!preview && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-[12px] p-8 text-center transition-colors ${dragging ? 'opacity-100' : 'opacity-80'}`}
            style={{
              border: dragging ? '1.5px dashed var(--tf-primary)' : '1.5px dashed var(--tf-border)',
              background: dragging ? 'var(--tf-bg-secondary)' : 'transparent',
            }}
          >
            <p className="text-[13px] mb-3">Ziehe deine XLSX-Datei hier rein</p>
            <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-3">oder</p>
            <label className="inline-block px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer" style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}>
              Datei wählen
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                className="hidden"
              />
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
              <div className="rounded p-3 text-[12px]" style={{ background: '#fee2e2', color: '#991b1b' }}>
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
                <div className="overflow-y-auto max-h-[300px] rounded" style={{ border: '0.5px solid var(--tf-border)' }}>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                        <th className="px-2 py-1.5">MA</th>
                        <th className="px-2 py-1.5">Kapazität</th>
                        <th className="px-2 py-1.5">Abgemeldet</th>
                        <th className="px-2 py-1.5">Tech</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map(r => (
                        <tr key={r.anonId} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                          <td className="px-2 py-1 font-mono">{r.anonId}</td>
                          <td className="px-2 py-1">{r.jahresKapazitaet ?? '—'}</td>
                          <td className="px-2 py-1 text-[var(--tf-text-tertiary)]">{(r.abgemeldet ?? []).join(', ')}</td>
                          <td className="px-2 py-1 text-[var(--tf-text-tertiary)]">{(r.manuelleTechnologien ?? []).length}</td>
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
          <div className="rounded p-2.5 text-[12px]" style={{ background: '#d1fae5', color: '#065f46' }}>
            ✓ {result}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Schließen
          </button>
          {preview && !preview.fatal && (
            <button
              type="button"
              onClick={() => void apply()}
              disabled={busy || preview.summary.valid === 0}
              className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              {busy ? 'Übernehme…' : `${preview.summary.valid} Zeilen übernehmen`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color?: 'emerald' | 'amber' | 'rose' }): React.ReactElement {
  const c = color === 'emerald' ? 'text-emerald-700'
    : color === 'amber' ? 'text-amber-700'
    : color === 'rose' ? 'text-rose-700'
    : 'text-[var(--tf-text)]';
  return (
    <div className="rounded p-2" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className={`text-[18px] font-semibold ${c}`}>{value}</div>
      <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">{label}</div>
    </div>
  );
}

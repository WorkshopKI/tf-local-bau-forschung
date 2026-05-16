/**
 * Multi-File-Upload fuer Onboarding-XLSX.
 *
 * Pro Datei eine Preview-Zeile mit Kuerzel, anonId-Vorschlag, Bewertungs-
 * Counts, abgeleiteten Ueberkategorien (editierbar). Bei bestehenden MAs
 * wird ein "→ Kalibrierung"-Hinweis gesetzt, der Apply-Button wechselt
 * dann auf "Kalibrierung starten".
 */
import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { applyOnboardingImport, parseOnboardingXlsx, type OnboardingPreview } from '../services/onboarding-import';
import { AnonymIdBadge } from './AnonymIdBadge';
import { KategoriePill } from './KategoriePill';
import { useDialogEsc } from './useDialogEsc';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Wird mit den Kalibrierungs-Previews (bestehende MAs) aufgerufen. */
  onCalibrate?: (previews: OnboardingPreview[]) => void;
}

interface Item {
  preview: OnboardingPreview;
  selectedKategorien: Set<string>;
}

export function OnboardingImportDialog({ open, onClose, onCalibrate }: Props): React.ReactElement | null {
  const storage = useStorage();
  const data = useAuslastungData(s => s.data);
  const cache = useAntraegeCache();
  const kategorien = data.config.ueberKategorien;
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onFiles(fileList: FileList | null): Promise<void> {
    if (!fileList) return;
    setBusy(true);
    try {
      const previews: Item[] = [];
      for (const f of Array.from(fileList)) {
        const preview = await parseOnboardingXlsx(f, { anonymMap: cache.anonymMap, data });
        previews.push({ preview, selectedKategorien: new Set(preview.abgeleiteteUeberKategorien) });
      }
      setItems(prev => [...prev, ...previews]);
    } finally {
      setBusy(false);
    }
  }

  function toggleKategorie(idx: number, katId: string): void {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = new Set(it.selectedKategorien);
      if (next.has(katId)) next.delete(katId); else next.add(katId);
      return { ...it, selectedKategorien: next };
    }));
  }

  async function applyAllNew(): Promise<void> {
    setBusy(true);
    try {
      const neu = items.filter(it => !it.preview.existierterAnonId && it.preview.effektivesKuerzel);
      for (const it of neu) {
        await applyOnboardingImport(storage, it.preview, [...it.selectedKategorien]);
      }
      setResult(`${neu.length} neue MAs importiert.`);
      setItems(prev => prev.filter(it => it.preview.existierterAnonId));
    } finally {
      setBusy(false);
    }
  }

  function startCalibration(): void {
    const bestehende = items.filter(it => it.preview.existierterAnonId).map(it => it.preview);
    if (bestehende.length === 0) return;
    onCalibrate?.(bestehende);
  }

  useDialogEsc(open, busy, onClose);

  if (!open) return null;

  const neuCount = items.filter(it => !it.preview.existierterAnonId && it.preview.effektivesKuerzel).length;
  const kalibrierCount = items.filter(it => it.preview.existierterAnonId).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)' }}
    >
      <div
        className="w-[800px] max-h-[80vh] rounded-[12px] p-5 flex flex-col gap-3 overflow-hidden"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium">Onboarding-XLSX importieren</h3>
          <button type="button" onClick={onClose} disabled={busy} className="cursor-pointer text-[var(--tf-text-tertiary)]">×</button>
        </div>

        <div className="rounded p-3 flex items-center gap-3 text-[12.5px]"
          style={{ border: '0.5px dashed var(--tf-border)' }}>
          <label className="cursor-pointer px-3 py-1.5 rounded-md" style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}>
            Dateien wählen
            <input
              type="file"
              accept=".xlsx"
              multiple
              onChange={e => void onFiles(e.target.files)}
              className="hidden"
            />
          </label>
          <span className="text-[var(--tf-text-tertiary)]">Mehrere XLSX gleichzeitig möglich</span>
        </div>

        {items.length > 0 && (
          <div className="overflow-y-auto flex-1 rounded" style={{ border: '0.5px solid var(--tf-border)' }}>
            {items.map((it, idx) => {
              const p = it.preview;
              const isKalibrierung = !!p.existierterAnonId;
              return (
                <div key={`${p.filename}-${idx}`} className="p-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px]">{p.effektivesKuerzel ?? '—'}</span>
                      {p.existierterAnonId ? (
                        <AnonymIdBadge anonId={p.existierterAnonId} size="sm" />
                      ) : (
                        p.vorgeschlageneAnonId && <AnonymIdBadge anonId={p.vorgeschlageneAnonId} size="sm" />
                      )}
                      {isKalibrierung && (
                        <span className="text-[10.5px] px-2 py-0.5 rounded" style={{ background: '#dbeafe', color: '#075985' }}>
                          → Kalibrierung
                        </span>
                      )}
                      {p.kuerzelMatch === 'abweichend' && (
                        <span className="text-[10.5px] px-2 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
                          ⚠ Kürzel-Mismatch
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--tf-text-tertiary)] font-mono">{p.filename}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-[11.5px]">
                    <div>
                      <span className="text-[var(--tf-text-tertiary)]">Bewertungen: </span>
                      <span className="font-medium text-emerald-700">{p.counts.kann_ich} Kann</span>
                      {' · '}
                      <span className="text-amber-700">{p.counts.teilweise} Teilw.</span>
                      {' · '}
                      <span className="text-rose-700">{p.counts.nicht_meins} Nicht</span>
                    </div>
                    {p.fachrichtung && <div><span className="text-[var(--tf-text-tertiary)]">Fach: </span>{p.fachrichtung}</div>}
                    {p.abschluss && <div><span className="text-[var(--tf-text-tertiary)]">Abschluss: </span>{p.abschluss}</div>}
                  </div>
                  {!isKalibrierung && (
                    <div className="mt-2">
                      <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Überkategorien</div>
                      <div className="flex flex-wrap gap-1.5">
                        {kategorien.map(k => {
                          const active = it.selectedKategorien.has(k.id);
                          return (
                            <button
                              key={k.id}
                              type="button"
                              onClick={() => toggleKategorie(idx, k.id)}
                              className="cursor-pointer"
                              aria-pressed={active}
                              title={k.name}
                            >
                              <KategoriePill kategorie={k} active={active} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {p.warnings.length > 0 && (
                    <p className="text-[10.5px] text-amber-700 mt-1.5">{p.warnings.join(' · ')}</p>
                  )}
                  {p.errors.length > 0 && (
                    <p className="text-[10.5px] text-rose-700 mt-1.5">{p.errors.join(' · ')}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {result && (
          <div className="rounded p-2.5 text-[12px]" style={{ background: '#d1fae5', color: '#065f46' }}>
            ✓ {result}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Schließen
          </button>
          {kalibrierCount > 0 && onCalibrate && (
            <button
              type="button"
              onClick={startCalibration}
              disabled={busy}
              className="px-4 py-1.5 rounded-md text-[12.5px] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-primary)', color: 'var(--tf-primary)' }}
            >
              Kalibrierung für {kalibrierCount} MA{kalibrierCount === 1 ? '' : 's'}
            </button>
          )}
          {neuCount > 0 && (
            <button
              type="button"
              onClick={() => void applyAllNew()}
              disabled={busy}
              className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              {busy ? 'Importiere…' : `${neuCount} neue MA${neuCount === 1 ? '' : 's'} anlegen`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

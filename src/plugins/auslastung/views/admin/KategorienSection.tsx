/**
 * Section zum Bearbeiten der Ueberkategorien nach abgeschlossenem Setup.
 * Tabelle: id / name / farbe / Mapping-Count / Drawer-Button "Bearbeiten".
 */
import { useMemo, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import {
  KATEGORIE_FARBEN,
  type KategorieFarbe,
  type UeberKategorie,
} from '../../types';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { KategoriePill } from '../../components/KategoriePill';

interface Props {
  storage: StorageService;
  allDeskriptoren: Array<{ wert: string; count: number }>;
}

export function KategorienSection({ storage, allDeskriptoren }: Props): React.ReactElement {
  const kategorien = useAuslastungData(s => s.data.config.ueberKategorien);
  const upsertKategorie = useAuslastungData(s => s.upsertKategorie);
  const removeKategorie = useAuslastungData(s => s.removeKategorie);

  const [drawerKat, setDrawerKat] = useState<UeberKategorie | null>(null);

  const nichtZugeordnet = useMemo(() => {
    // Substring-Match analog zum SetupWizard-Pre-Fill: ein echter Deskriptor
    // gilt als zugeordnet, wenn er ein Default-Mapping-Keyword als Substring
    // enthaelt (oder umgekehrt). Reines "exakter Match" wuerde alle 40
    // realen Werte als "nicht zugeordnet" markieren, weil die Defaults aus
    // ZT-Klartexten / Heuristik-Keywords bestehen.
    const needles: string[] = [];
    for (const k of kategorien) {
      for (const d of k.deskriptorenMapping) {
        const t = d.toLowerCase().trim();
        if (t) needles.push(t);
      }
    }
    return allDeskriptoren.filter(d => {
      const wert = d.wert.toLowerCase();
      return !needles.some(n => wert.includes(n) || n.includes(wert));
    }).length;
  }, [kategorien, allDeskriptoren]);

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">Überkategorien</h3>
        {nichtZugeordnet > 0 && (
          <span className="text-[11.5px] text-amber-700">
            ⚠ {nichtZugeordnet} Deskriptoren ohne Zuordnung
          </span>
        )}
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            <th className="px-2 py-1.5 w-20">ID</th>
            <th className="px-2 py-1.5">Name</th>
            <th className="px-2 py-1.5 w-32">Mapping</th>
            <th className="px-2 py-1.5 w-32 text-right">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {kategorien.map(k => (
            <tr key={k.id} style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
              <td className="px-2 py-1.5"><KategoriePill kategorie={k} /></td>
              <td className="px-2 py-1.5 text-[var(--tf-text)]">{k.name}</td>
              <td className="px-2 py-1.5 text-[var(--tf-text-secondary)]">{k.deskriptorenMapping.length} Werte</td>
              <td className="px-2 py-1.5 text-right">
                <button
                  type="button"
                  onClick={() => setDrawerKat(k)}
                  className="text-[11.5px] mr-2 cursor-pointer hover:underline"
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => void removeKategorie(storage, k.id)}
                  className="text-[11.5px] text-[var(--tf-text-tertiary)] cursor-pointer hover:text-rose-700"
                >
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {drawerKat && (
        <KategorieDrawer
          storage={storage}
          kategorie={drawerKat}
          allDeskriptoren={allDeskriptoren}
          onClose={() => setDrawerKat(null)}
          onSave={async (next) => {
            await upsertKategorie(storage, next);
            setDrawerKat(null);
          }}
        />
      )}
    </div>
  );
}

function KategorieDrawer({
  kategorie, allDeskriptoren, onClose, onSave,
}: {
  storage: StorageService;
  kategorie: UeberKategorie;
  allDeskriptoren: Array<{ wert: string; count: number }>;
  onClose: () => void;
  onSave: (next: UeberKategorie) => Promise<void>;
}): React.ReactElement {
  const [name, setName] = useState(kategorie.name);
  const [farbe, setFarbe] = useState<KategorieFarbe>(kategorie.farbe);
  const [mapping, setMapping] = useState<Set<string>>(
    new Set(kategorie.deskriptorenMapping.map(d => d.toLowerCase())),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(w: string): void {
    setMapping(prev => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w); else next.add(w);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh]"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="rounded-[12px] p-5 overflow-hidden flex flex-col gap-4"
        style={{
          background: 'var(--tf-bg)',
          border: '0.5px solid var(--tf-border)',
          // Resizable + groesserer Default (+100px breit, +300px hoch ggu. dem alten 500x~470).
          width: 600,
          height: 770,
          minWidth: 400,
          minHeight: 400,
          maxWidth: '95vw',
          maxHeight: '95vh',
          resize: 'both',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium">Kategorie bearbeiten</h3>
          <button type="button" onClick={onClose} className="text-[var(--tf-text-tertiary)] cursor-pointer">×</button>
        </div>

        <div className="grid grid-cols-[80px_1fr] gap-3 items-center">
          <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-[12.5px] px-2 py-1 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
          <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Farbe</label>
          <select
            value={farbe}
            onChange={e => setFarbe(e.target.value as KategorieFarbe)}
            className="text-[12.5px] px-2 py-1 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          >
            {KATEGORIE_FARBEN.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-2">
            Deskriptoren-Mapping ({mapping.size} ausgewählt)
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto rounded" style={{ border: '0.5px solid var(--tf-border)' }}>
            {allDeskriptoren.map(d => (
              <label
                key={d.wert}
                className="flex items-center gap-2 px-3 py-1 text-[12.5px] cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
              >
                <input
                  type="checkbox"
                  checked={mapping.has(d.wert)}
                  onChange={() => toggle(d.wert)}
                />
                <span className="flex-1">{d.wert}</span>
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{d.count}×</span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded p-2 text-[11.5px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>
            ⚠ Speichern fehlgeschlagen: <span className="font-mono">{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSave({
                  ...kategorie,
                  name: name.trim() || kategorie.name,
                  farbe,
                  deskriptorenMapping: [...mapping],
                });
              } catch (err) {
                console.error('[KategorieDrawer] save failed:', err);
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}
            className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            {busy ? 'Speichere…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

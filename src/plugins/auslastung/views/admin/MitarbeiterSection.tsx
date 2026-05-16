/**
 * MA-Verwaltung im Admin-Tab. Tabelle aller anonymen MAs mit:
 *  - Jahreskapazitaet (editierbar)
 *  - Ueberkategorien (Multi-Select)
 *  - manuelleTechnologien (Tag-Input)
 *  - abgemeldete Quartale (Comma-Liste)
 *  - "Onboarding ausstehend"-Badge
 */
import { useMemo, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import type { AnonymerMitarbeiter } from '../../types';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { useAntraegeCache } from '../../hooks/useAntraegeCache';
import { AnonymIdBadge } from '../../components/AnonymIdBadge';
import { KategoriePill } from '../../components/KategoriePill';
import { TechnologieTags } from '../../components/TechnologieTags';
import { PasswortDialog } from '../../components/PasswortDialog';
import { OnboardingImportDialog } from '../../components/OnboardingImportDialog';
import { KalibrierungsReport } from '../../components/KalibrierungsReport';
import { exportAnonymousXlsx, exportProtectedZip } from '../../services/export-service';
import { downloadOnboardingHtml } from '../../services/onboarding-html-generator';
import type { OnboardingPreview } from '../../services/onboarding-import';

interface Props {
  storage: StorageService;
}

export function MitarbeiterSection({ storage }: Props): React.ReactElement {
  const data = useAuslastungData(s => s.data);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const kategorien = useAuslastungData(s => s.data.config.ueberKategorien);
  const upsert = useAuslastungData(s => s.upsertMitarbeiter);
  const create = useAuslastungData(s => s.createMitarbeiter);
  const remove = useAuslastungData(s => s.removeMitarbeiter);
  const cache = useAntraegeCache();

  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [calibPreviews, setCalibPreviews] = useState<OnboardingPreview[] | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  async function exportGeschuetzt(password: string): Promise<void> {
    setExportBusy(true);
    try {
      await exportProtectedZip({
        data, antraege: cache.antraege, anonymMap: cache.anonymMap, password,
      });
      setPwOpen(false);
    } finally {
      setExportBusy(false);
    }
  }

  const list = useMemo(() => {
    return Object.values(mitarbeiter).sort((a, b) => a.anonId.localeCompare(b.anonId));
  }, [mitarbeiter]);

  const editMa = editId ? mitarbeiter[editId] : null;

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">Mitarbeiter ({list.length})</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void create(storage)}
            className="text-[11.5px] cursor-pointer hover:underline"
          >
            + MA hinzufügen
          </button>
        </div>
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            <th className="px-2 py-1.5 w-20">ID</th>
            <th className="px-2 py-1.5 w-24">Kapazität</th>
            <th className="px-2 py-1.5">Kategorien</th>
            <th className="px-2 py-1.5">Technologien</th>
            <th className="px-2 py-1.5 w-32 text-right">Status / Aktion</th>
          </tr>
        </thead>
        <tbody>
          {list.map(ma => {
            const kats = kategorien.filter(k => ma.ueberKategorien.includes(k.id));
            return (
              <tr key={ma.anonId} style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                <td className="px-2 py-1.5"><AnonymIdBadge anonId={ma.anonId} /></td>
                <td className="px-2 py-1.5 text-[var(--tf-text-secondary)]">{ma.jahresKapazitaet}h</td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {kats.map(k => <KategoriePill key={k.id} kategorie={k} />)}
                    {kats.length === 0 && <span className="text-[var(--tf-text-tertiary)]">—</span>}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <TechnologieTags tags={ma.manuelleTechnologien} max={5} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  {!ma.onboardingAbgeschlossen && (
                    <span className="text-[10.5px] text-amber-700 mr-2">⚙ Onboarding</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditId(ma.anonId)}
                    className="text-[11.5px] cursor-pointer hover:underline mr-2"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(storage, ma.anonId)}
                    className="text-[11.5px] text-[var(--tf-text-tertiary)] cursor-pointer hover:text-rose-700"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {editMa && (
        <MitarbeiterDrawer
          ma={editMa}
          kategorien={kategorien}
          onClose={() => setEditId(null)}
          onSave={async (next) => { await upsert(storage, next); setEditId(null); }}
        />
      )}

      {/* Onboarding/Export-Buttons (Prompt 2) */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="px-3 py-1.5 rounded-md text-[11.5px] cursor-pointer"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          Onboarding-XLSX importieren
        </button>
        <button
          type="button"
          onClick={() => downloadOnboardingHtml({ antraege: cache.antraege, kategorien })}
          disabled={kategorien.length === 0 || cache.antraege.length === 0}
          className="px-3 py-1.5 rounded-md text-[11.5px] cursor-pointer disabled:opacity-50"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Onboarding-HTML generieren
        </button>
        <button
          type="button"
          onClick={() => exportAnonymousXlsx({ data, antraege: cache.antraege })}
          className="px-3 py-1.5 rounded-md text-[11.5px] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Export (anonym)
        </button>
        <button
          type="button"
          onClick={() => setPwOpen(true)}
          disabled={exportBusy}
          className="px-3 py-1.5 rounded-md text-[11.5px] cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          Export (mit Kürzeln, geschützt)
        </button>
      </div>

      <OnboardingImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCalibrate={(previews) => { setImportOpen(false); setCalibPreviews(previews); }}
      />
      <KalibrierungsReport
        open={calibPreviews !== null}
        previews={calibPreviews ?? []}
        onClose={() => setCalibPreviews(null)}
      />
      <PasswortDialog
        open={pwOpen}
        busy={exportBusy}
        onClose={() => setPwOpen(false)}
        onConfirm={exportGeschuetzt}
      />
    </div>
  );
}

function MitarbeiterDrawer({
  ma, kategorien, onClose, onSave,
}: {
  ma: AnonymerMitarbeiter;
  kategorien: import('../../types').UeberKategorie[];
  onClose: () => void;
  onSave: (next: AnonymerMitarbeiter) => Promise<void>;
}): React.ReactElement {
  const [kap, setKap] = useState(ma.jahresKapazitaet);
  const [kats, setKats] = useState<Set<string>>(new Set(ma.ueberKategorien));
  const [techRaw, setTechRaw] = useState(ma.manuelleTechnologien.join(', '));
  const [abgRaw, setAbgRaw] = useState(ma.abgemeldet.join(', '));
  const [busy, setBusy] = useState(false);

  function toggleKat(id: string): void {
    setKats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save(): Promise<void> {
    setBusy(true);
    try {
      await onSave({
        ...ma,
        jahresKapazitaet: kap,
        ueberKategorien: [...kats],
        manuelleTechnologien: techRaw.split(',').map(s => s.trim()).filter(Boolean),
        abgemeldet: abgRaw.split(',').map(s => s.trim()).filter(Boolean),
      });
    } finally { setBusy(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-4"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        className="w-[450px] rounded-[12px] p-5 flex flex-col gap-3"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium">Mitarbeiter {ma.anonId}</h3>
          <button type="button" onClick={onClose} className="cursor-pointer">×</button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Jahreskapazität (Std.)</label>
          <input
            type="number"
            min={0}
            max={3000}
            value={kap}
            onChange={e => setKap(Number(e.target.value) || 0)}
            className="text-[12.5px] px-2 py-1 rounded outline-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Überkategorien</label>
          <div className="flex flex-wrap gap-1.5">
            {kategorien.map(k => {
              const active = kats.has(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleKat(k.id)}
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

        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Manuelle Technologien (Komma)</label>
          <textarea
            value={techRaw}
            onChange={e => setTechRaw(e.target.value)}
            rows={3}
            className="text-[12.5px] px-2 py-1 rounded outline-none resize-none"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Abgemeldete Quartale (Komma, z.B. 2026-Q3)</label>
          <input
            value={abgRaw}
            onChange={e => setAbgRaw(e.target.value)}
            className="text-[12.5px] px-2 py-1 rounded outline-none font-mono"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </div>

        <div className="flex justify-end gap-2 mt-2">
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
            onClick={() => void save()}
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

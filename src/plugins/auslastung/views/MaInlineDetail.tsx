/**
 * MaInlineDetail (v2.6) — Inline-Expand-Bereich pro MA-Zeile.
 *
 * Zwei Tabs:
 *  - **Detail**: Verbund-Listen "Festgebucht (CSV)" + "Pending (Store)"
 *  - **Bearbeiten**: Form mit Kapazitaet, Haupt-/Nebenkategorien, Technologien,
 *    Abgemeldungen, Aktiv-Toggle. Speichern -> Tab zurueck auf Detail.
 *
 * Ersetzt die fruehere Kombi aus `MaReadFlyout` (KapazitaetsSection) +
 * `MitarbeiterDrawer` (MitarbeiterSection).
 */
import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { KategoriePill } from '../components/KategoriePill';
import type { AnonymerMitarbeiter, UeberKategorie } from '../types';
import type { AuslastungVerbund, MaQuartalsAuslastung } from '../services/quartals-auslastung';

type Tab = 'detail' | 'edit';

interface Props {
  ma: AnonymerMitarbeiter;
  auslastung: MaQuartalsAuslastung;
  quartal: string;
  /** Nach erfolgreichem Save schliesst der Caller (MaRow) den Expand. */
  onSaved?: () => void;
}

export function MaInlineDetail({ ma, auslastung, quartal, onSaved }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('detail');

  return (
    <div className="px-4 py-3 flex flex-col gap-3"
      style={{ background: 'var(--tf-bg-secondary)', borderTop: '0.5px solid var(--tf-border)' }}>
      {/* Tabs */}
      <div className="flex items-center gap-1 text-[12px]">
        <TabButton active={tab === 'detail'} onClick={() => setTab('detail')}>Detail</TabButton>
        <TabButton active={tab === 'edit'} onClick={() => setTab('edit')}>Bearbeiten</TabButton>
      </div>

      {tab === 'detail' && (
        <DetailTab auslastung={auslastung} quartal={quartal} />
      )}
      {tab === 'edit' && (
        <EditTab
          ma={ma}
          onSaved={() => { setTab('detail'); onSaved?.(); }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md cursor-pointer ${active ? 'font-medium' : ''}`}
      style={{
        background: active ? 'var(--tf-bg)' : 'transparent',
        color: active ? 'var(--tf-text)' : 'var(--tf-text-secondary)',
        border: active ? '0.5px solid var(--tf-border)' : '0.5px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

// ─── Detail-Tab ───────────────────────────────────────────────────────────

function DetailTab({ auslastung, quartal }: {
  auslastung: MaQuartalsAuslastung;
  quartal: string;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <VerbundSection
        label={`Festgebucht (Master-CSV) — ${quartal}`}
        verbuende={auslastung.fest.verbuende}
        empty="Keine festen Buchungen im Quartal."
        hint="Quelle: tib_kuerz in der Master-CSV mit Antragsdatum im Quartal."
      />
      <VerbundSection
        label={`Eigene Eintragungen (pending) — ${quartal}`}
        verbuende={auslastung.pending.verbuende}
        empty="Keine offenen Selbsteintragungen."
        hint="Werden in die Kapazität gerechnet, bis der PL das Kürzel in die CSV einträgt."
      />
    </div>
  );
}

function VerbundSection({ label, verbuende, empty, hint }: {
  label: string;
  verbuende: readonly AuslastungVerbund[];
  empty: string;
  hint: string;
}): React.ReactElement {
  return (
    <div className="rounded-[8px] p-3" style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}>
      <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1.5">
        {label} ({verbuende.length})
      </div>
      {verbuende.length === 0 ? (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {verbuende.map((v, i) => {
            const azDisplay = v.aktenzeichen.length === 1
              ? v.aktenzeichen[0]
              : `${v.aktenzeichen[0]} +${v.aktenzeichen.length - 1}`;
            return (
              <li
                key={`${v.verbundId ?? v.aktenzeichen[0] ?? i}`}
                className="flex items-baseline gap-2 text-[11.5px] py-1"
                style={{ borderBottom: i < verbuende.length - 1 ? '0.5px dashed var(--tf-border)' : 'none' }}
              >
                <span className="font-mono text-[var(--tf-text-secondary)] shrink-0">{azDisplay}</span>
                <div className="flex-1 min-w-0">
                  {v.akronym && <span className="font-medium">{v.akronym}</span>}
                  {v.akronym && v.titel && <span className="text-[var(--tf-text-tertiary)]"> · </span>}
                  {v.titel && <span className="text-[var(--tf-text-secondary)]">{v.titel}</span>}
                </div>
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0 tabular-nums">
                  {v.tvCount} TVs · {v.stunden}h
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10.5px] text-[var(--tf-text-tertiary)] leading-snug mt-1.5">{hint}</p>
    </div>
  );
}

// ─── Edit-Tab ─────────────────────────────────────────────────────────────

function EditTab({ ma, onSaved }: {
  ma: AnonymerMitarbeiter;
  onSaved: () => void;
}): React.ReactElement {
  const storage = useStorage();
  const upsert = useAuslastungData(s => s.upsertMitarbeiter);
  const kategorien = useAuslastungData(s => s.data.config.ueberKategorien);

  // Hauptkategorie + Nebenkategorien getrennt — bei Save schreiben wir auch
  // das Legacy-Feld `ueberKategorien` mit (Save-Path-Kompat fuer Pre-1.18).
  const initialHaupt = ma.hauptKategorie || ma.ueberKategorien?.[0] || '';
  const initialNeben = ma.nebenKategorien ?? (ma.ueberKategorien ? ma.ueberKategorien.slice(1) : []);

  const [kap, setKap] = useState(ma.jahresKapazitaet);
  const [abschlag, setAbschlag] = useState(ma.abschlagProzent ?? 0);
  const [hauptKat, setHauptKat] = useState<string>(initialHaupt);
  const [nebenKats, setNebenKats] = useState<Set<string>>(new Set(initialNeben));
  const [techRaw, setTechRaw] = useState(ma.manuelleTechnologien.join(', '));
  const [abgRaw, setAbgRaw] = useState(ma.abgemeldet.join(', '));
  const [aktiv, setAktiv] = useState(ma.aktiv);

  function toggleNeben(id: string): void {
    if (id === hauptKat) return;  // Haupt kann nicht zusaetzlich neben sein
    setNebenKats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function pickHaupt(id: string): void {
    // Falls die neue Hauptkategorie bisher Nebenkat war → aus neben entfernen.
    setNebenKats(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setHauptKat(id);
  }

  const saveAction = useAsyncAction(async () => {
    const neben = [...nebenKats];
    const ueberKategorien = hauptKat ? [hauptKat, ...neben] : neben;
    await upsert(storage, {
      ...ma,
      jahresKapazitaet: kap,
      abschlagProzent: abschlag,
      hauptKategorie: hauptKat,
      nebenKategorien: neben,
      ueberKategorien,
      manuelleTechnologien: techRaw.split(',').map(s => s.trim()).filter(Boolean),
      abgemeldet: abgRaw.split(',').map(s => s.trim()).filter(Boolean),
      aktiv,
    });
    onSaved();
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Linke Spalte: Kapazitaet + Abschlag + Aktiv */}
      <div className="flex flex-col gap-3">
        <FormRow label="Jahreskapazität (Std.)">
          <input
            type="number"
            min={0}
            max={3000}
            value={kap}
            onChange={e => setKap(Number(e.target.value) || 0)}
            className="text-[12.5px] px-2 py-1 rounded outline-none w-full"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </FormRow>
        <FormRow label="Abschlag (%)" subtitle="Reduziert die Quartals-Kapazität (z.B. 25 für QS-Anteil)">
          <input
            type="number"
            min={0}
            max={100}
            value={abschlag}
            onChange={e => setAbschlag(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
            className="text-[12.5px] px-2 py-1 rounded outline-none w-full"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </FormRow>
        <FormRow label="Status">
          <label className="flex items-center gap-2 text-[12px] cursor-pointer">
            <input type="checkbox" checked={aktiv} onChange={e => setAktiv(e.target.checked)} />
            <span>{aktiv ? 'Aktiv' : 'Inaktiv'}</span>
          </label>
        </FormRow>
        <FormRow label="Abgemeldete Quartale" subtitle="Komma-getrennt, z.B. 2026-Q3, 2026-Q4">
          <input
            value={abgRaw}
            onChange={e => setAbgRaw(e.target.value)}
            className="text-[12.5px] px-2 py-1 rounded outline-none font-mono w-full"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </FormRow>
      </div>

      {/* Rechte Spalte: Kategorien + Technologien */}
      <div className="flex flex-col gap-3">
        <FormRow label="Hauptkategorie" subtitle="Bestimmt den Match-Pool im Zuweisungs-Cockpit">
          <div className="flex flex-wrap gap-1.5">
            {kategorien.map((k: UeberKategorie) => (
              <button
                key={k.id}
                type="button"
                onClick={() => pickHaupt(k.id)}
                className="cursor-pointer"
                aria-pressed={hauptKat === k.id}
              >
                <KategoriePill kategorie={k} mode={hauptKat === k.id ? 'primaer' : 'inactive'} />
              </button>
            ))}
          </div>
        </FormRow>
        <FormRow label="Nebenkategorien" subtitle="Aspekt-Match-Bonus im Matching">
          <div className="flex flex-wrap gap-1.5">
            {kategorien.map((k: UeberKategorie) => {
              const isHaupt = k.id === hauptKat;
              const isNeben = nebenKats.has(k.id);
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => toggleNeben(k.id)}
                  disabled={isHaupt}
                  className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-pressed={isNeben}
                  title={isHaupt ? 'Bereits Hauptkategorie' : k.name}
                >
                  <KategoriePill kategorie={k} mode={isNeben ? 'aspekt' : 'inactive'} />
                </button>
              );
            })}
          </div>
        </FormRow>
        <FormRow label="Manuelle Technologien" subtitle="Komma-getrennt">
          <textarea
            value={techRaw}
            onChange={e => setTechRaw(e.target.value)}
            rows={3}
            className="text-[12.5px] px-2 py-1 rounded outline-none resize-none w-full"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}
          />
        </FormRow>
      </div>

      {/* Save / Cancel — spannt ueber beide Spalten */}
      <div className="md:col-span-2 flex justify-end gap-2 pt-1">
        {saveAction.error && (
          <span className="text-[11.5px] text-[var(--tf-danger-text)] mr-auto self-center">
            {saveAction.error}
          </span>
        )}
        <button
          type="button"
          onClick={onSaved}
          disabled={saveAction.busy}
          className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
          style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={() => saveAction.run()}
          disabled={saveAction.busy}
          className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          {saveAction.busy ? 'Speichere…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}

function FormRow({ label, subtitle, children }: {
  label: string;
  subtitle?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
        {label}
      </label>
      {children}
      {subtitle && (
        <p className="text-[10.5px] text-[var(--tf-text-tertiary)] leading-snug">{subtitle}</p>
      )}
    </div>
  );
}

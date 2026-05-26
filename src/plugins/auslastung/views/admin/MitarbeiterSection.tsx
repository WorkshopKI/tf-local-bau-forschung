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
import type { AnonymerMitarbeiter, AntragstypBucket } from '../../types';
import { ALL_ANTRAGSTYP_BUCKETS } from '../../types';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { getEffectiveAntragstypen, hasPlOverride } from '../../services/antragstyp-praeferenz';
import type { useAntraegeCache } from '../../hooks/useAntraegeCache';
import { AnonymIdBadge, useDeAnonResolver } from '../../components/AnonymIdBadge';
import { KategoriePill } from '../../components/KategoriePill';
import { TechnologieTags } from '../../components/TechnologieTags';
import { PasswortDialog } from '../../components/PasswortDialog';
import { OnboardingImportDialog } from '../../components/OnboardingImportDialog';
import { useDialogEsc } from '../../components/useDialogEsc';
import { KalibrierungsReport } from '../../components/KalibrierungsReport';
import { exportAnonymousXlsx, exportProtectedZip } from '../../services/export-service';
import { downloadOnboardingHtml } from '../../services/onboarding-html-generator';
import type { OnboardingPreview } from '../../services/onboarding-import';
import { detectAktiveMAs, shouldShowAktivVorschlag } from '../../services/aktiv-detection';
import { AktivVorschlagBanner } from './AktivVorschlagBanner';

interface Props {
  storage: StorageService;
  /** Vom AuslastungAdmin durchgereicht. Frueher rief MitarbeiterSection
   *  `useAntraegeCache()` selbst auf — das erzeugte eine zweite, parallele
   *  IDB-Roundtrip-Instanz der 13k+ Antraege und sichtbaren Layout-Flash
   *  beim Banner-Render. Jetzt teilt sich die Section den cache mit dem
   *  Parent. */
  cache: ReturnType<typeof useAntraegeCache>;
}

export function MitarbeiterSection({ storage, cache }: Props): React.ReactElement {
  const data = useAuslastungData(s => s.data);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const kategorien = useAuslastungData(s => s.data.config.ueberKategorien);
  const upsert = useAuslastungData(s => s.upsertMitarbeiter);
  const create = useAuslastungData(s => s.createMitarbeiter);
  const remove = useAuslastungData(s => s.removeMitarbeiter);
  const setAktiv = useAuslastungData(s => s.setMitarbeiterAktiv);
  const applyAktivMap = useAuslastungData(s => s.applyAktivMap);

  const resolveName = useDeAnonResolver();
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [calibPreviews, setCalibPreviews] = useState<OnboardingPreview[] | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [vorschlagDismissed, setVorschlagDismissed] = useState(false);
  const [vorschlagBusy, setVorschlagBusy] = useState(false);

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
    return Object.values(mitarbeiter)
      .filter(m => showInactive || m.aktiv)
      .sort((a, b) => a.anonId.localeCompare(b.anonId));
  }, [mitarbeiter, showInactive]);

  const aktivCount = useMemo(
    () => Object.values(mitarbeiter).filter(m => m.aktiv).length,
    [mitarbeiter],
  );
  const totalCount = Object.keys(mitarbeiter).length;
  const inaktivCount = totalCount - aktivCount;

  const referenzJahr = useMemo(() => new Date().getUTCFullYear(), []);

  const vorschlag = useMemo(() => {
    if (vorschlagDismissed) return null;
    if (!cache.loaded) return null;
    if (!shouldShowAktivVorschlag(mitarbeiter)) return null;
    return detectAktiveMAs(cache.antraege, mitarbeiter, cache.anonymMap, referenzJahr);
  }, [vorschlagDismissed, cache.loaded, cache.antraege, cache.anonymMap, mitarbeiter, referenzJahr]);

  async function uebernehmenVorschlag(): Promise<void> {
    if (!vorschlag) return;
    setVorschlagBusy(true);
    try {
      await applyAktivMap(storage, vorschlag.vorschlag);
    } finally {
      setVorschlagBusy(false);
    }
  }

  function manuellSetzen(): void {
    setShowInactive(true);
    setVorschlagDismissed(true);
  }

  const editMa = editId ? mitarbeiter[editId] : null;

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-medium text-[var(--tf-text)]">
          Mitarbeiter ({aktivCount} aktiv{inaktivCount > 0 ? ` / ${totalCount} gesamt` : ''})
        </h3>
        <div className="flex items-center gap-3">
          {inaktivCount > 0 && (
            <label className="flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
              />
              Inaktive anzeigen
            </label>
          )}
          <button
            type="button"
            onClick={() => void create(storage)}
            className="text-[11.5px] cursor-pointer hover:underline"
          >
            + MA hinzufügen
          </button>
        </div>
      </div>
      {vorschlag && (
        <AktivVorschlagBanner
          detection={vorschlag}
          referenzJahr={referenzJahr}
          busy={vorschlagBusy}
          onUebernehmen={uebernehmenVorschlag}
          onManuell={manuellSetzen}
          onSpaeter={() => setVorschlagDismissed(true)}
        />
      )}
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            <th className="px-2 py-1.5 w-20">ID</th>
            <th className="px-2 py-1.5 w-24">Kapazität</th>
            <th className="px-2 py-1.5">Kategorien</th>
            <th className="px-2 py-1.5 w-56">Antragstypen</th>
            <th className="px-2 py-1.5">Technologien</th>
            <th className="px-2 py-1.5 w-32 text-right">Status / Aktion</th>
          </tr>
        </thead>
        <tbody>
          {list.map(ma => {
            // 1.17: Hauptkategorie (primaer) + Nebenkategorien (aspekt) visuell trennen.
            const hauptId = ma.hauptKategorie || ma.ueberKategorien?.[0] || '';
            const nebenIds = ma.nebenKategorien ?? (ma.ueberKategorien ? ma.ueberKategorien.slice(1) : []);
            const hauptKat = kategorien.find(k => k.id === hauptId);
            const nebenKats = nebenIds.map(id => kategorien.find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => k != null);
            const hasKats = hauptKat != null || nebenKats.length > 0;
            return (
              <tr
                key={ma.anonId}
                style={{
                  borderBottom: '0.5px solid var(--tf-border)',
                  opacity: ma.aktiv ? 1 : 0.55,
                }}
              >
                <td className="px-2 py-1.5"><AnonymIdBadge anonId={ma.anonId} realName={resolveName(ma.anonId)} /></td>
                <td className="px-2 py-1.5 text-[var(--tf-text-secondary)]">{ma.jahresKapazitaet}h</td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {hauptKat && <KategoriePill key={hauptKat.id} kategorie={hauptKat} mode="primaer" />}
                    {nebenKats.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
                    {!hasKats && <span className="text-[var(--tf-text-tertiary)]">—</span>}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <AntragstypOverrideCell ma={ma} onSave={async (next) => {
                    await upsert(storage, { ...ma, antragstypUeberschreibung: next });
                  }} />
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
                    onClick={() => {
                      if (ma.aktiv) {
                        const ok = window.confirm(
                          `${ma.anonId} deaktivieren?\n\nWird aus Matching, Dashboard und Cockpit ausgeblendet. Historische Anträge bleiben im Embedding-Corpus als Kompetenz-Referenz.`,
                        );
                        if (!ok) return;
                      }
                      void setAktiv(storage, ma.anonId, !ma.aktiv);
                    }}
                    className="text-[11.5px] cursor-pointer hover:underline mr-2"
                    title={ma.aktiv ? 'Klicken zum Deaktivieren' : 'Klicken zum Aktivieren'}
                  >
                    {ma.aktiv ? 'Aktiv' : 'Inaktiv'}
                  </button>
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

/**
 * AntragstypOverrideCell (v2.2): zeigt den effektiven Antragstyp-Filter eines
 * MAs (Override > Bevorzugt > 'Alle') und erlaubt PL inline ein Override zu
 * setzen oder zurueckzusetzen.
 */
function AntragstypOverrideCell({
  ma,
  onSave,
}: {
  ma: AnonymerMitarbeiter;
  onSave: (next: AntragstypBucket[] | undefined) => Promise<void>;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const effective = getEffectiveAntragstypen(ma);
  const overrideAktiv = hasPlOverride(ma);
  const bevorzugt = ma.antragstypBevorzugt ?? [];

  const label = effective === null
    ? 'Alle'
    : effective.join(', ');

  // Lokaler Edit-State waehrend des Edit-Modus
  const [draft, setDraft] = useState<AntragstypBucket[]>(() => ma.antragstypUeberschreibung ?? []);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`text-[11.5px] ${effective === null ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text-secondary)]'}`}>
          {label}
        </span>
        {overrideAktiv && (
          <span
            className="text-[9.5px] font-medium px-1 py-0.5 rounded"
            style={{ background: 'var(--tf-warning-soft, #fef3c7)', color: 'var(--tf-text)' }}
            title={`PL-Override aktiv. MA-Praeferenz: ${bevorzugt.length > 0 ? bevorzugt.join(', ') : 'keine'}`}
          >
            PL
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setDraft(ma.antragstypUeberschreibung ?? []);
            setOpen(true);
          }}
          className="text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer ml-1"
        >
          ändern
        </button>
      </div>
    );
  }

  const toggle = (bucket: AntragstypBucket): void => {
    setDraft(prev => prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {ALL_ANTRAGSTYP_BUCKETS.map(bucket => {
          const isActive = draft.includes(bucket);
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => toggle(bucket)}
              className="text-[10.5px] px-1.5 py-0.5 rounded cursor-pointer"
              style={
                isActive
                  ? { background: 'var(--tf-primary-light)', color: 'var(--tf-primary)', border: '0.5px solid var(--tf-primary)' }
                  : { background: 'transparent', color: 'var(--tf-text-tertiary)', border: '0.5px solid var(--tf-border)' }
              }
            >
              {isActive ? '✓ ' : ''}{bucket}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              // Leeres Array → undefined (Override zurueckziehen)
              await onSave(draft.length > 0 ? draft : undefined);
              setOpen(false);
            } finally {
              setBusy(false);
            }
          }}
          className="text-[10.5px] px-2 py-0.5 rounded cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          {busy ? '…' : 'Speichern'}
        </button>
        {(ma.antragstypUeberschreibung?.length ?? 0) > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(undefined);
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
            className="text-[10.5px] px-2 py-0.5 rounded cursor-pointer disabled:opacity-50 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
            title="Override entfernen → MA-Praeferenz greift wieder"
          >
            Override entfernen
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          Abbrechen
        </button>
      </div>
      {bevorzugt.length > 0 && (
        <p className="text-[10px] text-[var(--tf-text-tertiary)]">
          MA-Präferenz: {bevorzugt.join(', ')}
        </p>
      )}
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

  useDialogEsc(true, busy, onClose);

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
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh]"
      style={{ background: 'rgba(0,0,0,0.3)' }}
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

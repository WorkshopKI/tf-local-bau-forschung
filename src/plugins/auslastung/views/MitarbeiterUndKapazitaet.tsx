/**
 * MitarbeiterUndKapazitaet (v2.6) — konsolidierte MA-Tabelle im Übersicht-Tab.
 *
 * Ersetzt die fruehere Aufteilung in zwei Sections (KapazitaetsSection +
 * MitarbeiterSection) durch eine zwei-Zeilen-pro-MA-Tabelle mit Inline-
 * Expand (Tab Detail / Bearbeiten). Behaelt alle PL-Aktionen (Aktiv-Toggle,
 * Antragstyp-Override, MA-Anlegen, Onboarding-Import, XLSX-Export, ...).
 */
import { useMemo, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useAuslastungData } from '../hooks/useAuslastungData';
import type { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useDeAnonResolver } from '../components/AnonymIdBadge';
import { KategoriePill } from '../components/KategoriePill';
import { PasswortDialog } from '../components/PasswortDialog';
import { OnboardingImportDialog } from '../components/OnboardingImportDialog';
import { KalibrierungsReport } from '../components/KalibrierungsReport';
import { exportAnonymousXlsx, exportProtectedZip } from '../services/export-service';
import { downloadOnboardingHtml } from '../services/onboarding-html-generator';
import type { OnboardingPreview } from '../services/onboarding-import';
import { detectAktiveMAs, shouldShowAktivVorschlag } from '../services/aktiv-detection';
import { AktivVorschlagBanner } from './admin/AktivVorschlagBanner';
import { computeQuartalsAuslastung, EMPTY_AUSLASTUNG } from '../services/quartals-auslastung';
import { computeKapazitaet } from '../services/kapazitaet';
import { MaRow } from './MaRow';

interface Props {
  storage: StorageService;
  cache: ReturnType<typeof useAntraegeCache>;
}

export function MitarbeiterUndKapazitaet({ storage, cache }: Props): React.ReactElement {
  const data = useAuslastungData(s => s.data);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const config = useAuslastungData(s => s.data.config);
  const kategorien = config.ueberKategorien;
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const upsert = useAuslastungData(s => s.upsertMitarbeiter);
  const create = useAuslastungData(s => s.createMitarbeiter);
  const remove = useAuslastungData(s => s.removeMitarbeiter);
  const setAktiv = useAuslastungData(s => s.setMitarbeiterAktiv);
  const applyAktivMap = useAuslastungData(s => s.applyAktivMap);

  const resolveName = useDeAnonResolver();
  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedMa, setExpandedMa] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [calibPreviews, setCalibPreviews] = useState<OnboardingPreview[] | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [vorschlagDismissed, setVorschlagDismissed] = useState(false);
  const [vorschlagBusy, setVorschlagBusy] = useState(false);

  const referenzJahr = useMemo(() => new Date().getUTCFullYear(), []);

  const vorschlag = useMemo(() => {
    if (vorschlagDismissed) return null;
    if (!cache.loaded) return null;
    if (!shouldShowAktivVorschlag(mitarbeiter)) return null;
    return detectAktiveMAs(cache.antraege, mitarbeiter, cache.anonymMap, referenzJahr);
  }, [vorschlagDismissed, cache.loaded, cache.antraege, cache.anonymMap, mitarbeiter, referenzJahr]);

  const createAction = useAsyncAction(async () => {
    await create(storage);
  });

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

  // Quartals-Auslastung-Index (gemeinsam mit StatistikPanel; React-Caching
  // macht das praktisch frei).
  const auslastungByAnon = useMemo(
    () => computeQuartalsAuslastung(
      cache.antraege,
      zuweisungen,
      cache.anonymMap.toAnon,
      config.aktuellesQuartal,
      config.stundenProTV ?? 9,
    ),
    [cache.antraege, cache.anonymMap, zuweisungen, config.aktuellesQuartal, config.stundenProTV],
  );

  // MA-Liste: Filter + Sort.
  const list = useMemo(() => {
    const all = Object.values(mitarbeiter);
    const sichtbar = showInactive ? all : all.filter(m => m.aktiv);
    const filtered = kategorieFilter
      ? sichtbar.filter(m => (m.hauptKategorie === kategorieFilter)
          || (m.nebenKategorien?.includes(kategorieFilter) ?? false)
          || (m.ueberKategorien?.includes(kategorieFilter) ?? false))
      : sichtbar;
    return filtered.sort((a, b) => a.anonId.localeCompare(b.anonId));
  }, [mitarbeiter, kategorieFilter, showInactive]);

  const totalCount = Object.keys(mitarbeiter).length;
  const aktivCount = Object.values(mitarbeiter).filter(m => m.aktiv).length;
  const inaktivCount = totalCount - aktivCount;
  const hasGaps = totalCount > aktivCount;

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

  return (
    <div className="rounded-[12px] p-4 flex flex-col gap-3" style={{ border: '0.5px solid var(--tf-border)' }}>
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium">
          Mitarbeiter &amp; Kapazität
          <span className="ml-2 text-[11.5px] font-normal text-[var(--tf-text-tertiary)]">
            ({aktivCount} aktiv{inaktivCount > 0 ? ` / ${totalCount} gesamt` : ''} · {config.aktuellesQuartal})
          </span>
        </h2>
        <button
          type="button"
          onClick={() => createAction.run()}
          disabled={createAction.busy}
          className="text-[11.5px] cursor-pointer hover:underline disabled:opacity-50"
        >
          + MA hinzufügen
        </button>
      </div>

      {/* Filter-Leiste */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Kategorie</span>
        <button
          type="button"
          onClick={() => setKategorieFilter('')}
          className={`text-[11.5px] px-2.5 py-1 rounded-full cursor-pointer ${kategorieFilter === '' ? '' : 'opacity-50'}`}
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Alle ({aktivCount})
        </button>
        {kategorien.map(k => {
          const count = Object.values(mitarbeiter).filter(m =>
            m.aktiv && (m.hauptKategorie === k.id || m.nebenKategorien?.includes(k.id) || m.ueberKategorien?.includes(k.id))).length;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKategorieFilter(k.id === kategorieFilter ? '' : k.id)}
              className={`cursor-pointer flex items-center gap-1 ${kategorieFilter === k.id ? '' : 'opacity-50'}`}
            >
              <KategoriePill kategorie={k} />
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{count}</span>
            </button>
          );
        })}
        <label className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />
          <span>Inaktive anzeigen</span>
        </label>
      </div>

      {/* Vorschlag-Banner */}
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

      {/* MA-Liste */}
      <div className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
        {list.map(ma => {
          const auslastung = auslastungByAnon.get(ma.anonId) ?? EMPTY_AUSLASTUNG;
          const kapView = computeKapazitaet(ma, auslastung, config);
          return (
            <MaRow
              key={ma.anonId}
              ma={ma}
              auslastung={auslastung}
              kapView={kapView}
              kategorien={kategorien}
              realName={resolveName(ma.anonId)}
              quartal={config.aktuellesQuartal}
              expanded={expandedMa === ma.anonId}
              onToggleExpand={() => setExpandedMa(prev => prev === ma.anonId ? null : ma.anonId)}
              onSetAktiv={(next) => void setAktiv(storage, ma.anonId, next)}
              onRemove={() => void remove(storage, ma.anonId)}
              onUpsertAntragstyp={async (next) => {
                await upsert(storage, { ...ma, antragstypUeberschreibung: next });
              }}
            />
          );
        })}
        {list.length === 0 && (
          <div className="px-3 py-8 text-center text-[var(--tf-text-tertiary)] text-[12.5px]">
            Keine MAs in dieser Auswahl.
          </div>
        )}
      </div>

      {hasGaps && !showInactive && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-tight">
          {aktivCount} von {totalCount} Mitarbeitern aktiv. Inaktive MAs behalten ihre Nummer — Lücken sind normal.
        </p>
      )}

      {/* Aktion-Buttons */}
      <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
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

      {/* Modale */}
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

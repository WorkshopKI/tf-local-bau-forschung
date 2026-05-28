/**
 * MaListSection — "Mitarbeiter & Kapazität"-Bereich im Übersicht-Tab.
 *
 * Section-Header (Caps "MITARBEITER & KAPAZITÄT" + "X aktiv / Y gesamt") +
 * Filter-Bar (Kategorie-Pills + View-Switch + Inaktive-Checkbox + MA-Add) +
 * MA-Tabelle (Etappe 4) bzw. Karten-Heatmap (Etappe 5).
 *
 * Ersetzt das frühere `MitarbeiterUndKapazitaet`-Layout (zwei-Zeilen-Tabelle)
 * durch eine kompakte einzeilige Tabelle mit Inline-Expand auf Click —
 * `MaInlineDetail` bleibt für PL-Aktionen erhalten.
 *
 * `warningFilter` kommt von außen (von der `WarnungenZeile` über
 * `UebersichtView`) — `null` = kein Filter, `'no-bookings'` = nur MAs ohne
 * Buchungen, `'overbooked'` = nur überbuchte MAs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  getUserFoldersRootHandle,
  pickAndStoreUserFoldersRootHandle,
} from '@/core/services/infrastructure/smb-handle';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { collectUserProfiles } from '../../services/profil-einsammeln';
import type { useAntraegeCache } from '../../hooks/useAntraegeCache';
import { useDeAnonResolver } from '../../components/AnonymIdBadge';
import { detectAktiveMAs, shouldShowAktivVorschlag } from '../../services/aktiv-detection';
import { AktivVorschlagBanner } from '../admin/AktivVorschlagBanner';
import { EMPTY_AUSLASTUNG } from '../../services/quartals-auslastung';
import { useAuslastungIndex } from '../../hooks/useAuslastungIndex';
import { useAuslastungReady } from '../../hooks/useAuslastungReady';
import { computeKapazitaet, type KapazitaetsView } from '../../services/kapazitaet';
import { MaInlineDetail } from '../MaInlineDetail';
import { InlineCapsHeader } from './InlineCapsHeader';
import { MaListFilterBar, type ViewMode } from './MaListFilterBar';
import { MaTable, type SortColumn, type SortDir } from './MaTable';
import { MaTileGrid } from './MaTileGrid';

export type WarningFilter = null | 'no-bookings' | 'overbooked';

interface Props {
  storage: StorageService;
  cache: ReturnType<typeof useAntraegeCache>;
  warningFilter: WarningFilter;
  onClearWarningFilter: () => void;
}

const VIEW_LS_KEY = 'auslastung_view';

function readInitialView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_LS_KEY) === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
}

export function MaListSection({ storage, cache, warningFilter, onClearWarningFilter }: Props): React.ReactElement {
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const config = useAuslastungData(s => s.data.config);
  const kategorien = config.ueberKategorien;
  const create = useAuslastungData(s => s.createMitarbeiter);
  const applyAktivMap = useAuslastungData(s => s.applyAktivMap);
  const ensureMitarbeiterForAnonIds = useAuslastungData(s => s.ensureMitarbeiterForAnonIds);
  const applyAggregatedProfiles = useAuslastungData(s => s.applyAggregatedProfiles);
  const [einsammelnMsg, setEinsammelnMsg] = useState<string | null>(null);

  const resolveName = useDeAnonResolver();
  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedMa, setExpandedMa] = useState<string | null>(null);
  const [vorschlagDismissed, setVorschlagDismissed] = useState(false);
  const [vorschlagBusy, setVorschlagBusy] = useState(false);
  const [view, setView] = useState<ViewMode>(readInitialView);
  const [sortCol, setSortCol] = useState<SortColumn>('belegt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const referenzJahr = useMemo(() => new Date().getUTCFullYear(), []);
  const { ready } = useAuslastungReady();
  const { auslastungByAnon, altlastByAnon } = useAuslastungIndex();

  // View-Persistenz.
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_LS_KEY, view);
    } catch {
      // localStorage nicht verfuegbar — silently ignorieren.
    }
  }, [view]);

  // Wenn ein Warning-Filter aktiv ist, blenden wir inaktive MAs automatisch ein,
  // damit der User die Treffer auch sieht — sonst wird der Filter "leer" wirken.
  useEffect(() => {
    if (warningFilter === 'no-bookings' && !showInactive) {
      setShowInactive(true);
    }
  }, [warningFilter, showInactive]);

  // Auto-Create: fehlende MAs anlegen (siehe Original-Logik).
  useEffect(() => {
    if (!ready) return;
    const anonIds = [...cache.anonymMap.toReal.keys()];
    if (anonIds.length === 0) return;
    void ensureMitarbeiterForAnonIds(storage, anonIds);
  }, [ready, cache.anonymMap, ensureMitarbeiterForAnonIds, storage]);

  const vorschlag = useMemo(() => {
    if (vorschlagDismissed) return null;
    if (!cache.loaded) return null;
    if (!shouldShowAktivVorschlag(mitarbeiter)) return null;
    return detectAktiveMAs(cache.antraege, mitarbeiter, cache.anonymMap, referenzJahr);
  }, [vorschlagDismissed, cache.loaded, cache.antraege, cache.anonymMap, mitarbeiter, referenzJahr]);

  const createAction = useAsyncAction(async () => {
    await create(storage);
  });

  // v2.6: MA-Selbst-Profile aus den persoenlichen Ordnern einsammeln und in
  // auslastung.json mergen. Liest ueber den User-Folders-Root (nur read noetig).
  // Manuell statt auto-on-mount, um die Load-Idempotenz + SMB-Roundtrips nicht
  // zu unterlaufen. EIN setState + EIN persist im Store (Pitfall #16/#20).
  const einsammelnAction = useAsyncAction(async () => {
    setEinsammelnMsg(null);
    let root = await getUserFoldersRootHandle(storage.idb);
    if (!root) {
      const res = await pickAndStoreUserFoldersRootHandle(storage.idb);
      if (!res.ok) {
        if (res.reason === 'aborted') return;
        throw new Error(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
      }
      root = res.handle;
    }
    const profile = await collectUserProfiles(root);
    const { aktualisiert, neu } = await applyAggregatedProfiles(storage, profile, cache.anonymMap);
    setEinsammelnMsg(
      `${profile.length} Profil(e) gelesen · ${aktualisiert.length} aktualisiert · ${neu.length} neu angelegt`,
    );
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

  // KapazitaetsView pro MA: 1x pro Render-Cycle vorberechnen (statt im Map-Loop).
  const kapByAnon = useMemo(() => {
    const map = new Map<string, KapazitaetsView>();
    for (const ma of Object.values(mitarbeiter)) {
      const auslastung = auslastungByAnon.get(ma.anonId) ?? EMPTY_AUSLASTUNG;
      map.set(ma.anonId, computeKapazitaet(ma, auslastung, config));
    }
    return map;
  }, [mitarbeiter, auslastungByAnon, config]);

  // "Hat aktuelle Anträge im Quartal" — Filter-Helfer.
  const hasAntraege = useCallback((anonId: string): boolean => {
    const a = auslastungByAnon.get(anonId);
    if ((a?.fest.antraege ?? 0) > 0) return true;
    if ((a?.pending.antraege ?? 0) > 0) return true;
    const al = altlastByAnon.get(anonId);
    if ((al?.antraege ?? 0) > 0) return true;
    return false;
  }, [auslastungByAnon, altlastByAnon]);

  // Filter + Sort.
  const list = useMemo(() => {
    const all = Object.values(mitarbeiter);
    let sichtbar = showInactive ? all : all.filter(m => m.aktiv || hasAntraege(m.anonId));
    if (kategorieFilter) {
      sichtbar = sichtbar.filter(m =>
        m.hauptKategorie === kategorieFilter
        || m.nebenKategorien.includes(kategorieFilter),
      );
    }
    if (warningFilter === 'no-bookings') {
      sichtbar = sichtbar.filter(m => {
        const kv = kapByAnon.get(m.anonId);
        if (!kv) return false;
        return kv.verbrauchteStunden === 0;
      });
    } else if (warningFilter === 'overbooked') {
      sichtbar = sichtbar.filter(m => {
        const kv = kapByAnon.get(m.anonId);
        if (!kv) return false;
        return kv.ueberbuchung > 0;
      });
    }
    // Sort
    const sorted = [...sichtbar].sort((a, b) => {
      const kva = kapByAnon.get(a.anonId);
      const kvb = kapByAnon.get(b.anonId);
      if (!kva || !kvb) return a.anonId.localeCompare(b.anonId);
      let cmp = 0;
      switch (sortCol) {
        case 'ma':
          cmp = a.anonId.localeCompare(b.anonId);
          break;
        case 'belegt': {
          const pa = kva.effektivStunden > 0 ? kva.verbrauchteStunden / kva.effektivStunden : 0;
          const pb = kvb.effektivStunden > 0 ? kvb.verbrauchteStunden / kvb.effektivStunden : 0;
          cmp = pa - pb;
          break;
        }
        case 'frei':
          cmp = kva.restTVs - kvb.restTVs;
          break;
        case 'fest':
          cmp = kva.fest.tvs - kvb.fest.tvs;
          break;
        case 'altlast':
          cmp = (altlastByAnon.get(a.anonId)?.tvs ?? 0) - (altlastByAnon.get(b.anonId)?.tvs ?? 0);
          break;
      }
      if (cmp === 0) cmp = a.anonId.localeCompare(b.anonId);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [mitarbeiter, showInactive, kategorieFilter, warningFilter, kapByAnon, altlastByAnon, hasAntraege, sortCol, sortDir]);

  const handleToggleExpand = useCallback((anonId: string): void => {
    setExpandedMa(prev => (prev === anonId ? null : anonId));
  }, []);

  const handleSort = useCallback((col: SortColumn): void => {
    setSortCol(prev => {
      if (prev === col) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      // Defaults pro Spalte: frei/fest aufsteigend macht weniger Sinn,
      // typischerweise will man "die größten" — also desc beim Wechsel.
      setSortDir(col === 'ma' ? 'asc' : 'desc');
      return col;
    });
  }, []);

  const counts = useMemo(() => {
    // Zaehlt MAs mit aktuellen/Altanträgen ODER aktiv-Flag, abgeglichen mit dem
    // ggf. aktiven warningFilter.
    const considered = Object.values(mitarbeiter).filter(m => showInactive ? true : (m.aktiv || hasAntraege(m.anonId)));
    const all = considered.length;
    const perKategorie: Record<string, number> = {};
    for (const k of kategorien) {
      perKategorie[k.id] = considered.filter(m =>
        m.hauptKategorie === k.id
        || m.nebenKategorien.includes(k.id),
      ).length;
    }
    return { all, perKategorie };
  }, [mitarbeiter, kategorien, showInactive, hasAntraege]);

  const aktivCount = Object.values(mitarbeiter).filter(m => hasAntraege(m.anonId)).length;
  const totalCount = Object.keys(mitarbeiter).length;
  const stundenProTV = Math.max(1, config.stundenProTV ?? 9);

  return (
    <section
      id="ma-list-section"
      className="rounded-[12px] p-4 flex flex-col gap-3"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <InlineCapsHeader
          label="Mitarbeiter & Kapazität"
          count={`${aktivCount} aktiv / ${totalCount} gesamt`}
        />
        <button
          type="button"
          onClick={() => einsammelnAction.run()}
          disabled={einsammelnAction.busy}
          className="h-7 px-3 rounded-md text-[12px] font-medium cursor-pointer disabled:opacity-50 transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
          title="Liest die in „Meine Technologien“ gepflegten Profile aus den persönlichen Ordnern aller Teammitglieder ein und übernimmt sie."
        >
          {einsammelnAction.busy ? 'Sammle ein…' : 'Team-Profile einsammeln'}
        </button>
      </div>

      {(einsammelnMsg || einsammelnAction.error) && (
        <div
          className="rounded-md px-3 py-1.5 text-[12px]"
          style={
            einsammelnAction.error
              ? { background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)' }
              : { background: 'var(--tf-info-bg)', color: 'var(--tf-info-text)' }
          }
        >
          {einsammelnAction.error ?? einsammelnMsg}
        </div>
      )}

      <MaListFilterBar
        kategorien={kategorien}
        kategorieFilter={kategorieFilter}
        onKategorieFilter={setKategorieFilter}
        counts={counts}
        view={view}
        onView={setView}
        showInactive={showInactive}
        onShowInactive={setShowInactive}
        onAddMa={() => createAction.run()}
        addBusy={createAction.busy}
      />

      {/* Warning-Filter-Banner (kann gelöscht werden über X-Button) */}
      {warningFilter && (
        <div
          className="rounded-md px-3 py-1.5 flex items-center gap-2"
          style={{ background: 'var(--tf-warning-bg)', color: 'var(--tf-warning-text)', fontSize: 12 }}
        >
          <span>
            Filter aktiv: {warningFilter === 'no-bookings' ? 'nur MAs ohne Buchungen' : 'nur überbuchte MAs'}
          </span>
          <button
            type="button"
            onClick={onClearWarningFilter}
            className="ml-auto cursor-pointer hover:underline"
            style={{ fontSize: 11.5 }}
          >
            Filter entfernen
          </button>
        </div>
      )}

      {/* Vorschlag-Banner (existing) */}
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

      {/* Body — Tabellen-View (Karten kommt in Etappe 5) */}
      {view === 'table' ? (
        <MaTable
          list={list}
          auslastungByAnon={auslastungByAnon}
          altlastByAnon={altlastByAnon}
          kapByAnon={kapByAnon}
          kategorien={kategorien}
          quartal={config.aktuellesQuartal}
          stundenProTV={stundenProTV}
          resolveName={resolveName}
          expandedMa={expandedMa}
          onToggleExpand={handleToggleExpand}
          sort={{ col: sortCol, dir: sortDir }}
          onSort={handleSort}
          renderInlineDetail={(ma) => {
            const auslastung = auslastungByAnon.get(ma.anonId) ?? EMPTY_AUSLASTUNG;
            return (
              <MaInlineDetail
                ma={ma}
                auslastung={auslastung}
                quartal={config.aktuellesQuartal}
                onSaved={() => setExpandedMa(null)}
              />
            );
          }}
        />
      ) : (
        <MaTileGrid
          list={list}
          altlastByAnon={altlastByAnon}
          kapByAnon={kapByAnon}
          kategorien={kategorien}
          stundenProTV={stundenProTV}
          resolveName={resolveName}
          expandedMa={expandedMa}
          onToggleExpand={handleToggleExpand}
          sort={{ col: sortCol, dir: sortDir }}
          renderInlineDetail={(ma) => {
            const auslastung = auslastungByAnon.get(ma.anonId) ?? EMPTY_AUSLASTUNG;
            return (
              <MaInlineDetail
                ma={ma}
                auslastung={auslastung}
                quartal={config.aktuellesQuartal}
                onSaved={() => setExpandedMa(null)}
              />
            );
          }}
        />
      )}

      {!showInactive && totalCount > aktivCount && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-tight">
          {aktivCount} von {totalCount} Mitarbeitern haben aktuelle Anträge. MAs ohne Anträge sind ausgeblendet — Lücken in der Nummerierung sind normal.
        </p>
      )}
    </section>
  );
}

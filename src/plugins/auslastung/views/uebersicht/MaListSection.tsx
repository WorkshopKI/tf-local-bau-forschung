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
import { usePersoenlicheWurzeln } from '@/core/hooks/usePersoenlicheWurzeln';
import { WurzelnVerbinden } from '@/core/components/WurzelnVerbinden';
import { jeWurzel, juengsterGewinnt, formatiereSammelBericht } from '@/core/services/personal-roots';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { collectUserProfiles } from '../../services/onboarding';
import { normalizeKuerzel } from '../../services/identitaet';
import type { PersoenlichesAuslastungProfil } from '../../types';
import type { useAntraegeCache } from '../../hooks/useAntraegeCache';
import { useDeAnonResolver } from '../../components/AnonymIdBadge';
import { detectAktiveMAs, shouldShowAktivVorschlag } from '../../services/kapazitaet';
import { AktivVorschlagBanner } from '../admin/AktivVorschlagBanner';
import { EMPTY_AUSLASTUNG } from '../../services/kapazitaet';
import { useAuslastungIndex } from '../../hooks/useAuslastungIndex';
import { useAuslastungReady } from '../../hooks/useAuslastungReady';
import { computeKapazitaet, type KapazitaetsView } from '../../services/kapazitaet';
import { computeKapazitaetProTyp, hatTypKapazitaet, type KapazitaetProTypView } from '../../services/kapazitaet';
import { ALL_ANTRAGSTYP_BUCKETS, type AnonymerMitarbeiter, type AntragstypBucket } from '../../types';
import { MaInlineDetail } from '../MaInlineDetail';
import { ChevronRight } from 'lucide-react';
import { MaListFilterBar, type ViewMode } from './MaListFilterBar';
import { readMaListeFilters, persistMaListeFilters } from '../filterPersistence';
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
const MA_COLLAPSE_LS_KEY = 'auslastung_ma_collapsed';

function readInitialView(): ViewMode {
  try {
    return window.localStorage.getItem(VIEW_LS_KEY) === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
}

/** Klappzustand der MA-Sektion (analog StatistikSection). Default offen. */
function readInitialMaOpen(): boolean {
  try {
    return window.localStorage.getItem(MA_COLLAPSE_LS_KEY) !== '1';
  } catch {
    return true;
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
  const { wurzeln, zustaende, verbinde, entferne } = usePersoenlicheWurzeln();

  const resolveName = useDeAnonResolver();
  // Filter aus localStorage vorbelegen (überleben Reload/Session); ein
  // useEffect schreibt Änderungen zurück. Nicht-Standard-Kategorie/Antragstyp
  // klappen ihr CollapsibleSeg automatisch auf.
  const [kategorieFilter, setKategorieFilter] = useState<string>(() => readMaListeFilters().kategorie);
  const [antragstypFilter, setAntragstypFilter] = useState<AntragstypBucket | ''>(() => readMaListeFilters().antragstyp);
  const [showInactive, setShowInactive] = useState(() => readMaListeFilters().showInactive);
  const [expandedMa, setExpandedMa] = useState<string | null>(null);
  const [vorschlagDismissed, setVorschlagDismissed] = useState(false);
  const [vorschlagBusy, setVorschlagBusy] = useState(false);
  const [view, setView] = useState<ViewMode>(readInitialView);
  const [maOpen, setMaOpen] = useState<boolean>(readInitialMaOpen);
  const [sortCol, setSortCol] = useState<SortColumn>('belegt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filter-Auswahl persistieren, sobald sich etwas ändert.
  useEffect(() => {
    persistMaListeFilters({ kategorie: kategorieFilter, antragstyp: antragstypFilter, showInactive });
  }, [kategorieFilter, antragstypFilter, showInactive]);

  // Persistierte Kategorie gegen die aktuelle Konfiguration abgleichen
  // (Cold-Start-safe: nur wenn die Liste schon geladen ist).
  useEffect(() => {
    if (kategorieFilter && kategorien.length > 0 && !kategorien.some(k => k.id === kategorieFilter)) {
      setKategorieFilter('');
    }
  }, [kategorieFilter, kategorien]);

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

  // Klappzustand-Persistenz (analog StatistikSection).
  useEffect(() => {
    try {
      window.localStorage.setItem(MA_COLLAPSE_LS_KEY, maOpen ? '0' : '1');
    } catch {
      // localStorage nicht verfuegbar — silently ignorieren.
    }
  }, [maOpen]);

  // Hinweis: Der "no-bookings"-Filter erzwingt NICHT mehr showInactive=true.
  // Die zugehoerige Warnung zaehlt nur AKTIVE MAs ohne Buchungen (statistik.ts),
  // und ein erzwungenes showInactive liess sich nicht mehr abwaehlen (Effect
  // re-setzte das Haekchen sofort). Der Filter zeigt jetzt per Default die
  // aktiven Treffer; inaktive sind ueber die Checkbox optional zuschaltbar.

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
  // auslastung.json mergen (nur read noetig). Manuell statt auto-on-mount, um
  // die Load-Idempotenz + SMB-Roundtrips nicht zu unterlaufen.
  //
  // v4.1: mehrere Wurzeln. KEIN Auto-Pick mehr im Sammel-Klick — das Verbinden
  // laeuft ueber die Zeilen daneben, eine je Gruppe mit eigenem Knopf (unter
  // file:// verbraucht jeder Berechtigungs-Dialog die User-Activation,
  // recurring-bug §2). Gesammelt wird aus allen freigegebenen Wurzeln, danach
  // GENAU EIN applyAggregatedProfiles (Pitfall #16/#20). Nicht verbundene
  // Gruppen stehen in der Meldung statt still zu fehlen.
  const einsammelnAction = useAsyncAction(async () => {
    setEinsammelnMsg(null);
    const alle: PersoenlichesAuslastungProfil[] = [];
    const bericht = await jeWurzel(wurzeln, async root => {
      const teil = await collectUserProfiles(root.handle);
      alle.push(...teil);
      return teil.length;
    });
    const profile = juengsterGewinnt(alle, p => normalizeKuerzel(p.kuerzel), p => p.updatedAt);
    const { aktualisiert, neu, unzuordenbar } = await applyAggregatedProfiles(storage, profile, cache.anonymMap);
    const teile = [
      formatiereSammelBericht(bericht, { einheit: 'Profil(e) gelesen' }),
      `${aktualisiert.length} aktualisiert`,
    ];
    if (neu.length > 0) teile.push(`${neu.length} neu angelegt`);
    if (unzuordenbar.length > 0) teile.push(`${unzuordenbar.length} nicht zuordenbar (${unzuordenbar.join(', ')})`);
    setEinsammelnMsg(teile.join(' · '));
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

  // v2.16: per-Antragstyp-Kapazität (primäres Modell) — 1x pro Render-Cycle.
  const kapTypByAnon = useMemo(() => {
    const map = new Map<string, KapazitaetProTypView>();
    const stdProTV = Math.max(1, config.stundenProTV ?? 9);
    for (const ma of Object.values(mitarbeiter)) {
      map.set(ma.anonId, computeKapazitaetProTyp(ma, auslastungByAnon.get(ma.anonId), stdProTV, config.stundenProTVProTyp));
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
    if (antragstypFilter) {
      sichtbar = sichtbar.filter(m => hatTypKapazitaet(m, antragstypFilter));
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
    // Kategorie-Reihenfolge = Config-Order (wie in der Filter-Leiste); MAs ohne
    // Hauptkategorie ans Ende. Status-Rang spiegelt die Status-Logik aus
    // MaCompactRow: Aktiv < Ohne Buchung < Inaktiv < Abgemeldet.
    const quartal = config.aktuellesQuartal;
    const katOrder = new Map(kategorien.map((k, i) => [k.id, i]));
    const kategorieRank = (id: string): number =>
      id && katOrder.has(id) ? katOrder.get(id)! : Number.MAX_SAFE_INTEGER;
    const statusRank = (ma: AnonymerMitarbeiter, kv: KapazitaetsView): number => {
      if (ma.abgemeldet.includes(quartal)) return 3;
      if (!ma.aktiv) return 2;
      const ohneBuchung = kv.verbrauchteStunden === 0 && (altlastByAnon.get(ma.anonId)?.tvs ?? 0) === 0;
      return ohneBuchung ? 1 : 0;
    };
    const sorted = [...sichtbar].sort((a, b) => {
      const kva = kapByAnon.get(a.anonId);
      const kvb = kapByAnon.get(b.anonId);
      if (!kva || !kvb) return a.anonId.localeCompare(b.anonId);
      let cmp = 0;
      switch (sortCol) {
        case 'ma':
          cmp = a.anonId.localeCompare(b.anonId);
          break;
        case 'kategorie':
          cmp = kategorieRank(a.hauptKategorie) - kategorieRank(b.hauptKategorie);
          break;
        // „Aktuelles Quartal" (Balken) visualisiert den Belegt-Anteil.
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
        case 'status':
          cmp = statusRank(a, kva) - statusRank(b, kvb);
          break;
      }
      if (cmp === 0) cmp = a.anonId.localeCompare(b.anonId);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [mitarbeiter, showInactive, kategorieFilter, antragstypFilter, warningFilter, kapByAnon, altlastByAnon, hasAntraege, sortCol, sortDir, kategorien, config.aktuellesQuartal]);

  const handleToggleExpand = useCallback((anonId: string): void => {
    setExpandedMa(prev => (prev === anonId ? null : anonId));
  }, []);

  const handleSort = useCallback((col: SortColumn): void => {
    setSortCol(prev => {
      if (prev === col) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      // Defaults pro Spalte: numerische Spalten beim Wechsel desc ("die
      // größten zuerst"), Text-/Ordinal-Spalten (MA, Kategorie, Status) asc.
      const ascDefault = col === 'ma' || col === 'kategorie' || col === 'status';
      setSortDir(ascDefault ? 'asc' : 'desc');
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
    const perAntragstyp = { FuE: 0, DS: 0, DL: 0, NW: 0 } as Record<AntragstypBucket, number>;
    for (const b of ALL_ANTRAGSTYP_BUCKETS) {
      perAntragstyp[b] = considered.filter(m => hatTypKapazitaet(m, b)).length;
    }
    return { all, perKategorie, perAntragstyp };
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMaOpen(o => !o)}
          aria-expanded={maOpen}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer text-left select-none"
        >
          <ChevronRight
            size={14}
            className="text-[var(--tf-text-tertiary)] shrink-0"
            style={{
              transform: maOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform var(--tf-duration-med) var(--tf-ease)',
            }}
          />
          <span
            className="uppercase text-[var(--tf-text-tertiary)] shrink-0"
            style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: 'var(--tf-tracking-caps)', lineHeight: 1 }}
          >
            Mitarbeiter &amp; Kapazität
          </span>
          <span className="text-[var(--tf-text-tertiary)] shrink-0" style={{ fontSize: 11.5, lineHeight: 1 }}>
            {`${aktivCount} aktiv / ${totalCount} gesamt`}
          </span>
          <span aria-hidden className="flex-1" style={{ height: '0.5px', background: 'var(--tf-border)' }} />
        </button>
        <div className="flex items-center gap-2 shrink-0">
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

      {/* Verbinden je Gruppe — ein Knopf, ein Dialog. Verschwindet, sobald alle
          Wurzeln nutzbar sind. */}
      <WurzelnVerbinden
        wurzeln={wurzeln}
        zustaende={zustaende}
        verbinde={verbinde}
        entferne={entferne}
        hinweis="Zum Einsammeln muss je Gruppe der übergeordnete Ordner mit den persönlichen Ordnern verbunden sein (nur Lesezugriff)."
      />

      {maOpen && (
        <>
      <MaListFilterBar
        kategorien={kategorien}
        kategorieFilter={kategorieFilter}
        onKategorieFilter={setKategorieFilter}
        antragstypFilter={antragstypFilter}
        onAntragstypFilter={setAntragstypFilter}
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
          kapTypByAnon={kapTypByAnon}
          kategorien={kategorien}
          quartal={config.aktuellesQuartal}
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
                altlast={altlastByAnon.get(ma.anonId)}
                removable={!cache.anonymMap.toReal.has(ma.anonId)}
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
          kapTypByAnon={kapTypByAnon}
          kategorien={kategorien}
          quartal={config.aktuellesQuartal}
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
                altlast={altlastByAnon.get(ma.anonId)}
                removable={!cache.anonymMap.toReal.has(ma.anonId)}
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
        </>
      )}
    </section>
  );
}

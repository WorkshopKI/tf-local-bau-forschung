// TODO(refactor v2.4+): mischt Filter/Sort + Matching-Orchestrierung, Verbund-Liste und das große DetailPanel — entlang dieser Grenzen aufteilen (opportunistisch beim nächsten Anfassen).
// Vorschlag: DetailPanel.tsx (rechte Spalte) + Verbund-Liste + Filter-Chips als Sub-Komponenten.
/**
 * Screen 1b — Zuweisungs-Cockpit.
 *
 * 50/50 Split:
 *  - Links: Antragsliste mit Filter-Pills (Quartal/Kategorie/Status)
 *  - Rechts: Detail + kompakte VorschlagRows (Matching-Engine live), mit
 *    Zuweisungs-Streifen am Kopf (Redesign v2.26).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  getUserFoldersRootHandle,
  pickAndStoreUserFoldersRootHandle,
  refreshUserFoldersRootPermission,
} from '@/core/services/infrastructure/smb-handle';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { usePendingUebernahmeWuensche } from '../hooks/usePendingUebernahmeWuensche';
import { usePersistedKlassifizierungenView } from '../hooks/useKlassifizierungen';
import { getAntrag } from '@/core/services/csv/idb-csv';
import { runMatchingWithContext } from '../services/matching';
import {
  buildZuweisbarkeitsPruefung,
  collectUebernahmeWuensche,
  findeZurueckgezogeneWuensche,
  NICHT_ZUWEISBAR_TEXT,
  type WunschRef,
} from '../services/onboarding';
import { useDeAnonResolver } from '../components/AnonymIdBadge';
import { useAuslastungReady } from '../hooks/useAuslastungReady';
import { useAuslastungIndex } from '../hooks/useAuslastungIndex';
import { SkeletonRows } from '../components/Skeleton';
import { getTVCount } from '../services/kapazitaet';
import { collectVerbundTHints, groupFreigegebeneByVerbund, istUnvollstaendigAz, istVollstaendigFuerTypAz, istZuVerteilen, verteilCutoffDatum, verbundKeyOf, type VollstaendigkeitsGateAz, type VerbundZuweisungRow } from '../services/verbund';
import { useMatchingCorpus, type MatchingCorpus } from '../hooks/useMatchingCorpus';
import {
  embedText,
  ensureEmbeddingReady,
} from '@/core/services/embedding-corpus';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
  stundenProTVFor,
  type AntragstypBucket,
  type AusgeschlossenerMa,
  type MatchResult,
  type Zuweisung,
} from '../types';
import { buildManualMatch } from '../services/matching';
import { verbrauchFromAuslastung } from '../services/matching';
import { computeKapazitaet, tageImQuartal as computeTageImQuartal } from '../services/kapazitaet';
import { useKuerzelExport } from '../hooks/useKuerzelExport';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import {
  buildZuweisungSortOptions,
  type ZuweisungSortKey,
} from '../services/matching';
import type { Antrag } from '@/core/services/csv/types';
import {
  SPLIT_MIN,
  SPLIT_MAX,
  clampSplitPct,
  readSplitPct,
  persistSplitPct,
  kategorienOfRow,
  antragstypBucketsOfRow,
  statusBucketsOfRow,
  type StatusFilter,
} from './cockpit-helpers';
import { applyFacets, bucketFacet, countFacet, type Facet } from './facetCounts';
import { DetailPanel } from './DetailPanel';
import { VerbundListe } from './VerbundListe';
import { FilterToolbar } from './FilterToolbar';
import { readZuweisungFilters, persistZuweisungFilters } from './filterPersistence';

export function ZuweisungsCockpit(): React.ReactElement {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const upsertZuweisung = useAuslastungData(s => s.upsertZuweisung);
  const assignVerbund = useAuslastungData(s => s.assignVerbund);
  const unassignVerbund = useAuslastungData(s => s.unassignVerbund);
  const applyUebernahmeWuensche = useAuslastungData(s => s.applyUebernahmeWuensche);

  const cache = useAntraegeCache();
  // v2.9: offene Übernahme-Wünsche (read-only aus den persönlichen Ordnern) —
  // markiert Anträge schon VOR dem Einsammeln als „vorgemerkt".
  const { pendingByAntrag, wunschStand, reloadPending } = usePendingUebernahmeWuensche(cache.anonymMap);
  const resolveName = useDeAnonResolver();
  const { ready } = useAuslastungReady();
  const isInitialLoading = !ready;
  // v2.63: persisted-only — das Cockpit konsumiert nur freigegebene (= immer
  // persistierte) Klassifizierungen; die fruehere Live-Klassifizierung aller
  // unklassifizierten Antraege war hier reine CPU-Verschwendung.
  const view = usePersistedKlassifizierungenView(cache.antraege, klassifizierungen);

  // Filter-Segmente aus localStorage vorbelegen (überleben Reload/Session);
  // ein useEffect weiter unten schreibt jede Änderung zurück. Nicht-Standard-
  // Werte klappen ihr Segment via CollapsibleSeg automatisch auf.
  const [kategorieFilter, setKategorieFilter] = useState<string>(() => readZuweisungFilters().kategorie);
  const [antragstypFilter, setAntragstypFilter] = useState<AntragstypBucket | ''>(() => readZuweisungFilters().antragstyp);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => readZuweisungFilters().status);
  const [sortKey, setSortKey] = useState<ZuweisungSortKey>(() => readZuweisungFilters().sort);

  // Filter-Auswahl zurückschreiben, sobald sich etwas ändert.
  useEffect(() => {
    persistZuweisungFilters({
      kategorie: kategorieFilter, antragstyp: antragstypFilter, status: statusFilter, sort: sortKey,
    });
  }, [kategorieFilter, antragstypFilter, statusFilter, sortKey]);

  // Persistierte Kategorie gegen die aktuelle Konfiguration abgleichen — eine
  // zwischenzeitlich entfernte Überkategorie würde sonst still „0 Ergebnisse"
  // filtern. Nur abgleichen, wenn die Liste schon geladen ist (Cold-Start-safe).
  useEffect(() => {
    const kats = config.ueberKategorien;
    if (kategorieFilter && kats.length > 0 && !kats.some(k => k.id === kategorieFilter)) {
      setKategorieFilter('');
    }
  }, [kategorieFilter, config.ueberKategorien]);

  const [selectedAz, setSelectedAz] = useState<string | null>(null);
  // v2.18: Inline-Bestätigung für die Rücknahme einer Zuweisung (verbundId).
  const [confirmUnassignId, setConfirmUnassignId] = useState<string | null>(null);

  // Resizable Split: Breite der linken Liste in %. Ref haelt den Live-Wert
  // waehrend des Ziehens, damit pointerup/keydown ohne Stale-Closure persisten.
  const [leftPct, setLeftPct] = useState<number>(() => readSplitPct());
  const leftPctRef = useRef(leftPct);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  // v2.48: Nebenkompetenz-Vorschläge (eigener Block) + ausgeschlossene MAs (Grund-Liste).
  const [nebenMatches, setNebenMatches] = useState<MatchResult[]>([]);
  const [ausgeschlossen, setAusgeschlossen] = useState<AusgeschlossenerMa[]>([]);
  const [matchingRunning, setMatchingRunning] = useState(false);
  const [einsammelnMsg, setEinsammelnMsg] = useState<string | null>(null);
  // v2.290: Details des letzten Einsammelns (wer/was) — als Tooltip an der
  // Bilanz-Zeile, damit die PL zurückgezogene und nicht mehr zuweisbare
  // Wünsche nachvollziehen kann.
  const [einsammelnRefs, setEinsammelnRefs] = useState<
    { neu: WunschRef[]; entfernt: WunschRef[]; nichtZuweisbar: WunschRef[] } | null
  >(null);
  // v2.19: von der PL manuell hinzugefuegte MAs (anonIds) fuer den selektierten
  // Antrag — Reset bei Selektionswechsel (siehe useEffect weiter unten).
  const [manualAnonIds, setManualAnonIds] = useState<string[]>([]);

  // Perf: Embedding-Korpus + Antraege-Index einmal pro Daten-Stand cachen
  // (statt pro Klick neu laden/bauen). Plus pro-Antrag-Query-Embedding-Cache und
  // ein Request-Token gegen Out-of-Order-Ergebnisse bei schnellem Durchklicken.
  const loadCorpus = useMatchingCorpus(cache.antraege, cache.embeddableAz, storage);
  const queryEmbeddingCacheRef = useRef<Map<string, number[]>>(new Map());
  const matchReqIdRef = useRef(0);

  // Rollierendes Verteil-Fenster (Cutoff) — exakt wie die Klassifizierungs-Liste,
  // damit beide denselben Pool nutzen (gleitet über den Jahreswechsel). Steht
  // vor dem Einsammeln, weil dessen Zuweisbarkeits-Prüfung darauf aufsetzt.
  const verteilCutoff = useMemo(
    () => verteilCutoffDatum(config.aktuellesQuartal, config.verteilLookbackMonate ?? 6),
    [config.aktuellesQuartal, config.verteilLookbackMonate],
  );

  // v2.9: Übernahme-Wünsche aus den persoenlichen Ordnern einsammeln (read-Mode
  // ueber den User-Folders-Root, gespiegelt von MaListSection). Merged sie als
  // Zuweisung{status:'selbst'} in auslastung.json (EIN persist im Store).
  const einsammelnAction = useAsyncAction(async () => {
    setEinsammelnMsg(null);
    setEinsammelnRefs(null);
    let root = await getUserFoldersRootHandle(storage.idb);
    if (!root) {
      const res = await pickAndStoreUserFoldersRootHandle(storage.idb);
      if (!res.ok) {
        if (res.reason === 'aborted') return;
        throw new Error(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
      }
      root = res.handle;
    } else {
      // v2.59.5: bestehendes Handle re-granten — die Read-Permission kann unter
      // file:// nach Browser-Neustart verfallen sein; collectUebernahmeWuensche
      // würde dann beim Verzeichnis-Iterieren mit NotAllowedError werfen. Hier
      // sind wir im Klick-Gesture → requestPermission darf prompten.
      const perm = await refreshUserFoldersRootPermission(storage.idb);
      if (perm !== 'granted') {
        throw new Error('Zugriff auf den Ordner der Teammitglieder wurde nicht erteilt. Bitte erneut versuchen.');
      }
    }
    const batch = await collectUebernahmeWuensche(root);
    const total = batch.reduce((n, p) => n + p.wuensche.length, 0);
    // antragId → Verbund-Key, damit der Merge keine Selbst-Wünsche fuer bereits
    // freigegebene Verbünde anlegt (eine Einheit, ein Bearbeiter).
    const verbundKeyByAntrag = new Map(cache.antraege.map(a => [a.aktenzeichen, verbundKeyOf(a)]));
    const { neu, entfernt, bereitsVergeben, nichtZuweisbar, neueEintraege, entfernteEintraege, nichtZuweisbareEintraege } =
      await applyUebernahmeWuensche(
        storage,
        batch,
        cache.anonymMap,
        (id) => verbundKeyByAntrag.get(id) ?? id,
        // Gleicher Pool wie die Liste — sonst entstehen Selbst-Records für
        // Anträge, die hier gar nicht auftauchen können (Pille bliebe auf 0).
        buildZuweisbarkeitsPruefung(cache.antraege, verteilCutoff),
      );
    // „bereits vergeben" / „nicht mehr zuweisbar" erklären, warum die gelesene
    // Zahl größer bleibt als die Summe aus neu/zurückgezogen: erledigte Wünsche
    // stehen noch in der persönlichen Datei des MA, bis er das nächste Mal auf
    // die Startseite geht.
    setEinsammelnMsg(
      `${total} Wunsch/Wünsche gelesen · ${neu} neu · ${entfernt} zurückgezogen`
      + (bereitsVergeben > 0 ? ` · ${bereitsVergeben} bereits vergeben` : '')
      + (nichtZuweisbar > 0 ? ` · ${nichtZuweisbar} nicht mehr zuweisbar` : ''),
    );
    setEinsammelnRefs({ neu: neueEintraege, entfernt: entfernteEintraege, nichtZuweisbar: nichtZuweisbareEintraege });
    // Pending-Markierung aktualisieren (eingesammelte Wünsche sind nun im Store).
    reloadPending();
  });

  const kuerzelExport = useKuerzelExport();

  // v2.9: gemeinsamer Provider-Memo statt eigener Berechnung. Wird in die
  // Matching-Engine durchgereicht, damit fest+pending in den Score
  // einfliessen (statt nur Store-Zuweisungen).
  const { auslastungByAnon } = useAuslastungIndex();

  // Worklist = freigegebene Klassifizierungen ∩ derselbe „zu verteilen"-Pool wie
  // in der Klassifizierungs-Liste (`istZuVerteilen`: Antragsdatum im Fenster, KEIN
  // tib_kuerz, kein ausgeschlossener Status). cutoff===null → kein Datums-Filter
  // (identisch zur Klassifizierungs-Liste, verbund-aggregation.ts).
  const freigegebene = useMemo(() => {
    return view.filter(v =>
      v.klassifizierung.status === 'freigegeben'
      && (verteilCutoff === null || istZuVerteilen(v.antrag, verteilCutoff)),
    );
  }, [view, verteilCutoff]);

  // v2.6.6: Eine Zeile pro Verbund (alle TVs teilen Klassifizierung + Bearbeiter).
  const verbundRows = useMemo(
    () => groupFreigegebeneByVerbund(freigegebene, cache.verbuendeById),
    [freigegebene, cache.verbuendeById],
  );

  // v2.290: Ein zurückgezogener Wunsch verschwindet SOFORT aus der Liste. Die
  // persönlichen Ordner sind beim Öffnen des Tabs bereits gelesen — die Anzeige
  // muss den Einsammel-Klick also nicht abwarten (der persistiert denselben
  // Befund nur). Gilt für Filter, Zähler, Liste und Detail; die Matching-Engine
  // rechnet bewusst weiter auf dem Store-Stand (Auslastung/Kontingente kommen
  // ohnehin aus useAuslastungIndex).
  const zurueckgezogene = useMemo(
    () => findeZurueckgezogeneWuensche(zuweisungen, wunschStand),
    [zuweisungen, wunschStand],
  );
  const zuweisungenAnzeige = useMemo(() => {
    if (zurueckgezogene.length === 0) return zuweisungen;
    const raus = new Set(zurueckgezogene.map(z => `${z.antragId}::${z.anonId}`));
    return zuweisungen.filter(z => !raus.has(`${z.antragId}::${z.anonId}`));
  }, [zuweisungen, zurueckgezogene]);

  // Akronym je TV-Aktenzeichen — für die „wer/was"-Tooltips der Wunsch-Zeilen.
  const akronymByAz = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of verbundRows) {
      for (const az of row.tvAktenzeichen) m.set(az, row.akronym);
    }
    return m;
  }, [verbundRows]);

  const beschreibeWunsch = useCallback(
    (ref: WunschRef): string => {
      const wer = resolveName(ref.anonId) ?? ref.anonId;
      const akronym = akronymByAz.get(ref.antragId);
      const grund = ref.grund ? ` (${NICHT_ZUWEISBAR_TEXT[ref.grund]})` : '';
      return `${wer} → ${akronym ? `${akronym} · ` : ''}${ref.antragId}${grund}`;
    },
    [resolveName, akronymByAz],
  );

  // Tooltip an der Einsammel-Bilanz: WER wollte WAS — und warum ein Wunsch
  // nicht angekommen ist. Ohne den Grund bleibt „0 neu" bei 14 gelesenen
  // Wünschen unerklärlich.
  const einsammelnTooltip = useMemo(() => {
    if (!einsammelnRefs) return undefined;
    const blocks = [
      ['Neu', einsammelnRefs.neu],
      ['Zurückgezogen', einsammelnRefs.entfernt],
      ['Nicht mehr zuweisbar — steht nicht in dieser Liste', einsammelnRefs.nichtZuweisbar],
    ] as const;
    const text = blocks
      .filter(([, refs]) => refs.length > 0)
      .map(([titel, refs]) => `${titel}:\n${refs.map(r => `  ${beschreibeWunsch(r)}`).join('\n')}`)
      .join('\n\n');
    return text || undefined;
  }, [einsammelnRefs, beschreibeWunsch]);

  // Antragstyp-Filter: vb_phase pro Aktenzeichen, fuer den Lead-TV-Lookup.
  // vb_phase steht auf dem Antrag-Objekt (nicht auf der Verbund-Zeile).
  const phaseByAz = useMemo(() => {
    const m = new Map<string, unknown>();
    for (const a of cache.antraege) {
      m.set(a.aktenzeichen, a.vb_phase);
    }
    return m;
  }, [cache.antraege]);

  // Facetten der Toolbar — EINE Definition je Facette, geteilt von Filterung
  // (unten) und Pillen-Zählern (`filterCounts`). Die Bucket-Funktionen leben in
  // cockpit-helpers; „alle" ist der Aus-Zustand des Status-Segments.
  const bucketsKategorie = kategorienOfRow;
  const bucketsAntragstyp = useCallback(
    (row: VerbundZuweisungRow) => antragstypBucketsOfRow(row, phaseByAz),
    [phaseByAz],
  );
  const bucketsStatus = useCallback(
    (row: VerbundZuweisungRow) => statusBucketsOfRow(row, zuweisungenAnzeige, pendingByAntrag),
    [zuweisungenAnzeige, pendingByAntrag],
  );
  const facets = useMemo<Facet<VerbundZuweisungRow>[]>(() => [
    bucketFacet('kategorie', kategorieFilter, bucketsKategorie),
    bucketFacet('antragstyp', antragstypFilter, bucketsAntragstyp),
    bucketFacet('status', statusFilter === 'alle' ? '' : statusFilter, bucketsStatus),
  ], [kategorieFilter, antragstypFilter, statusFilter, bucketsKategorie, bucketsAntragstyp, bucketsStatus]);

  // Filter anwenden — Status aggregiert ueber alle TVs des Verbundes.
  const filtered = useMemo(() => applyFacets(verbundRows, facets), [verbundRows, facets]);

  // Sortier-Optionen — „Kategorie" respektiert die konfigurierte Reihenfolge der
  // Überkategorien (id → Index). Wird in die reinen Comparatoren durchgereicht.
  const sortOptions = useMemo(() => {
    const rank = new Map(config.ueberKategorien.map((k, i) => [k.id, i]));
    return buildZuweisungSortOptions(rank);
  }, [config.ueberKategorien]);

  // Sortieren NACH dem Filtern (Default: Akronym A→Z statt zufälliger Pool-Reihenfolge).
  const sorted = useMemo(() => {
    const compare = sortOptions.find(o => o.key === sortKey)?.compare;
    return compare ? [...filtered].sort(compare) : filtered;
  }, [filtered, sortKey, sortOptions]);

  // Counts pro Filter-Option — je Facette ueber die Zeilen, die die ANDEREN
  // aktiven Filter bereits passiert haben (Facetten-Semantik wie in der
  // Foerderantraege-Sidebar, `computeFacetCounts`). Damit gilt: was die Pille
  // anzeigt, ist die Zeilenzahl nach dem Klick auf sie.
  const filterCounts = useMemo(() => {
    const kat = countFacet(verbundRows, facets, 'kategorie', bucketsKategorie);
    const typ = countFacet(verbundRows, facets, 'antragstyp', bucketsAntragstyp);
    const status = countFacet(verbundRows, facets, 'status', bucketsStatus);
    return {
      kategorie: kat.byBucket,
      kategorieTotal: kat.total,
      antragstyp: {
        FuE: typ.byBucket.FuE ?? 0,
        DS: typ.byBucket.DS ?? 0,
        DL: typ.byBucket.DL ?? 0,
        NW: typ.byBucket.NW ?? 0,
      } satisfies Record<AntragstypBucket, number>,
      antragstypTotal: typ.total,
      offen: status.byBucket.offen ?? 0,
      selbst: status.byBucket.selbst ?? 0,
      zugewiesen: status.byBucket.zugewiesen ?? 0,
      statusTotal: status.total,
    };
  }, [verbundRows, facets, bucketsKategorie, bucketsAntragstyp, bucketsStatus]);

  const selected = selectedAz ? cache.antraege.find(a => a.aktenzeichen === selectedAz) : null;
  const selectedView = selectedAz ? view.find(v => v.antrag.aktenzeichen === selectedAz) : null;
  const selectedRow = selectedAz ? verbundRows.find(r => r.leadAktenzeichen === selectedAz) : null;

  // v2.63: voller Record des selektierten Antrags per Point-Read. Der Cache
  // haelt kuenftig nur die Slim-Projektion — Projektbeschreibung (Embedding-
  // Query, Detail-Summary) + Deskriptoren kommen fuer GENAU EINEN Antrag aus
  // der IDB (~ms). Request-Token gegen Out-of-Order beim schnellen Durchklicken.
  const [selectedFull, setSelectedFull] = useState<Antrag | null>(null);
  const selectedFullReqIdRef = useRef(0);
  useEffect(() => {
    const reqId = ++selectedFullReqIdRef.current;
    if (!selectedAz) { setSelectedFull(null); return; }
    void getAntrag(storage.idb, selectedAz)
      .then(full => { if (selectedFullReqIdRef.current === reqId) setSelectedFull(full); })
      .catch(() => { if (selectedFullReqIdRef.current === reqId) setSelectedFull(null); });
  }, [selectedAz, storage]);

  // Vollstaendigkeits-Gate (D_XTEC fuer FuE/DS, D_ADV fuer DL/NW): v2.63 — die
  // Az-Sets kommen aus dem Slim-Cache-Stream-Pass (custom-gemappte Felder dort
  // bereits aufgeloest), kein Scan ueber volle Records mehr.
  const gate = useMemo<VollstaendigkeitsGateAz>(
    () => ({
      dxtec: cache.xtecAzSet.size > 0,
      dadv: cache.advAzSet.size > 0,
      xtecAzSet: cache.xtecAzSet,
      advAzSet: cache.advAzSet,
    }),
    [cache.xtecAzSet, cache.advAzSet],
  );
  const antragByAz = useMemo(() => new Map(cache.antraege.map(a => [a.aktenzeichen, a])), [cache.antraege]);

  // v2.19: T_HINT verbund-weit — Bemerkung auf irgendeinem TV des Verbundes
  // (nicht nur dem Lead) im Detail anzeigen.
  const detailTHints = useMemo(() => {
    if (!selected) return [] as string[];
    const azs = selectedRow?.tvAktenzeichen ?? [selected.aktenzeichen];
    const tvs = azs.map(az => antragByAz.get(az)).filter((a): a is NonNullable<typeof a> => !!a);
    return collectVerbundTHints(tvs.length > 0 ? tvs : [selected]);
  }, [selected, selectedRow, antragByAz]);

  // Zuweisung gesperrt, solange NICHT alle TVs des selektierten Verbundes fuer
  // ihren Antragstyp vollstaendig erfasst sind (D_XTEC fuer FuE/DS, D_ADV fuer
  // DL/NW; Gate-/Transitions-bewusst). Sichtbar bleibt der Antrag (Warndreieck),
  // nur die Aktion ist gated.
  const selectedVollstaendig = useMemo(() => {
    if (!selected) return true;
    const azs = selectedRow?.tvAktenzeichen ?? [selected.aktenzeichen];
    const tvs = azs.map(az => antragByAz.get(az)).filter((a): a is NonNullable<typeof a> => !!a);
    const list = tvs.length > 0 ? tvs : [selected];
    return list.every(tv => istVollstaendigFuerTypAz(tv, gate));
  }, [selected, selectedRow, antragByAz, gate]);

  // v2.19 — Manueller MA-Eintrag.
  // Reset der manuellen Auswahl bei Selektionswechsel (nicht bei zuweisungen/
  // mitarbeiter-Aenderungen — sonst verschwaende die Card beim Zuweisen).
  useEffect(() => { setManualAnonIds([]); }, [selectedAz]);

  // Freie TVs pro aktivem MA — Kapazitaets-Hinweis im Picker (least-loaded zuerst sichtbar).
  const restTVsByAnon = useMemo(() => {
    const m = new Map<string, number>();
    for (const ma of Object.values(mitarbeiter)) {
      if (!ma.aktiv) continue;
      m.set(ma.anonId, computeKapazitaet(ma, auslastungByAnon.get(ma.anonId), config).restTVs);
    }
    return m;
  }, [mitarbeiter, auslastungByAnon, config]);

  // Manuelle Cards bauen — gleiche Kapazitaets-/Kontingent-Helfer wie die Engine.
  const kontingentVerbrauch = useMemo(() => verbrauchFromAuslastung(auslastungByAnon), [auslastungByAnon]);
  const selectedTvCount = useMemo(
    () => selected ? getTVCount(cache.antraege, (selected as { verbund_id?: string }).verbund_id, selected.aktenzeichen) : 1,
    [selected, cache.antraege],
  );
  const selectedBucket = selected ? getKategorieLabel(selected.vb_phase) : null;
  const manualMatches = useMemo(() => {
    if (!selected) return [] as MatchResult[];
    const benoetigt = stundenProTVFor(config, selectedBucket) * selectedTvCount;
    return manualAnonIds
      .map(anonId => mitarbeiter[anonId])
      .filter((ma): ma is NonNullable<typeof ma> => !!ma)
      .map(ma => buildManualMatch(ma, selectedBucket, auslastungByAnon.get(ma.anonId), kontingentVerbrauch.get(ma.anonId), config, benoetigt));
  }, [selected, manualAnonIds, mitarbeiter, auslastungByAnon, kontingentVerbrauch, config, selectedBucket, selectedTvCount]);

  // Engine-Treffer + manuelle Cards (Dedupe gegen Engine-anonIds).
  const mergedMatches = useMemo(() => {
    if (manualMatches.length === 0) return matches;
    const engineIds = new Set(matches.map(m => m.anonId));
    return [...matches, ...manualMatches.filter(m => !engineIds.has(m.anonId))];
  }, [matches, manualMatches]);

  const addManual = useCallback((anonId: string) => {
    setManualAnonIds(prev => prev.includes(anonId) ? prev : [...prev, anonId]);
  }, []);
  const removeManual = useCallback((anonId: string) => {
    setManualAnonIds(prev => prev.filter(id => id !== anonId));
  }, []);

  // v2.18: Rücknahme einer Verbund-Zuweisung (PL-Umplanung) — entfernt die
  // Freigabe, die Auslastung des MA rechnet reaktiv neu (zuweisungen-Ref ändert).
  const unassignRowAction = useAsyncAction(async (row: VerbundZuweisungRow) => {
    await unassignVerbund(storage, { tvAktenzeichen: row.tvAktenzeichen, quartal: config.aktuellesQuartal });
  });
  const unassignSelectedAction = useAsyncAction(async () => {
    if (!selectedRow) return;
    await unassignVerbund(storage, { tvAktenzeichen: selectedRow.tvAktenzeichen, quartal: config.aktuellesQuartal });
  });

  // v2.9: offene Übernahme-Wünsche für den ausgewählten Antrag (read-only, vor
  // dem Einsammeln) — abzüglich bereits im Store erfasster anonIds.
  const detailPendingAnonIds = (() => {
    if (!selected) return [] as string[];
    const azs = selectedRow?.tvAktenzeichen ?? [selected.aktenzeichen];
    const storeWunsch = new Set(
      zuweisungenAnzeige
        .filter(z => azs.includes(z.antragId) && (z.status === 'selbst' || z.selbstEingetragen || z.status === 'freigegeben'))
        .map(z => z.anonId),
    );
    return Array.from(new Set(azs.flatMap(az => pendingByAntrag.get(az) ?? []))).filter(a => !storeWunsch.has(a));
  })();

  // Wenn Selektion durch Filter wegfaellt — auf den Lead-TV des ersten (nach
  // aktueller Sortierung obersten) Verbundes. Membership ist sortier-unabhängig,
  // daher bleibt eine noch sichtbare Selektion beim Umsortieren erhalten.
  useEffect(() => {
    if (selectedAz && !sorted.some(r => r.leadAktenzeichen === selectedAz)) {
      setSelectedAz(sorted[0]?.leadAktenzeichen ?? null);
    } else if (!selectedAz && sorted.length > 0) {
      setSelectedAz(sorted[0]!.leadAktenzeichen);
    }
  }, [sorted, selectedAz]);

  // Matching-Engine fuer selektierten Antrag
  useEffect(() => {
    if (!selected || !selectedView) {
      matchReqIdRef.current++; // laufende Berechnung invalidieren
      setMatches([]);
      setNebenMatches([]);
      setAusgeschlossen([]);
      setMatchingRunning(false);
      return;
    }
    // Voller Record laedt noch (Point-Read, ~ms) — Spinner an, der Effekt
    // laeuft erneut sobald selectedFull ankommt. NIE mit dem Slim-Record
    // matchen (Projektbeschreibung/AST-Typ wuerden fehlen → stilles
    // Qualitaets-Downgrade von Stage 1/2).
    if (!selectedFull || selectedFull.aktenzeichen !== selected.aktenzeichen) {
      matchReqIdRef.current++;
      setMatchingRunning(true);
      return;
    }
    const reqId = ++matchReqIdRef.current;
    void (async () => {
      setMatchingRunning(true);
      try {
        // 1.17: primaer + aspekte aus den freigegebenen Feldern.
        const k = selectedView.klassifizierung;
        const primaerKategorie = k.freigegebenePrimaer;
        const aspekte = k.freigegebeneAspekte;
        let queryEmbedding: number[] | undefined;
        let corpus: MatchingCorpus | undefined;
        if (config.stage2Aktiv) {
          // Query-Embedding pro Antrag cachen — Re-Klick spart die Inferenz.
          const cachedQuery = queryEmbeddingCacheRef.current.get(selected.aktenzeichen);
          if (cachedQuery) {
            queryEmbedding = cachedQuery;
          } else {
            await ensureEmbeddingReady(storage.idb);
            const text = [
              selectedFull[CANONICAL_VERBUND_TITEL],
              selectedFull[CANONICAL_TITEL],
              selectedFull[FIELD_PROJEKTBESCHREIBUNG],
            ].filter(s => typeof s === 'string').join(' ');
            queryEmbedding = await embedText(text, 'query');
            queryEmbeddingCacheRef.current.set(selected.aktenzeichen, queryEmbedding);
          }
          // Korpus + Index einmal pro Daten-Stand (gecacht ueber Klicks hinweg).
          corpus = await loadCorpus();
        }
        // v2.4: echte TV-Anzahl aus der Anträge-Liste, damit Engine die
        // korrekten benoetigtenStunden berechnet (Verbund mit 4 TVs = 36h).
        const verbundId = (selected as { verbund_id?: string }).verbund_id;
        const tvCount = getTVCount(cache.antraege, verbundId, selected.aktenzeichen);
        const result = runMatchingWithContext({
          antrag: selectedFull,
          primaerKategorie,
          aspekte,
          config,
          mitarbeiter,
          zuweisungen,
          historischeDeskriptorenByAnon: cache.historischeDeskriptorenByAnon,
          historischeAstByAnon: cache.historischeAstByAnon,
          historischeAntraegeCountByAnon: cache.historischeAntraegeCountByAnon,
          anonymMap: cache.anonymMap,
          queryEmbedding,
          corpusEmbeddings: corpus?.corpusEmbeddings,
          antraegeIndex: corpus?.antraegeIndex,
          anzahlTV: tvCount,
          auslastungByAnon,
          // 5 Vorschläge statt der Engine-Default-3 — die PL sieht mehr
          // Kandidaten ohne zu scrollen (Cards zusätzlich kompakter).
          topN: 5,
        });
        // Stale-Guard: nur anwenden, wenn diese Selektion noch aktuell ist
        // (verhindert, dass ein langsamerer frueherer Lauf einen neueren
        // ueberschreibt, wenn der User schnell durchklickt).
        if (matchReqIdRef.current === reqId) {
          setMatches(result.vorschlaege);
          setNebenMatches(result.nebenkompetenz);
          setAusgeschlossen(result.ausgeschlossen);
        }
      } finally {
        if (matchReqIdRef.current === reqId) setMatchingRunning(false);
      }
    })();
  }, [selectedAz, selected, selectedView, selectedFull, config, mitarbeiter, zuweisungen, cache.antraege, cache.historischeDeskriptorenByAnon, cache.historischeAntraegeCountByAnon, cache.anonymMap, storage, auslastungByAnon, loadCorpus]);

  async function zuweisen(match: MatchResult): Promise<void> {
    if (!selected) return;
    // Sperre: unvollstaendige Verbuende (D_XTEC/D_ADV fehlt) sind sichtbar, aber
    // nicht zuweisbar (Defense-in-Depth zur UI-Sperre).
    if (!selectedVollstaendig) return;
    // v2.4: PL-Freigabe bucht echte tvCount-Stunden + setzt anzahlTV im
    // Zuweisungs-Record, damit die Buchung mit der CSV konsistent ist.
    // Verbund-atomar: assignVerbund raeumt alle konkurrierenden Zuweisungen
    // ALLER TVs des Verbundes weg (Geist-Freigaben + Fremd-Selbst-Wünsche) und
    // setzt GENAU EINE Freigabe — eine Einheit, ein Bearbeiter.
    const verbundId = (selected as { verbund_id?: string }).verbund_id;
    const tvCount = getTVCount(cache.antraege, verbundId, selected.aktenzeichen);
    const tvAktenzeichen = selectedRow?.tvAktenzeichen ?? [selected.aktenzeichen];
    await assignVerbund(storage, {
      tvAktenzeichen,
      leadAktenzeichen: selected.aktenzeichen,
      anonId: match.anonId,
      quartal: config.aktuellesQuartal,
      stunden: match.benoetigteStunden,
      anzahlTV: tvCount,
    });
  }

  async function ablehnen(match: MatchResult): Promise<void> {
    if (!selected) return;
    const z: Zuweisung = {
      antragId: selected.aktenzeichen,
      anonId: match.anonId,
      quartal: config.aktuellesQuartal,
      stunden: 0,
      status: 'abgelehnt',
    };
    await upsertZuweisung(storage, z);
  }

  // ─── Resize-Handler ────────────────────────────────────────────────────
  const setSplitFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = clampSplitPct(((clientX - rect.left) / rect.width) * 100);
    leftPctRef.current = pct;
    setLeftPct(pct);
  }, []);

  const onHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setSplitFromClientX(e.clientX);
  }, [setSplitFromClientX]);

  const onHandlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* schon freigegeben */ }
    persistSplitPct(leftPctRef.current);
  }, []);

  const onHandleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = clampSplitPct(leftPctRef.current + (e.key === 'ArrowLeft' ? -2 : 2));
    leftPctRef.current = next;
    setLeftPct(next);
    persistSplitPct(next);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: Übernahme-Wünsche einsammeln (links) + Export (rechts) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => einsammelnAction.run()}
            loading={einsammelnAction.busy}
            title="Liest die Übernahme-Wünsche der MAs aus deren persönlichen Ordnern ein"
          >
            Übernahme-Wünsche einsammeln
          </Button>
          {einsammelnMsg && (
            <span
              className={einsammelnTooltip
                ? 'text-[11px] text-[var(--tf-text-tertiary)] cursor-help underline decoration-dotted underline-offset-2'
                : 'text-[11px] text-[var(--tf-text-tertiary)]'}
              title={einsammelnTooltip}
            >
              {einsammelnMsg}
            </span>
          )}
          {/* Live-Rückzüge: der MA hat den Wunsch aus seinem Ordner entfernt, die
              PL hat aber noch nicht eingesammelt. Aus der Liste sind sie bereits
              raus — hier steht, WER WAS zurückgezogen hat. */}
          {zurueckgezogene.length > 0 && (
            <span
              className="text-[11px] text-amber-700 cursor-help underline decoration-dotted underline-offset-2"
              title={`Zurückgezogen (aus der Liste bereits entfernt, wird beim nächsten Einsammeln gespeichert):\n${
                zurueckgezogene.map(z => `  ${beschreibeWunsch({ antragId: z.antragId, anonId: z.anonId })}`).join('\n')
              }`}
            >
              {zurueckgezogene.length} zurückgezogen
            </span>
          )}
          {einsammelnAction.error && (
            <span className="text-[11px] text-[var(--tf-danger-text)]">Fehler: {einsammelnAction.error}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {kuerzelExport.error && (
            <span className="text-[11px] text-[var(--tf-danger-text)]">Fehler: {kuerzelExport.error}</span>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => { void kuerzelExport.run(); }}
            loading={kuerzelExport.busy}
          >
            Export (mit Kürzeln)
          </Button>
        </div>
      </div>

      {/* Filter-Chips im Stil der Foerderantraege-Quickfilter (CollapsibleSeg) */}
      <FilterToolbar
        filterCounts={filterCounts}
        ueberKategorien={config.ueberKategorien}
        kategorieFilter={kategorieFilter}
        antragstypFilter={antragstypFilter}
        statusFilter={statusFilter}
        sortKey={sortKey}
        onKategorieChange={setKategorieFilter}
        onAntragstypChange={setAntragstypFilter}
        onStatusChange={setStatusFilter}
        onSortChange={setSortKey}
      />

      {/* Split — resizable: linke Liste per Ziehgriff breiter ziehbar (lange VB-Titel lesen) */}
      <div ref={containerRef} className="flex min-h-[600px]">
        {/* Links: Liste */}
        <VerbundListe
          leftPct={leftPct}
          rows={sorted}
          isInitialLoading={isInitialLoading}
          verteilLookbackMonate={config.verteilLookbackMonate}
          selectedAz={selectedAz}
          onSelect={setSelectedAz}
          antragByAz={antragByAz}
          gate={gate}
          ueberKategorien={config.ueberKategorien}
          zuweisungen={zuweisungenAnzeige}
          pendingByAntrag={pendingByAntrag}
          confirmUnassignId={confirmUnassignId}
          onSetConfirmUnassign={setConfirmUnassignId}
          onUnassignRow={(row) => { void unassignRowAction.run(row); }}
          unassignBusy={unassignRowAction.busy}
        />

        {/* Ziehgriff — Spaltenbreite anpassen (Pointer + Pfeiltasten) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Spaltenbreite anpassen"
          aria-valuenow={Math.round(leftPct)}
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          tabIndex={0}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onKeyDown={onHandleKeyDown}
          className="group shrink-0 mx-1 w-1.5 self-stretch flex items-center justify-center cursor-col-resize touch-none focus:outline-none"
        >
          <div
            className="w-0.5 h-10 rounded-full transition-all group-hover:h-16 group-focus-visible:h-16"
            style={{ background: 'var(--tf-border)' }}
          />
        </div>

        {/* Rechts: Detail */}
        <div className="flex-1 min-w-0 rounded-[12px] p-4 overflow-y-auto" style={{ border: '0.5px solid var(--tf-border)' }}>
          {isInitialLoading ? (
            <div className="flex flex-col gap-3">
              <SkeletonRows count={1} columns={['80%']} rowHeight={48} />
              <SkeletonRows count={3} columns={['60%']} rowHeight={20} />
              <div className="mt-3 text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                Lade Vorschläge …
              </div>
              <SkeletonRows count={3} columns={['100%']} rowHeight={120} />
            </div>
          ) : !selected || !selectedView ? (
            <div className="flex items-center justify-center h-full text-[var(--tf-text-tertiary)] text-[12.5px]">
              ← Wähle einen Antrag aus
            </div>
          ) : (
            <DetailPanel
              antrag={selectedFull ?? selected}
              deskriptoren={cache.deskriptorenByAz.get(selected.aktenzeichen) ?? []}
              akronym={selectedRow?.akronym ?? ''}
              verbundTitel={selectedRow?.verbundTitel ?? ''}
              klassifizierung={selectedView.klassifizierung}
              kategorien={config.ueberKategorien}
              matches={mergedMatches}
              nebenMatches={nebenMatches}
              ausgeschlossen={ausgeschlossen}
              matchingRunning={matchingRunning}
              zuweisungen={zuweisungenAnzeige.filter(z => (selectedRow?.tvAktenzeichen ?? [selected.aktenzeichen]).includes(z.antragId))}
              mitarbeiter={mitarbeiter}
              pendingAnonIds={detailPendingAnonIds}
              unvollstaendig={istUnvollstaendigAz(selected, gate)}
              zuweisenGesperrt={!selectedVollstaendig}
              tHints={detailTHints}
              restTVsByAnon={restTVsByAnon}
              onZuweisen={zuweisen}
              onAblehnen={ablehnen}
              onAddManual={addManual}
              onRemoveManual={removeManual}
              onUnassign={() => { void unassignSelectedAction.run(); }}
              tageImQuartal={computeTageImQuartal(config.aktuellesQuartal)}
            />
          )}
        </div>
      </div>
    </div>
  );
}


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
import { AlertTriangle, Info, Undo2 } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  getUserFoldersRootHandle,
  pickAndStoreUserFoldersRootHandle,
} from '@/core/services/infrastructure/smb-handle';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { usePendingUebernahmeWuensche } from '../hooks/usePendingUebernahmeWuensche';
import { useKlassifizierungenView } from '../hooks/useKlassifizierungen';
import { runMatching } from '../services/matching-engine';
import { collectUebernahmeWuensche } from '../services/uebernahme-einsammeln';
import { useAuslastungReady } from '../hooks/useAuslastungReady';
import { useAuslastungIndex } from '../hooks/useAuslastungIndex';
import { SkeletonRows } from '../components/Skeleton';
import { getTVCount } from '../services/quartals-auslastung';
import { collectVerbundTHints, groupFreigegebeneByVerbund, hatDXtecDatum, istUnvollstaendig, istZuVerteilen, UNVOLLSTAENDIG_TOOLTIP, verteilCutoffDatum, verbundKeyOf, type VerbundZuweisungRow } from '../services/verbund-aggregation';
import { useMatchingCorpus, type MatchingCorpus } from '../hooks/useMatchingCorpus';
import {
  embedText,
  ensureEmbeddingReady,
} from '@/core/services/embedding-corpus';
import {
  ALL_ANTRAGSTYP_BUCKETS,
  CANONICAL_AKRONYM,
  CANONICAL_TITEL,
  CANONICAL_VERBUND_ID,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
  stundenProTVFor,
  type AntragstypBucket,
  type MatchResult,
  type Zuweisung,
} from '../types';
import { KategoriePill } from '../components/KategoriePill';
import { ConfidenceDot } from '../components/ConfidenceDot';
import { TechnologieTags } from '../components/TechnologieTags';
import { VorschlagRow } from '../components/VorschlagRow';
import { ZuweisungStreifen } from '../components/ZuweisungStreifen';
import { ManuellerMaPicker } from '../components/ManuellerMaPicker';
import { buildManualMatch } from '../services/manual-match';
import { verbrauchFromAuslastung } from '../services/kontingent';
import { computeKapazitaet, tageImQuartal as computeTageImQuartal } from '../services/kapazitaet';
import { AnonymIdBadge, useDeAnonResolver } from '../components/AnonymIdBadge';
import { readAntragDeskriptoren } from '../services/profil-aggregator';
import { useKuerzelExport } from '../hooks/useKuerzelExport';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';
import {
  buildZuweisungSortOptions,
  buildSortChips,
  sortChipValue,
  nextSortKeyForClick,
  SORT_CHIP_DISPLAY,
  DEFAULT_ZUWEISUNG_SORT,
  type ZuweisungSortKey,
} from '../services/zuweisung-sort';
import type { Antrag } from '@/core/services/csv/types';

type StatusFilter = 'offen' | 'selbst' | 'zugewiesen' | 'alle';

/** Labels der Status-Filter-Pills. `selbst` heisst nutzerseitig „Übernahme-
 *  Wunsch" (v2.9) — so filtert die PL gezielt Anträge, die jemand haben will. */
const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  offen: 'offen',
  selbst: 'Übernahme-Wunsch',
  zugewiesen: 'zugewiesen',
  alle: 'alle',
};

// ─── Resizable Split (linke Liste vs. Detail) ───────────────────────────
// Der User kann die linke Antragsliste breiter ziehen, um lange VB-Titel zu
// lesen. Breite (linke Spalte in %) wird in localStorage gehalten — laut
// CLAUDE.md fuer User-Preferences erlaubt.
const SPLIT_STORAGE_KEY = 'tf-auslastung-zuweisung-split';
const SPLIT_MIN = 25;
const SPLIT_MAX = 75;
const SPLIT_DEFAULT = 50;

/** Klemmt einen Prozentwert auf den erlaubten Split-Bereich. */
function clampSplitPct(n: number): number {
  if (!Number.isFinite(n)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
}

/** Liest die gespeicherte Split-Breite (linke Spalte in %) aus localStorage. */
function readSplitPct(): number {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    return raw === null ? SPLIT_DEFAULT : clampSplitPct(parseFloat(raw));
  } catch {
    return SPLIT_DEFAULT;
  }
}

/** Persistiert die Split-Breite (best-effort — localStorage kann fehlen). */
function persistSplitPct(pct: number): void {
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(pct)));
  } catch {
    /* localStorage nicht verfuegbar — Breite bleibt nur fuer die Session */
  }
}

/** Formatiert das Antragsdatum (ISO `YYYY-MM-DD`) als de-DE-Datum (DD.MM.YYYY).
 *  Leeres/ungültiges Datum → „—" (Spalte bleibt konsistent gefüllt). */
function formatAntragsdatum(iso: string | undefined): string {
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
  return '—';
}

/** Formatiert den Klick-Zeitpunkt einer Vormerkung kompakt (de-DE). */
function formatKlickZeit(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Aggregierter Status eines Verbundes ueber alle seine TVs. Geteilt von der
 *  Filterung und der Count-Berechnung (eine Quelle statt Duplizierung). */
function verbundStatusFlags(
  tvAktenzeichen: string[],
  zuweisungen: Zuweisung[],
): { offen: boolean; selbst: boolean; zug: boolean } {
  const ze = zuweisungen.filter(z => tvAktenzeichen.includes(z.antragId));
  return {
    offen: ze.length === 0 || ze.every(z => z.status === 'abgelehnt'),
    selbst: ze.some(z => z.status === 'selbst' || z.selbstEingetragen),
    zug: ze.some(z => z.status === 'freigegeben'),
  };
}

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
  const { pendingByAntrag, reloadPending } = usePendingUebernahmeWuensche(cache.anonymMap);
  const resolveName = useDeAnonResolver();
  const { ready } = useAuslastungReady();
  const isInitialLoading = !ready;
  const view = useKlassifizierungenView(cache.antraege, config.ueberKategorien, klassifizierungen);

  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [antragstypFilter, setAntragstypFilter] = useState<AntragstypBucket | ''>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('offen');
  const [sortKey, setSortKey] = useState<ZuweisungSortKey>(DEFAULT_ZUWEISUNG_SORT);
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
  const [matchingRunning, setMatchingRunning] = useState(false);
  const [einsammelnMsg, setEinsammelnMsg] = useState<string | null>(null);
  // v2.19: von der PL manuell hinzugefuegte MAs (anonIds) fuer den selektierten
  // Antrag — Reset bei Selektionswechsel (siehe useEffect weiter unten).
  const [manualAnonIds, setManualAnonIds] = useState<string[]>([]);

  // Perf: Embedding-Korpus + Antraege-Index einmal pro Daten-Stand cachen
  // (statt pro Klick neu laden/bauen). Plus pro-Antrag-Query-Embedding-Cache und
  // ein Request-Token gegen Out-of-Order-Ergebnisse bei schnellem Durchklicken.
  const loadCorpus = useMatchingCorpus(cache.antraege, storage);
  const queryEmbeddingCacheRef = useRef<Map<string, number[]>>(new Map());
  const matchReqIdRef = useRef(0);

  // v2.9: Übernahme-Wünsche aus den persoenlichen Ordnern einsammeln (read-Mode
  // ueber den User-Folders-Root, gespiegelt von MaListSection). Merged sie als
  // Zuweisung{status:'selbst'} in auslastung.json (EIN persist im Store).
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
    const batch = await collectUebernahmeWuensche(root);
    const total = batch.reduce((n, p) => n + p.wuensche.length, 0);
    // antragId → Verbund-Key, damit der Merge keine Selbst-Wünsche fuer bereits
    // freigegebene Verbünde anlegt (eine Einheit, ein Bearbeiter).
    const verbundKeyByAntrag = new Map(cache.antraege.map(a => [a.aktenzeichen, verbundKeyOf(a)]));
    const { neu, entfernt } = await applyUebernahmeWuensche(
      storage,
      batch,
      cache.anonymMap,
      (id) => verbundKeyByAntrag.get(id) ?? id,
    );
    setEinsammelnMsg(
      `${total} Wunsch/Wünsche gelesen · ${neu} neu · ${entfernt} zurückgezogen`,
    );
    // Pending-Markierung aktualisieren (eingesammelte Wünsche sind nun im Store).
    reloadPending();
  });

  const kuerzelExport = useKuerzelExport();

  // v2.9: gemeinsamer Provider-Memo statt eigener Berechnung. Wird in die
  // Matching-Engine durchgereicht, damit fest+pending in den Score
  // einfliessen (statt nur Store-Zuweisungen).
  const { auslastungByAnon } = useAuslastungIndex();

  // Rollierendes Verteil-Fenster (Cutoff) — exakt wie die Klassifizierungs-Liste,
  // damit beide denselben Pool nutzen (gleitet über den Jahreswechsel).
  const verteilCutoff = useMemo(
    () => verteilCutoffDatum(config.aktuellesQuartal, config.verteilLookbackMonate ?? 6),
    [config.aktuellesQuartal, config.verteilLookbackMonate],
  );

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

  // Antragstyp-Filter: vb_phase pro Aktenzeichen, fuer den Lead-TV-Lookup.
  // vb_phase steht auf dem Antrag-Objekt (nicht auf der Verbund-Zeile).
  const phaseByAz = useMemo(() => {
    const m = new Map<string, unknown>();
    for (const a of cache.antraege) {
      m.set(a.aktenzeichen, (a as Record<string, unknown>).vb_phase);
    }
    return m;
  }, [cache.antraege]);

  // Filter anwenden — Status aggregiert ueber alle TVs des Verbundes.
  const filtered = useMemo(() => {
    return verbundRows.filter(row => {
      const kats = [row.klassifizierung.freigegebenePrimaer, ...row.klassifizierung.freigegebeneAspekte].filter(Boolean);
      if (kategorieFilter && !kats.includes(kategorieFilter)) return false;
      // Antragstyp via Lead-TV (vb_phase ist verbund-weit gleich; Irrlaeufer/9
      // → getKategorieLabel === null → matcht keinen Bucket, nur „Alle").
      if (antragstypFilter && getKategorieLabel(phaseByAz.get(row.leadAktenzeichen)) !== antragstypFilter) return false;
      if (statusFilter !== 'alle') {
        const { offen, selbst, zug } = verbundStatusFlags(row.tvAktenzeichen, zuweisungen);
        if (statusFilter === 'offen' && !offen) return false;
        if (statusFilter === 'selbst' && !selbst) return false;
        if (statusFilter === 'zugewiesen' && !zug) return false;
      }
      return true;
    });
  }, [verbundRows, kategorieFilter, antragstypFilter, phaseByAz, statusFilter, zuweisungen]);

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

  // Counts pro Filter-Option — ueber ALLE freigegebenen Verbunde (stabil, nicht
  // ueber die aktuell gefilterte Teilmenge; gleiche Regel wie die Foerderantraege-
  // Quickfilter). Werden im aufgeklappten Chip-Segment angezeigt.
  const filterCounts = useMemo(() => {
    const kategorie: Record<string, number> = {};
    const antragstyp: Record<AntragstypBucket, number> = { FuE: 0, DS: 0, DL: 0, NW: 0 };
    let offen = 0, selbst = 0, zugewiesen = 0;
    for (const row of verbundRows) {
      const kats = new Set(
        [row.klassifizierung.freigegebenePrimaer, ...row.klassifizierung.freigegebeneAspekte].filter(Boolean),
      );
      for (const id of kats) kategorie[id] = (kategorie[id] ?? 0) + 1;
      const bucket = getKategorieLabel(phaseByAz.get(row.leadAktenzeichen));
      if (bucket) antragstyp[bucket]++;
      const flags = verbundStatusFlags(row.tvAktenzeichen, zuweisungen);
      if (flags.offen) offen++;
      if (flags.selbst) selbst++;
      if (flags.zug) zugewiesen++;
    }
    return { kategorie, antragstyp, offen, selbst, zugewiesen, total: verbundRows.length };
  }, [verbundRows, phaseByAz, zuweisungen]);

  const selected = selectedAz ? cache.antraege.find(a => a.aktenzeichen === selectedAz) : null;
  const selectedView = selectedAz ? view.find(v => v.antrag.aktenzeichen === selectedAz) : null;
  const selectedRow = selectedAz ? verbundRows.find(r => r.leadAktenzeichen === selectedAz) : null;

  // v2.19 — D_XTEC-Markierung: nur wenn das Feld irgendwo befuellt ist
  // (Transitions-Schutz, solange D_XTEC nicht gemappt ist).
  const dxtecVerfuegbar = useMemo(() => cache.antraege.some(a => hatDXtecDatum(a)), [cache.antraege]);
  const antragByAz = useMemo(() => new Map(cache.antraege.map(a => [a.aktenzeichen, a])), [cache.antraege]);

  // v2.19: T_HINT verbund-weit — Bemerkung auf irgendeinem TV des Verbundes
  // (nicht nur dem Lead) im Detail anzeigen.
  const detailTHints = useMemo(() => {
    if (!selected) return [] as string[];
    const azs = selectedRow?.tvAktenzeichen ?? [selected.aktenzeichen];
    const tvs = azs.map(az => antragByAz.get(az)).filter((a): a is Antrag => !!a);
    return collectVerbundTHints(tvs.length > 0 ? tvs : [selected]);
  }, [selected, selectedRow, antragByAz]);

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
  const selectedBucket = selected ? getKategorieLabel((selected as Record<string, unknown>).vb_phase) : null;
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
      zuweisungen
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
      setMatchingRunning(false);
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
              selected[CANONICAL_VERBUND_TITEL],
              selected[CANONICAL_TITEL],
              selected[FIELD_PROJEKTBESCHREIBUNG],
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
        const result = runMatching({
          antrag: selected,
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
        if (matchReqIdRef.current === reqId) setMatches(result);
      } finally {
        if (matchReqIdRef.current === reqId) setMatchingRunning(false);
      }
    })();
  }, [selectedAz, selected, selectedView, config, mitarbeiter, zuweisungen, cache.antraege, cache.historischeDeskriptorenByAnon, cache.historischeAntraegeCountByAnon, cache.anonymMap, storage, auslastungByAnon, loadCorpus]);

  async function zuweisen(match: MatchResult): Promise<void> {
    if (!selected) return;
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

  // ─── Filter-Chips (Stil wie Foerderantraege-Quickfilter / CollapsibleSeg) ──
  const kategorieItems: CollapsibleSegItem[] = [
    { label: 'Alle', count: filterCounts.total },
    ...config.ueberKategorien.map(k => ({ label: k.id, count: filterCounts.kategorie[k.id] ?? 0 })),
  ];
  const onKategorieChange = (label: string): void => {
    setKategorieFilter(label === 'Alle' ? '' : label);
  };

  const antragstypItems: CollapsibleSegItem[] = [
    { label: 'Alle', count: filterCounts.total },
    ...ALL_ANTRAGSTYP_BUCKETS.map(b => ({ label: b, count: filterCounts.antragstyp[b] })),
  ];
  const onAntragstypChange = (label: string): void => {
    setAntragstypFilter(label === 'Alle' ? '' : (label as AntragstypBucket));
  };

  const statusKeys: StatusFilter[] = ['offen', 'selbst', 'zugewiesen', 'alle'];
  const statusCountByKey: Record<StatusFilter, number> = {
    offen: filterCounts.offen,
    selbst: filterCounts.selbst,
    zugewiesen: filterCounts.zugewiesen,
    alle: filterCounts.total,
  };
  const statusItems: CollapsibleSegItem[] = statusKeys.map(s => ({
    label: STATUS_FILTER_LABELS[s],
    count: statusCountByKey[s],
  }));
  const onStatusChange = (label: string): void => {
    const key = statusKeys.find(s => STATUS_FILTER_LABELS[s] === label);
    if (key) setStatusFilter(key);
  };

  // Sortier-Chips — kompakt; „Antragsdatum"/„Sicherheit" je EIN Pfeil-Toggle
  // (Klick auf den aktiven Chip dreht die Richtung). Bewusst ohne Counts
  // (Sortierung partitioniert nicht). Tooltip erklärt die Richtung.
  const sortItems: CollapsibleSegItem[] = buildSortChips(sortKey).map(c => ({ label: c.label, title: c.title }));
  const onSortChange = (label: string): void => {
    setSortKey(prev => nextSortKeyForClick(label, prev));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: Übernahme-Wünsche einsammeln (links) + Export (rechts) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => einsammelnAction.run()}
            disabled={einsammelnAction.busy}
            className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: '0.5px solid var(--tf-border)' }}
            title="Liest die Übernahme-Wünsche der MAs aus deren persönlichen Ordnern ein"
          >
            {einsammelnAction.busy ? 'Sammle ein…' : 'Übernahme-Wünsche einsammeln'}
          </button>
          {einsammelnMsg && (
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">{einsammelnMsg}</span>
          )}
          {einsammelnAction.error && (
            <span className="text-[11px] text-[var(--tf-danger-text)]">Fehler: {einsammelnAction.error}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {kuerzelExport.error && (
            <span className="text-[11px] text-[var(--tf-danger-text)]">Fehler: {kuerzelExport.error}</span>
          )}
          <button
            type="button"
            onClick={() => { void kuerzelExport.run(); }}
            disabled={kuerzelExport.busy}
            className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            {kuerzelExport.busy ? 'Exportiere…' : 'Export (mit Kürzeln)'}
          </button>
        </div>
      </div>

      {/* Filter-Chips im Stil der Foerderantraege-Quickfilter (CollapsibleSeg) */}
      <div className="flex items-center gap-2 flex-wrap">
        <CollapsibleSeg
          label="Kategorie"
          value={kategorieFilter || 'Alle'}
          items={kategorieItems}
          onChange={onKategorieChange}
        />
        <CollapsibleSeg
          label="Antragstyp"
          value={antragstypFilter || 'Alle'}
          items={antragstypItems}
          onChange={onAntragstypChange}
        />
        <CollapsibleSeg
          label="Status"
          value={STATUS_FILTER_LABELS[statusFilter]}
          items={statusItems}
          onChange={onStatusChange}
          defaultValue={STATUS_FILTER_LABELS.offen}
        />
        <CollapsibleSeg
          label="Sortiert nach"
          value={sortChipValue(sortKey)}
          items={sortItems}
          onChange={onSortChange}
          defaultValue={SORT_CHIP_DISPLAY[DEFAULT_ZUWEISUNG_SORT]}
          startCollapsed
        />
      </div>

      {/* Split — resizable: linke Liste per Ziehgriff breiter ziehbar (lange VB-Titel lesen) */}
      <div ref={containerRef} className="flex min-h-[600px]">
        {/* Links: Liste */}
        <div
          className="rounded-[12px] overflow-hidden flex flex-col min-w-0"
          style={{ width: `${leftPct}%`, border: '0.5px solid var(--tf-border)' }}
        >
          <div className="px-3 py-2 flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            <span>{isInitialLoading ? '…' : `${sorted.length} Verbund${sorted.length !== 1 ? 'e' : ''}`}</span>
            {!isInitialLoading && (
              <>
                <span>· nur ohne TIB-Kürzel (letzte {config.verteilLookbackMonate ?? 6} Mon.)</span>
                <span
                  className="cursor-help inline-flex opacity-70 hover:opacity-100"
                  title={`Gelistet werden nur Anträge OHNE Bearbeiter-Kürzel (tib_kuerz) mit Antragsdatum aus den letzten ${config.verteilLookbackMonate ?? 6} Monaten (rollierend — gleitet über den Jahreswechsel). Bereits vergebene, ältere oder „abgelehnt/zurückgezogen"/„Irrläufer"-Anträge erscheinen nicht.`}
                  aria-label="Filter-Hinweis: nur unverteilte Anträge der letzten Monate"
                >
                  <Info size={11} aria-hidden />
                </span>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isInitialLoading && (
              <SkeletonRows count={8} columns={[80, 64, 180, 60, 24]} />
            )}
            {!isInitialLoading && sorted.map(row => {
              const isSel = selectedAz === row.leadAktenzeichen;
              const rowLead = antragByAz.get(row.leadAktenzeichen);
              const unvollstaendig = dxtecVerfuegbar && rowLead != null && istUnvollstaendig(rowLead);
              // 1.17: Primaer (gefuellt) vs Aspekte (outline) trennen.
              const primaerId = row.klassifizierung.freigegebenePrimaer;
              const aspektIds = row.klassifizierung.freigegebeneAspekte;
              const primaerKat = config.ueberKategorien.find(k => k.id === primaerId);
              const aspektKats = aspektIds
                .map(id => config.ueberKategorien.find(k => k.id === id))
                .filter((k): k is NonNullable<typeof k> => k != null);
              // Status ueber ALLE TVs des Verbundes aggregieren.
              const ze = zuweisungen.filter(z => row.tvAktenzeichen.includes(z.antragId));
              const zug = ze.some(z => z.status === 'freigegeben');
              // v2.18: an wen zugewiesen (freigegeben) — fuer die „zugewiesen an"-Anzeige.
              const assignedAnonIds = Array.from(new Set(
                ze.filter(z => z.status === 'freigegeben').map(z => z.anonId),
              ));
              // v2.9: distinct Interessenten (selbst-Zuweisungen) zaehlen.
              const interessentenCount = new Set(
                ze.filter(z => z.status === 'selbst' || z.selbstEingetragen).map(z => z.anonId),
              ).size;
              // Offene (noch nicht eingesammelte) Übernahme-Wünsche — abzüglich
              // bereits im Store erfasster anonIds (sonst Doppel-Signal nach Einsammeln).
              const storeWunschAnonIds = new Set(
                ze.filter(z => z.status === 'selbst' || z.selbstEingetragen || z.status === 'freigegeben').map(z => z.anonId),
              );
              const pendingAnonIds = Array.from(new Set(
                row.tvAktenzeichen.flatMap(az => pendingByAntrag.get(az) ?? []),
              )).filter(a => !storeWunschAnonIds.has(a));
              return (
                <div
                  key={row.verbundId}
                  onClick={() => setSelectedAz(row.leadAktenzeichen)}
                  className="px-3 py-2 cursor-pointer flex items-center gap-2"
                  style={{
                    background: isSel ? 'var(--tf-bg-secondary)' : 'transparent',
                    borderBottom: '0.5px solid var(--tf-border)',
                  }}
                >
                  {unvollstaendig && (
                    <span className="text-amber-600 shrink-0 inline-flex" title={UNVOLLSTAENDIG_TOOLTIP} aria-label={UNVOLLSTAENDIG_TOOLTIP}>
                      <AlertTriangle size={12} aria-hidden />
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-[var(--tf-text-secondary)] shrink-0">{row.leadAktenzeichen}</span>
                  <span
                    className="text-[10.5px] text-[var(--tf-text-tertiary)] tabular-nums shrink-0 w-[64px]"
                    title="Antragsdatum"
                  >
                    {formatAntragsdatum(row.antragsdatum)}
                  </span>
                  {row.akronym && (
                    <span className="text-[10.5px] px-1 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] shrink-0">{row.akronym}</span>
                  )}
                  <span className="flex-1 truncate text-[12px]" title={row.verbundTitel || undefined}>{row.verbundTitel || '—'}</span>
                  {row.tvCount > 1 && (
                    <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0" title={`${row.tvCount} Teilvorhaben`}>×{row.tvCount} TVs</span>
                  )}
                  <div className="flex gap-0.5">
                    {primaerKat && <KategoriePill key={primaerKat.id} kategorie={primaerKat} mode="primaer" />}
                    {aspektKats.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
                  </div>
                  {zug && (
                    <div className="flex items-center gap-1 shrink-0">
                      {assignedAnonIds.map(a => (
                        <AnonymIdBadge key={a} anonId={a} size="sm" realName={resolveName(a)} />
                      ))}
                      {confirmUnassignId === row.verbundId ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Zuweisung wirklich zurücknehmen"
                            disabled={unassignRowAction.busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmUnassignId(null);
                              void unassignRowAction.run(row);
                            }}
                            className="text-[10.5px] font-medium px-1.5 py-0.5 rounded cursor-pointer disabled:opacity-50"
                            style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}
                          >
                            Zurücknehmen
                          </button>
                          <button
                            type="button"
                            title="Abbrechen"
                            onClick={(e) => { e.stopPropagation(); setConfirmUnassignId(null); }}
                            className="text-[11px] text-[var(--tf-text-tertiary)] px-1 cursor-pointer"
                          >
                            ✗
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          title="Zuweisung zurücknehmen"
                          onClick={(e) => { e.stopPropagation(); setConfirmUnassignId(row.verbundId); }}
                          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer p-0.5 rounded"
                        >
                          <Undo2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                  {interessentenCount > 0 && !zug && (
                    <span
                      className="text-blue-700 text-[10.5px] font-medium shrink-0"
                      title={`${interessentenCount} Übernahme-Wunsch/Wünsche`}
                    >
                      {interessentenCount} will
                    </span>
                  )}
                  {pendingAnonIds.length > 0 && !zug && (
                    <span
                      className="text-amber-700 text-[10.5px] font-medium shrink-0"
                      title={`Vorgemerkt (noch nicht eingesammelt): ${pendingAnonIds.map(a => resolveName(a) ?? a).join(', ')}`}
                    >
                      ⚑ {pendingAnonIds.length} vorgemerkt
                    </span>
                  )}
                  <ConfidenceDot confidence={row.confidence} manuell={row.manuell} />
                </div>
              );
            })}
            {!isInitialLoading && sorted.length === 0 && (
              <div className="px-3 py-8 text-center text-[var(--tf-text-tertiary)] text-[12.5px]">
                Keine freigegebenen Verbünde in dieser Ansicht.
              </div>
            )}
          </div>
        </div>

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
              antrag={selected}
              akronym={selectedRow?.akronym ?? ''}
              verbundTitel={selectedRow?.verbundTitel ?? ''}
              klassifizierung={selectedView.klassifizierung}
              kategorien={config.ueberKategorien}
              matches={mergedMatches}
              matchingRunning={matchingRunning}
              zuweisungen={zuweisungen.filter(z => (selectedRow?.tvAktenzeichen ?? [selected.aktenzeichen]).includes(z.antragId))}
              mitarbeiter={mitarbeiter}
              pendingAnonIds={detailPendingAnonIds}
              unvollstaendig={dxtecVerfuegbar && istUnvollstaendig(selected)}
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

function DetailPanel({
  antrag, akronym, verbundTitel, klassifizierung, kategorien, matches, matchingRunning,
  zuweisungen, mitarbeiter, pendingAnonIds, unvollstaendig, tHints, restTVsByAnon,
  onZuweisen, onAblehnen, onAddManual, onRemoveManual, onUnassign, tageImQuartal,
}: {
  antrag: Antrag;
  /** Verbund-Akronym/-Titel (aus dem verbuende-Store aufgeloest, siehe
   *  resolveVerbundMeta) — konsistent mit der linken Liste. */
  akronym: string;
  verbundTitel: string;
  klassifizierung: import('../types').Klassifizierung;
  kategorien: import('../types').UeberKategorie[];
  matches: MatchResult[];
  matchingRunning: boolean;
  zuweisungen: Zuweisung[];
  mitarbeiter: Record<string, import('../types').AnonymerMitarbeiter>;
  /** anonIds mit offenem (noch nicht eingesammeltem) Übernahme-Wunsch für diesen Antrag. */
  pendingAnonIds: string[];
  /** v2.19: Antrag „nicht vollständig" (kein D_XTEC) → Warn-Markierung im Header. */
  unvollstaendig: boolean;
  /** v2.19: T_HINT-Bemerkungen über alle TVs des Verbundes (distinct, nicht-leer). */
  tHints: string[];
  /** v2.19: freie TVs pro aktivem MA — Kapazitäts-Hinweis im manuellen Picker. */
  restTVsByAnon: Map<string, number>;
  onZuweisen: (m: MatchResult) => void;
  onAblehnen: (m: MatchResult) => void;
  /** v2.19: aktiven MA manuell als Vorschlag hinzufügen. */
  onAddManual: (anonId: string) => void;
  /** v2.19: manuelle Card wieder entfernen (Ablehnen auf manueller Card). */
  onRemoveManual: (anonId: string) => void;
  /** Ruecknahme der Verbund-Freigabe (entfernt die freigegebene Zuweisung). */
  onUnassign: () => void;
  tageImQuartal: number;
}): React.ReactElement {
  const resolveName = useDeAnonResolver();
  const akt = akronym || (antrag[CANONICAL_AKRONYM] as string | undefined);
  const vbTitel = verbundTitel || (antrag[CANONICAL_VERBUND_TITEL] as string | undefined);
  const tvTitel = antrag[CANONICAL_TITEL] as string | undefined;
  const summary = antrag[FIELD_PROJEKTBESCHREIBUNG] as string | undefined;
  const verbund_id = antrag[CANONICAL_VERBUND_ID] as string | undefined;
  const desk = readAntragDeskriptoren(antrag);
  // 1.17: Primaer (gefuellt) + Aspekte (outline) trennen.
  const primaerKatId = klassifizierung.freigegebenePrimaer;
  const aspektKatIds = klassifizierung.freigegebeneAspekte;
  const primaerKategorie = kategorien.find(k => k.id === primaerKatId);
  const aspektKategorien = aspektKatIds
    .map(id => kategorien.find(k => k.id === id))
    .filter((k): k is NonNullable<typeof k> => k != null);
  // v2.9: ALLE Interessenten (selbst-Eintraege) — die PL waehlt einen aus.
  // Pro MA nur EIN Eintrag (frueheste Vormerkung, falls mehrere TVs), sortiert
  // nach Klick-Zeit aufsteigend → der zuerst Wollende steht oben.
  const klickTs = (z: Zuweisung): number => {
    const iso = z.selbstEingetragenAm ?? z.freigegebenAm; // Fallback fuer Pre-v2.9-Eintraege
    return iso ? Date.parse(iso) : Number.POSITIVE_INFINITY;
  };
  const interessenten = (() => {
    const byAnon = new Map<string, Zuweisung>();
    for (const z of zuweisungen) {
      if (z.status !== 'selbst' && !z.selbstEingetragen) continue;
      const prev = byAnon.get(z.anonId);
      if (!prev || klickTs(z) < klickTs(prev)) byAnon.set(z.anonId, z);
    }
    return Array.from(byAnon.values()).sort((a, b) => klickTs(a) - klickTs(b));
  })();
  // „Kein klares Match"-Hinweis nur über die echten Matcher-Treffer — manuelle
  // Cards (immer confidence 'low') sollen die Warnung nicht auslösen.
  const echteMatches = matches.filter(m => !m.manuell);
  const hasLow = echteMatches.length > 0 && echteMatches.every(m => m.confidence === 'low');

  // Redesign v2.26: der freigegebene Zustand steht oben als Streifen (statt der
  // alten „Aktuelle Zuweisungen"-Liste unten). assignVerbund setzt genau EINE
  // Freigabe pro Verbund → in der Praxis ein Eintrag.
  const freigegebeneZuweisung = zuweisungen.find(z => z.status === 'freigegeben');
  const assignedAnonIds = new Set(
    zuweisungen.filter(z => z.status === 'freigegeben').map(z => z.anonId),
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          {unvollstaendig && (
            <span className="text-amber-600 shrink-0 inline-flex" title={UNVOLLSTAENDIG_TOOLTIP} aria-label={UNVOLLSTAENDIG_TOOLTIP}>
              <AlertTriangle size={13} aria-hidden />
            </span>
          )}
          <span className="font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">{antrag.aktenzeichen}</span>
          {akt && <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">{akt}</span>}
          {verbund_id && <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">VB {verbund_id}</span>}
          <div className="ml-auto flex gap-1">
            {primaerKategorie && <KategoriePill key={primaerKategorie.id} kategorie={primaerKategorie} mode="primaer" />}
            {aspektKategorien.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
          </div>
        </div>
        <h2 className="text-[15px] leading-[1.4] font-medium text-[var(--tf-text)] [text-wrap:pretty] tracking-[-0.005em]">{vbTitel ?? '—'}</h2>
        {tvTitel && tvTitel !== vbTitel && (
          <p className="text-[12.5px] leading-[1.5] text-[var(--tf-text-tertiary)] mt-0.5 [text-wrap:pretty]">{tvTitel}</p>
        )}
      </div>

      {/* v2.26: Zuweisungs-Streifen ganz oben — nur wenn freigegeben. */}
      {freigegebeneZuweisung && (
        <ZuweisungStreifen
          anonId={freigegebeneZuweisung.anonId}
          realName={resolveName(freigegebeneZuweisung.anonId)}
          stunden={freigegebeneZuweisung.stunden}
          quartal={freigegebeneZuweisung.quartal}
          onUnassign={onUnassign}
        />
      )}

      {/* v2.9: offene Übernahme-Wünsche (noch nicht eingesammelt) — read-only,
          damit die PL den Antrag nicht versehentlich erneut zuweist. */}
      {pendingAnonIds.length > 0 && (
        <div className="rounded p-2.5 text-[12px]" style={{ background: '#fef3c7', color: '#92400e' }}>
          <div className="font-medium mb-1.5">
            ⚑ Vorgemerkt — noch nicht eingesammelt
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {pendingAnonIds.map(a => (
              <AnonymIdBadge key={a} anonId={a} size="sm" realName={resolveName(a)} />
            ))}
          </div>
          <p className="text-[10.5px] mt-1.5 opacity-90">
            Über »Übernahme-Wünsche einsammeln« formalisieren — danach erscheint der Antrag unter „Übernahme-Wunsch".
          </p>
        </div>
      )}

      {/* Übernahme-Wünsche: alle Interessenten, PL weist gezielt einem zu */}
      {interessenten.length > 0 && (
        <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-info-soft, #dbeafe)', color: '#075985' }}>
          <div className="font-medium mb-1.5">
            {interessenten.length === 1
              ? 'Übernahme-Wunsch'
              : `${interessenten.length} Übernahme-Wünsche`}
          </div>
          <ul className="flex flex-col gap-1">
            {interessenten.map((z, i) => {
              const ts = formatKlickZeit(z.selbstEingetragenAm ?? z.freigegebenAm);
              return (
              <li key={z.anonId} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <AnonymIdBadge anonId={z.anonId} size="sm" realName={resolveName(z.anonId)} />
                  {ts && (
                    <span className="text-[10.5px] opacity-75 shrink-0" title="Zeitpunkt des Klicks auf den Übernahme-Button">
                      {i === 0 && interessenten.length > 1 ? `zuerst · ${ts}` : ts}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const m: MatchResult = {
                      anonId: z.anonId,
                      bm25Score: 1, embeddingScore: 0, kompetenzScore: 1, restKapazitaet: 0,
                      quartalsKapazitaet: 0, balanceScore: 0, finalScore: 1,
                      matchendeTechnologien: [], aehnlicheProjekte: [],
                      matchStufe: 1, confidence: 'high',
                      benoetigteStunden: z.stunden,
                      astMatchCount: 0, astBoost: 0,
                    };
                    onZuweisen(m);
                  }}
                  className="text-[11.5px] px-2 py-0.5 rounded cursor-pointer font-medium shrink-0"
                  style={{ background: '#075985', color: 'white' }}
                >
                  Zuweisen
                </button>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Body */}
      {desk.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Deskriptoren</div>
          <TechnologieTags tags={desk} />
        </div>
      )}
      {summary && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Zusammenfassung</div>
          <p className="text-[12px] text-[var(--tf-text-secondary)] line-clamp-5">{summary}</p>
        </div>
      )}
      {/* v2.19: Bemerkung (T_HINT) — verbund-weit, nur wenn befuellt. */}
      {tHints.length > 0 && (
        <div className="rounded p-2.5" style={{ background: 'var(--tf-bg-secondary)' }}>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Bemerkung</div>
          {tHints.map((t, i) => (
            <p key={i} className="text-[12px] text-[var(--tf-text-secondary)] whitespace-pre-wrap">{t}</p>
          ))}
        </div>
      )}

      {/* Match-Vorschlaege */}
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Vorschläge</span>
          <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">{matches.length} · sortiert nach Passung</span>
          <span className="flex-1 h-[0.5px]" style={{ background: 'var(--tf-border)' }} />
          {matchingRunning && <span className="text-[11px] text-[var(--tf-text-tertiary)]">Berechne…</span>}
          <ManuellerMaPicker
            mitarbeiter={mitarbeiter}
            excludeAnonIds={new Set(matches.map(m => m.anonId))}
            resolveName={resolveName}
            restTVsByAnon={restTVsByAnon}
            onAdd={onAddManual}
          />
        </div>
        {hasLow && (
          <div className="mb-2 rounded p-2 text-[11.5px]" style={{ background: '#fef3c7', color: '#92400e' }}>
            ⚠ Kein klares Match — manuelle Prüfung empfohlen.
          </div>
        )}
        {matches.length > 0 ? (
          <div className="rounded-[10px] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
            {matches.map(m => (
              <VorschlagRow
                key={m.anonId}
                match={m}
                isAssigned={assignedAnonIds.has(m.anonId)}
                antragstyp={getKategorieLabel((antrag as Record<string, unknown>).vb_phase)}
                onZuweisen={() => onZuweisen(m)}
                onAblehnen={() => (m.manuell ? onRemoveManual(m.anonId) : onAblehnen(m))}
                tageImQuartal={tageImQuartal}
              />
            ))}
          </div>
        ) : (
          !matchingRunning && (
            <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">
              Keine passenden MAs gefunden — möglicherweise keine MAs in den Kategorien, alle abgemeldet oder Kapazität voll.
            </p>
          )
        )}
      </div>
    </div>
  );
}

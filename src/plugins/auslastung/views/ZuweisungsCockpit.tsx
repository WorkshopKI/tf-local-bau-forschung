// TODO(refactor v2.4+): 525 Zeilen — opportunistisch splitten, wenn diese Datei naechstes Mal angefasst wird.
// Vorschlag: AssignmentTable.tsx + AssignmentFilters.tsx + PaginationControls.tsx als Sub-Komponenten.
/**
 * Screen 1b — Zuweisungs-Cockpit.
 *
 * 50/50 Split:
 *  - Links: Antragsliste mit Filter-Pills (Quartal/Kategorie/Status)
 *  - Rechts: Detail + Top-3 VorschlagCards (Matching-Engine live)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  getUserFoldersRootHandle,
  pickAndStoreUserFoldersRootHandle,
} from '@/core/services/infrastructure/smb-handle';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useKlassifizierungenView } from '../hooks/useKlassifizierungen';
import { runMatching } from '../services/matching-engine';
import { collectUebernahmeWuensche } from '../services/uebernahme-einsammeln';
import { useAuslastungReady } from '../hooks/useAuslastungReady';
import { useAuslastungIndex } from '../hooks/useAuslastungIndex';
import { SkeletonRows } from '../components/Skeleton';
import { getTVCount } from '../services/quartals-auslastung';
import { groupFreigegebeneByVerbund } from '../services/verbund-aggregation';
import {
  buildAntraegeIndexForMatching,
} from '../services/embedding-matcher';
import {
  loadAllEmbeddings,
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
  type AntragstypBucket,
  type MatchResult,
  type Zuweisung,
} from '../types';
import { KategoriePill } from '../components/KategoriePill';
import { ConfidenceDot } from '../components/ConfidenceDot';
import { TechnologieTags } from '../components/TechnologieTags';
import { VorschlagCard } from '../components/VorschlagCard';
import { tageImQuartal as computeTageImQuartal } from '../services/kapazitaet';
import { AnonymIdBadge, useDeAnonResolver } from '../components/AnonymIdBadge';
import { readAntragDeskriptoren } from '../services/profil-aggregator';
import { exportAnonymousXlsx, exportDeAnonymizedXlsx } from '../services/export-service';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';
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
  const applyUebernahmeWuensche = useAuslastungData(s => s.applyUebernahmeWuensche);

  const cache = useAntraegeCache();
  const { ready } = useAuslastungReady();
  const isInitialLoading = !ready;
  const view = useKlassifizierungenView(cache.antraege, config.ueberKategorien, klassifizierungen);

  const [kategorieFilter, setKategorieFilter] = useState<string>('');
  const [antragstypFilter, setAntragstypFilter] = useState<AntragstypBucket | ''>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('offen');
  const [selectedAz, setSelectedAz] = useState<string | null>(null);

  // Resizable Split: Breite der linken Liste in %. Ref haelt den Live-Wert
  // waehrend des Ziehens, damit pointerup/keydown ohne Stale-Closure persisten.
  const [leftPct, setLeftPct] = useState<number>(() => readSplitPct());
  const leftPctRef = useRef(leftPct);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchingRunning, setMatchingRunning] = useState(false);
  const [einsammelnMsg, setEinsammelnMsg] = useState<string | null>(null);

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
    const { neu, entfernt } = await applyUebernahmeWuensche(storage, batch, cache.anonymMap);
    setEinsammelnMsg(
      `${total} Wunsch/Wünsche gelesen · ${neu} neu · ${entfernt} zurückgezogen`,
    );
  });

  const data = useAuslastungData(s => s.data);

  function exportAnonym(): void {
    exportAnonymousXlsx({ data, antraege: cache.antraege, verbuendeById: cache.verbuendeById });
  }

  function exportMitKuerzeln(): void {
    exportDeAnonymizedXlsx({
      data,
      antraege: cache.antraege,
      anonymMap: cache.anonymMap,
      verbuendeById: cache.verbuendeById,
    });
  }

  // v2.9: gemeinsamer Provider-Memo statt eigener Berechnung. Wird in die
  // Matching-Engine durchgereicht, damit fest+pending in den Score
  // einfliessen (statt nur Store-Zuweisungen).
  const { auslastungByAnon } = useAuslastungIndex();

  // Nur freigegebene Klassifizierungen sind hier sichtbar (Phase 1 muss durch).
  const freigegebene = useMemo(() => {
    return view.filter(v => v.klassifizierung.status === 'freigegeben');
  }, [view]);

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

  // Wenn Selektion durch Filter wegfaellt — auf den Lead-TV des ersten Verbundes.
  useEffect(() => {
    if (selectedAz && !filtered.some(r => r.leadAktenzeichen === selectedAz)) {
      setSelectedAz(filtered[0]?.leadAktenzeichen ?? null);
    } else if (!selectedAz && filtered.length > 0) {
      setSelectedAz(filtered[0]!.leadAktenzeichen);
    }
  }, [filtered, selectedAz]);

  // Matching-Engine fuer selektierten Antrag
  useEffect(() => {
    if (!selected || !selectedView) {
      setMatches([]);
      return;
    }
    void (async () => {
      setMatchingRunning(true);
      try {
        // 1.17: primaer + aspekte aus den freigegebenen Feldern.
        const k = selectedView.klassifizierung;
        const primaerKategorie = k.freigegebenePrimaer;
        const aspekte = k.freigegebeneAspekte;
        let queryEmbedding: number[] | undefined;
        let corpusEmbeddings: Map<string, number[]> | undefined;
        let antraegeIndex: ReturnType<typeof buildAntraegeIndexForMatching> | undefined;
        if (config.stage2Aktiv) {
          await ensureEmbeddingReady(storage.idb);
          const text = [
            selected[CANONICAL_VERBUND_TITEL],
            selected[CANONICAL_TITEL],
            selected[FIELD_PROJEKTBESCHREIBUNG],
          ].filter(s => typeof s === 'string').join(' ');
          queryEmbedding = await embedText(text, 'query');
          corpusEmbeddings = await loadAllEmbeddings(storage.idb);
          antraegeIndex = buildAntraegeIndexForMatching(cache.antraege);
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
          anonymMap: cache.anonymMap,
          queryEmbedding,
          corpusEmbeddings,
          antraegeIndex,
          anzahlTV: tvCount,
          auslastungByAnon,
        });
        setMatches(result);
      } finally {
        setMatchingRunning(false);
      }
    })();
  }, [selectedAz, selected, selectedView, config, mitarbeiter, zuweisungen, cache.antraege, cache.historischeDeskriptorenByAnon, cache.anonymMap, storage, auslastungByAnon]);

  async function zuweisen(match: MatchResult): Promise<void> {
    if (!selected) return;
    // v2.4: PL-Freigabe bucht echte tvCount-Stunden + setzt anzahlTV im
    // Zuweisungs-Record, damit die Buchung mit der CSV konsistent ist.
    const verbundId = (selected as { verbund_id?: string }).verbund_id;
    const tvCount = getTVCount(cache.antraege, verbundId, selected.aktenzeichen);
    const z: Zuweisung = {
      antragId: selected.aktenzeichen,
      anonId: match.anonId,
      quartal: config.aktuellesQuartal,
      stunden: match.benoetigteStunden,
      anzahlTV: tvCount,
      status: 'freigegeben',
      freigegebenAm: new Date().toISOString(),
    };
    await upsertZuweisung(storage, z);
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
          <button
            type="button"
            onClick={exportAnonym}
            className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Export (anonym)
          </button>
          <button
            type="button"
            onClick={exportMitKuerzeln}
            className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            Export (mit Kürzeln)
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
      </div>

      {/* Split — resizable: linke Liste per Ziehgriff breiter ziehbar (lange VB-Titel lesen) */}
      <div ref={containerRef} className="flex min-h-[600px]">
        {/* Links: Liste */}
        <div
          className="rounded-[12px] overflow-hidden flex flex-col min-w-0"
          style={{ width: `${leftPct}%`, border: '0.5px solid var(--tf-border)' }}
        >
          <div className="px-3 py-2 text-[11.5px] text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            {isInitialLoading ? '…' : `${filtered.length} Verbund${filtered.length !== 1 ? 'e' : ''}`}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isInitialLoading && (
              <SkeletonRows count={8} columns={[80, 220, 60, 24]} />
            )}
            {!isInitialLoading && filtered.map(row => {
              const isSel = selectedAz === row.leadAktenzeichen;
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
              // v2.9: distinct Interessenten (selbst-Zuweisungen) zaehlen.
              const interessentenCount = new Set(
                ze.filter(z => z.status === 'selbst' || z.selbstEingetragen).map(z => z.anonId),
              ).size;
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
                  <span className="font-mono text-[11px] text-[var(--tf-text-secondary)] shrink-0">{row.leadAktenzeichen}</span>
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
                  {zug && <span className="text-emerald-700 text-[11px]" title="zugewiesen">✓✓</span>}
                  {interessentenCount > 0 && !zug && (
                    <span
                      className="text-blue-700 text-[10.5px] font-medium shrink-0"
                      title={`${interessentenCount} Übernahme-Wunsch/Wünsche`}
                    >
                      {interessentenCount} will
                    </span>
                  )}
                  <ConfidenceDot confidence={row.confidence} />
                </div>
              );
            })}
            {!isInitialLoading && filtered.length === 0 && (
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
              matches={matches}
              matchingRunning={matchingRunning}
              zuweisungen={zuweisungen.filter(z => (selectedRow?.tvAktenzeichen ?? [selected.aktenzeichen]).includes(z.antragId))}
              mitarbeiter={mitarbeiter}
              onZuweisen={zuweisen}
              onAblehnen={ablehnen}
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
  zuweisungen, mitarbeiter, onZuweisen, onAblehnen, tageImQuartal,
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
  onZuweisen: (m: MatchResult) => void;
  onAblehnen: (m: MatchResult) => void;
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
  const hasLow = matches.length > 0 && matches.every(m => m.confidence === 'low');

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">{antrag.aktenzeichen}</span>
          {akt && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{akt}</span>}
          {verbund_id && <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">VB {verbund_id}</span>}
          <div className="ml-auto flex gap-1">
            {primaerKategorie && <KategoriePill key={primaerKategorie.id} kategorie={primaerKategorie} mode="primaer" />}
            {aspektKategorien.map(k => <KategoriePill key={k.id} kategorie={k} mode="aspekt" />)}
          </div>
        </div>
        <h2 className="text-[14px] font-medium text-[var(--tf-text)]">{vbTitel ?? '—'}</h2>
        {tvTitel && tvTitel !== vbTitel && (
          <p className="text-[12px] text-[var(--tf-text-secondary)] mt-0.5">{tvTitel}</p>
        )}
      </div>

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

      {/* Match-Vorschlaege */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">Vorschläge (Top {matches.length})</h3>
          {matchingRunning && <span className="text-[11px] text-[var(--tf-text-tertiary)]">Berechne…</span>}
        </div>
        {hasLow && (
          <div className="mb-2 rounded p-2 text-[11.5px]" style={{ background: '#fef3c7', color: '#92400e' }}>
            ⚠ Kein klares Match — manuelle Prüfung empfohlen.
          </div>
        )}
        <div className="flex flex-col gap-2">
          {matches.map(m => (
            <VorschlagCard
              key={m.anonId}
              match={m}
              onZuweisen={() => onZuweisen(m)}
              onAblehnen={() => onAblehnen(m)}
              tageImQuartal={tageImQuartal}
            />
          ))}
          {matches.length === 0 && !matchingRunning && (
            <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-4">
              Keine passenden MAs gefunden — möglicherweise keine MAs in den Kategorien, alle abgemeldet oder Kapazität voll.
            </p>
          )}
        </div>
      </div>

      {/* Aktuelle Zuweisungen */}
      {zuweisungen.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Zuweisungen</div>
          <ul className="text-[11.5px] space-y-0.5">
            {zuweisungen.map(z => {
              const ma = mitarbeiter[z.anonId];
              return (
                <li key={`${z.antragId} ${z.anonId}`} className="flex items-center gap-2">
                  <AnonymIdBadge anonId={z.anonId} size="sm" realName={resolveName(z.anonId)} />
                  <span className="text-[var(--tf-text-secondary)]">{z.status}</span>
                  <span className="text-[var(--tf-text-tertiary)]">· {z.stunden}h</span>
                  {ma && <span className="text-[var(--tf-text-tertiary)]">· Q {z.quartal}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

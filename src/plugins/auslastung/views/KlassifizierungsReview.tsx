/**
 * Screen 1a — Klassifizierungs-Review (pro Verbund).
 *
 * Die Klassifizierung erfolgt fachlich pro Verbund — alle TVs eines Verbundes
 * haben dieselben Kategorien und gehen an denselben Bearbeiter. Die UI gruppiert
 * TVs unter einem Verbund-Header; Pill-Toggle + Freigeben wirken verbund-weit
 * (alle TV-`Klassifizierung`-Records werden synchron upgesertet). Stage 2 nutzt
 * das Verbund-Titel-Embedding (siehe `verbund-embedding.ts`).
 *
 * Filter-Pills: Alle / Review nötig / Bereits freigegeben — Counts auf
 * Verbund-Ebene.
 * Pool-Filter: aktuelles Jahr, ohne TiB, ohne abgelehnt/zurückgezogen/Irrläufer
 * (TV-Ebene; ein Verbund erscheint wenn mindestens ein TV im Pool).
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  ColumnPicker,
  useColumnVisibility,
  useColumnWidths,
  useTableSort,
} from '@/components/data-table';
import { useAuslastungData, buildFreigegebenRecord } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useAuslastungReady } from '../hooks/useAuslastungReady';
import {
  buildVerbundClassificationViews,
  type VerbundKlassifizierungsView,
} from '../services/verbund-aggregation';
import {
  getCachedVerbundEmbeddings,
  loadAllVerbundEmbeddings,
} from '../services/verbund-embedding';
import { type Klassifizierung } from '../types';
import { buildVerbundColumns } from './verbund-columns';
import { VerbundClassificationTable } from './VerbundClassificationTable';
import { LLMKlassifizierungButtons } from '../components/LLMKlassifizierungButtons';
import { SkeletonRows } from '../components/Skeleton';

/** Helper: zeigt „…" waehrend Loading, sonst die Zahl. */
function fmtCount(value: number, loading: boolean): string {
  return loading ? '…' : String(value);
}

type ViewFilter = 'alle' | 'review' | 'llm' | 'freigegeben';

/** Verbund mit offenem (= noch nicht freigegebenem) LLM-Vorschlag. */
function istLlmVorschlag(v: VerbundKlassifizierungsView): boolean {
  return v.klassifizierung.status !== 'freigegeben'
    && v.klassifizierung.vorgeschlagenePrimaer?.methode === 'llm';
}

const COLUMN_VISIBILITY_STORAGE_KEY = 'teamflow_auslastung_klassifizierung_verbund_columns';
const COLUMN_WIDTHS_STORAGE_KEY = 'teamflow_auslastung_klassifizierung_verbund_column_widths';

/** Dauer, die eine frisch freigegebene Zeile im „Review nötig"-Filter mit
 *  Flash sichtbar bleibt, bevor sie ausgeblendet wird. Muss zur Keyframe-Dauer
 *  `freigabe-flash` in theme.css passen. */
const FREIGABE_FLASH_MS = 1400;

function jahrAusQuartal(quartal: string): number | null {
  const m = /^(\d{4})-Q[1-4]$/.exec(quartal);
  return m ? Number(m[1]) : null;
}

export function KlassifizierungsReview(): React.ReactElement {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const upsertLocal = useAuslastungData(s => s.upsertKlassifizierungenLocal);
  const schedulePersist = useAuslastungData(s => s.schedulePersist);
  const flushPersist = useAuslastungData(s => s.flushPersist);
  const freigebenBulk = useAuslastungData(s => s.freigebenKategorienBulk);

  const cache = useAntraegeCache();
  const { ready } = useAuslastungReady();
  const isInitialLoading = !ready;
  const aktuellesJahr = useMemo(
    () => jahrAusQuartal(config.aktuellesQuartal),
    [config.aktuellesQuartal],
  );

  // Verbund-Embeddings (Themen-Vektoren) — separater IDB-Storage neben den
  // Antrag-Embeddings. Wird seit Mai 2026 immer geladen (kein User-Toggle mehr),
  // ein leerer Korpus führt einfach zu leeren Vorschlägen — der Bootstrap-
  // Banner unten weist darauf hin.
  //
  // Initializer-Funktion liest den modul-globalen Cache aus verbund-embedding.ts
  // synchron — beim Re-Mount ist die Map damit schon im ersten Render verfuegbar.
  // useEffect bleibt fuer den Initial-Async-Load (App-Cold-Start, Cache leer);
  // wenn der Pre-Load aus `useAntraegeCache.refresh` (Hebel D) den Cache schon
  // gefuellt hat, ist auch das erste Mount synchron.
  const [verbundEmbeddings, setVerbundEmbeddings] = useState<Map<string, number[]> | null>(
    () => getCachedVerbundEmbeddings(storage.idb),
  );
  const [embeddingsLoading, setEmbeddingsLoading] = useState(verbundEmbeddings === null);
  useEffect(() => {
    if (verbundEmbeddings !== null) return;
    let cancelled = false;
    setEmbeddingsLoading(true);
    void loadAllVerbundEmbeddings(storage.idb)
      .then(map => { if (!cancelled) setVerbundEmbeddings(map); })
      .catch(err => { console.warn('[KlassifizierungsReview] Verbund-Embedding-Load fehlgeschlagen:', err); })
      .finally(() => { if (!cancelled) setEmbeddingsLoading(false); });
    return () => { cancelled = true; };
    // verbundEmbeddings darf NICHT in der Dep-Liste stehen — sonst feuert der
    // Effekt nochmal nach erfolgreichem setState. Die Guard oben reicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage.idb]);

  // Unmount/Plugin-Wechsel: einen noch ausstehenden Debounce-Write (Pill-Toggle)
  // sofort schreiben, damit kein Edit verloren geht. flushPersist ist No-op,
  // wenn nichts aussteht.
  useEffect(() => {
    return () => { void flushPersist(storage); };
    // Nur beim Unmount feuern; storage/flushPersist sind ref-stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v2.10: Stage-2-Embedding-Matching ist teuer (~690 ms bei 138 Verbuenden).
  // useDeferredValue verschiebt den Recompute mit Stage-2 in einen Background-
  // Render, sobald die Embeddings da sind — der initiale Mount (ohne Stage-2)
  // bleibt unblockiert und die Tabelle erscheint sofort. React tauscht die
  // Tabelle dann im naechsten idle Frame durch die Stage-2-Variante aus.
  const deferredEmbeddings = useDeferredValue(verbundEmbeddings);

  const hasCentroids = useMemo(
    () => config.ueberKategorien.some(k => Array.isArray(k.referenzEmbedding) && k.referenzEmbedding.length > 0),
    [config.ueberKategorien],
  );

  // Verbund-Aggregation. Pool-Filterung + verbuende-Lookup passieren intern
  // im Service — wir uebergeben Store-Refs (cache.antraege, cache.verbuende),
  // damit der Modul-globale Closure-Cache in verbund-aggregation.ts ueber
  // Re-Mounts hinweg greifen kann (~690 ms Stage-2-Recompute gespart).
  const verbundViews = useMemo(
    () => buildVerbundClassificationViews(
      cache.antraege,
      aktuellesJahr,
      config.ueberKategorien,
      klassifizierungen,
      deferredEmbeddings ?? undefined,
      config.stage2Aktiv === true,
      cache.verbuende,
    ),
    [cache.antraege, aktuellesJahr, config.ueberKategorien, klassifizierungen, deferredEmbeddings, config.stage2Aktiv, cache.verbuende],
  );

  const [filter, setFilter] = useState<ViewFilter>('alle');

  // Freigabe-Grace-Period: nach „Freigeben" wechselt der Verbund auf Status
  // 'freigegeben' und faellt aus dem „Review nötig"-Filter. Statt sofort zu
  // verschwinden bleibt die Zeile FREIGABE_FLASH_MS mit gruenem Flash stehen
  // (Erfolgs-Feedback), dann wird sie entfernt.
  const [justFreigegeben, setJustFreigegeben] = useState<Set<string>>(() => new Set());
  const freigabeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = freigabeTimers.current;
    return () => { for (const t of timers.values()) clearTimeout(t); };
  }, []);

  const counts = useMemo(() => {
    let neu = 0, freig = 0, review = 0, llm = 0;
    for (const v of verbundViews) {
      if (v.klassifizierung.status === 'freigegeben') { freig++; continue; }
      // LLM-Vorschlag ist eine Teilmenge der hohen Confidences (neu) — eigener
      // Zaehler fuer den LLM-Filter-Tab, neu bleibt die Bulk-Freigabe-Basis.
      if (istLlmVorschlag(v)) llm++;
      if (v.confidence === 'high') neu++;
      else review++;
    }
    return { neu, freig, review, llm, total: verbundViews.length };
  }, [verbundViews]);

  const filtered = useMemo(() => {
    return verbundViews.filter(v => {
      if (filter === 'freigegeben') return v.klassifizierung.status === 'freigegeben';
      if (filter === 'review') {
        // Frisch freigegeben → noch in der Flash-Grace-Period sichtbar lassen.
        if (justFreigegeben.has(v.verbundId)) return true;
        return v.klassifizierung.status !== 'freigegeben' && v.confidence !== 'high';
      }
      if (filter === 'llm') {
        if (justFreigegeben.has(v.verbundId)) return true;
        return istLlmVorschlag(v);
      }
      return true;
    });
  }, [verbundViews, filter, justFreigegeben]);

  // Sammelt die Freigabe-Entries fuer alle TVs eines Verbundes (gleiche
  // Kategorien fuer alle TVs). Leeres Array, wenn kein Primaer-Vorschlag.
  function collectVerbundFreigaben(
    view: VerbundKlassifizierungsView,
  ): { antragId: string; kategorieIds: string[] }[] {
    const primaer = view.klassifizierung.vorgeschlagenePrimaer;
    if (!primaer) return [];
    const ids = [primaer.kategorieId, ...view.klassifizierung.vorgeschlageneAspekte.map(a => a.kategorieId)];
    return view.tvs.map(tv => ({ antragId: tv.aktenzeichen, kategorieIds: ids }));
  }

  // Persistenz-Wrapper: Verbund-Aktion wirkt auf alle TVs — EIN persist
  // statt einem pro TV (Pitfall #16/#20). Danach Grace-Period starten, damit
  // die Zeile im „Review nötig"-Filter nicht sofort verschwindet.
  async function freigebeVerbund(view: VerbundKlassifizierungsView): Promise<void> {
    await freigebenBulk(storage, collectVerbundFreigaben(view));
    const id = view.verbundId;
    setJustFreigegeben(prev => new Set(prev).add(id));
    const existing = freigabeTimers.current.get(id);
    if (existing) clearTimeout(existing);
    freigabeTimers.current.set(id, setTimeout(() => {
      setJustFreigegeben(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      freigabeTimers.current.delete(id);
    }, FREIGABE_FLASH_MS));
  }

  // Pill-Toggle: optimistisch (ein setState) + debounced persist. Wirkt auf
  // alle TVs eines Verbundes. Kein await pro TV mehr (Pitfall #16/#20), kein
  // synchroner Recompute-Stau (Fix A cacht die Live-Klassifizierungen).
  function applyVerbundOverride(
    view: VerbundKlassifizierungsView,
    kategorieId: string,
    add: boolean,
  ): void {
    const istFreigegeben = view.klassifizierung.status === 'freigegeben';
    const currentIds = istFreigegeben
      ? [view.klassifizierung.freigegebenePrimaer, ...view.klassifizierung.freigegebeneAspekte].filter(Boolean)
      : (view.klassifizierung.vorgeschlagenePrimaer
          ? [view.klassifizierung.vorgeschlagenePrimaer.kategorieId, ...view.klassifizierung.vorgeschlageneAspekte.map(a => a.kategorieId)]
          : []);
    const current = new Set(currentIds);
    if (add) {
      if (current.size >= 2 && !current.has(kategorieId)) return;
      current.add(kategorieId);
    } else {
      current.delete(kategorieId);
    }
    const ids = [...current];
    const records: Klassifizierung[] = view.tvs.map(tv => {
      if (istFreigegeben) {
        const existing = klassifizierungen.find(k => k.antragId === tv.aktenzeichen);
        return buildFreigegebenRecord(existing, tv.aktenzeichen, ids);
      }
      const [primaerId, ...aspektIds] = ids;
      return {
        antragId: tv.aktenzeichen,
        status: 'vorgeschlagen',
        vorgeschlagenePrimaer: primaerId
          ? { kategorieId: primaerId, confidence: 1.0, methode: 'regel' }
          : null,
        vorgeschlageneAspekte: aspektIds.map(id => ({ kategorieId: id, confidence: 1.0 })),
        freigegebenePrimaer: '',
        freigegebeneAspekte: [],
      };
    });
    upsertLocal(records);
    schedulePersist(storage);
  }

  async function bulkFreigeben(): Promise<void> {
    const candidates = verbundViews.filter(v =>
      v.klassifizierung.status !== 'freigegeben'
      && v.confidence === 'high'
      && v.klassifizierung.vorgeschlagenePrimaer !== null
    );
    if (candidates.length === 0) return;
    if (!confirm(`${candidates.length} Verbünde mit hoher Sicherheit freigeben?`)) return;
    // Alle TVs aller Kandidaten in EINEM persist statt N SMB-Roundtrips
    // (Pitfall #16/#20): vorher ~2 s/Verbund (40 Verbuende = 80 s), jetzt ~2 s.
    const entries = candidates.flatMap(collectVerbundFreigaben);
    await freigebenBulk(storage, entries);
  }

  // Spalten + Hooks
  const allColumns = useMemo(
    () => buildVerbundColumns({
      kategorien: config.ueberKategorien,
      onToggleVerbund: (v, id, add) => applyVerbundOverride(v, id, add),
      onFreigebeVerbund: v => void freigebeVerbund(v),
    }),
    // applyVerbundOverride + freigebeVerbund sind Closures über Hook-State,
    // ueberKategorien ist der relevante Re-Build-Trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.ueberKategorien],
  );

  const { visibleKeys, toggleColumn } = useColumnVisibility(
    COLUMN_VISIBILITY_STORAGE_KEY,
    allColumns,
  );

  const visibleColumns = useMemo(
    () => allColumns.filter(c => visibleKeys.includes(c.key)),
    [allColumns, visibleKeys],
  );

  const defaultWidths = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of allColumns) {
      if (typeof c.width === 'number') out[c.key] = c.width;
    }
    return out;
  }, [allColumns]);

  const { widths: columnWidths, setWidth } = useColumnWidths(
    COLUMN_WIDTHS_STORAGE_KEY,
    defaultWidths,
  );

  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(
    filtered,
    allColumns,
    'akronym',
    'asc',
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Pool-Hint */}
      {aktuellesJahr !== null && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)]">
          Verteil-Pool: Verbünde aus {aktuellesJahr} ohne TiB-Zuweisung, ohne Status
          „abgelehnt/zurückgezogen" und „Irrläufer". Klassifizierung wirkt auf alle TVs eines Verbundes.
        </div>
      )}

      {/* Themen-Modell-Status */}
      {!hasCentroids && (
        <div
          className="text-[11.5px] px-3 py-2 rounded"
          style={{
            background: 'var(--tf-info-soft, #fef3c7)',
            color: 'var(--tf-text)',
            border: '0.5px solid var(--tf-border)',
          }}
        >
          <strong>Kategorie-Referenzen fehlen.</strong>{' '}
          Bootstrap für die automatische Themen-Erkennung: einige Verbünde
          manuell pro Kategorie freigeben, danach im Admin „Inkrementell"
          laufen lassen — die Themen-Vektoren werden dann pro Kategorie
          gemittelt und Vorschläge greifen automatisch.
        </div>
      )}
      {hasCentroids && embeddingsLoading && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)]">
          Themen-Vektoren werden geladen …
        </div>
      )}

      {/* 1.17: LLM-Klassifizierung */}
      <div
        className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-[var(--tf-radius)]"
        style={{ background: 'var(--tf-bg-secondary)', border: '0.5px solid var(--tf-border)' }}
      >
        <span className="text-[11.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
          LLM-Klassifizierung
        </span>
        <LLMKlassifizierungButtons
          verbundViews={verbundViews}
          kategorien={config.ueberKategorien}
          isLoading={isInitialLoading}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['alle', 'review', 'llm', 'freigegeben'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-[11.5px] px-3 py-1 rounded-full cursor-pointer transition-colors ${
                filter === f ? 'opacity-100' : 'opacity-60 hover:opacity-90'
              }`}
              style={{
                background: filter === f ? 'var(--tf-text)' : 'transparent',
                color: filter === f ? 'var(--tf-bg)' : 'var(--tf-text-secondary)',
                border: '0.5px solid var(--tf-border)',
              }}
            >
              {f === 'alle' && `Alle (${fmtCount(counts.total, isInitialLoading)})`}
              {f === 'review' && `Review nötig (${fmtCount(counts.review, isInitialLoading)})`}
              {f === 'llm' && `LLM-Vorschlag (${fmtCount(counts.llm, isInitialLoading)})`}
              {f === 'freigegeben' && `Freigegeben (${fmtCount(counts.freig, isInitialLoading)})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            {fmtCount(counts.total, isInitialLoading)} Verbünde · {fmtCount(counts.freig, isInitialLoading)} freigegeben · {fmtCount(counts.review, isInitialLoading)} prüfen
          </span>
          <button
            type="button"
            disabled={isInitialLoading || counts.neu === 0}
            onClick={() => void bulkFreigeben()}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            Alle hohen Confidences freigeben ({fmtCount(counts.neu, isInitialLoading)})
          </button>
          <ColumnPicker
            columns={allColumns}
            visibleKeys={visibleKeys}
            onToggleColumn={toggleColumn}
          />
        </div>
      </div>

      <VerbundClassificationTable
        rows={sortedRows}
        columns={visibleColumns}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        columnWidths={columnWidths}
        onColumnWidthChange={setWidth}
        highlightRowIds={justFreigegeben}
        emptyContent={
          isInitialLoading
            ? <SkeletonRows count={6} columns={[70, 80, 240, 140, 80, 70, 70]} />
            : 'Keine Verbünde in dieser Ansicht.'
        }
      />
    </div>
  );
}

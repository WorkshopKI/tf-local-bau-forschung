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
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  ColumnPicker,
  useColumnVisibility,
  useColumnWidths,
  useTableSort,
} from '@/components/data-table';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { normalizeKuerzel } from '../services/anonym-map';
import {
  buildVerbundClassificationViews,
  type VerbundKlassifizierungsView,
} from '../services/verbund-aggregation';
import { loadAllVerbundEmbeddings } from '../services/verbund-embedding';
import type { Antrag } from '@/core/services/csv/types';
import {
  CANONICAL_TIB_KUERZ,
  CANONICAL_ANTRAGSDATUM,
  type Klassifizierung,
} from '../types';
import { buildVerbundColumns } from './verbund-columns';
import { VerbundClassificationTable } from './VerbundClassificationTable';
import { LLMKlassifizierungButtons } from '../components/LLMKlassifizierungButtons';

type ViewFilter = 'alle' | 'review' | 'freigegeben';

const COLUMN_VISIBILITY_STORAGE_KEY = 'teamflow_auslastung_klassifizierung_verbund_columns';
const COLUMN_WIDTHS_STORAGE_KEY = 'teamflow_auslastung_klassifizierung_verbund_column_widths';

const EXCLUDED_STATUS = new Set(['abgelehnt/zurückgezogen', 'irrläufer']);

function jahrAusQuartal(quartal: string): number | null {
  const m = /^(\d{4})-Q[1-4]$/.exec(quartal);
  return m ? Number(m[1]) : null;
}

function istZuVerteilen(antrag: Antrag, jahr: number): boolean {
  const datum = antrag[CANONICAL_ANTRAGSDATUM];
  if (typeof datum !== 'string' || !datum.startsWith(`${jahr}-`)) return false;
  if (normalizeKuerzel(antrag[CANONICAL_TIB_KUERZ]) !== null) return false;
  const status = typeof antrag.status === 'string' ? antrag.status.trim().toLowerCase() : '';
  if (EXCLUDED_STATUS.has(status)) return false;
  return true;
}

export function KlassifizierungsReview(): React.ReactElement {
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const upsertKlassifizierung = useAuslastungData(s => s.upsertKlassifizierung);
  const freigeben = useAuslastungData(s => s.freigebenKategorien);

  const cache = useAntraegeCache();
  const aktuellesJahr = useMemo(
    () => jahrAusQuartal(config.aktuellesQuartal),
    [config.aktuellesQuartal],
  );
  const antraegeImPool = useMemo(() => {
    if (aktuellesJahr === null) return cache.antraege;
    return cache.antraege.filter(a => istZuVerteilen(a, aktuellesJahr));
  }, [cache.antraege, aktuellesJahr]);

  // Verbund-Embeddings (Themen-Vektoren) — separater IDB-Storage neben den
  // Antrag-Embeddings. Wird seit Mai 2026 immer geladen (kein User-Toggle mehr),
  // ein leerer Korpus führt einfach zu leeren Vorschlägen — der Bootstrap-
  // Banner unten weist darauf hin.
  const [verbundEmbeddings, setVerbundEmbeddings] = useState<Map<string, number[]> | null>(null);
  const [embeddingsLoading, setEmbeddingsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setEmbeddingsLoading(true);
    void loadAllVerbundEmbeddings(storage.idb)
      .then(map => { if (!cancelled) setVerbundEmbeddings(map); })
      .catch(err => { console.warn('[KlassifizierungsReview] Verbund-Embedding-Load fehlgeschlagen:', err); })
      .finally(() => { if (!cancelled) setEmbeddingsLoading(false); });
    return () => { cancelled = true; };
  }, [storage.idb]);

  const hasCentroids = useMemo(
    () => config.ueberKategorien.some(k => Array.isArray(k.referenzEmbedding) && k.referenzEmbedding.length > 0),
    [config.ueberKategorien],
  );

  // Verbund-Aggregation
  const verbundViews = useMemo(
    () => buildVerbundClassificationViews(
      antraegeImPool,
      config.ueberKategorien,
      klassifizierungen,
      verbundEmbeddings ?? undefined,
      config.stage2Aktiv,
    ),
    [antraegeImPool, config.ueberKategorien, klassifizierungen, verbundEmbeddings, config.stage2Aktiv],
  );

  const [filter, setFilter] = useState<ViewFilter>('alle');

  const counts = useMemo(() => {
    let neu = 0, freig = 0, review = 0;
    for (const v of verbundViews) {
      if (v.klassifizierung.status === 'freigegeben') freig++;
      else if (v.confidence === 'high') neu++;
      else review++;
    }
    return { neu, freig, review, total: verbundViews.length };
  }, [verbundViews]);

  const filtered = useMemo(() => {
    return verbundViews.filter(v => {
      if (filter === 'freigegeben') return v.klassifizierung.status === 'freigegeben';
      if (filter === 'review') return v.klassifizierung.status !== 'freigegeben' && v.confidence !== 'high';
      return true;
    });
  }, [verbundViews, filter]);

  // Persistenz-Wrapper: Verbund-Aktion wirkt auf alle TVs.
  async function freigebeVerbund(view: VerbundKlassifizierungsView): Promise<void> {
    const ids = view.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
    if (ids.length === 0) return;
    for (const tv of view.tvs) {
      await freigeben(storage, tv.aktenzeichen, ids);
    }
  }

  async function applyVerbundOverride(
    view: VerbundKlassifizierungsView,
    kategorieId: string,
    add: boolean,
  ): Promise<void> {
    const current = new Set(
      view.klassifizierung.status === 'freigegeben'
        ? view.klassifizierung.freigegebeneKategorien
        : view.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId),
    );
    if (add) {
      if (current.size >= 2 && !current.has(kategorieId)) return;
      current.add(kategorieId);
    } else {
      current.delete(kategorieId);
    }
    const ids = [...current];
    for (const tv of view.tvs) {
      if (view.klassifizierung.status === 'freigegeben') {
        await freigeben(storage, tv.aktenzeichen, ids);
      } else {
        const next: Klassifizierung = {
          antragId: tv.aktenzeichen,
          status: 'vorgeschlagen',
          freigegebeneKategorien: [],
          vorgeschlageneKategorien: ids.map(id => ({
            kategorieId: id,
            confidence: 1.0,
            methode: 'regel',
          })),
        };
        await upsertKlassifizierung(storage, next);
      }
    }
  }

  async function bulkFreigeben(): Promise<void> {
    const candidates = verbundViews.filter(v =>
      v.klassifizierung.status !== 'freigegeben'
      && v.confidence === 'high'
      && v.klassifizierung.vorgeschlageneKategorien.length > 0
    );
    if (candidates.length === 0) return;
    if (!confirm(`${candidates.length} Verbünde mit hoher Sicherheit freigeben?`)) return;
    for (const v of candidates) {
      await freigebeVerbund(v);
    }
  }

  // Spalten + Hooks
  const allColumns = useMemo(
    () => buildVerbundColumns({
      kategorien: config.ueberKategorien,
      onToggleVerbund: (v, id, add) => void applyVerbundOverride(v, id, add),
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
          antraege={antraegeImPool}
          kategorien={config.ueberKategorien}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['alle', 'review', 'freigegeben'] as const).map(f => (
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
              {f === 'alle' && `Alle (${counts.total})`}
              {f === 'review' && `Review nötig (${counts.review})`}
              {f === 'freigegeben' && `Freigegeben (${counts.freig})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            {counts.total} Verbünde · {counts.freig} freigegeben · {counts.review} prüfen
          </span>
          <button
            type="button"
            disabled={counts.neu === 0}
            onClick={() => void bulkFreigeben()}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            Alle hohen Confidences freigeben ({counts.neu})
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
        emptyContent="Keine Verbünde in dieser Ansicht."
      />
    </div>
  );
}

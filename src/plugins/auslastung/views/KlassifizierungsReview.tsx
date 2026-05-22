/**
 * Screen 1a — Klassifizierungs-Review.
 *
 * Tabelle: 11 Spalten, davon 7 default sichtbar — siehe
 * `klassifizierung-columns.tsx`. Sortierbar pro Spalte (asc → desc → null);
 * "Spalten ▼"-Picker persistiert sichtbare Spalten in localStorage.
 *
 * Filter-Pills: Alle / Review nötig / Bereits freigegeben.
 * Batch-Aktion: "Alle hohen Confidences freigeben".
 * Pool-Filter: aktuelles Jahr, ohne TiB, ohne abgelehnt/zurückgezogen/Irrläufer.
 */
import { useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  ColumnPicker,
  SortableTable,
  useColumnVisibility,
  useColumnWidths,
  useTableSort,
} from '@/components/data-table';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useKlassifizierungenView, type KlassifizierungsView } from '../hooks/useKlassifizierungen';
import { normalizeKuerzel } from '../services/anonym-map';
import type { Antrag } from '@/core/services/csv/types';
import {
  CANONICAL_TIB_KUERZ,
  CANONICAL_ANTRAGSDATUM,
  type Klassifizierung,
} from '../types';
import { buildClassifierColumns } from './klassifizierung-columns';

type ViewFilter = 'alle' | 'review' | 'freigegeben';

const COLUMN_VISIBILITY_STORAGE_KEY = 'teamflow_auslastung_klassifizierung_columns';
const COLUMN_WIDTHS_STORAGE_KEY = 'teamflow_auslastung_klassifizierung_column_widths';

/** Status-Werte (lowercase, getrimmt), die einen Antrag aus dem
 *  Verteil-Pool ausschliessen. Quelle: Foyer-CSV `STATUS_TV`. */
const EXCLUDED_STATUS = new Set(['abgelehnt/zurückgezogen', 'irrläufer']);

/** Extrahiert das Jahr aus `config.aktuellesQuartal` (Format `YYYY-QN`). */
function jahrAusQuartal(quartal: string): number | null {
  const m = /^(\d{4})-Q[1-4]$/.exec(quartal);
  return m ? Number(m[1]) : null;
}

/** True wenn der Antrag dem Verteil-Pool angehoert: aktuelles Jahr, ohne
 *  TiB-Zuweisung, Status nicht in `EXCLUDED_STATUS`. */
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
  const view = useKlassifizierungenView(antraegeImPool, config.ueberKategorien, klassifizierungen);

  const [filter, setFilter] = useState<ViewFilter>('alle');

  const counts = useMemo(() => {
    let neu = 0, freig = 0, review = 0;
    for (const v of view) {
      if (v.klassifizierung.status === 'freigegeben') freig++;
      else if (v.confidence === 'high') neu++;
      else review++;
    }
    return { neu, freig, review, total: view.length };
  }, [view]);

  const filtered = useMemo(() => {
    return view.filter(v => {
      if (filter === 'freigegeben') return v.klassifizierung.status === 'freigegeben';
      if (filter === 'review') return v.klassifizierung.status !== 'freigegeben' && v.confidence !== 'high';
      return true;
    });
  }, [view, filter]);

  async function bulkFreigeben(): Promise<void> {
    const candidates = view.filter(v =>
      v.klassifizierung.status !== 'freigegeben'
      && v.confidence === 'high'
      && v.klassifizierung.vorgeschlageneKategorien.length > 0
    );
    if (candidates.length === 0) return;
    if (!confirm(`${candidates.length} Anträge mit hoher Sicherheit freigeben?`)) return;
    for (const v of candidates) {
      const ids = v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
      await freigeben(storage, v.antrag.aktenzeichen, ids);
    }
  }

  async function applyManualOverride(
    v: KlassifizierungsView,
    kategorieId: string,
    add: boolean,
  ): Promise<void> {
    const current = new Set(
      v.klassifizierung.status === 'freigegeben'
        ? v.klassifizierung.freigegebeneKategorien
        : v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId),
    );
    if (add) {
      if (current.size >= 2 && !current.has(kategorieId)) return;
      current.add(kategorieId);
    } else {
      current.delete(kategorieId);
    }
    const ids = [...current];
    if (v.klassifizierung.status === 'freigegeben') {
      await freigeben(storage, v.antrag.aktenzeichen, ids);
    } else {
      const next: Klassifizierung = {
        ...v.klassifizierung,
        vorgeschlageneKategorien: ids.map(id => ({
          kategorieId: id,
          confidence: 1.0,
          methode: 'regel',
        })),
      };
      await upsertKlassifizierung(storage, next);
    }
  }

  async function bestaetigen(v: KlassifizierungsView): Promise<void> {
    const ids = v.klassifizierung.vorgeschlageneKategorien.map(c => c.kategorieId);
    await freigeben(storage, v.antrag.aktenzeichen, ids);
  }

  // Spalten-Definition mit injizierten Callbacks. useMemo damit die `render`-
  // Closures stabil bleiben (sonst rendert jeder Parent-Re-Render alle Zeilen
  // neu).
  const allColumns = useMemo(
    () => buildClassifierColumns({
      kategorien: config.ueberKategorien,
      onToggleKategorie: (v, id, add) => void applyManualOverride(v, id, add),
      onBestaetigen: v => void bestaetigen(v),
    }),
    // applyManualOverride + bestaetigen sind Closures ueber Hook-State, also
    // ist die ueberKategorien-Liste der relevante Re-Build-Trigger. Storage/
    // freigeben/upsert sind stabile Zustand-Hooks.
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

  // Default-Breiten aus den Spalten-Definitionen — User-Overrides aus
  // localStorage werden im Hook gemerged + ueberschreiben einzelne Keys.
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
    'confidence',
    'desc',
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Pool-Hint */}
      {aktuellesJahr !== null && (
        <div className="text-[11px] text-[var(--tf-text-tertiary)]">
          Verteil-Pool: Anträge aus {aktuellesJahr} ohne TiB-Zuweisung, ohne Status
          „abgelehnt/zurückgezogen" und „Irrläufer".
        </div>
      )}

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
            {counts.total} gesamt · {counts.freig} freigegeben · {counts.review} prüfen
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

      <SortableTable
        rows={sortedRows}
        columns={visibleColumns}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        rowKey={v => v.antrag.aktenzeichen}
        emptyContent="Keine Anträge in dieser Ansicht."
        columnWidths={columnWidths}
        onColumnWidthChange={setWidth}
      />
    </div>
  );
}

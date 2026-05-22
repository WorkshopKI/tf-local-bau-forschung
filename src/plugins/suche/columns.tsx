/**
 * Spalten-Konfiguration fuer die Excel-artige Suchtabelle.
 *
 * Pro Spalte:
 *  - `accessor`: liefert den sortier-/filterbaren Rohwert (auch fuer Export).
 *  - `render`: liefert das JSX fuer eine Zelle.
 *
 * Konvention: leere Zellen liefern `''` aus `accessor` und `null` aus `render`,
 * damit Sortierung deterministisch ist und Tailwind keinen Layout-Shift macht.
 */
import { memo, type ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { Badge } from '@/ui';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { SortableColumn } from '@/components/data-table';
import { getStatusCategoryColor } from '@/plugins/antraege/groupAggregates';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';

export type SearchColumnAppliesTo = 'both' | 'antrag' | 'dokument';

/**
 * Filter-Typ pro Spalte:
 *  - `multiSelect` (Default): Checkbox-Liste mit allen distinct accessor-Werten.
 *  - `year`: Extrahiert das Jahr aus Datums-Werten (YYYY-MM-DD oder dd.mm.yyyy).
 *    Filter zeigt Jahre als Multi-Select.
 *  - `type`: Antrag / Dokument-Filter — Werte kommen aus `filterAccessor`, nicht
 *    aus dem `accessor` (der dort den FKZ/Dateinamen liefert).
 */
export type SearchColumnFilterType = 'multiSelect' | 'year' | 'type';

/**
 * Such-spezifische Spalten-Definition: erweitert die generische
 * `SortableColumn<UnifiedSearchResult>` um Filter- + Resize-spezifische
 * Felder (Default-Width hier required, `filterable`, Filter-Typ, Filter-
 * Accessor, etc.).
 */
export interface SearchColumn extends SortableColumn<UnifiedSearchResult> {
  /** Default-Spaltenbreite in Pixel. User kann sie per Drag-Handle ueberschreiben. */
  width: number;
  filterable: boolean;
  appliesTo: SearchColumnAppliesTo;
  /** Default `multiSelect`. */
  filterType?: SearchColumnFilterType;
  /** Optional separate Quelle fuer Filter-Kandidaten (wenn der Filter etwas
   *  anderes filtert als der Sort-Accessor — z.B. `fkzDatei`: Sort nach
   *  FKZ/Datei, Filter nach Antrag/Dokument). */
  filterAccessor?: (r: UnifiedSearchResult) => string;
  /** Optionaler Display-Mapper fuer Filter-Dropdown-Werte. Filter-State bleibt
   *  nach Roh-Werten indexiert; nur das Label im Dropdown wird gemappt. */
  formatFilterLabel?: (value: string) => string;
}

/** Extrahiert das Jahr (YYYY) aus einem ISO- oder dd.mm.yyyy-Datum.
 *  Liefert leeren String bei nicht-parsebaren Werten. */
export function extractYear(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value);
  const iso = /^(\d{4})-\d{2}-\d{2}/.exec(s);
  if (iso && iso[1]) return iso[1];
  const de = /^\d{2}\.\d{2}\.(\d{4})/.exec(s);
  if (de && de[1]) return de[1];
  return '';
}

/**
 * Liefert den Filter-Wert einer Spalte fuer eine Ergebniszeile — beruecksichtigt
 * `filterType` und optionalen `filterAccessor`. Wird sowohl beim Sammeln der
 * Filter-Kandidaten als auch beim Anwenden des Filters genutzt, damit beide
 * Pfade identisch projizieren.
 */
export function getColumnFilterValue(col: SearchColumn, r: UnifiedSearchResult): string {
  if (col.filterType === 'type' && col.filterAccessor) {
    return col.filterAccessor(r);
  }
  if (col.filterType === 'year') {
    const raw = col.filterAccessor ? col.filterAccessor(r) : col.accessor(r);
    return extractYear(raw);
  }
  if (col.filterAccessor) return col.filterAccessor(r);
  const v = col.accessor(r);
  return v === undefined || v === null ? '' : String(v);
}

const METHOD_LABELS: Record<string, string> = {
  fulltext: 'Stichwort', vector: 'Bedeutung', hybrid: 'Stichwort + Bedeutung',
};

/** Abkuerzungen fuer ueberlange Status-Labels — Cell + Filter-Dropdown zeigen
 *  die kurze Variante, Tooltip / Filter-State arbeiten weiterhin mit dem
 *  Roh-Status. */
const STATUS_LABEL_OVERRIDES: Record<string, string> = {
  'Widerspruch zur Ablehnung': 'Wiederspr. zur Ablehn.',
  'Stellungnahme zur Rücknahmeempfehlung': 'Stellungnahme zur RNE',
  'abgelehnt/zurückgezogen': 'abgelehnt/zurückgez.',
  'Bewilligungsentwurf VDI/VDE-IT': 'Bewilligungsentwurf',
};

function shortStatus(s: string): string {
  return STATUS_LABEL_OVERRIDES[s] ?? s;
}

function safeString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

// Zellen-Renderer sind ueber alle ~14 Spalten und alle Treffer-Zeilen
// im Hot-Path. memo() spart bei Filter-/Sort-/Resize-Updates Tausende
// Reconcile-Calls (siehe Performance-Audit, R2).
const MethodPill = memo(function MethodPill({ method }: { method: string }): ReactNode {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
      {METHOD_LABELS[method] ?? method}
    </span>
  );
});

const TypeBadge = memo(function TypeBadge({ r }: { r: UnifiedSearchResult }): ReactNode {
  if (r.type === 'antrag') {
    const dotColor = r.statusKategorie ? getStatusCategoryColor(r.statusKategorie) : '#d1d5db';
    const label = getKategorieLabel(r.vbPhase) ?? 'Antrag';
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-800">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-violet-50 text-violet-800">
      <FileText size={10} aria-hidden />
      Dok
    </span>
  );
});

const StatusBadge = memo(function StatusBadge({ r }: { r: UnifiedSearchResult }): ReactNode {
  if (r.type !== 'antrag' || !r.status) return null;
  const color = r.statusKategorie ? getStatusCategoryColor(r.statusKategorie) : '#9ca3af';
  return (
    <span
      className="inline-block text-[11px] px-2 py-0.5 rounded truncate max-w-full"
      style={{ backgroundColor: `${color}22`, color, border: `0.5px solid ${color}44` }}
      title={r.status}
    >
      {shortStatus(r.status)}
    </span>
  );
});

function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export const SEARCH_COLUMNS: SearchColumn[] = [
  {
    key: 'type', label: 'Typ', width: 60, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'both',
    // Accessor liefert exakt das Label, das TypeBadge anzeigt — damit
    // Filter-Dropdown / Sort konsistent zur Zell-Pill sind. Dokument-
    // interne Orama-Subtypen ('antrag', 'bauantrag') werden bewusst
    // nicht durchgereicht; die Typ-Spalte unterscheidet ausschliesslich
    // entlang der UnifiedSearchResult.type-Achse.
    accessor: r => r.type === 'antrag'
      ? (getKategorieLabel(r.vbPhase) ?? 'Antrag')
      : 'Dok',
    render: r => <TypeBadge r={r} />,
  },
  {
    key: 'fkzDatei', label: 'FKZ', width: 85, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'both',
    accessor: r => r.type === 'antrag' ? safeString(r.fkz) : safeString(r.dateiname),
    filterType: 'type',
    filterAccessor: r => r.type === 'antrag' ? 'Antrag' : 'Dokument',
    render: r => r.type === 'antrag'
      ? <span className="font-mono text-[12px] text-[var(--tf-text)]">{r.fkz}</span>
      : <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.dateiname}>{r.dateiname}</span>,
  },
  {
    key: 'programm', label: 'Programm', width: 100, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'both',
    accessor: r => safeString(r.programm ?? r.zugehoerigesProgramm),
    render: r => (
      <span className="font-mono text-[11px] text-[var(--tf-text-secondary)]">
        {r.programm ?? r.zugehoerigesProgramm ?? ''}
      </span>
    ),
  },
  {
    key: 'titelInhalt', label: 'Titel / Inhalt', width: 400, defaultVisible: true,
    sortable: true, filterable: false, locked: true, appliesTo: 'both', wrap: true,
    accessor: r => safeString(r.title),
    render: r => (
      <div className="min-w-0">
        <span className="font-medium text-[13px] text-[var(--tf-text)]">{r.title}</span>
        {r.snippet && (
          <>
            <span className="text-[12px] text-[var(--tf-text-tertiary)]"> — </span>
            <span className="text-[12px] text-[var(--tf-text-secondary)]">{r.snippet}</span>
          </>
        )}
      </div>
    ),
  },
  {
    key: 'status', label: 'Status', width: 90, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.status),
    render: r => <StatusBadge r={r} />,
    formatFilterLabel: shortStatus,
  },
  {
    key: 'score', label: 'Score', width: 80, defaultVisible: true,
    sortable: true, filterable: false, appliesTo: 'both',
    accessor: r => r.score,
    render: r => (
      <span className="font-mono text-[12px] text-[var(--tf-text)]">{r.score.toFixed(2)}</span>
    ),
  },
  {
    key: 'antragsteller', label: 'AST', width: 180, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.antragsteller),
    render: r => r.antragsteller
      ? <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.antragsteller}>{r.antragsteller}</span>
      : null,
  },
  {
    key: 'antragsdatum', label: 'Antragseingang', width: 110, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.antragsdatum),
    filterType: 'year',
    render: r => r.antragsdatum
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.antragsdatum}</span>
      : null,
  },
  {
    key: 'bewilligungsdatum', label: 'Bewilligungsdatum', width: 130, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.bewilligungsdatum),
    filterType: 'year',
    render: r => r.bewilligungsdatum
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.bewilligungsdatum}</span>
      : null,
  },
  {
    key: 'ortAst', label: 'Ort AST', width: 120, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.ortAst),
    render: r => r.ortAst
      ? <span className="text-[12px] text-[var(--tf-text)] truncate block" title={r.ortAst}>{r.ortAst}</span>
      : null,
  },
  {
    key: 'laufzeitbeginn', label: 'Laufzeitbeginn', width: 120, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.laufzeitbeginn),
    filterType: 'year',
    render: r => r.laufzeitbeginn
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.laufzeitbeginn}</span>
      : null,
  },
  {
    key: 'laufzeitende', label: 'Laufzeitende', width: 120, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'antrag',
    accessor: r => safeString(r.laufzeitende),
    filterType: 'year',
    render: r => r.laufzeitende
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono">{r.laufzeitende}</span>
      : null,
  },
  {
    key: 'zuwendung', label: 'Zuwendung', width: 120, defaultVisible: false,
    sortable: true, filterable: false, appliesTo: 'antrag',
    accessor: r => typeof r.zuwendung === 'number' ? r.zuwendung : 0,
    render: r => typeof r.zuwendung === 'number'
      ? <span className="text-[12px] text-[var(--tf-text)] font-mono block text-right">{formatEur(r.zuwendung)}</span>
      : null,
  },
  {
    key: 'dokumentTyp', label: 'Dokumenttyp', width: 110, defaultVisible: false,
    sortable: true, filterable: true, appliesTo: 'dokument',
    accessor: r => safeString(r.dokumentTyp),
    render: r => r.dokumentTyp
      ? <Badge variant="default">{r.dokumentTyp}</Badge>
      : null,
  },
  {
    key: 'method', label: 'Suche', width: 170, defaultVisible: true,
    sortable: true, filterable: true, appliesTo: 'both',
    accessor: r => safeString(r.method),
    render: r => <MethodPill method={r.method} />,
    formatFilterLabel: v => METHOD_LABELS[v] ?? v,
  },
];

export const DEFAULT_VISIBLE_COLUMN_KEYS: string[] =
  SEARCH_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);

export const LOCKED_COLUMN_KEYS: string[] =
  SEARCH_COLUMNS.filter(c => c.locked).map(c => c.key);

export function getColumnByKey(key: string): SearchColumn | undefined {
  return SEARCH_COLUMNS.find(c => c.key === key);
}

// ---------- Dynamische Spalten (KI-Analyse, Prompt 03) ----------------------

const DYNAMIC_PREFIX = 'extra:';

function prettyLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bFkz\b/i, 'FKZ');
}

/** Baut dynamische Spalten fuer LLM-extrahierte Felder (z.B. `foerderzweck`).
 *  Die Spalten lesen aus `r.extraFields[key]`. Reihenfolge entspricht der
 *  uebergebenen Key-Liste (= `gewuenschteSpalten` aus Stufe 1). */
export function buildDynamicColumns(keys: ReadonlyArray<string>): SearchColumn[] {
  return keys
    .filter(k => typeof k === 'string' && k.trim().length > 0)
    .filter(k => !SEARCH_COLUMNS.some(c => c.key === k)) // Duplikate mit statischen Spalten vermeiden
    .map(k => {
      const accessor = (r: UnifiedSearchResult): string | number => {
        const v = r.extraFields?.[k];
        if (v === null || v === undefined) return '';
        return v;
      };
      return {
        key: `${DYNAMIC_PREFIX}${k}`,
        label: prettyLabel(k),
        width: 160,
        defaultVisible: true,
        sortable: true,
        filterable: true,
        appliesTo: 'antrag',
        accessor,
        render: (r: UnifiedSearchResult) => {
          const v = r.extraFields?.[k];
          if (v === null || v === undefined || v === '') return null;
          const text = String(v);
          return (
            <span className="text-[12px] text-[var(--tf-text)] truncate block" title={text}>
              {text}
            </span>
          );
        },
      } satisfies SearchColumn;
    });
}

export function isDynamicColumnKey(key: string): boolean {
  return key.startsWith(DYNAMIC_PREFIX);
}

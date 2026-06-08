/**
 * Spalten-Registry für die Tabellen-Ansicht der Förderanträge ("compact"-
 * View-Mode, seit dem Umbau eine echte Header-Tabelle wie die Suche).
 *
 * Aufbau analog zu `SEARCH_COLUMNS` (src/plugins/suche/columns.tsx): jede
 * Spalte liefert `accessor` (primitiver Sort-Wert, leere → '' bzw. große Zahl
 * für deterministische Sortierung) + `render` (Zell-JSX, `null` wenn leer).
 *
 * Alle Felder stammen aus `AntragListItem` und sind im Slim-Store
 * `ANTRAEGE_LIST_VIEW` projiziert (siehe `LIST_VIEW_FIELDS`). Cell-Renderer
 * verwenden ausschließlich vorhandene Helfer wieder (Status-Label, Eingangs-
 * Ampel, Frist) — keine String-Literal-Status-Vergleiche (Pitfall #12).
 */
import type { ReactNode } from 'react';
import { Badge } from '@/ui';
import type { SortableColumn } from '@/components/data-table';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { daysUntilFristAware, computeFristDatum } from '@/core/services/csv/frist';
import { isBegleitungStatus } from '@/core/utils/status-canonical';
import { getKategorieLabel } from './filter/kategorieQuickfilter';
import { MaKuerzelBadge } from './MaKuerzelBadge';
import type { AntragTableRow } from './tableGrouping';
import { worstAmpel, criticalFristAware } from './groupAggregates';
import {
  getEingangAmpel,
  daysSinceEingang,
  AMPEL_COLOR,
  AMPEL_TOOLTIP,
} from './eingangAmpel';

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** Tage bis Frist als Anzeige-Text: "+45d" (Zeit übrig), "heute", "-12d"
 *  (überfällig). `null` → leer. */
function formatFrist(d: number | null): string {
  if (d === null) return '';
  if (d === 0) return 'heute';
  if (d > 0) return `+${d}d`;
  return `${d}d`;
}

/** Jahr aus ISO (YYYY-…) oder dd.mm.yyyy für den Datums-Spaltenfilter (analog
 *  zum Jahr-Filter der Suche). Leerer/unparsbarer Wert → '' (wird von
 *  `deriveFilterCandidates` als „kein Kandidat" übersprungen). */
function yearOf(v: string | undefined): string {
  const s = (v ?? '').trim();
  const iso = /^(\d{4})-/.exec(s);
  if (iso) return iso[1]!;
  const de = /(\d{4})\s*$/.exec(s);
  return de ? de[1]! : '';
}

/** Absolutes Frist-Datum + Berechnungsbasis als Tooltip-Text — macht die
 *  Tage-Differenz (z.B. "-74d") nachvollziehbar. Phasen-bewusst (Pitfall #12). */
function fristTooltip(
  r: Pick<AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum'>,
): string | undefined {
  const iso = computeFristDatum(r);
  if (!iso) return undefined;
  const datum = new Date(iso).toLocaleDateString('de-DE');
  return isBegleitungStatus(r.status)
    ? `VN-Frist: ${datum} (VN-Eingang + 6 Monate)`
    : `Bearbeitungsfrist: ${datum} (Antragseingang + 90 Tage)`;
}

/** EUR ohne Nachkommastellen — lokal gehalten (wie `suche/columns.tsx`). */
function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function textCell(v: string | null): ReactNode {
  return v ? <span className="text-[12px] text-[var(--tf-text)]" title={v}>{v}</span> : null;
}

function dateCell(v: string | null): ReactNode {
  return v ? <span className="font-mono text-[11.5px] text-[var(--tf-text)]">{v}</span> : null;
}

export const ANTRAG_TABLE_COLUMNS: SortableColumn<AntragTableRow>[] = [
  {
    key: 'aktenzeichen',
    label: 'FKZ',
    defaultVisible: true,
    locked: true,
    sortable: true,
    width: 132,
    wrap: false,
    accessor: r => r.aktenzeichen,
    render: r => {
      // Verbund-Zeile (Gruppiert: Verbund) → FKZ-Range + Count-Chip + worst-
      // Ampel über alle TVs; sonst Einzel-FKZ + eigene Eingangs-Ampel.
      const meta = r._verbund;
      const ampel = meta ? worstAmpel(meta.tvs) : getEingangAmpel(r);
      const ampelDays = !meta && ampel !== null ? daysSinceEingang(r) : null;
      const fkzText = meta ? meta.fkzRange : r.aktenzeichen;
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="shrink-0 w-2 h-2 inline-flex items-center justify-center">
            {ampel !== null ? (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: AMPEL_COLOR[ampel] }}
                title={ampelDays !== null ? `${AMPEL_TOOLTIP[ampel]} (${ampelDays} Tage)` : AMPEL_TOOLTIP[ampel]}
                aria-hidden="true"
              />
            ) : null}
          </span>
          <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)] truncate">{fkzText}</span>
          {meta ? (
            <span
              className="shrink-0 font-mono text-[10px] text-[var(--tf-text-tertiary)]"
              title={`${meta.tvCount} Teilvorhaben`}
            >
              ·{meta.tvCount}
            </span>
          ) : null}
        </span>
      );
    },
  },
  {
    key: 'akronym',
    label: 'Akronym',
    defaultVisible: true,
    sortable: true,
    filterable: true,
    width: 130,
    wrap: false,
    accessor: r => strOrNull(r.akronym) ?? '',
    render: r => {
      const v = strOrNull(r.akronym);
      return v ? <span className="font-medium text-[12.5px] text-[var(--tf-text)]" title={v}>{v}</span> : null;
    },
  },
  {
    key: 'antragsteller',
    label: 'Antragsteller',
    defaultVisible: true,
    sortable: true,
    filterable: true,
    width: 260,
    wrap: false,
    accessor: r => strOrNull(r.antragsteller) ?? '',
    render: r => {
      const v = strOrNull(r.antragsteller);
      return v ? <span className="text-[12px] text-[var(--tf-text-secondary)]" title={v}>{v}</span> : null;
    },
  },
  {
    key: 'status',
    label: 'Status',
    defaultVisible: true,
    sortable: true,
    filterable: true,
    width: 140,
    wrap: false,
    accessor: r => {
      const s = strOrNull(r.status);
      return s ? getStatusLabel(s) : '';
    },
    render: r => {
      const s = strOrNull(r.status);
      return s ? (
        <Badge
          variant={getStatusVariant(s)}
          className="min-w-[100px] justify-center whitespace-nowrap text-[10.5px]"
        >
          {getStatusLabel(s)}
        </Badge>
      ) : null;
    },
  },
  {
    key: 'frist',
    label: 'Frist',
    defaultVisible: true,
    sortable: true,
    width: 72,
    wrap: false,
    // Leere Fristen ans Ende (asc) → große Zahl statt null. Verbund-Zeile:
    // dringendste Frist über alle TVs (kritischster TV), sonst per-TV.
    accessor: r => (r._verbund ? criticalFristAware(r._verbund.tvs) : daysUntilFristAware(r)) ?? Number.MAX_SAFE_INTEGER,
    // Export darf nicht den Sortier-Sentinel (MAX_SAFE_INTEGER) schreiben →
    // lesbarer Tage-Text ("+45d"/"-12d"/"heute"), leere Frist → leere Zelle.
    exportValue: r => {
      const d = r._verbund ? criticalFristAware(r._verbund.tvs) : daysUntilFristAware(r);
      return d === null ? '' : formatFrist(d);
    },
    render: r => {
      const d = r._verbund ? criticalFristAware(r._verbund.tvs) : daysUntilFristAware(r);
      if (d === null) return null;
      const critical = d < 0;
      return (
        <span
          className={`tabular-nums text-[11px] ${
            critical ? 'text-[var(--tf-danger-text)] font-medium' : 'text-[var(--tf-text-tertiary)]'
          }`}
          title={r._verbund ? 'Dringendste Frist im Verbund' : fristTooltip(r)}
        >
          {formatFrist(d)}
        </span>
      );
    },
  },
  {
    key: 'titel',
    label: 'TV Titel',
    defaultVisible: false,
    sortable: true,
    width: 260,
    wrap: false,
    accessor: r => strOrNull(r.titel) ?? '',
    render: r => textCell(strOrNull(r.titel)),
  },
  {
    key: 'verbund_titel',
    label: 'VB Titel',
    defaultVisible: false,
    sortable: true,
    width: 280,
    wrap: false,
    // Verbund-Titel ist nicht in `AntragListItem` projiziert (Verbund-Level-Feld);
    // `AntraegeTable` reichert die Row vorab aus `verbundById` an (siehe dort).
    accessor: r => strOrNull(r.verbund_titel) ?? '',
    render: r => textCell(strOrNull(r.verbund_titel)),
  },
  {
    key: 'vb_phase',
    label: 'Typ',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 76,
    wrap: false,
    accessor: r => getKategorieLabel(r.vb_phase) ?? '',
    render: r => {
      const v = getKategorieLabel(r.vb_phase);
      return v ? <span className="text-[12px] text-[var(--tf-text)]">{v}</span> : null;
    },
  },
  {
    key: 'bewilligung_datum',
    label: 'Bewilligungsdatum',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOf(r.bewilligung_datum),
    width: 148,
    wrap: false,
    accessor: r => strOrNull(r.bewilligung_datum) ?? '',
    render: r => dateCell(strOrNull(r.bewilligung_datum)),
  },
  {
    key: 'erstentscheidung',
    label: 'Erstentscheidung',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOf(r.erstentscheidung),
    width: 148,
    wrap: false,
    accessor: r => strOrNull(r.erstentscheidung) ?? '',
    render: r => dateCell(strOrNull(r.erstentscheidung)),
  },
  {
    key: 'antragsdatum',
    label: 'Antragseingang',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOf(r.antragsdatum),
    width: 140,
    wrap: false,
    accessor: r => strOrNull(r.antragsdatum) ?? '',
    render: r => dateCell(strOrNull(r.antragsdatum)),
  },
  {
    key: 'ort_ast',
    label: 'Ort AST',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 140,
    wrap: false,
    accessor: r => strOrNull(r.ort_ast) ?? '',
    render: r => textCell(strOrNull(r.ort_ast)),
  },
  {
    key: 'foerdersumme',
    label: 'Zuwendung',
    defaultVisible: false,
    sortable: true,
    width: 124,
    wrap: false,
    accessor: r => (typeof r.foerdersumme === 'number' ? r.foerdersumme : 0),
    render: r =>
      typeof r.foerdersumme === 'number' ? (
        <span className="font-mono text-[12px] text-[var(--tf-text)] block text-right">{formatEur(r.foerdersumme)}</span>
      ) : null,
  },
  {
    key: 'laufzeitbeginn',
    label: 'Laufzeitbeginn',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOf(r.laufzeitbeginn),
    width: 132,
    wrap: false,
    accessor: r => strOrNull(r.laufzeitbeginn) ?? '',
    render: r => dateCell(strOrNull(r.laufzeitbeginn)),
  },
  {
    key: 'laufzeitende',
    label: 'Laufzeitende',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => yearOf(r.laufzeitende),
    width: 132,
    wrap: false,
    accessor: r => strOrNull(r.laufzeitende) ?? '',
    render: r => dateCell(strOrNull(r.laufzeitende)),
  },
  {
    key: 'branche',
    label: 'Branche',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 150,
    wrap: false,
    accessor: r => strOrNull(r.branche) ?? '',
    render: r => textCell(strOrNull(r.branche)),
  },
  {
    key: 'foerdergeber',
    label: 'Fördergeber',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 150,
    wrap: false,
    accessor: r => strOrNull(r.foerdergeber) ?? '',
    render: r => textCell(strOrNull(r.foerdergeber)),
  },
];

export const DEFAULT_VISIBLE_COLUMN_KEYS: string[] =
  ANTRAG_TABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);

export const LOCKED_COLUMN_KEYS: string[] =
  ANTRAG_TABLE_COLUMNS.filter(c => c.locked === true).map(c => c.key);

/**
 * „MA"-Spalte (TIB-Bearbeiter-Kürzel). Bewusst NICHT Teil von
 * `ANTRAG_TABLE_COLUMNS` → der Spalten-Picker listet sie nicht; sie wird von
 * `AntraegeTable` automatisch eingeblendet, sobald der „alle"-/Übersichtsmodus
 * aktiv ist (`showMaColumn`). Für die Verbund-Sammelzeile zeigt sie das Kürzel
 * des Lead-TVs.
 */
export const MA_COLUMN: SortableColumn<AntragTableRow> = {
  key: 'tib_kuerz',
  label: 'MA',
  // Nicht im Spalten-Picker (steht nicht in ANTRAG_TABLE_COLUMNS); `defaultVisible`
  // ist nur Pflichtfeld des Typs und hier ohne Wirkung.
  defaultVisible: false,
  sortable: true,
  filterable: true,
  width: 72,
  wrap: false,
  accessor: r => strOrNull(r.tib_kuerz) ?? '',
  render: r => <MaKuerzelBadge kuerzel={r.tib_kuerz} />,
};

/**
 * Sichtbare Spalten in Registry-Reihenfolge auflösen — Single Source für Tabelle
 * (`AntraegeTable`) UND XLSX-Export (`export-xlsx.ts`), damit der Export exakt die
 * Spalten der Ansicht abbildet. Die MA-Spalte wird im „alle"-/Übersichtsmodus
 * (`showMaColumn`) automatisch direkt nach der gelockten FKZ-Spalte eingeblendet
 * (nicht Teil von ANTRAG_TABLE_COLUMNS, daher nicht im Picker).
 */
export function resolveAntragTableColumns(
  visibleKeys: readonly string[],
  showMaColumn: boolean,
): SortableColumn<AntragTableRow>[] {
  const set = new Set(visibleKeys);
  const base = ANTRAG_TABLE_COLUMNS.filter(c => set.has(c.key));
  if (!showMaColumn || base.length === 0) return base;
  return [base[0]!, MA_COLUMN, ...base.slice(1)];
}

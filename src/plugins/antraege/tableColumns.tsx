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
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { KopierIconButton } from '@/components/ui/KopierIconButton';
import type { SortableColumn } from '@/components/data-table';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { formatGermanDate } from '@/core/services/csv/dateParse';
import { daysUntilFristAware, computeFristDatum } from '@/core/services/csv/frist';
import { isBegleitungStatus, isTerminalStatus, statusRang } from '@/core/utils/status-canonical';
import { naechsterSchritt } from '@/core/utils/naechsterSchritt';
import { getAktiveVersion, leiteStatusAb } from '@/core/status';
import { isStatusCockpitEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';
import { KonfliktBadge } from './status/KonfliktBadge';
import { HerleitungPopover } from './status/HerleitungPopover';
import { getKategorieLabel } from './filter/kategorieQuickfilter';
import { MaKuerzelBadge } from './MaKuerzelBadge';
import type { AntragTableRow } from './tableGrouping';
import { worstAmpel, criticalFristAware } from './groupAggregates';
import { fristAnzeige, fristAnzeigeFromDays } from './fristAnzeige';
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

/** Filter-Label für Zeilen ohne Wert. Ein nicht-leerer Sentinel macht „leere"
 *  Einträge im Spaltenfilter wählbar — sonst überspringt `deriveFilterCandidates`
 *  den leeren String als „kein Kandidat". `applyColumnFilters` matcht denselben
 *  Sentinel zurück (gleicher `filterAccessor`-Pfad). */
const FILTER_EMPTY_LABEL = '(leer)';

/** Jahr fürs Datums-Spaltenfilter, leere/datumslose Zeilen als „(leer)"
 *  wählbar (z.B. „Anträge ohne Erstentscheidung"). */
function yearOfOrEmpty(v: string | undefined): string {
  return yearOf(v) || FILTER_EMPTY_LABEL;
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

/**
 * Konflikt-Badge für eine Verbund-Zeile (nur bei aktivem Status-Cockpit): leitet
 * über den kuratierten Katalog den Status aus den TV-Status-Feldern ab und zeigt
 * das Badge, wenn die Ableitung einen Spine-Konflikt trägt (sonst `null`).
 * `getAktiveVersion`/`leiteStatusAb` sind reine Funktionen (keine Hooks) — Aufruf
 * im `render` ist unbedenklich. Nur `status` liegt auf `AntragListItem` vor.
 */
function renderKonflikt(tvs: AntragListItem[]): ReactNode {
  const version = getAktiveVersion();
  if (!version) return null;
  const tvFelder = Object.fromEntries(tvs.map(tv => [tv.aktenzeichen, { status: String(tv.status ?? '') }]));
  const erg = leiteStatusAb(version, {}, tvFelder);
  return <KonfliktBadge ableitung={erg} version={version} kompakt />;
}

/**
 * Das Info-Icon der Status-Erklärung (Vorgangssystem) für eine Listenzeile.
 *
 * Nur wo es eine Verbund-Id gibt — ohne sie könnte die Erklärung weder
 * Teilvorhaben noch Datumsspalten laden und stünde leer da. Der Inhalt lädt erst
 * beim Öffnen (`useHerleitung`), sonst ginge jede der 13 000 Zeilen beim
 * Rendern auf die IndexedDB.
 */
function renderHerleitung(r: AntragListItem): ReactNode {
  if (!isVorgangssystemEnabled()) return null;
  const vbid = typeof r.verbund_id === 'string' && r.verbund_id ? r.verbund_id : null;
  if (!vbid) return null;
  return (
    <span className="ml-1 inline-flex align-middle">
      <HerleitungPopover verbundId={vbid} statusRoh={r.status} />
    </span>
  );
}

/** Key der MA-Spalte (TIB-Bearbeiter-Kürzel) — Konstante für die Auto-Show im
 *  „alle"-/Übersichtsmodus (`resolveAntragTableColumns`) + die Picker-Ausblendung
 *  in genau diesem Modus (`AntraegeMain`, sonst stünde im Picker eine Checkbox,
 *  deren Toggle ohne Wirkung bliebe, weil die Spalte dort erzwungen wird). */
export const MA_COLUMN_KEY = 'tib_kuerz';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

/**
 * Factory für eine „Datums-Status"-Spalte (FB Status / PreCheck Status): Badge
 * mit dem Spalten-Label (aus der Projektion), Tooltip = Datum (DD.MM.YYYY).
 * Sortierung nach Datum (ISO; leer ans Ende, '' sortiert wie bei den übrigen
 * Datums-Spalten vorne), Filter nach Label. Off by default (einblendbar).
 * Tooltip via Wrapper-`<span>`, da `Badge` kein `title` durchreicht.
 */
function statusDatumColumn(opts: {
  key: string;
  label: string;
  variant: BadgeVariant;
  getLabel: (r: AntragTableRow) => string | undefined;
  getDatum: (r: AntragTableRow) => string | undefined;
}): SortableColumn<AntragTableRow> {
  const { key, label, variant, getLabel, getDatum } = opts;
  return {
    key,
    label,
    defaultVisible: false,
    sortable: true,
    filterable: true,
    filterAccessor: r => strOrNull(getLabel(r)) ?? FILTER_EMPTY_LABEL,
    width: 150,
    wrap: false,
    accessor: r => strOrNull(getDatum(r)) ?? '',
    render: r => {
      const lbl = strOrNull(getLabel(r));
      if (!lbl) return null;
      const datum = strOrNull(getDatum(r));
      return (
        <span className="inline-flex max-w-full" title={datum ? formatGermanDate(datum) : undefined}>
          <Badge variant={variant} className="max-w-full justify-center truncate text-[10.5px]">
            {lbl}
          </Badge>
        </span>
      );
    },
  };
}

export const ANTRAG_TABLE_COLUMNS: SortableColumn<AntragTableRow>[] = [
  {
    key: 'aktenzeichen',
    label: 'FKZ',
    defaultVisible: true,
    locked: true,
    sortable: true,
    // 156 statt der urspruenglichen 132: der Kopier-Slot rechts belegt dauerhaft
    // ~22px (Layout-stabil, s.u.) — bei 132 wuerde das FKZ sonst abgeschnitten.
    width: 156,
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
        // `max-w-full min-w-0`: die Zelle clippt (overflow:hidden) — ohne das
        // schoebe ein langer FKZ-Range den Kopier-Knopf aus dem Sichtfeld,
        // statt den Text zu kuerzen.
        <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
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
          <span className="min-w-0 font-mono text-[11px] text-[var(--tf-text-tertiary)] truncate" title={fkzText}>{fkzText}</span>
          {meta ? (
            <span
              className="shrink-0 font-mono text-[10px] text-[var(--tf-text-tertiary)]"
              title={`${meta.tvCount} Teilvorhaben`}
            >
              ·{meta.tvCount}
            </span>
          ) : null}
          {/* Kopier-Slot: belegt IMMER Platz (nur die Sichtbarkeit schaltet um),
              sonst spraenge die Zelle beim Hover (Pitfall #14). `focus-within`,
              damit der per Tab erreichbare Knopf nicht unsichtbar bleibt.
              Kopiert wird der ANGEZEIGTE Wert — bei einer Verbund-Zeile also das
              gepflegte Verbund-FKZ (ersatzweise die TV-Range, s. `verbundFkz`). */}
          <span className="shrink-0 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
            <KopierIconButton
              text={fkzText}
              title={meta ? 'Verbund-FKZ kopieren' : 'FKZ kopieren'}
              ariaLabel={`${meta ? 'Verbund-FKZ' : 'FKZ'} ${fkzText} kopieren`}
            />
          </span>
        </span>
      );
    },
  },
  {
    // Bearbeiter-Kürzel (TIB) — regulär im Spalten-Picker wählbar (off by
    // default). Zeigt je Antrag, von welchem TIB er stammt; v.a. nützlich bei
    // „Auch außerhalb meiner Anträge suchen" (Bearbeiter-Filter aktiv →
    // Auto-Show aus, aber fremde TIBs in der Trefferliste). Im „alle"-/
    // Übersichtsmodus zusätzlich automatisch erzwungen (showMaColumn).
    key: MA_COLUMN_KEY,
    label: 'TIB',
    defaultVisible: false,
    sortable: true,
    filterable: true,
    width: 72,
    wrap: false,
    accessor: r => strOrNull(r.tib_kuerz) ?? '',
    render: r => <MaKuerzelBadge kuerzel={r.tib_kuerz} />,
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
    // Kombinierte „Status und nächster Schritt"-Spalte (Journey-Paket 2 Phase 3):
    // amtliches Status-Badge + ` → {Aktion}` aus `naechsterSchritt` (inkl.
    // PreCheck-Stand). Terminale Anträge: kein Badge, nur grauer Status-Text.
    // Sortierung nach kanonischem Status-Rang (`statusRang`, Pitfall #12), dann
    // Aktion alphabetisch als Sekundärschlüssel — beides in einen Sortier-String
    // gefaltet (Rang 2-stellig gepolstert → dominiert, Aktion tie-break).
    key: 'status_naechster_schritt',
    label: 'Status und nächster Schritt',
    defaultVisible: true,
    sortable: true,
    width: 320,
    wrap: false,
    accessor: r => {
      const s = strOrNull(r.status);
      if (!s) return '99'; // leerer Status ans Ende
      const schritt = naechsterSchritt(s, r.precheck_status_label ?? '');
      const aktion = (schritt?.aktion || getStatusLabel(s)).toLowerCase();
      return `${String(statusRang(s)).padStart(2, '0')} ${aktion}`;
    },
    // Export lesbar halten (nicht den Rang-Sortier-String) — „{Status} → {Aktion}".
    exportValue: r => {
      const s = strOrNull(r.status);
      if (!s) return '';
      const schritt = naechsterSchritt(s, r.precheck_status_label ?? '');
      const aktion = isTerminalStatus(s) ? '' : (schritt?.aktion ?? '');
      return aktion ? `${getStatusLabel(s)} → ${aktion}` : getStatusLabel(s);
    },
    render: r => {
      const s = strOrNull(r.status);
      if (!s) return null;
      // Konflikt-Badge (Status-Cockpit): nur echte Multi-TV-Verbund-Zeilen mit
      // ausgewiesenem Spine-Konflikt; steht VOR dem nachgestellten Aktions-Text,
      // damit das nowrap-`<td>` den Aktions-Text zuerst clippt (Badge bleibt).
      const konflikt = isStatusCockpitEnabled() && r._verbund ? renderKonflikt(r._verbund.tvs) : null;
      const konfliktEl = konflikt ? <span className="ml-1 inline-flex align-middle">{konflikt}</span> : null;
      // Terminal: Arbeit erledigt → kein farbiges Badge, nur ruhiger Status-Text.
      if (isTerminalStatus(s)) {
        return (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]" title={getStatusLabel(s)}>
            {getStatusLabel(s)}
            {konfliktEl}
            {renderHerleitung(r)}
          </span>
        );
      }
      const schritt = naechsterSchritt(s, r.precheck_status_label ?? '');
      const aktion = schritt?.aktion ?? '';
      // Inline gehalten (kein Flex): das nowrap-`<td>` (overflow:hidden +
      // text-overflow:ellipsis) clippt den nachgestellten Aktions-Text zuerst;
      // das Badge steht vorne und wird nie abgeschnitten.
      return (
        <span
          className="text-[11.5px]"
          title={aktion ? `${getStatusLabel(s)} → ${aktion}` : getStatusLabel(s)}
        >
          <Badge
            variant={getStatusVariant(s)}
            className="align-middle justify-center whitespace-nowrap text-[10.5px]"
          >
            {getStatusLabel(s)}
          </Badge>
          {konfliktEl}
          {renderHerleitung(r)}
          {aktion ? (
            <span className="ml-1.5 text-[var(--tf-text-secondary)]">→ {aktion}</span>
          ) : null}
        </span>
      );
    },
  },
  {
    // Altes reines Status-Badge — bleibt als Spalten-Picker-Option, Default AUS
    // (seit Phase 3 durch „Status und nächster Schritt" ersetzt). Bestehende
    // gespeicherte Spalten-Configs behalten diese Spalte (Migration lässt Keys
    // unangetastet, nur der Default ändert sich).
    key: 'status',
    label: 'Status',
    defaultVisible: false,
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
        <span className="inline-flex items-center">
          <Badge
            variant={getStatusVariant(s)}
            className="min-w-[100px] justify-center whitespace-nowrap text-[10.5px]"
          >
            {getStatusLabel(s)}
          </Badge>
          {renderHerleitung(r)}
        </span>
      ) : null;
    },
  },
  // Datums-Status-Spalten (FB Status / PreCheck Status): jüngstes gültiges Datum
  // über mehrere Legacy-Spalten — die *_status_label/_datum-Felder werden bei der
  // List-View-Projektion berechnet (siehe status-datum-gruppen.ts). Off by default
  // (einblendbar via Spalten-Picker).
  statusDatumColumn({
    key: 'fb_status',
    label: 'FB Status',
    variant: 'info',
    getLabel: r => r.fb_status_label,
    getDatum: r => r.fb_status_datum,
  }),
  statusDatumColumn({
    key: 'precheck_status',
    label: 'PreCheck Status',
    variant: 'default',
    getLabel: r => r.precheck_status_label,
    getDatum: r => r.precheck_status_datum,
  }),
  {
    key: 'frist',
    label: 'Frist',
    defaultVisible: true,
    sortable: true,
    width: 96,
    wrap: false,
    // Sortier-Wert bleibt der numerische „Tage bis zur Frist" (asc = dringendste
    // zuerst). Terminale/leere Fristen ans Ende → große Zahl (deckt sich mit der
    // leeren Anzeige in `render`/`fristAnzeige`). Verbund-Zeile: dringendste
    // Frist über alle TVs (kritischster TV), sonst per-TV.
    accessor: r => {
      if (r._verbund) return criticalFristAware(r._verbund.tvs) ?? Number.MAX_SAFE_INTEGER;
      if (isTerminalStatus(r.status)) return Number.MAX_SAFE_INTEGER;
      return daysUntilFristAware(r) ?? Number.MAX_SAFE_INTEGER;
    },
    // Export = lesbarer relativer Text ("in 45 T"/"seit 12 T"/"heute"), leere/
    // terminale Frist → leere Zelle (nie der Sortier-Sentinel).
    exportValue: r => {
      const a = r._verbund ? fristAnzeigeFromDays(criticalFristAware(r._verbund.tvs)) : fristAnzeige(r);
      return a?.text ?? '';
    },
    render: r => {
      const a = r._verbund ? fristAnzeigeFromDays(criticalFristAware(r._verbund.tvs)) : fristAnzeige(r);
      if (!a) return null;
      const overdue = a.ampel === 'rot';
      return (
        <span
          className={`inline-flex items-center gap-1.5 tabular-nums text-[11px] ${
            overdue ? 'text-[var(--tf-danger-text)] font-medium' : 'text-[var(--tf-text-tertiary)]'
          }`}
          title={r._verbund ? 'Dringendste Frist im Verbund' : fristTooltip(r)}
        >
          <span
            className="shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ background: AMPEL_COLOR[a.ampel] }}
            aria-hidden="true"
          />
          {a.text}
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
    filterAccessor: r => yearOfOrEmpty(r.erstentscheidung),
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
 * Präfix der Ordner-Spalten aus dem Statuskatalog. Diese Spalten stehen NICHT
 * in `ANTRAG_TABLE_COLUMNS` — welche es gibt, entscheidet die Kuration, nicht
 * der Code. Der Sichtbarkeits-Store muss sie deshalb am Präfix erkennen statt
 * an einer festen Schlüsselliste.
 */
export const KATEGORIE_COLUMN_PREFIX = 'katstatus:';

/**
 * Eine einblendbare Spalte je kuratiertem Ordner: der jüngste Eintrag des
 * Ordners als Badge, das Datum im Tooltip und als Sortierschlüssel. Bauart 1:1
 * wie die fest verdrahteten FB-/PreCheck-Spalten — nur dass die Liste aus dem
 * Katalog kommt.
 */
export function kategorieStatusColumns(
  kategorien: readonly { kategorieId: string; label: string }[],
): SortableColumn<AntragTableRow>[] {
  return kategorien.map(k => statusDatumColumn({
    key: `${KATEGORIE_COLUMN_PREFIX}${k.kategorieId}`,
    label: k.label,
    variant: 'default',
    getLabel: r => r.kat_status?.[k.kategorieId]?.l,
    getDatum: r => r.kat_status?.[k.kategorieId]?.d,
  }));
}

/**
 * Sichtbare Spalten in Registry-Reihenfolge auflösen — Single Source für Tabelle
 * (`AntraegeTable`) UND XLSX-Export (`export-xlsx.ts`), damit der Export exakt die
 * Spalten der Ansicht abbildet. Die MA-Spalte (TIB-Kürzel) ist regulär im Picker
 * wählbar; im „alle"-/Übersichtsmodus (`showMaColumn`) wird sie zusätzlich
 * automatisch erzwungen (auch ohne Picker-Auswahl) und erscheint dank Registry-
 * Reihenfolge direkt nach der gelockten FKZ-Spalte. Set-Union → kein Duplikat,
 * falls die Spalte ohnehin schon im Picker gewählt ist.
 */
export function resolveAntragTableColumns(
  visibleKeys: readonly string[],
  showMaColumn: boolean,
  kategorien: readonly { kategorieId: string; label: string }[] = [],
): SortableColumn<AntragTableRow>[] {
  const keys = new Set(visibleKeys);
  if (showMaColumn) keys.add(MA_COLUMN_KEY);
  // Ordner-Spalten hinten anhängen: die Registry-Reihenfolge ist die Lesefolge
  // der festen Spalten, die kuratierten kommen als Zusatz dazu.
  return [...ANTRAG_TABLE_COLUMNS, ...kategorieStatusColumns(kategorien)]
    .filter(c => keys.has(c.key));
}

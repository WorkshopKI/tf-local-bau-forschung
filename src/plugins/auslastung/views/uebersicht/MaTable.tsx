/**
 * MaTable — kompakte MA-Tabelle (Tabellen-View des "Mitarbeiter & Kapazität"-
 * Bereichs). Rendert eine Headerleiste mit Sort-Klick + n Rows + optional
 * eine eingerueckte Inline-Detail-Zeile fuer den aktuell expandeten MA.
 *
 * Layout (Design-Handoff `auslastung-balken`, Layout C): zwei getrennte Balken-
 * Spalten „Altlasten (Rückstand)" + „Aktuelles Quartal", jede mit EIGENER linker
 * Grundlinie. Der Altlasten-Balken skaliert relativ zum größten Rückstand aller
 * sichtbaren MAs (`maxBl`) → Zeilenvergleich. Der Aktuell-Balken bleibt Kapazitäts-
 * Auslastung in % (rot bei Überbuchung).
 *
 * Spaltenbreiten via `table-layout: fixed` + `<colgroup>`; die Grenze zwischen
 * „Altlasten" und „Aktuelles Quartal" ist per Griff **resizable** — der Nutzer
 * kann die Altlasten-Spalte schmaler ziehen (die Breite wandert live in
 * „Aktuelles Quartal", das den Rest füllt). Breite in localStorage persistiert
 * (`useColumnWidths`); Live-Drag mutiert nur die CSS-Var `--altlast-w` am
 * `<table>` (kein Row-Re-Render — Zeilen sind memoized). Doppelklick = zurück
 * auf den 30-%-Default.
 *
 * Sort-State wird vom Parent (`MaListSection`) verwaltet, damit ein spaeterer
 * Wechsel auf die Karten-View dieselbe Sortierung erbt.
 */
import { Fragment, useCallback, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useColumnWidths } from '@/components/data-table';
import type { AnonymerMitarbeiter, UeberKategorie } from '../../types';
import type { MaQuartalsAuslastung } from '../../services/kapazitaet';
import { EMPTY_AUSLASTUNG } from '../../services/kapazitaet';
import type { MaAltlastBucket } from '../../services/kapazitaet';
import type { KapazitaetsView } from '../../services/kapazitaet';
import type { KapazitaetProTypView } from '../../services/kapazitaet';
import { MaCompactRow } from './MaCompactRow';

export type SortColumn = 'ma' | 'belegt' | 'frei' | 'fest' | 'altlast' | 'kategorie' | 'status';
export type SortDir = 'asc' | 'desc';
export interface SortState {
  col: SortColumn;
  dir: SortDir;
}

interface Props {
  list: AnonymerMitarbeiter[];
  auslastungByAnon: Map<string, MaQuartalsAuslastung>;
  altlastByAnon: Map<string, MaAltlastBucket>;
  kapByAnon: Map<string, KapazitaetsView>;
  kapTypByAnon: Map<string, KapazitaetProTypView>;
  kategorien: UeberKategorie[];
  quartal: string;
  resolveName: (anonId: string) => string | null;
  expandedMa: string | null;
  onToggleExpand: (anonId: string) => void;
  sort: SortState;
  onSort: (col: SortColumn) => void;
  renderInlineDetail: (ma: AnonymerMitarbeiter) => React.ReactNode;
}

interface ColumnSpec {
  key: string;
  id: SortColumn | null;
  label: string;
  align: 'left' | 'right';
  /** CSS-Breite des `<col>` (fixed layout). */
  colWidth: string;
  /** Zonentrenner links (0.5px Border) — trennt Altlasten von „Aktuelles Quartal". */
  zoneLeft?: boolean;
  /** Header in Akzentfarbe (`--tf-akt-bar`). */
  accent?: boolean;
  /** Resize-Griff an der rechten Kante (Altlasten↔Aktuelles Quartal). */
  resizeRight?: boolean;
}

// Die Altlasten-Spalte trägt die einzige variable Breite (`--altlast-w`, Default
// 30 %). „Aktuelles Quartal" ist `auto` und füllt den Rest → schmalere Altlasten
// = breiteres Aktuelles Quartal.
const COLUMNS: ColumnSpec[] = [
  { key: 'ma', id: 'ma', label: 'MA', align: 'left', colWidth: '110px' },
  { key: 'altlast-bar', id: 'altlast', label: 'Altlasten (Rückstand)', align: 'left', colWidth: 'var(--altlast-w, 30%)', resizeRight: true },
  { key: 'aktuell-bar', id: 'belegt', label: 'Aktuelles Quartal', align: 'left', colWidth: 'auto', zoneLeft: true, accent: true },
  { key: 'fest', id: 'fest', label: 'Aktuell', align: 'right', colWidth: '84px' },
  { key: 'altlast-num', id: 'altlast', label: 'Altlast.', align: 'right', colWidth: '84px' },
  { key: 'frei', id: 'frei', label: 'Frei', align: 'right', colWidth: '72px' },
  { key: 'kategorie', id: 'kategorie', label: 'Kategorie', align: 'left', colWidth: '96px' },
  { key: 'status', id: 'status', label: 'Status', align: 'left', colWidth: '124px' },
  { key: 'actions', id: null, label: '', align: 'right', colWidth: '40px' },
];

const ALTLAST_MIN_PX = 96;
const AKTUELL_MIN_PX = 150;
const WIDTHS_LS_KEY = 'auslastung_ma_colwidths';

export function MaTable({
  list, auslastungByAnon, altlastByAnon, kapByAnon, kapTypByAnon, kategorien, quartal,
  resolveName, expandedMa, onToggleExpand, sort, onSort, renderInlineDetail,
}: Props): React.ReactElement {
  const tableRef = useRef<HTMLTableElement>(null);
  const { widths, setWidth } = useColumnWidths(WIDTHS_LS_KEY, { altlast: 0 });
  const altlastPx = widths.altlast ?? 0;
  const altlastColWidth = altlastPx > 0 ? `${altlastPx}px` : '30%';

  // Gemeinsame Skala der Altlasten-Balken: größte Rückstand-Summe über die aktuell
  // sichtbare (gefilterte) Liste. Bei Filterwechsel re-normalisiert sich die Spalte.
  const maxBl = useMemo(() => {
    let m = 0;
    for (const ma of list) {
      const band = altlastByAnon.get(ma.anonId)?.tvsProBand;
      const s = band ? band[0] + band[1] + band[2] : 0;
      if (s > m) m = s;
    }
    return m;
  }, [list, altlastByAnon]);

  // Drag der Altlasten↔Aktuelles-Quartal-Grenze. Live nur DOM-CSS-Var mutieren
  // (kein Re-Render), auf mouseup persistieren. Obergrenze so, dass „Aktuelles
  // Quartal" ≥ AKTUELL_MIN_PX bleibt.
  const startAltlastResize = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    const altTh = e.currentTarget.parentElement as HTMLElement | null;
    const aktTh = table.querySelector('th[data-col="aktuell-bar"]') as HTMLElement | null;
    const startWidth = altTh ? altTh.offsetWidth : 300;
    const aktW0 = aktTh ? aktTh.offsetWidth : AKTUELL_MIN_PX;
    const startX = e.clientX;
    const maxWidth = Math.max(ALTLAST_MIN_PX, startWidth + aktW0 - AKTUELL_MIN_PX);
    let latest = startWidth;

    function onMove(ev: MouseEvent): void {
      const next = Math.min(maxWidth, Math.max(ALTLAST_MIN_PX, startWidth + (ev.clientX - startX)));
      latest = next;
      table!.style.setProperty('--altlast-w', `${next}px`);
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setWidth('altlast', Math.round(latest));
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [setWidth]);

  const resetAltlastWidth = useCallback((): void => setWidth('altlast', 0), [setWidth]);

  return (
    <table
      ref={tableRef}
      className="w-full"
      style={{ borderCollapse: 'collapse', tableLayout: 'fixed', ['--altlast-w' as string]: altlastColWidth } as React.CSSProperties}
    >
      <colgroup>
        {COLUMNS.map(c => <col key={c.key} style={{ width: c.colWidth }} />)}
      </colgroup>
      <thead>
        <tr>
          {COLUMNS.map((c) => {
            const sortable = c.id !== null;
            const active = sortable && sort.col === c.id;
            return (
              <th
                key={c.key}
                data-col={c.key}
                className="uppercase"
                style={{
                  padding: '0 8px 6px',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: 'var(--tf-tracking-caps)',
                  textAlign: c.align,
                  color: c.accent ? 'var(--tf-akt-bar)' : 'var(--tf-text-tertiary)',
                  borderBottom: '0.5px solid var(--tf-border)',
                  borderLeft: c.zoneLeft ? '0.5px solid var(--tf-border)' : undefined,
                  cursor: sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  overflow: 'hidden',
                  position: c.resizeRight ? 'relative' : undefined,
                }}
                onClick={() => sortable && c.id && onSort(c.id)}
                aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <span
                  className="inline-flex items-center gap-1 align-middle"
                  style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {c.label}
                  {active && (sort.dir === 'asc'
                    ? <ChevronUp size={11} aria-hidden />
                    : <ChevronDown size={11} aria-hidden />
                  )}
                </span>
                {c.resizeRight && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Breite der Altlasten-Spalte anpassen (Doppelklick: zurücksetzen)"
                    title="Ziehen: Altlasten schmaler/breiter · Doppelklick: zurücksetzen"
                    onMouseDown={startAltlastResize}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={resetAltlastWidth}
                    className="absolute right-0 top-0 h-full w-[7px] cursor-col-resize hover:bg-[var(--tf-border-hover)] z-10"
                    style={{ touchAction: 'none' }}
                  />
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {list.map(ma => {
          const kapView = kapByAnon.get(ma.anonId);
          if (!kapView) return null;
          // MAs ohne aktuelle Quartals-Buchung haben keinen auslastungByAnon-
          // Eintrag (computeQuartalsAuslastung listet nur Gebuchte). Fallback auf
          // EMPTY_AUSLASTUNG, sonst wuerden Inaktive + neue MAs nie gerendert.
          const auslastung = auslastungByAnon.get(ma.anonId) ?? EMPTY_AUSLASTUNG;
          const isExpanded = expandedMa === ma.anonId;
          return (
            <Fragment key={ma.anonId}>
              <MaCompactRow
                ma={ma}
                auslastung={auslastung}
                kapView={kapView}
                kapTyp={kapTypByAnon.get(ma.anonId)}
                altlast={altlastByAnon.get(ma.anonId)}
                maxBl={maxBl}
                kategorien={kategorien}
                realName={resolveName(ma.anonId)}
                quartal={quartal}
                expanded={isExpanded}
                onToggleExpand={onToggleExpand}
              />
              {isExpanded && (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ padding: 0 }}>
                    {renderInlineDetail(ma)}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
        {list.length === 0 && (
          <tr>
            <td colSpan={COLUMNS.length} className="text-center text-[var(--tf-text-tertiary)]" style={{ padding: '32px 12px', fontSize: 12.5 }}>
              Keine MAs in dieser Auswahl.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

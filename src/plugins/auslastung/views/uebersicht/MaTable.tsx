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
 * Sort-State wird vom Parent (`MaListSection`) verwaltet, damit ein spaeterer
 * Wechsel auf die Karten-View dieselbe Sortierung erbt.
 */
import { Fragment, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  id: SortColumn | null;
  label: string;
  align: 'left' | 'right';
  /** Feste Spaltenbreite in px (0/undefined = auto). */
  width?: number;
  /** Prozentuale Breite (Balken-Spalten). */
  widthPct?: string;
  minWidth?: number;
  /** Zonentrenner links (0.5px Border) — trennt Altlasten von „Aktuelles Quartal". */
  zoneLeft?: boolean;
  /** Header in Akzentfarbe (`--tf-akt-bar`). */
  accent?: boolean;
}

const COLUMNS: ColumnSpec[] = [
  { id: 'ma', label: 'MA', align: 'left', width: 110 },
  { id: 'altlast', label: 'Altlasten (Rückstand)', align: 'left', widthPct: '30%', minWidth: 210 },
  { id: 'belegt', label: 'Aktuelles Quartal', align: 'left', widthPct: '20%', minWidth: 150, zoneLeft: true, accent: true },
  { id: 'fest', label: 'Aktuell', align: 'right', width: 80 },
  { id: 'altlast', label: 'Altlast.', align: 'right', width: 80 },
  { id: 'frei', label: 'Frei', align: 'right', width: 70 },
  { id: 'kategorie', label: 'Kategorie', align: 'left', width: 90 },
  { id: 'status', label: 'Status', align: 'left', width: 90 },
  { id: null, label: '', align: 'right', width: 30 },
];

export function MaTable({
  list, auslastungByAnon, altlastByAnon, kapByAnon, kapTypByAnon, kategorien, quartal,
  resolveName, expandedMa, onToggleExpand, sort, onSort, renderInlineDetail,
}: Props): React.ReactElement {
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

  return (
    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {COLUMNS.map((c, idx) => {
            const sortable = c.id !== null;
            const active = sortable && sort.col === c.id;
            return (
              <th
                key={idx}
                className="uppercase"
                style={{
                  padding: '0 8px 6px',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: 'var(--tf-tracking-caps)',
                  textAlign: c.align,
                  width: c.widthPct ?? (c.width || undefined),
                  minWidth: c.minWidth,
                  color: c.accent ? 'var(--tf-akt-bar)' : 'var(--tf-text-tertiary)',
                  borderBottom: '0.5px solid var(--tf-border)',
                  borderLeft: c.zoneLeft ? '0.5px solid var(--tf-border)' : undefined,
                  cursor: sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => sortable && c.id && onSort(c.id)}
                aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <span className="inline-flex items-center gap-1 align-middle">
                  {c.label}
                  {active && (sort.dir === 'asc'
                    ? <ChevronUp size={11} aria-hidden />
                    : <ChevronDown size={11} aria-hidden />
                  )}
                </span>
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

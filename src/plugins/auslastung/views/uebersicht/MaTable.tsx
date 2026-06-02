/**
 * MaTable — kompakte MA-Tabelle (Tabellen-View des "Mitarbeiter & Kapazität"-
 * Bereichs). Rendert eine Headerleiste mit Sort-Klick + n Rows + optional
 * eine eingerueckte Inline-Detail-Zeile fuer den aktuell expandeten MA.
 *
 * Sort-State wird vom Parent (`MaListSection`) verwaltet, damit ein spaeterer
 * Wechsel auf die Karten-View dieselbe Sortierung erbt.
 */
import { Fragment } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AnonymerMitarbeiter } from '../../types';
import type { MaQuartalsAuslastung } from '../../services/quartals-auslastung';
import { EMPTY_AUSLASTUNG } from '../../services/quartals-auslastung';
import type { MaAltlastBucket } from '../../services/altlast';
import type { KapazitaetsView } from '../../services/kapazitaet';
import type { KapazitaetProTypView } from '../../services/kapazitaet-pro-typ';
import { MaCompactRow } from './MaCompactRow';

export type SortColumn = 'ma' | 'auslastung' | 'belegt' | 'frei' | 'fest' | 'altlast' | 'status';
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
  quartal: string;
  stundenProTV: number;
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
  width: number;
}

const COLUMNS: ColumnSpec[] = [
  { id: 'ma', label: 'MA', align: 'left', width: 110 },
  { id: 'auslastung', label: 'Auslastung', align: 'left', width: 0 },
  { id: 'belegt', label: 'Belegt', align: 'right', width: 70 },
  { id: 'frei', label: 'Frei (TVs)', align: 'right', width: 80 },
  { id: 'fest', label: 'Aktuell', align: 'left', width: 95 },
  { id: 'altlast', label: 'Altanträge', align: 'left', width: 85 },
  { id: 'status', label: 'Status', align: 'left', width: 90 },
  { id: null, label: '', align: 'right', width: 30 },
];

export function MaTable({
  list, auslastungByAnon, altlastByAnon, kapByAnon, kapTypByAnon, quartal, stundenProTV,
  resolveName, expandedMa, onToggleExpand, sort, onSort, renderInlineDetail,
}: Props): React.ReactElement {
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
                className="uppercase text-[var(--tf-text-tertiary)]"
                style={{
                  padding: '0 8px 6px',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: 'var(--tf-tracking-caps)',
                  textAlign: c.align,
                  width: c.width || undefined,
                  borderBottom: '0.5px solid var(--tf-border)',
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
                realName={resolveName(ma.anonId)}
                quartal={quartal}
                stundenProTV={stundenProTV}
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

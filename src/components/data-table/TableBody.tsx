/**
 * Zeilen-Körper der `SortableTable`: Datenzeilen, Section-Bänder, Zell-Styles
 * und der Empty-State.
 *
 * Section-Bänder setzen voraus, dass die Rows bereits nach Section gruppiert
 * (kontiguierlich) hereinkommen — beim Wechsel des Keys wird eine volle-Breite-
 * Zeile eingeschoben. Die Zählung je Section passiert hier, weil sie sonst
 * nirgends gebraucht wird.
 */
import { Fragment, useMemo, type ReactNode } from 'react';
import type { SortableColumn } from './types';

export interface TableBodyProps<T> {
  rows: T[];
  columns: SortableColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  emptyContent?: ReactNode;
  sectionKeyOf?: (row: T) => string;
  renderSectionHeader?: (sectionKey: string, count: number) => ReactNode;
}

export function TableBody<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  isRowSelected,
  emptyContent,
  sectionKeyOf,
  renderSectionHeader,
}: TableBodyProps<T>): React.ReactElement {
  const sectionsEnabled = sectionKeyOf !== undefined && renderSectionHeader !== undefined;
  const sectionCounts = useMemo(() => {
    if (!sectionKeyOf) return null;
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = sectionKeyOf(r);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [rows, sectionKeyOf]);

  return (
    <tbody>
      {rows.map((row, idx) => {
        const isLast = idx === rows.length - 1;
        const clickable = onRowClick !== undefined;
        const selected = isRowSelected?.(row) ?? false;
        // Section-Band beim Phasen-Wechsel (inkl. erster Zeile) einschieben.
        const sectionKey = sectionsEnabled ? sectionKeyOf!(row) : null;
        const showSection = sectionsEnabled
          && (idx === 0 || sectionKeyOf!(rows[idx - 1]!) !== sectionKey);
        return (
          <Fragment key={rowKey(row)}>
            {/* `borderTop` MUSS bleiben: der `thead` traegt selbst keine
                Unterkante und denselben grauen Grund wie dieses Band. Steht
                ein Band als erste Zeile, ist diese Oberkante die einzige
                Trennung zum Tabellenkopf — ohne sie verschmelzen beide zu
                einem grauen Block. */}
            {showSection ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-1.5"
                  style={{
                    background: 'var(--tf-bg-secondary)',
                    borderTop: '0.5px solid var(--tf-border)',
                  }}
                >
                  {renderSectionHeader!(sectionKey!, sectionCounts?.get(sectionKey!) ?? 0)}
                </td>
              </tr>
            ) : null}
            <tr
              onClick={clickable ? () => onRowClick(row) : undefined}
              // `group/row`: benannte Hover-Gruppe, damit Zell-Renderer
              // Aktionen erst bei Hover ueber die ZEILE einblenden koennen
              // (`group-hover/row:…`, z.B. das Kopier-Icon der FKZ-Spalte).
              // Benannt, damit sie sich nicht mit einer `group` INNERHALB
              // einer Zelle kreuzt.
              className={clickable ? 'group/row cursor-pointer hover:bg-[var(--tf-bg-secondary)]' : 'group/row'}
              style={{
                borderTop: '0.5px solid var(--tf-border)',
                background: selected ? 'var(--tf-bg-secondary)' : undefined,
              }}
            >
              {columns.map(c => {
                // Default: Umbruch. Explizit `wrap: false` → kompakt mit ellipsis.
                const noWrap = c.wrap === false;
                return (
                  <td
                    key={c.key}
                    className="px-3 py-1 align-top leading-tight"
                    style={{
                      whiteSpace: noWrap ? 'nowrap' : 'normal',
                      wordBreak: noWrap ? undefined : 'break-word',
                      overflow: 'hidden',
                      textOverflow: noWrap ? 'ellipsis' : undefined,
                      borderBottom: !isLast ? '0.5px solid var(--tf-border)' : undefined,
                    }}
                  >
                    {c.render(row)}
                  </td>
                );
              })}
            </tr>
          </Fragment>
        );
      })}
      {rows.length === 0 && (
        <tr>
          <td
            colSpan={columns.length}
            className="px-3 py-6 text-center text-[var(--tf-text-tertiary)]"
          >
            {emptyContent ?? 'Keine Eintraege.'}
          </td>
        </tr>
      )}
    </tbody>
  );
}

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
import { ZELL_POLSTER_PX } from './tableLayout';

export interface TableBodyProps<T> {
  rows: T[];
  columns: SortableColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  emptyContent?: ReactNode;
  sectionKeyOf?: (row: T) => string;
  renderSectionHeader?: (sectionKey: string, count: number) => ReactNode;
  /** Erste Spalte beim waagerechten Scrollen stehen lassen. */
  stickyFirstColumn?: boolean;
  /** Optional: Farbe einer schmalen Kante am Zeilenanfang („Rinne") — CSS-Farbe
   *  oder `null` für keine. Sie sitzt als Innenkante IN der ersten Zelle, belegt
   *  also keine eigene Spur und fährt mit, wenn diese Zelle klebt.
   *
   *  Ohne diesen Callback ändert sich nichts; die Rinne ist eine Zutat für
   *  Tabellen, in denen eine Zeile eine Dringlichkeit trägt (Förderanträge). */
  rowAccent?: (row: T) => string | null;
  /** Trägt diese Zeile einen aufgeklappten Bereich? Nur zusammen mit
   *  `renderRowDetail` wirksam. */
  isRowExpanded?: (row: T) => boolean;
  /** Inhalt des aufgeklappten Bereichs — eine zweite, volle-Breite-`<tr>`
   *  direkt unter der Datenzeile. */
  renderRowDetail?: (row: T) => ReactNode;
  /** Innenbreite des Scrollports in px — der Deckel des aufgeklappten Bereichs.
   *  `undefined` = nicht gemessen; dann bleibt der Bereich inhaltsbreit. */
  portBreite?: number;
  /** Senkrechtes Zell-Polster. `kompakt` ist das bisherige Maß und der Default —
   *  Tabellen ohne eigene Wahl sehen unverändert aus. */
  dichte?: 'kompakt' | 'normal';
}

/** Das senkrechte Polster je Dichtestufe. Waagerecht bleibt es bei `px-3`: die
 *  Spaltenbreiten-Messung rechnet damit (`ZELL_POLSTER_PX`), und eine Dichte,
 *  die auch die Breiten verschiebt, würde die Tabelle beim Umschalten neu
 *  umbrechen statt nur zu strecken. */
const ZEILEN_POLSTER: Readonly<Record<'kompakt' | 'normal', string>> = {
  kompakt: 'py-1',
  normal: 'py-2.5',
};

/**
 * Grund der sticky-Zelle — NUR über Klassen.
 *
 * Sticky-Zellen sind durchsichtig; ohne eigenen Grund scrollt der Inhalt der
 * Nachbarspalten sichtbar dahinter durch. Die Zeile setzt ihre Selektion aber
 * per INLINE-Style und ihren Hover per Klasse. Ein Inline-`background` auf der
 * Zelle schlüge jede Hover-Klasse; deshalb werden beide Fälle hier
 * gegenseitig ausschließend gewählt (Tailwind v4 entscheidet kollidierende
 * Utilities über die Quellreihenfolge, nicht über Spezifität — beides
 * gleichzeitig anzuhängen wäre Glücksspiel).
 */
function stickyZellGrund(selected: boolean): string {
  return selected
    ? 'bg-[var(--tf-bg-secondary)]'
    : 'bg-[var(--tf-bg)] group-hover/row:bg-[var(--tf-bg-secondary)]';
}

/**
 * Ersatz für die Rahmen, die Chrome an sticky-Zellen bei
 * `border-collapse: collapse` verliert: die Oberkante der Zeile und eine
 * Trennkante zur scrollenden Fläche.
 */
const STICKY_ZELL_KANTEN = 'inset 0 0.5px 0 var(--tf-border), 1px 0 0 var(--tf-border)';

export function TableBody<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  isRowSelected,
  emptyContent,
  sectionKeyOf,
  renderSectionHeader,
  stickyFirstColumn = false,
  rowAccent,
  isRowExpanded,
  renderRowDetail,
  portBreite,
  dichte = 'kompakt',
}: TableBodyProps<T>): React.ReactElement {
  const polster = ZEILEN_POLSTER[dichte];
  const detailEnabled = isRowExpanded !== undefined && renderRowDetail !== undefined;
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
                  {/* Die `colSpan`-Zelle selbst darf NICHT sticky werden — sie
                      spannt die ganze Breite und zöge das Band mit. Nur die
                      Beschriftung bleibt links stehen; der graue Grund spannt
                      weiter über alle Spalten. */}
                  {stickyFirstColumn ? (
                    <div style={{ position: 'sticky', left: ZELL_POLSTER_PX, width: 'max-content' }}>
                      {renderSectionHeader!(sectionKey!, sectionCounts?.get(sectionKey!) ?? 0)}
                    </div>
                  ) : (
                    renderSectionHeader!(sectionKey!, sectionCounts?.get(sectionKey!) ?? 0)
                  )}
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
              {columns.map((c, ci) => {
                // Default: Umbruch. Explizit `wrap: false` → kompakt mit ellipsis.
                const noWrap = c.wrap === false;
                const sticky = stickyFirstColumn && ci === 0;
                // Die Rinne ist eine INNENkante der ersten Zelle, kein eigenes
                // Element: als `<td>` bräuchte sie eine Spur, als absolut
                // gesetzter Balken einen positionierten Vorfahren — beides in
                // einer `table-layout: fixed`-Tabelle mehr Umbau als Nutzen.
                // Als Schatten liegt sie vor den Kanten-Schatten und fährt mit,
                // wenn die Zelle klebt.
                const rinne = ci === 0 ? rowAccent?.(row) ?? null : null;
                const schatten = [
                  rinne ? `inset 3px 0 0 ${rinne}` : null,
                  sticky ? STICKY_ZELL_KANTEN : null,
                ].filter(Boolean).join(', ');
                return (
                  <td
                    key={c.key}
                    className={
                      sticky
                        ? `px-3 ${polster} align-top leading-tight ${stickyZellGrund(selected)}`
                        : `px-3 ${polster} align-top leading-tight`
                    }
                    style={{
                      whiteSpace: noWrap ? 'nowrap' : 'normal',
                      wordBreak: noWrap ? undefined : 'break-word',
                      overflow: 'hidden',
                      textOverflow: noWrap ? 'ellipsis' : undefined,
                      borderBottom: !isLast && !sticky ? '0.5px solid var(--tf-border)' : undefined,
                      ...(sticky ? { position: 'sticky', left: 0, zIndex: 10 } : null),
                      ...(schatten ? { boxShadow: schatten } : null),
                    }}
                  >
                    {c.render(row)}
                  </td>
                );
              })}
            </tr>
            {detailEnabled && isRowExpanded!(row) ? (
              <tr>
                {/* `colSpan={columns.length}` — NICHT `+1`: die Fueller-`<col>`
                    rechts hat bewusst keine Zelle je Zeile (tableSizing.ts).
                    Kein `zIndex`: der Bereich muss UNTER die stehende Kopfzeile
                    scrollen (thead 20, klebende erste Zelle 10). */}
                <td
                  colSpan={columns.length}
                  style={{
                    padding: 0,
                    background: 'var(--tf-bg-secondary)',
                    borderTop: '0.5px solid var(--tf-border)',
                  }}
                >
                  {/* Wie beim Abschnitts-Band: die `colSpan`-Zelle selbst darf
                      nicht kleben (sie zoege die ganze Breite mit), der INHALT
                      schon — sonst steht der Bereich beim waagerechten Blaettern
                      links ausserhalb des Sichtfelds.

                      `min(100%, port)` statt `max-content`: `100 %` loest gegen
                      die `colSpan`-Zelle auf (unter `table-layout: fixed` steht
                      deren Breite vor dem Inhalt fest, es gibt also keinen
                      Zirkelschluss), `min()` deckelt auf das, was man wirklich
                      sieht. Ist die Tabelle GEPINNT schmaler als der Port,
                      gewinnt `100 %` — richtig, dort gibt es nichts zu scrollen.
                      Ohne Messung bleibt es inhaltsbreit wie bis v3.31. */}
                  <div
                    style={{
                      width: portBreite !== undefined ? `min(100%, ${portBreite}px)` : 'max-content',
                      ...(stickyFirstColumn ? { position: 'sticky', left: 0 } : null),
                    }}
                  >
                    {renderRowDetail!(row)}
                  </div>
                </td>
              </tr>
            ) : null}
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

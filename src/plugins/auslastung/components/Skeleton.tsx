/**
 * Skeleton-Komponenten (v2.7) fuer Loading-States im Auslastungs-Modul.
 *
 * Reine CSS-Animation (Tailwind `animate-pulse`), kein Skeleton-Lib —
 * konsistent zum Codebase-Stil (Width-Inline-Styles, keine externen Deps).
 *
 * Verwendung:
 *  - `<SkeletonBar width="60%" />` fuer Inline-Placeholder
 *  - `<SkeletonRows count={6} columns={[80, 60, 220]} />` fuer Tabellen-Body
 */

interface SkeletonBarProps {
  /** CSS-Width — Pixel, Prozent oder beliebiger Wert. */
  width: number | string;
  /** Hoehe in Pixel. Default 12. */
  height?: number;
  className?: string;
}

export function SkeletonBar({ width, height = 12, className }: SkeletonBarProps): React.ReactElement {
  return (
    <span
      className={`inline-block rounded animate-pulse ${className ?? ''}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: `${height}px`,
        background: 'var(--tf-bg-secondary)',
        verticalAlign: 'middle',
      }}
      aria-hidden
    />
  );
}

interface SkeletonRowsProps {
  /** Anzahl der Skeleton-Zeilen. */
  count: number;
  /** Spalten-Breiten in Pixel (oder string-CSS). Definiert auch die Spalten-Anzahl. */
  columns: Array<number | string>;
  /** Zeilen-Hoehe in Pixel. Default 36. */
  rowHeight?: number;
}

export function SkeletonRows({ count, columns, rowHeight = 36 }: SkeletonRowsProps): React.ReactElement {
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: count }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-3 px-3"
          style={{
            height: `${rowHeight}px`,
            borderBottom: '0.5px solid var(--tf-border)',
          }}
        >
          {columns.map((w, colIdx) => (
            <SkeletonBar
              key={colIdx}
              width={w}
              height={12}
              className={colIdx === columns.length - 1 ? 'shrink-0' : 'shrink'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Sehr kompakte 1-Zeilen-Variante fuer Inline-Stellen (z.B. Counts).
 *  Width ist ein kleiner Default; Caller passt via Style an. */
export function SkeletonDot({ width = 18 }: { width?: number }): React.ReactElement {
  return <SkeletonBar width={width} height={11} />;
}

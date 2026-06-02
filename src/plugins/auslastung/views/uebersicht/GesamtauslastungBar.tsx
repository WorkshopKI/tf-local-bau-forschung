/**
 * GesamtauslastungBar — horizontaler Zwei-Schicht-Balken für die
 * Gesamtauslastung eines MAs (Tabelle + Karte). At-a-glance-Anzeige neben den
 * per-Antragstyp-Bars (`TypKapazitaetBars`):
 *
 *  - Schicht 1 (solide `--tf-primary`): belegt im aktuellen Quartal (`belegtPct`).
 *  - Schicht 2 (entsättigtes Primary): offene Anträge aus den beiden vorherigen
 *    Quartalen (`altlastFillPct`), ab `belegtPct` versetzt.
 *
 * Werte werden vom Caller berechnet (s. `MaCompactRow` / `MaTile`), damit die
 * Füllung exakt zur `BELEGT %`-Spalte passt. Tokenbasiert, kein Layout-Shift.
 */
import { memo } from 'react';

interface Props {
  /** Belegt-% (aktuelles Quartal). Wird auf 100 gedeckelt. */
  belegtPct: number;
  /** Zusätzlicher Füllgrad für Altanträge (bereits auf Restbreite begrenzt). */
  altlastFillPct: number;
  /** Balkenhöhe in px (default 4). */
  height?: number;
}

export const GesamtauslastungBar = memo(function GesamtauslastungBar({
  belegtPct, altlastFillPct, height = 4,
}: Props): React.ReactElement {
  const belegtWidth = Math.min(100, belegtPct);
  return (
    <div
      className="relative w-full"
      style={{ height, background: 'var(--tf-bg-secondary)', borderRadius: 'var(--tf-radius-pill)' }}
    >
      {belegtPct > 0 && (
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{ width: `${belegtWidth}%`, background: 'var(--tf-primary)', borderRadius: 'var(--tf-radius-pill)' }}
        />
      )}
      {altlastFillPct > 0 && (
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${belegtWidth}%`,
            width: `${altlastFillPct}%`,
            background: 'hsl(var(--tf-primary-h), calc(var(--tf-primary-s) * 0.4), 70%)',
            borderRadius: 'var(--tf-radius-pill)',
          }}
        />
      )}
    </div>
  );
});

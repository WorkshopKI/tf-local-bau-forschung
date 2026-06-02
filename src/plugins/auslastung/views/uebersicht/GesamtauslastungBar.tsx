/**
 * GesamtauslastungBar — zwei getrennte, untereinander liegende Balken für die
 * Kapazitäts-Sicht eines MAs (Tabelle + Karte):
 *
 *  - Balken 1 „Auslastung Quartal": belegt (`--tf-primary`, bei Überbuchung
 *    `--tf-danger-text`) — der ungefüllte Rest = noch frei.
 *  - Balken 2 „Altanträge": offene Anträge der 2 Vorquartale (entsättigtes
 *    Primary), als Anteil der Quartalskapazität.
 *
 * Beide Balken werden immer gerendert (kein Layout-Shift; leerer Track = nichts
 * offen). Jeder Balken trägt einen `title`-Tooltip (file://-kompatibel). Farben
 * spiegeln die Legende in `MaTileGrid` (Aktuell / Altanträge). Tokenbasiert.
 */
import { memo } from 'react';

const ALTLAST_COLOR = 'hsl(var(--tf-primary-h), calc(var(--tf-primary-s) * 0.4), 70%)';

interface Props {
  /** Belegt-% (aktuelles Quartal). Kann > 100 sein (überbucht). */
  belegtPct: number;
  /** Altanträge als % der Quartalskapazität (0..100). */
  altlastPct: number;
  /** Freie TVs im Quartal (für Tooltip). */
  freiTVs: number;
  /** Offene Altanträge in TVs (für Tooltip). */
  altlastTvs: number;
  /** Quartals-Label für den Tooltip, z.B. „2026-Q2". */
  quartal: string;
  /** Höhe je Balken in px (default 4). */
  height?: number;
  /** Abstand zwischen den beiden Balken in px (default 3). */
  gap?: number;
}

export const GesamtauslastungBar = memo(function GesamtauslastungBar({
  belegtPct, altlastPct, freiTVs, altlastTvs, quartal, height = 4, gap = 3,
}: Props): React.ReactElement {
  const ueberbucht = belegtPct > 100;
  const belegtWidth = Math.min(100, Math.max(0, belegtPct));
  const altlastWidth = Math.min(100, Math.max(0, altlastPct));

  const belegtTitle =
    `Auslastung ${quartal}: ${belegtPct} % belegt · ${freiTVs} ${freiTVs === 1 ? 'TV' : 'TVs'} frei`
    + (ueberbucht ? ' · überbucht' : '');
  const altlastTitle =
    `Offene Altanträge (2 Vorquartale): ${altlastTvs} ${altlastTvs === 1 ? 'TV' : 'TVs'}`;

  const trackStyle: React.CSSProperties = {
    height,
    background: 'var(--tf-bg-secondary)',
    borderRadius: 'var(--tf-radius-pill)',
  };

  return (
    <div className="flex flex-col w-full" style={{ gap }}>
      {/* Balken 1 — Auslastung im aktuellen Quartal */}
      <div className="relative w-full" style={trackStyle} title={belegtTitle}>
        {belegtWidth > 0 && (
          <div
            className="absolute top-0 bottom-0 left-0"
            style={{
              width: `${belegtWidth}%`,
              background: ueberbucht ? 'var(--tf-danger-text)' : 'var(--tf-primary)',
              borderRadius: 'var(--tf-radius-pill)',
            }}
          />
        )}
      </div>

      {/* Balken 2 — offene Altanträge der 2 Vorquartale */}
      <div className="relative w-full" style={trackStyle} title={altlastTitle}>
        {altlastWidth > 0 && (
          <div
            className="absolute top-0 bottom-0 left-0"
            style={{ width: `${altlastWidth}%`, background: ALTLAST_COLOR, borderRadius: 'var(--tf-radius-pill)' }}
          />
        )}
      </div>
    </div>
  );
});

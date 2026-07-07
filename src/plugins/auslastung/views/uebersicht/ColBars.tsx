/**
 * ColBars — die beiden nebeneinanderliegenden Balken-Spalten der MA-Tabelle
 * (Tab „Auslastung MA", Design-Handoff `auslastung-balken`, Layout C).
 *
 * Anders als `GesamtauslastungBar` (Karten-Sicht: zwei gestapelte Balken pro
 * Karte, jeweils % der eigenen Quartalskapazität) rendert jede dieser
 * Komponenten EINE Balken-Spalte mit EIGENER linker Grundlinie:
 *
 *  - `AltlastColBar`  — Rückstand: Segmente Q-1 · Q-2 · Q-3–7 (neu→alt, links→
 *    rechts), gedämpfte Blau-Rampe (`altlast-colors`), Track-Breite RELATIV zum
 *    größten Rückstand aller sichtbaren MAs (`maxBl`) → Zeilenvergleich „wer hat
 *    am meisten liegen". Zahl im Segment nur bei Anteil ≥ 10 %.
 *  - `AktuellColBar`  — aktuelles Quartal: Kapazitäts-Auslastung in % (eigene
 *    0–100-Grundlinie, KEIN Kohorten-Max), `--tf-akt-bar`, rot bei Überbuchung
 *    (`--tf-danger-text`, > 100 %). belegt% steht im Balken.
 *
 * Höhe 13px, radius 3px (Handoff-Maße). Alle Farben tokenbasiert (Light+Dark).
 */
import { memo } from 'react';
import {
  altlastBandColor,
  altlastBandTextColor,
  ALTLAST_BAND_SHORT,
} from './altlast-colors';

const BAR_HEIGHT = 13;
const BAR_RADIUS = 3;

interface AltlastProps {
  /** Offene Altanträge in TVs je Band [Q-1, Q-2, Q-3..Q-7]. */
  bandTvs: readonly [number, number, number];
  /** Größte Altlast-Summe über die sichtbaren MAs (gemeinsame Skala). */
  maxBl: number;
}

export const AltlastColBar = memo(function AltlastColBar({ bandTvs, maxBl }: AltlastProps): React.ReactElement {
  const sum = bandTvs[0] + bandTvs[1] + bandTvs[2];
  const fillWidth = maxBl > 0 ? (sum / maxBl) * 100 : 0;

  return (
    <div className="flex items-center w-full" style={{ height: BAR_HEIGHT }}>
      {sum > 0 && (
        <div
          className="flex h-full"
          style={{ width: `${fillWidth}%`, gap: 1.5, borderRadius: BAR_RADIUS, overflow: 'hidden' }}
        >
          {([0, 1, 2] as const).map((i) => {
            const tvs = bandTvs[i];
            if (tvs <= 0) return null;
            const band = (i + 1) as 1 | 2 | 3;
            const show = sum > 0 && tvs / sum >= 0.10;
            return (
              <div
                key={i}
                className="flex items-center justify-center h-full"
                style={{ flexGrow: tvs, flexBasis: 0, minWidth: 2, background: altlastBandColor(band) }}
                title={`${ALTLAST_BAND_SHORT[i]}: ${tvs} ${tvs === 1 ? 'TV' : 'TVs'}`}
              >
                {show && (
                  <span
                    className="font-mono"
                    style={{ fontSize: 9.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: altlastBandTextColor(band) }}
                  >
                    {tvs}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

interface AktuellProps {
  /** Belegt-% im aktuellen Quartal. Kann > 100 sein (überbucht). */
  belegtPct: number;
  /** Freie TVs im Quartal (für Tooltip). */
  freiTVs: number;
  /** Quartals-Label für den Tooltip, z.B. „2026-Q3". */
  quartal: string;
}

export const AktuellColBar = memo(function AktuellColBar({ belegtPct, freiTVs, quartal }: AktuellProps): React.ReactElement {
  const ueberbucht = belegtPct > 100;
  const fillW = Math.min(100, Math.max(0, belegtPct));
  const fillColor = ueberbucht ? 'var(--tf-danger-text)' : 'var(--tf-akt-bar)';
  const ring = ueberbucht
    ? '0 0 0 1.5px hsl(0, 55%, 45%, 0.28)'
    : '0 0 0 1.5px hsl(var(--tf-primary-h), 48%, 42%, 0.28)';
  // Zahl im Fill, wenn der Fill breit genug ist; sonst knapp rechts daneben.
  const inside = fillW >= 20;
  const title =
    `Auslastung ${quartal}: ${belegtPct} % belegt · ${freiTVs} ${freiTVs === 1 ? 'TV' : 'TVs'} frei`
    + (ueberbucht ? ' · überbucht' : '');

  return (
    <div className="relative w-full" style={{ height: BAR_HEIGHT }} title={title}>
      {/* Track (freie Kapazität als Referenz) */}
      <div className="absolute inset-0" style={{ background: 'var(--tf-bg-secondary)', borderRadius: BAR_RADIUS }} />
      {fillW > 0 && (
        <div
          className="absolute top-0 bottom-0 left-0 flex items-center justify-center"
          style={{ width: `${fillW}%`, background: fillColor, borderRadius: BAR_RADIUS, boxShadow: ring }}
        >
          {inside && belegtPct > 0 && (
            <span
              className="font-mono"
              style={{ fontSize: 9.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: '#ffffff' }}
            >
              {belegtPct}%
            </span>
          )}
        </div>
      )}
      {!inside && belegtPct > 0 && (
        <span
          className="absolute font-mono"
          style={{
            left: `calc(${fillW}% + 4px)`,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 9.5,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: fillColor,
          }}
        >
          {belegtPct}%
        </span>
      )}
    </div>
  );
});

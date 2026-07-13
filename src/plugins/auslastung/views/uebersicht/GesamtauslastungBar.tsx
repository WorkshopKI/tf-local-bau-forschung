/**
 * GesamtauslastungBar — zwei getrennte, untereinander liegende Balken für die
 * Kapazitäts-Sicht eines MAs (Tabelle + Karte):
 *
 *  - Balken 1 „Auslastung Quartal": belegt (`--tf-primary`, bei Überbuchung
 *    `--tf-danger-text`) — der ungefüllte Rest = noch frei.
 *  - Balken 2 „Altanträge": offene Anträge der Vorquartale, **alters-gestaffelt
 *    segmentiert** (siehe `altlast-colors`), als Anteil der Quartalskapazität.
 *    Ein pill-geclippter Track mit bis zu 3 farbigen Segmenten nebeneinander,
 *    **ältestes zuerst** (chronologisch links→rechts, konsistent mit der Tabelle):
 *    links = Q-3..Q-7 (dunkelstes) → Q-2 → Q-1 (hellstes) rechts — je älter, desto
 *    dunkler (Rampe gedreht v2.197.2). Gedämpfte Blau-Rampe (keine Severity-Farbe).
 *
 * Beide Balken werden immer gerendert (kein Layout-Shift; leerer Track = nichts
 * offen). Jeder Balken trägt einen `title`-Tooltip (file://-kompatibel). Farben
 * spiegeln die Legende in `MaTileGrid`. Tokenbasiert (Belegt) bzw. Viz-Rampe
 * (Altanträge).
 */
import { memo } from 'react';
import { altlastBandColor, altlastBandTextColor, ALTLAST_BAND_LABELS } from './altlast-colors';

interface Props {
  /** Belegt-% (aktuelles Quartal). Kann > 100 sein (überbucht). */
  belegtPct: number;
  /** Altanträge als % der Quartalskapazität je Band [Q-1, Q-2, Q-3..Q-7] (ungekappt). */
  altlastBandPct: readonly [number, number, number];
  /** Freie TVs im Quartal (für Tooltip). */
  freiTVs: number;
  /** Offene Altanträge in TVs gesamt (für Tooltip + Summe). */
  altlastTvs: number;
  /** Offene Altanträge in TVs je Band [Q-1, Q-2, Q-3..Q-7] (für Tooltip-Aufschlüsselung). */
  altlastBandTvs?: readonly [number, number, number];
  /** Quartals-Label für den Tooltip, z.B. „2026-Q2". */
  quartal: string;
  /** Höhe je Balken in px (default 5). */
  height?: number;
  /** Abstand zwischen den beiden Balken in px (default 3). */
  gap?: number;
  /** Zeigt die TVs je Altlast-Band IM Balken-Segment (wie die MA-Tabelle,
   *  `ColBars`) — nur wo das Segment breit genug ist. Default `false` (die
   *  Karten-/Tabellen-Nutzer bleiben unverändert). Braucht sinnvoll `height ≥ 12`
   *  + `altlastBandTvs`. */
  altlastZahlen?: boolean;
}

export const GesamtauslastungBar = memo(function GesamtauslastungBar({
  belegtPct, altlastBandPct, freiTVs, altlastTvs, altlastBandTvs, quartal, height = 5, gap = 3, altlastZahlen = false,
}: Props): React.ReactElement {
  const ueberbucht = belegtPct > 100;
  const belegtWidth = Math.min(100, Math.max(0, belegtPct));

  // Segmente proportional in die (auf 100 gekappte) Gesamtbreite einpassen.
  const b0 = Math.max(0, altlastBandPct[0]); // Band 1 · Q-1 · neuestes (hell)
  const b1 = Math.max(0, altlastBandPct[1]); // Band 2 · Q-2
  const b2 = Math.max(0, altlastBandPct[2]); // Band 3 · Q-3..Q-7 · ältestes (dunkel)
  const rawSum = b0 + b1 + b2;
  const totalWidth = Math.min(100, rawSum);
  const scale = rawSum > 100 ? 100 / rawSum : 1;
  // Ältestes (Q-3..Q-7) zuerst → links, dann Q-2, dann Q-1 (neuestes) rechts —
  // chronologisch links→rechts, konsistent mit der Tabellen-Balken-Spalte.
  // Farbe folgt dem Alter (dunkel = alt/links, hell = neu/rechts).
  const ordered: readonly { band: 1 | 2 | 3; pct: number }[] = [
    { band: 3, pct: b2 },
    { band: 2, pct: b1 },
    { band: 1, pct: b0 },
  ];
  let offset = 0;
  const segments = ordered.map(({ band, pct }) => {
    const width = pct * scale;
    const seg = { band, left: offset, width, color: altlastBandColor(band) };
    offset += width;
    return seg;
  });

  const belegtTitle =
    `Auslastung ${quartal}: ${belegtPct} % belegt · ${freiTVs} ${freiTVs === 1 ? 'TV' : 'TVs'} frei`
    + (ueberbucht ? ' · überbucht' : '');

  const bandTvs = altlastBandTvs ?? [0, 0, 0];
  // Tooltip liest links → rechts wie der Balken: ältestes Band (Q-3..Q-7) zuerst.
  const bandDetail = ([2, 1, 0] as const)
    .map((i) => {
      const tvs = bandTvs[i] ?? 0;
      const label = ALTLAST_BAND_LABELS[i];
      return tvs > 0 && label ? `${label}: ${tvs}` : null;
    })
    .filter(Boolean)
    .join(' · ');
  const altlastTitle =
    `Offene Altanträge: ${altlastTvs} ${altlastTvs === 1 ? 'TV' : 'TVs'}`
    + (bandDetail ? ` · ${bandDetail}` : '');

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

      {/* Balken 2 — offene Altanträge, alters-gestaffelt segmentiert.
          Track clippt (overflow hidden) → Segmente ohne eigene Rundung, damit
          es als ein durchgehender Balken mit Farbstufen liest. */}
      <div
        className="relative w-full overflow-hidden"
        style={trackStyle}
        title={altlastTitle}
      >
        {totalWidth > 0 && segments.map((s, i) => {
          if (s.width <= 0) return null;
          const tvs = bandTvs[s.band - 1] ?? 0;
          // Zahl nur, wenn das Segment breit genug ist (sonst überläuft/clippt sie).
          const zeigeZahl = altlastZahlen && tvs > 0 && s.width >= 9;
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0 flex items-center justify-center overflow-hidden"
              style={{ left: `${s.left}%`, width: `${s.width}%`, background: s.color }}
            >
              {zeigeZahl && (
                <span
                  className="font-mono"
                  style={{ fontSize: 9.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: altlastBandTextColor(s.band) }}
                >
                  {tvs}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

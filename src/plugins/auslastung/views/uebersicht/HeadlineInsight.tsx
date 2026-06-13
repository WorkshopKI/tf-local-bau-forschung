/**
 * HeadlineInsight — Headline-Card "Buchungs-Stand vs. Quartal-Fortschritt".
 *
 * Visualisiert in einer Karte:
 *  - Hauptzahl: aktuelle Buchungs-Prozent (z.B. "9 %")
 *  - "von 6.150 h gebucht" als Sub-Text
 *  - Delta-Chip: Differenz zum erwarteten Stand bei linearer Quartal-Verteilung
 *    (`bookedPct − fortschrittPct` in Prozentpunkten). Negativ → warning-Farben,
 *    positiv → success-Farben.
 *  - Dual-Bar: 8px-Track mit Booked-Segment (primary) + Now-Marker
 *    (2px-Strich in tf-text) positioniert am Quartal-Fortschritts-Prozent.
 *  - Legende unter dem Bar + Soll-Wert rechts.
 *  - Commentary einzeilig mit Ellipsis (Tooltip via `title` für abgeschnittenen Text).
 *
 * Werte kommen aus `computeQuartalsStatistik()` — keine eigene Aggregation.
 */
import { useMemo } from 'react';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { useAuslastungIndex } from '../../hooks/useAuslastungIndex';
import { computeQuartalsStatistik } from '../../services/kapazitaet';

function fmtH(n: number): string {
  return Math.round(n).toLocaleString('de-DE');
}

export function HeadlineInsight(): React.ReactElement {
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const config = useAuslastungData(s => s.data.config);
  const { auslastungByAnon } = useAuslastungIndex();

  const stats = useMemo(
    () => computeQuartalsStatistik(mitarbeiter, auslastungByAnon, config, config.aktuellesQuartal),
    [mitarbeiter, auslastungByAnon, config],
  );

  const bookedPct = stats.kapazitaet.prozent;
  const fortschrittPct = stats.quartal.fortschrittProzent;
  const deltaPP = bookedPct - fortschrittPct;
  const expectedHours = (stats.kapazitaet.effektivStunden * fortschrittPct) / 100;

  const deltaTone = deltaPP >= 0 ? 'success' : 'warning';
  const deltaLabel = deltaPP === 0
    ? '±0 pp'
    : deltaPP > 0
      ? `+${deltaPP} pp vor Plan`
      : `${deltaPP} pp hinter Plan`;

  const commentary = bookedPct >= fortschrittPct
    ? `Bei linearer Verteilung müssten zum Stichtag rund ${fmtH(expectedHours)} h gebucht sein — tatsächlich sind es ${fmtH(stats.kapazitaet.verbrauchteStunden)} h. Buchung liegt ${deltaPP} pp über Soll.`
    : `Bei linearer Verteilung müssten zum Stichtag rund ${fmtH(expectedHours)} h gebucht sein — tatsächlich sind es ${fmtH(stats.kapazitaet.verbrauchteStunden)} h. Über die Hälfte der Quartalskapazität ist noch nicht verplant.`;

  return (
    <div
      style={{
        border: '0.5px solid var(--tf-border)',
        borderRadius: 10,
        padding: '14px 16px',
        background: 'var(--tf-bg)',
      }}
    >
      <p
        className="uppercase text-[var(--tf-text-tertiary)]"
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: 'var(--tf-tracking-caps)',
        }}
      >
        Buchungs-Stand vs. Quartal-Fortschritt
      </p>

      <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mt-2">
        <span style={{ fontSize: 28, fontWeight: 500, lineHeight: 1, color: 'var(--tf-text)' }}>
          {bookedPct} %
        </span>
        <span style={{ fontSize: 13, color: 'var(--tf-text-secondary)' }}>
          von {fmtH(stats.kapazitaet.effektivStunden)} h gebucht
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: 6,
            marginLeft: 4,
            color: `var(--tf-${deltaTone}-text)`,
            background: `var(--tf-${deltaTone}-bg)`,
          }}
        >
          {deltaLabel}
        </span>
      </div>

      {/* Dual-Bar mit Now-Marker */}
      <div className="relative mt-4" style={{ height: 8 }}>
        <div
          className="absolute inset-0"
          style={{
            background: 'var(--tf-bg-secondary)',
            borderRadius: 'var(--tf-radius-pill)',
          }}
        />
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{
            width: `${Math.min(100, Math.max(0, bookedPct))}%`,
            background: 'var(--tf-primary)',
            borderRadius: 'var(--tf-radius-pill)',
            transition: 'width 200ms ease-out',
          }}
        />
        {fortschrittPct > 0 && (
          <div
            className="absolute"
            aria-hidden
            style={{
              left: `${Math.min(100, Math.max(0, fortschrittPct))}%`,
              top: -6,
              bottom: -6,
              width: 2,
              background: 'var(--tf-text)',
              borderRadius: 'var(--tf-radius-pill)',
              transform: 'translateX(-1px)',
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-3 flex-wrap gap-x-4 gap-y-1">
        <div className="flex items-center gap-3 text-[11.5px] text-[var(--tf-text-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--tf-primary)',
                display: 'inline-block',
              }}
            />
            Gebucht {fmtH(stats.kapazitaet.verbrauchteStunden)} h
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              style={{
                width: 2, height: 10,
                background: 'var(--tf-text)',
                borderRadius: 'var(--tf-radius-pill)',
                display: 'inline-block',
              }}
            />
            Heute (Tag {stats.quartal.tagAktuell})
          </span>
        </div>
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Soll bei linearer Buchung: ~{fmtH(expectedHours)} h
        </div>
      </div>

      <p
        className="mt-2 text-[var(--tf-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ fontSize: 12.5, lineHeight: 1.55 }}
        title={commentary}
      >
        {commentary}
      </p>
    </div>
  );
}

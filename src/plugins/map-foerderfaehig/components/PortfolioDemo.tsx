/**
 * Portfolio-Prinzipansicht — Sunburst mit fest verdrahteten Demo-Daten.
 *
 * Die Ansicht liest bewusst NICHTS aus dem Store: sie zeigt, wie eine
 * Portfolio-Sicht aussähe, nicht wie das Portfolio aussieht. Deshalb trägt sie
 * dauerhaft und unübersehbar das Label „Demo-Daten · Prinzipansicht".
 *
 * Rein darstellend; Geometrie aus `infografik/portfolio-demo.ts`.
 */
import { useMemo, useState } from 'react';
import {
  PORTFOLIO_DEMO, PORTFOLIO_DEMO_GESAMT, baueRingSegmente, ringPfad,
} from '../infografik/portfolio-demo';

const GROESSE = 420;
const MITTE = GROESSE / 2;
const RING_1 = { innen: 62, aussen: 128 };
const RING_2 = { innen: 132, aussen: 186 };

/** Farbabstufungen je Themenfeld — aus dem Primärton gemischt. */
function farbe(index: number, ebene: 1 | 2, aktiv: boolean): string {
  const anteil = 22 + index * 11 + (ebene === 2 ? -8 : 0) + (aktiv ? 18 : 0);
  return `color-mix(in srgb, var(--tf-primary) ${Math.min(94, anteil)}%, var(--tf-bg))`;
}

export function PortfolioDemo(): React.ReactElement {
  const segmente = useMemo(() => baueRingSegmente(), []);
  const [aktiv, setAktiv] = useState<string | null>(null);

  const gewaehlt = segmente.find(s => s.name === aktiv) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded px-3 py-2 text-[12.5px]"
        style={{
          background: 'color-mix(in srgb, var(--tf-warning-text) 12%, var(--tf-bg))',
          border: '0.5px solid var(--tf-warning-text)',
        }}
      >
        <p className="font-medium text-[var(--tf-text)]">Demo-Daten · Prinzipansicht</p>
        <p className="text-[var(--tf-text-secondary)] mt-0.5">
          {PORTFOLIO_DEMO.length} erfundene Themenfelder, {PORTFOLIO_DEMO_GESAMT} erfundene
          Anträge. Es fliesst keine einzige echte Antragszahl ein. ZIM ist technologie- und
          branchenoffen — eine Themen-Taxonomie wie diese ist gesetzt, nicht abgeleitet.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-6">
        <svg
          viewBox={`0 0 ${GROESSE} ${GROESSE}`}
          width={GROESSE}
          height={GROESSE}
          role="img"
          aria-label="Sunburst der Themenfelder (Demo-Daten)"
          className="max-w-full shrink-0"
        >
          {segmente.map(s => {
            const ring = s.ebene === 1 ? RING_1 : RING_2;
            const ist = s.name === aktiv;
            return (
              <path
                key={`${s.ebene}-${s.name}`}
                d={ringPfad(s, MITTE, ring.innen, ring.aussen)}
                fill={farbe(s.farbIndex, s.ebene, ist)}
                stroke="var(--tf-bg)"
                strokeWidth={1.5}
                onMouseEnter={() => setAktiv(s.name)}
                onMouseLeave={() => setAktiv(null)}
                style={{ cursor: 'default' }}
              />
            );
          })}

          <text
            x={MITTE} y={MITTE - 6} textAnchor="middle"
            fill="var(--tf-text)" fontSize={26} fontWeight={500}
          >
            {PORTFOLIO_DEMO_GESAMT}
          </text>
          <text
            x={MITTE} y={MITTE + 14} textAnchor="middle"
            fill="var(--tf-text-tertiary)" fontSize={11}
          >
            Anträge (fiktiv)
          </text>
        </svg>

        <div className="flex-1 min-w-0 w-full">
          {gewaehlt !== null ? (
            <div className="mb-3">
              <p className="text-[13px] font-medium text-[var(--tf-text)]">{gewaehlt.name}</p>
              <p className="text-[12px] text-[var(--tf-text-secondary)]">
                {gewaehlt.anzahl} Anträge ·{' '}
                {((gewaehlt.anzahl / PORTFOLIO_DEMO_GESAMT) * 100).toLocaleString('de-DE', {
                  maximumFractionDigits: 1,
                })} % des fiktiven Portfolios
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3">
              Über ein Segment fahren für Details.
            </p>
          )}

          <ul className="flex flex-col gap-1">
            {PORTFOLIO_DEMO.map((thema, i) => (
              <li key={thema.name} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: farbe(i, 1, false) }}
                />
                <span className="text-[12.5px] text-[var(--tf-text)] flex-1 truncate">
                  {thema.name}
                </span>
                <span className="text-[12px] text-[var(--tf-text-tertiary)] tabular-nums shrink-0">
                  {thema.anzahl}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
        Ausbaupfad: Statt erfundener Themen tragen deterministische Dimensionen mehr —
        etwa Projektform × Grössenklasse als Abbild der Fördersatzmatrix, oder eine
        Befund-Landkarte über die tatsächlichen Prüfergebnisse.
      </p>
    </div>
  );
}

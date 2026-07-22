/**
 * Geteilte Zeitachsen-Geometrie für die Zeitplan-Ansichten (Paket 3). Aus
 * `GanttZeitplan` extrahiert, damit „Nach AP" und „Nach Person" (Schwimmbahnen)
 * exakt dieselbe X-Achse, Gridlines und Leerflächen-Annotation teilen (statt zu
 * kopieren). Reine Geometrie (`macheAchse`) + zwei winzige SVG-Fragmente.
 *
 * Ursprung exakt: linke Plot-Kante = Beginn M1 = erste Gridline; Monat m →
 * `plotLeft + (m − 1) · monatBreite`. `x` akzeptiert auch **fraktionale**
 * Positionen (`posStart`/`posEnde`) — ein Balken belegt `[x(p1) … x(p2))`.
 */
import type { ReactElement } from 'react';

export const GANTT_W = 1000;
export const GANTT_ROW_H = 30;
export const GANTT_KOPF_H = 26;
export const GANTT_LABEL_W = 210;
export const GANTT_PM_W = 48;
export const GANTT_PLOT_LEFT = GANTT_LABEL_W + GANTT_PM_W + 16;
export const GANTT_PLOT_RIGHT = GANTT_W - 16;
export const GANTT_PLOT_W = GANTT_PLOT_RIGHT - GANTT_PLOT_LEFT;

export interface GanttAchse {
  /** Anzahl Monate der Achse (≥ 1). */
  monate: number;
  /** Pixel pro Monat. */
  mw: number;
  /** Monat (ganz oder fraktional) → X-Pixel. `x(1) === GANTT_PLOT_LEFT`. */
  x: (monat: number) => number;
  /** Monate mit Gridline/Label (M1, M4, …). */
  gridMonate: number[];
  /** Rechte Plot-Kante — folgt der Zeichenbreite, nicht der Konstanten. */
  plotRight: number;
}

/**
 * Baut die X-Achse aus dem Monats-Horizont (`achseMax`).
 *
 * `gesamtBreite` ist die Breite des viewBox in SVG-Einheiten. Wer sie mitgibt,
 * zeichnet 1 Einheit = 1 CSS-Pixel und hält damit Schriftgrößen unabhängig von
 * der Panel-Breite; ohne Angabe bleibt es beim festen `GANTT_W`.
 */
export function macheAchse(achseMax: number, gesamtBreite: number = GANTT_W): GanttAchse {
  const monate = Math.max(1, achseMax);
  const plotRight = gesamtBreite - 16;
  const mw = (plotRight - GANTT_PLOT_LEFT) / monate;
  const x = (monat: number): number => GANTT_PLOT_LEFT + (monat - 1) * mw;
  const gridMonate: number[] = [];
  for (let m = 1; m <= monate; m += 3) gridMonate.push(m);
  return { monate, mw, x, gridMonate, plotRight };
}

/** Vertikale Gridlines + Monats-Labels (M1, M4, …). */
export function GanttGrid({ achse, hoehe }: { achse: GanttAchse; hoehe: number }): ReactElement {
  return (
    <>
      {achse.gridMonate.map(m => (
        <g key={`grid-${m}`}>
          <line x1={achse.x(m)} y1={GANTT_KOPF_H - 6} x2={achse.x(m)} y2={hoehe - 4} stroke="var(--tf-border)" strokeWidth={0.5} />
          <text x={achse.x(m)} y={14} fill="var(--tf-text-tertiary)" fontSize={11}>M{m}</text>
        </g>
      ))}
    </>
  );
}

/**
 * Leerflächen-Annotation „ab M x keine APs in <Quelle> terminiert", wenn ≥ 3 Monate
 * nach dem letzten Balken frei bleiben. `anzahlZeilen` = Zeilen/Bahnen (für die
 * vertikale Zentrierung), `letzterMonat` = letzter terminierter Monat.
 */
export function GanttLeerAnnotation({
  achse, letzterMonat, anzahlZeilen, quelleLabel,
}: {
  achse: GanttAchse;
  letzterMonat: number;
  anzahlZeilen: number;
  quelleLabel: string;
}): ReactElement | null {
  if (!(letzterMonat > 0 && achse.monate >= letzterMonat + 3)) return null;
  return (
    <text
      x={(achse.x(letzterMonat + 1) + achse.plotRight) / 2}
      y={GANTT_KOPF_H + (anzahlZeilen * GANTT_ROW_H) / 2}
      textAnchor="middle"
      fill="var(--tf-text-tertiary)"
      fontSize={12}
    >
      ab M{letzterMonat + 1} keine APs in {quelleLabel} terminiert
    </text>
  );
}

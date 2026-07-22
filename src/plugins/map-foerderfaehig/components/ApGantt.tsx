/**
 * Arbeitspaket-Gantt. Nutzt die Achsen-Geometrie der Antrag-Aufbereitung
 * (`macheAchse`, `GanttGrid`, `GanttLeerAnnotation`) — dieselbe X-Achse wie die
 * dortigen Zeitplan-Ansichten, statt einer zweiten Rechnung.
 *
 * Der viewBox wächst mit dem Panel (`zeichenBreite`): 1 SVG-Einheit = 1 CSS-Pixel.
 * Ein viewBox fester Breite würde im breiten Prüfblatt hochskaliert — und mit ihm
 * jede Schrift und jeder Balken. Die Maße hier sind also echte Pixel.
 *
 * Rein darstellend: alle Positionen kommen fertig aus `ansicht/gantt-daten.ts`.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import {
  GANTT_KOPF_H, GANTT_LABEL_W, GANTT_PM_W, GANTT_PLOT_LEFT, GANTT_ROW_H, GANTT_W,
  GanttGrid, GanttLeerAnnotation, macheAchse,
} from '@/plugins/antraege/aufbereitung/GanttAchse';
import type { GanttDaten } from '../ansicht/gantt-daten';
import { letzterTerminierterMonat, zeichenBreite } from '../ansicht/gantt-daten';

/** Einzige Farbe der Ansicht — markiert Arbeitspakete über der PM-Grenze. */
const WARN = 'var(--tf-warning-text)';
/** Balkenhöhe in px — Handoff-Maß, unabhängig von der Zeilenhöhe. */
const BALKEN_H = 12;

/** Container-Breite in CSS-Pixeln; `null`, solange nicht gemessen. */
function useContainerBreite(): [React.RefObject<HTMLDivElement | null>, number | null] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [breite, setBreite] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([eintrag]) => {
      setBreite(eintrag?.contentRect.width ?? null);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, breite];
}

export function ApGantt({ daten }: { daten: GanttDaten }): React.ReactElement {
  const [ref, gemessen] = useContainerBreite();
  const breite = zeichenBreite(gemessen, GANTT_W);
  const achse = macheAchse(daten.achseMax, breite);
  const hoehe = GANTT_KOPF_H + daten.zeilen.length * GANTT_ROW_H + 8;

  return (
    <div className="flex flex-col gap-2" ref={ref}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${breite} ${hoehe}`} width="100%" role="img" aria-label="Arbeitspakete im Zeitverlauf">
          <GanttGrid achse={achse} hoehe={hoehe} />

          {daten.zeilen.map((zeile, i) => {
            const y = GANTT_KOPF_H + i * GANTT_ROW_H;
            const x1 = achse.x(zeile.posStart);
            const balkenBreite = Math.max(2, achse.x(zeile.posEnde) - x1);
            return (
              <g key={`${zeile.laufnummer ?? 'x'}-${zeile.name}`}>
                <text
                  x={0} y={y + GANTT_ROW_H / 2 + 4}
                  fill="var(--tf-text)" fontSize={12}
                >
                  {zeile.name.length > 30 ? `${zeile.name.slice(0, 29)}…` : zeile.name}
                </text>
                <text
                  x={GANTT_LABEL_W + GANTT_PM_W} y={y + GANTT_ROW_H / 2 + 4}
                  textAnchor="end"
                  fill={zeile.auffaellig ? WARN : 'var(--tf-text-tertiary)'}
                  fontSize={11}
                >
                  {zeile.aufwandPm === null ? '—' : `${zeile.aufwandPm} PM`}
                </text>
                <rect
                  x={x1} y={y + (GANTT_ROW_H - BALKEN_H) / 2} width={balkenBreite} height={BALKEN_H} rx={BALKEN_H / 2}
                  fill={zeile.auffaellig ? WARN : 'var(--tf-text-tertiary)'}
                  opacity={zeile.auffaellig ? 0.85 : 0.45}
                />
              </g>
            );
          })}

          <GanttLeerAnnotation
            achse={achse}
            letzterMonat={letzterTerminierterMonat(daten)}
            anzahlZeilen={daten.zeilen.length}
            quelleLabel="der Einreichung"
          />

          {daten.zeilen.length === 0 && (
            <text
              x={GANTT_PLOT_LEFT} y={GANTT_KOPF_H + 18}
              fill="var(--tf-text-tertiary)" fontSize={12}
            >
              Keine terminierten Arbeitspakete
            </text>
          )}
        </svg>
      </div>

      {daten.ohneTermin.length > 0 && (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">
          Ohne Termin und daher nicht dargestellt: {daten.ohneTermin.join(', ')}
        </p>
      )}
    </div>
  );
}

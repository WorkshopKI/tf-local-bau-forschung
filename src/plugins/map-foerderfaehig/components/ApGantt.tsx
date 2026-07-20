/**
 * Arbeitspaket-Gantt. Nutzt die Achsen-Geometrie der Antrag-Aufbereitung
 * (`macheAchse`, `GanttGrid`, `GanttLeerAnnotation`) — dieselbe X-Achse wie die
 * dortigen Zeitplan-Ansichten, statt einer zweiten Rechnung.
 *
 * Rein darstellend: alle Positionen kommen fertig aus `ansicht/gantt-daten.ts`.
 */
import {
  GANTT_KOPF_H, GANTT_LABEL_W, GANTT_PM_W, GANTT_PLOT_LEFT, GANTT_ROW_H, GANTT_W,
  GanttGrid, GanttLeerAnnotation, macheAchse,
} from '@/plugins/antraege/aufbereitung/GanttAchse';
import type { GanttDaten } from '../ansicht/gantt-daten';
import { letzterTerminierterMonat } from '../ansicht/gantt-daten';

/** Einzige Farbe der Ansicht — markiert Arbeitspakete über der PM-Grenze. */
const WARN = 'var(--tf-warning, #f59e0b)';

export function ApGantt({ daten }: { daten: GanttDaten }): React.ReactElement {
  const achse = macheAchse(daten.achseMax);
  const hoehe = GANTT_KOPF_H + daten.zeilen.length * GANTT_ROW_H + 8;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${GANTT_W} ${hoehe}`} width="100%" role="img" aria-label="Arbeitspakete im Zeitverlauf">
          <GanttGrid achse={achse} hoehe={hoehe} />

          {daten.zeilen.map((zeile, i) => {
            const y = GANTT_KOPF_H + i * GANTT_ROW_H;
            const x1 = achse.x(zeile.posStart);
            const breite = Math.max(2, achse.x(zeile.posEnde) - x1);
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
                  x={x1} y={y + 7} width={breite} height={GANTT_ROW_H - 14} rx={4}
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

/**
 * Handgebauter SVG-Gantt für den Zeitplan-Tab „Nach AP" (pure — Props = `ApZeile[]`
 * + Befund-Markierungen). BEWUSST ohne Chart-Library. Monochrom; einzige Farbe ist
 * der Warning-Dot bei Zeitraum-Abweichungen. Achsen-/Gridline-/Leerflächen-Geometrie
 * kommt aus dem geteilten `GanttAchse` (identische Achse wie die Schwimmbahnen).
 *
 * Ursprung exakt: linke Plot-Kante = Beginn M1 = erste Gridline; ein AP mit
 * `monatStart = 1` beginnt AUF dieser Linie. Ein Balken M[s…e] belegt `[x(s) … x(e+1))`.
 * Diese Ansicht nutzt bewusst die **ganzen** Monate (`monatStart`/`monatEnde`) — die
 * tagesgenauen `posStart`/`posEnde` sind der Schwimmbahnen-Ansicht vorbehalten.
 */
import type { ApZeile } from './tabellen';
import {
  GANTT_ROW_H, GANTT_KOPF_H, GANTT_PLOT_LEFT,
  macheAchse, useGanttBreite, GanttGrid, GanttLeerAnnotation,
} from './GanttAchse';

interface GanttProps {
  zeilen: ApZeile[];
  /** Monat, bis zu dem die X-Achse reicht (max über beide Quellen). */
  achseMax: number;
  /** AP-Nummern mit `zeitraum-abweichung` (Warning-Dot am Zeilenanfang). */
  abweichungsNummern: Set<string>;
  /** Quelle des angezeigten Zeitplans (für die Leerflächen-Annotation). */
  quelleLabel: string;
}

const WARN = '#f59e0b'; // amber-500 — semantische Ausnahme (DESIGN_GUIDE: Dots dürfen Farbe tragen)

const kuerze = (s: string, n = 32): string => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function GanttZeitplan({ zeilen, achseMax, abweichungsNummern, quelleLabel }: GanttProps): React.ReactElement {
  const [svgRef, breite] = useGanttBreite<SVGSVGElement>();
  const achse = macheAchse(achseMax, breite);
  const { mw, x } = achse;

  const kinderVon = (nummer: string): ApZeile[] =>
    zeilen.filter(z => z.istUnterAp && z.nummer.trim().startsWith(nummer.trim() + '.'));

  const H = GANTT_KOPF_H + zeilen.length * GANTT_ROW_H + 8;

  // Leerflächen-Annotation: ≥ 3 Monate nach dem letzten Balken frei?
  const letzterMonat = zeilen.reduce((max, z) => Math.max(max, z.monatEnde ?? z.monatStart ?? 0), 0);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${breite} ${H}`} width="100%" role="img" aria-label="Gantt-Diagramm des Projektplans"
      style={{ display: 'block', maxWidth: '100%' }}>
      <GanttGrid achse={achse} hoehe={H} />
      <GanttLeerAnnotation achse={achse} letzterMonat={letzterMonat} anzahlZeilen={zeilen.length} quelleLabel={quelleLabel} />

      {/* Zeilen */}
      {zeilen.map((z, i) => {
        const y = GANTT_KOPF_H + i * GANTT_ROW_H;
        const mid = y + GANTT_ROW_H / 2;
        const kinder = z.istUnterAp ? [] : kinderVon(z.nummer);
        const hatKinder = kinder.length > 0;
        const warn = abweichungsNummern.has(z.nummer.trim());

        // Effektive Spanne: Ober-AP mit Kindern aus min/max der Kinder.
        const starts = hatKinder ? kinder.map(k => k.monatStart ?? k.monatEnde ?? 0).filter(Boolean) : [];
        const enden = hatKinder ? kinder.map(k => k.monatEnde ?? k.monatStart ?? 0).filter(Boolean) : [];
        const s = hatKinder ? Math.min(...starts) : z.monatStart;
        const e = hatKinder ? Math.max(...enden) : z.monatEnde ?? z.monatStart;

        // PM-Anzeige: Ober-AP mit Kindern = Summe der Kinder, sonst eigener Wert.
        const pmWert = hatKinder
          ? kinder.reduce((sum, k) => sum + (k.pm ?? 0), 0)
          : z.pm;

        const labelX = z.istUnterAp ? 20 : 4;
        const nummerLabel = z.istUnterAp ? z.nummer : `AP ${z.nummer}`;

        return (
          <g key={`${z.nummer}-${i}`}>
            {warn ? <circle cx={9} cy={mid} r={3} fill={WARN} /> : null}
            <text x={labelX} y={mid + 3.5} fontSize={12.5}
              fill={z.istUnterAp ? 'var(--tf-text-secondary)' : 'var(--tf-text)'}
              fontWeight={z.istUnterAp ? 400 : 500}>
              {nummerLabel}
            </text>
            <text x={labelX + (z.istUnterAp ? 34 : 42)} y={mid + 3.5} fontSize={12.5}
              fill={z.istUnterAp ? 'var(--tf-text-secondary)' : 'var(--tf-text)'}>
              {kuerze(z.bezeichnung, z.istUnterAp ? 24 : 26)}
            </text>
            {pmWert != null && pmWert > 0 ? (
              <text x={GANTT_PLOT_LEFT - 14} y={mid + 3.5} fontSize={11} textAnchor="end" fill="var(--tf-text-tertiary)">
                {pmWert} PM
              </text>
            ) : null}

            {/* Balken (Leaf) bzw. Klammer (Ober-AP mit Kindern) */}
            {s != null && e != null && e >= s ? (
              hatKinder ? (
                <path
                  d={`M ${x(s)} ${mid + 3} L ${x(s)} ${mid - 4} L ${x(e + 1)} ${mid - 4} L ${x(e + 1)} ${mid + 3}`}
                  fill="none" stroke="var(--tf-text-secondary)" strokeWidth={1} opacity={0.75}
                />
              ) : (
                <rect x={x(s)} y={mid - 4} width={Math.max(2, (e - s + 1) * mw)} height={8} rx={4}
                  fill="var(--tf-text-secondary)" opacity={0.75} />
              )
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

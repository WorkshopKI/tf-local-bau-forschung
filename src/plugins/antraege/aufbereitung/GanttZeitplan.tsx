/**
 * Handgebauter SVG-Gantt für den Zeitplan-Tab (pure — Props = `ApZeile[]` +
 * Befund-Markierungen). BEWUSST ohne Chart-Library. Monochrom; einzige Farbe ist
 * der Warning-Dot bei Zeitraum-Abweichungen.
 *
 * Ursprung exakt: linke Plot-Kante = Beginn M1 = erste Gridline; ein AP mit
 * `monatStart = 1` beginnt AUF dieser Linie. Monat m → Gridline bei
 * `plotLeft + (m − 1) · monatBreite`; ein Balken M[s…e] belegt `[x(s) … x(e+1))`.
 */
import type { ApZeile } from './tabellen';

interface GanttProps {
  zeilen: ApZeile[];
  /** Monat, bis zu dem die X-Achse reicht (max über beide Quellen). */
  achseMax: number;
  /** AP-Nummern mit `zeitraum-abweichung` (Warning-Dot am Zeilenanfang). */
  abweichungsNummern: Set<string>;
  /** Quelle des angezeigten Zeitplans (für die Leerflächen-Annotation). */
  quelleLabel: string;
}

const W = 1000;
const ROW_H = 30;
const KOPF_H = 26;
const LABEL_W = 210;
const PM_W = 48;
const PLOT_LEFT = LABEL_W + PM_W + 16;
const PLOT_RIGHT = W - 16;
const PLOT_W = PLOT_RIGHT - PLOT_LEFT;
const WARN = '#f59e0b'; // amber-500 — semantische Ausnahme (DESIGN_GUIDE: Dots dürfen Farbe tragen)

const kuerze = (s: string, n = 32): string => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function GanttZeitplan({ zeilen, achseMax, abweichungsNummern, quelleLabel }: GanttProps): React.ReactElement {
  const monate = Math.max(1, achseMax);
  const mw = PLOT_W / monate;
  const x = (monat: number): number => PLOT_LEFT + (monat - 1) * mw;

  const kinderVon = (nummer: string): ApZeile[] =>
    zeilen.filter(z => z.istUnterAp && z.nummer.trim().startsWith(nummer.trim() + '.'));

  const H = KOPF_H + zeilen.length * ROW_H + 8;

  // Gridlines + Labels alle 3 Monate (M1, M4, …).
  const gridMonate: number[] = [];
  for (let m = 1; m <= monate; m += 3) gridMonate.push(m);

  // Leerflächen-Annotation: ≥ 3 Monate nach dem letzten Balken frei?
  const letzterMonat = zeilen.reduce((max, z) => Math.max(max, z.monatEnde ?? z.monatStart ?? 0), 0);
  const zeigeLeerAnnotation = letzterMonat > 0 && monate >= letzterMonat + 3;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gantt-Diagramm des Projektplans"
      style={{ display: 'block', maxWidth: '100%' }}>
      {/* Gridlines + Monats-Labels */}
      {gridMonate.map(m => (
        <g key={`grid-${m}`}>
          <line x1={x(m)} y1={KOPF_H - 6} x2={x(m)} y2={H - 4} stroke="var(--tf-border)" strokeWidth={0.5} />
          <text x={x(m)} y={14} fill="var(--tf-text-tertiary)" fontSize={11}>M{m}</text>
        </g>
      ))}

      {/* Leerflächen-Annotation */}
      {zeigeLeerAnnotation ? (
        <text
          x={(x(letzterMonat + 1) + PLOT_RIGHT) / 2}
          y={KOPF_H + (zeilen.length * ROW_H) / 2}
          textAnchor="middle"
          fill="var(--tf-text-tertiary)"
          fontSize={12}
        >
          ab M{letzterMonat + 1} keine APs in {quelleLabel} terminiert
        </text>
      ) : null}

      {/* Zeilen */}
      {zeilen.map((z, i) => {
        const y = KOPF_H + i * ROW_H;
        const mid = y + ROW_H / 2;
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
              <text x={PLOT_LEFT - 14} y={mid + 3.5} fontSize={11} textAnchor="end" fill="var(--tf-text-tertiary)">
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

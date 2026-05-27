/**
 * Sparkline — 52×11 Inline-SVG-Polyline für den Verlauf-Spalten-Slot.
 *
 * **Phase 1**: Es gibt im Datenmodell (`useAuslastungIndex`) noch kein
 * Wochen-Verlauf-Aggregat. Der Slot rendert daher einen gestrichelt-grauen
 * Platzhalter (3 kurze Striche). Sobald `weeklyTrendByAnon` als Aggregat
 * existiert, wird der `data?: number[]`-Prop befüllt und die Polyline
 * gezeichnet (linearer Map auf 52×11).
 *
 * Bei `inactive` (z.B. "Ohne Buchung"-Zeile) bleibt die Linie gestrichelt
 * — bewusste visuelle Konsistenz mit dem Handoff-Design.
 */
interface Props {
  /** Optional: Reihe von Werten, die als Polyline gezeichnet wird. */
  data?: number[];
  /** Wenn true: gestrichelt-grau (Default für Placeholder + "Ohne Buchung"). */
  inactive?: boolean;
}

const W = 52;
const H = 11;

export function Sparkline({ data, inactive }: Props): React.ReactElement {
  // Placeholder: drei kurze gestrichelte Striche.
  if (!data || data.length === 0 || inactive) {
    return (
      <svg width={W} height={H} aria-hidden>
        <line
          x1={2} y1={H / 2} x2={W - 2} y2={H / 2}
          stroke="var(--tf-text-tertiary)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.6}
        />
      </svg>
    );
  }

  // Min/Max für Y-Skala.
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = Math.max(1e-6, maxV - minV);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * (W - 2) + 1;
    const y = (H - 2) - ((v - minV) / range) * (H - 4) + 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <svg width={W} height={H} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="hsl(215, 35%, 50%)"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

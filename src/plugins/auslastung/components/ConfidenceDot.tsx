/** Farbiger Punkt fuer Confidence-Anzeige (gruen/gelb/rot). */
interface Props {
  confidence: 'high' | 'medium' | 'low';
  size?: 'sm' | 'md';
  /** v2.34: Klassifizierung wurde von Hand (per Pill-Klick) vergeben. Dann ist
   *  der Punkt immer gruen — eine menschliche Entscheidung gilt als sicher —
   *  mit eigenem Tooltip, unabhaengig vom numerischen Confidence-Wert. */
  manuell?: boolean;
}

const COLORS: Record<Props['confidence'], string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-rose-500',
};

const LABELS: Record<Props['confidence'], string> = {
  high: 'Hohe Sicherheit',
  medium: 'Mittlere Sicherheit',
  low: 'Niedrige Sicherheit',
};

const MANUELL_LABEL = 'Von Hand klassifiziert';

export function ConfidenceDot({ confidence, size = 'sm', manuell = false }: Props): React.ReactElement {
  const dim = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  const color = manuell ? 'bg-emerald-500' : COLORS[confidence];
  const label = manuell ? MANUELL_LABEL : LABELS[confidence];
  return (
    <span
      className={`inline-block rounded-full ${color} ${dim}`}
      title={label}
      aria-label={label}
    />
  );
}

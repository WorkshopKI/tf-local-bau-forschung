/** Farbiger Punkt fuer Confidence-Anzeige (gruen/gelb/rot). */
interface Props {
  confidence: 'high' | 'medium' | 'low';
  size?: 'sm' | 'md';
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

export function ConfidenceDot({ confidence, size = 'sm' }: Props): React.ReactElement {
  const dim = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  return (
    <span
      className={`inline-block rounded-full ${COLORS[confidence]} ${dim}`}
      title={LABELS[confidence]}
      aria-label={LABELS[confidence]}
    />
  );
}

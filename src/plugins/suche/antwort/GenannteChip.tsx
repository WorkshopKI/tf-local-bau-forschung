/**
 * „nur die genannten (13)" — der Filter auf die Vorhaben, die die Antwort nennt.
 *
 * Er steht NACH den Facetten in derselben Zeile, weil er nach ihnen filtert:
 * seine Zahl ist auf der Menge gezählt, die sie übriglassen. Andersherum
 * versprächen die Facettenzahlen etwas, das der Chip danach wieder wegnimmt
 * („eine Facettenzahl ist eine Zusage").
 *
 * Er erscheint nur, wenn die Antwort überhaupt Vorhaben genannt hat — ein
 * Filter auf eine leere Menge wäre eine Sackgasse mit Bedienelement.
 */
import { Sparkles } from 'lucide-react';

export function GenannteChip({
  anzahl, aktiv, onToggle,
}: {
  /** Wie viele Treffer die Antwort nennt. Bei 0 rendert der Chip nichts. */
  anzahl: number;
  aktiv: boolean;
  onToggle: () => void;
}): React.ReactElement | null {
  if (anzahl <= 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={aktiv}
      title={aktiv
        ? 'Wieder alle Treffer zeigen'
        : 'Nur die Vorhaben zeigen, die die Antwort oben nennt'}
      className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] cursor-pointer"
      style={aktiv
        ? { background: 'var(--tf-primary)', color: 'var(--tf-on-primary)' }
        : { border: '0.5px solid var(--tf-primary)', color: 'var(--tf-primary)' }}
    >
      <Sparkles size={11} aria-hidden />
      nur die genannten
      <span className={aktiv ? '' : 'text-[var(--tf-text-tertiary)]'}>{anzahl}</span>
    </button>
  );
}

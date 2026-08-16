import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterChipProps {
  /** Filter-Name; wird als „Label:" vorangestellt. */
  label: string;
  /** Aktueller Wert (rechts vom Label). */
  value?: React.ReactNode;
  /** Klick auf den Chip (z.B. Dropdown öffnen / Toggle). Ignoriert, wenn
   *  `onRemove` gesetzt ist (dann ist der Klick = Entfernen). */
  onClick?: () => void;
  /** Wenn gesetzt: zeigt ein ✕ und der Klick ruft onRemove. */
  onRemove?: () => void;
  title?: string;
  className?: string;
}

/**
 * Abgerundeter Filter-Chip „Label: Wert" (optional entfernbar). Domänenfrei —
 * destilliert aus ActiveFilterChips. Styling über --tf-*-Tokens.
 */
export function FilterChip({
  label,
  value,
  onClick,
  onRemove,
  title,
  className,
}: FilterChipProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onRemove ?? onClick}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px]',
        // Weisser Grund, nicht die leichte Grundfläche: der Chip steht auf
        // Werkzeug-Bändern, die selbst diese Fläche tragen (Förderanträge seit
        // v4.68) — dort wäre er sonst nur ein Rahmen. Auf weissem Grund trennt
        // ihn weiterhin seine Kontur.
        'bg-[var(--tf-bg)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] transition-colors',
        className,
      )}
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="text-[var(--tf-text-secondary)]">{label}:</span>
      {value != null && <span className="truncate max-w-[180px]">{value}</span>}
      {onRemove != null && <X size={12} className="text-[var(--tf-text-tertiary)]" />}
    </button>
  );
}

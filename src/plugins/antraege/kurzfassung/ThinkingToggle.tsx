/**
 * Pro-Generierung-Schalter „Thinking" (Reasoning) — sitzt neben den Generieren-
 * Buttons. Default kommt aus der Einstellung (KI-Assistent), kann hier aber pro
 * Lauf übersteuert werden (z.B. „Neu" mit Thinking für eine bessere Fassung).
 *
 * Toggleable-Pill-Muster (DESIGN_GUIDE Kap. 5 / Pitfall #14): konstante Breite,
 * Inaktiv = outline-only (NICHT `opacity-40`, das wirkt wie disabled).
 */
import { Brain } from 'lucide-react';

interface Props {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ThinkingToggle({ enabled, onChange, disabled }: Props): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      title={enabled
        ? 'Thinking aktiv — die KI „denkt" vor der Antwort (langsamer, oft bessere Fassung). Der Denkprozess wird unten angezeigt.'
        : 'Thinking aus — schnellere, direkte Generierung. Zum Einschalten klicken.'}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        enabled
          ? 'border-[0.5px] border-[var(--tf-text)] bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]'
          : 'border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
      }`}
    >
      <Brain size={14} />
      Thinking
    </button>
  );
}

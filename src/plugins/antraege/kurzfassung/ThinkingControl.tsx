/**
 * Pro-Generierung-Schalter fürs Thinking-/Reasoning-Budget — kompakter An/Aus-Toggle
 * neben den Generieren-Buttons (kein Icon, platzsparend; keine Niedrig/Standard-
 * Abstufung im UI). Default kommt aus der Einstellung (KI-Assistent), kann hier aber
 * pro Lauf übersteuert werden. „An" = das kanonische Standard-Budget
 * (`THINKING_ON_BUDGET` = 'medium'); jeder Wert ≠ 'none' gilt als aktiv.
 */
import type { ThinkingBudget } from '@/core/services/ai/llm-thinking';

interface Props {
  budget: ThinkingBudget;
  onChange: (budget: ThinkingBudget) => void;
  disabled?: boolean;
}

/** Budget bei „An" — spiegelt `THINKING_ON_BUDGET` aus llm-thinking.ts. */
const ON_BUDGET: ThinkingBudget = 'medium';

export function ThinkingControl({ budget, onChange, disabled }: Props): React.ReactElement {
  const aktiv = budget !== 'none';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktiv}
      disabled={disabled}
      onClick={() => onChange(aktiv ? 'none' : ON_BUDGET)}
      title='Thinking/Reasoning: ob das LLM vor der Antwort „nachdenkt". An = oft bessere Fassung, aber langsamer.'
      className={`inline-flex items-center h-[28px] px-[11px] rounded-[8px] border-[0.5px] text-[12px] whitespace-nowrap transition-colors ${
        aktiv
          ? 'border-[var(--tf-primary)] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
          : 'border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      Thinking
    </button>
  );
}

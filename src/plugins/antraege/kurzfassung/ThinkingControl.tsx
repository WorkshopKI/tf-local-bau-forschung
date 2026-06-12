/**
 * Pro-Generierung-Auswahl des Thinking-/Reasoning-Budgets (Aus / Niedrig /
 * Standard) — kompaktes Dropdown neben den Generieren-Buttons. Default kommt aus
 * der Einstellung (KI-Assistent), kann hier aber pro Lauf übersteuert werden
 * (z.B. „Neu" mit mehr Reasoning für eine bessere Fassung). Kleines Brain-Icon,
 * aktiver Rahmen sobald ≠ Aus.
 */
import { Brain } from 'lucide-react';
import type { ThinkingBudget } from '@/core/services/ai/llm-thinking';

interface Props {
  budget: ThinkingBudget;
  onChange: (budget: ThinkingBudget) => void;
  disabled?: boolean;
}

/** Sichtbare Stufen (das Transport-Budget 'high' ist hier bewusst nicht angeboten). */
const OPTIONS: Array<{ value: ThinkingBudget; label: string }> = [
  { value: 'none', label: 'Aus' },
  { value: 'low', label: 'Niedrig' },
  { value: 'medium', label: 'Standard' },
];

export function ThinkingControl({ budget, onChange, disabled }: Props): React.ReactElement {
  const aktiv = budget !== 'none';
  return (
    <span
      title='Thinking/Reasoning: wie viel das LLM vor der Antwort „nachdenkt". Mehr = oft bessere Fassung, aber langsamer.'
      className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-[8px] border-[0.5px] text-[12px] ${
        aktiv
          ? 'border-[var(--tf-text)] bg-[var(--tf-bg-secondary)]'
          : 'border-[var(--tf-border-hover)]'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <Brain size={12} className={`shrink-0 ${aktiv ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text-tertiary)]'}`} />
      <span className="text-[var(--tf-text-tertiary)]">Thinking</span>
      <select
        value={budget}
        disabled={disabled}
        onChange={e => onChange(e.target.value as ThinkingBudget)}
        className="bg-transparent text-[12px] text-[var(--tf-text)] outline-none cursor-pointer disabled:cursor-not-allowed"
      >
        {OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </span>
  );
}

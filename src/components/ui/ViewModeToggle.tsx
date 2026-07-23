/**
 * Generischer Ansichts-Umschalter (Liste / Tabelle / Karten) — store-agnostisch
 * (`value`/`onChange` als Props). Kanonische Heimat des zuvor in der Skill-
 * Verwaltung beheimateten Toggles; wird von Skill-Verwaltung und Anfragen
 * direkt genutzt. Optik 1:1 wie der
 * Förderanträge-`ViewModeToggle` (Primary-Underline via box-shadow, kein
 * Layout-Shift), aber ohne Store-Bindung.
 */
import { List, Table, LayoutGrid, type LucideIcon } from 'lucide-react';

export type ViewMode = 'list' | 'table' | 'cards';

const OPTIONS: { mode: ViewMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'list', label: 'Liste', Icon: List },
  { mode: 'table', label: 'Tabelle', Icon: Table },
  { mode: 'cards', label: 'Karten', Icon: LayoutGrid },
];

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: Props): React.ReactElement {
  return (
    <div
      role="group"
      aria-label="Ansicht wechseln"
      className="inline-flex items-center rounded-[var(--tf-radius)] overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {OPTIONS.map(({ mode, label, Icon }, idx) => {
        const isActive = mode === value;
        const baseShadow = idx === 0 ? 'none' : 'inset 0.5px 0 0 var(--tf-border)';
        const activeShadow = `${baseShadow === 'none' ? '' : baseShadow + ', '}inset 0 -2px 0 var(--tf-primary)`;
        return (
          <button
            key={mode}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            onClick={() => onChange(mode)}
            className={`h-8 w-8 inline-flex items-center justify-center transition-colors ${
              isActive
                ? 'text-[var(--tf-primary)]'
                : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
            }`}
            style={{
              background: isActive ? 'var(--tf-bg-secondary)' : 'transparent',
              boxShadow: isActive ? activeShadow : baseShadow,
            }}
          >
            <Icon size={14} strokeWidth={isActive ? 2.25 : 1.75} />
          </button>
        );
      })}
    </div>
  );
}

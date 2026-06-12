/**
 * Ansichts-Umschalter (Liste / Tabelle / Karten) der Skill-Verwaltung.
 *
 * Optik 1:1 wie der Förderanträge-`ViewModeToggle`, aber store-agnostisch
 * (value/onChange als Props) — der Antraege-Toggle ist fest an dessen Store
 * gebunden und daher nicht wiederverwendbar. Wird von beiden Tabs (Skills +
 * Qualitätsregeln) genutzt.
 */
import { List, Table, LayoutGrid, type LucideIcon } from 'lucide-react';

export type RegistryViewMode = 'list' | 'table' | 'cards';

const OPTIONS: { mode: RegistryViewMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'list', label: 'Liste', Icon: List },
  { mode: 'table', label: 'Tabelle', Icon: Table },
  { mode: 'cards', label: 'Karten', Icon: LayoutGrid },
];

interface Props {
  value: RegistryViewMode;
  onChange: (mode: RegistryViewMode) => void;
}

export function RegistryViewModeToggle({ value, onChange }: Props): React.ReactElement {
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

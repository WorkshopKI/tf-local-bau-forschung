/**
 * Generischer Ansichts-Umschalter — store-agnostisch (`value`/`onChange` als
 * Props). Kanonische Heimat des zuvor in der Skill-Verwaltung beheimateten
 * Toggles; genutzt von Skill-Verwaltung, Anfragen und dem Feedback-Board. Optik
 * 1:1 wie der Förderanträge-`ViewModeToggle` (Primary-Underline via box-shadow,
 * kein Layout-Shift), aber ohne Store-Bindung.
 *
 * Die Modi sind seit v3.24 eine PROP: Liste · Tabelle · Karten bleibt der
 * Default, das Feedback-Board reicht Liste · Board herein. Vorher musste es sich
 * seine eigene Segmentgruppe bauen — und tat es, mit anderer Höhe und anderem
 * Aktiv-Zustand.
 */
import { List, Table, LayoutGrid, type LucideIcon } from 'lucide-react';

export type ViewMode = 'list' | 'table' | 'cards';

export interface ViewModeOption<T extends string> {
  mode: T;
  label: string;
  Icon: LucideIcon;
}

const OPTIONS: ViewModeOption<ViewMode>[] = [
  { mode: 'list', label: 'Liste', Icon: List },
  { mode: 'table', label: 'Tabelle', Icon: Table },
  { mode: 'cards', label: 'Karten', Icon: LayoutGrid },
];

interface Props<T extends string> {
  value: T;
  onChange: (mode: T) => void;
  /** Default: Liste · Tabelle · Karten. */
  options?: readonly ViewModeOption<T>[];
  /** Default: „Ansicht wechseln". */
  ariaLabel?: string;
}

export function ViewModeToggle<T extends string = ViewMode>({
  value, onChange, options, ariaLabel,
}: Props<T>): React.ReactElement {
  const modi = options ?? (OPTIONS as unknown as readonly ViewModeOption<T>[]);
  return (
    <div
      role="group"
      aria-label={ariaLabel ?? 'Ansicht wechseln'}
      className="inline-flex items-center rounded-[var(--tf-radius)] overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {modi.map(({ mode, label, Icon }, idx) => {
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

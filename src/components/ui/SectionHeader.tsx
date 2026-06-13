import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
  /** Wenn true: Label wird zum Toggle-Button mit Chevron (klappt den Sektion-Inhalt ein/aus). */
  collapsible?: boolean;
  /** true = zugeklappt. Nur relevant wenn `collapsible`. */
  collapsed?: boolean;
  /** Toggle-Handler. Nur relevant wenn `collapsible`. */
  onToggleCollapsed?: () => void;
}

const LABEL_CLASS = 'text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text)]';

export function SectionHeader({
  label,
  action,
  collapsible,
  collapsed,
  onToggleCollapsed,
}: SectionHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between pb-1.5 mb-3"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      {collapsible ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 cursor-pointer select-none text-left min-w-0"
        >
          <ChevronRight
            size={12}
            className="text-[var(--tf-text-tertiary)] shrink-0"
            style={{
              transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform var(--tf-duration-med) var(--tf-ease)',
            }}
          />
          <span className={LABEL_CLASS}>{label}</span>
        </button>
      ) : (
        <span className={LABEL_CLASS}>{label}</span>
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

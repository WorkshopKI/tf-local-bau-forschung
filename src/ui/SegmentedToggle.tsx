/**
 * SegmentedToggle — generischer Mini-Segmented-Control (z.B. Tabelle/Karten).
 *
 * Aktive Option hat hellen Background + Border + Schatten; inaktive Optionen
 * sind transparent. Klick toggelt zur ausgewaehlten Option.
 *
 * Layout-Konvention (aus Handoff-Design):
 *   Container: border 0.5px / radius 8px / padding 2px / bg-secondary
 *   Buttons:   height 26px / padding 0 10px / font 12px / radius 6px
 */
export interface SegmentedToggleOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

interface Props<T extends string> {
  value: T;
  onChange: (id: T) => void;
  options: Array<SegmentedToggleOption<T>>;
  ariaLabel?: string;
}

export function SegmentedToggle<T extends string>({
  value, onChange, options, ariaLabel,
}: Props<T>): React.ReactElement {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center"
      style={{
        border: '0.5px solid var(--tf-border)',
        borderRadius: 8,
        padding: 2,
        background: 'var(--tf-bg-secondary)',
        gap: 0,
      }}
    >
      {options.map(opt => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className="inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            style={{
              height: 26,
              padding: '0 10px',
              fontSize: 12,
              borderRadius: 6,
              background: active ? 'var(--tf-bg)' : 'transparent',
              color: active ? 'var(--tf-text)' : 'var(--tf-text-secondary)',
              border: active ? '0.5px solid var(--tf-border)' : '0.5px solid transparent',
              boxShadow: active ? '0 1px 0 rgba(0,0,0,0.02)' : 'none',
            }}
          >
            {opt.icon && <span className="inline-flex">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

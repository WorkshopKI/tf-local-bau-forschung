// Typ-Filter-Chips (Redesign v2.199): Single-Select-Filter „Alle · Problem · Idee
// · UX · Lob · Frage" mit Zähler + Farb-Dot. Aktiv = --tf-primary-Fill (App-Pill-
// Konvention, nicht das near-black des Mockups → im Dark-Mode lesbar). Das ist ein
// Filter (kein Listen-Sicht-Tab → nicht ScopeTabs; Guard no-parallel-scope-tabs
// betrifft nur Unterstrich-Tabs).

export interface TypeChipItem {
  key: string;
  label: string;
  count: number;
  /** CSS-Farbe des Punkts (z.B. var(--tf-danger-text)); fehlt bei „Alle". */
  dot?: string;
}

interface Props {
  items: TypeChipItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function FeedbackTypeChips({ items, activeKey, onChange }: Props): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Typ-Filter">
      {items.map(it => {
        const active = it.key === activeKey;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={`h-[30px] px-2.5 rounded-full inline-flex items-center gap-1.5 text-[12px] cursor-pointer transition-colors border-[0.5px] ${
              active
                ? 'bg-[var(--tf-primary)] border-transparent text-[var(--tf-on-primary)] font-medium'
                : 'bg-[var(--tf-bg)] border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]'
            }`}
          >
            {it.dot && !active && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.dot }} />
            )}
            {it.label}
            <span className={`text-[10px] tabular-nums ${active ? 'text-[var(--tf-on-primary)] opacity-75' : 'text-[var(--tf-text-tertiary)]'}`}>
              {it.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

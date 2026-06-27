import { cn } from '@/lib/utils';

export interface ScopeTabItem {
  key: string;
  label: string;
  /** Optionaler Zähler hinter dem Label. */
  count?: number;
}

export interface ScopeTabsProps {
  items: ScopeTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  /** 'tabs' = breit/unterstrichen (Default — Förderanträge-Scope-Tabs);
   *  'pills' = kompakt (Chat-Historie-Filter). EIN Bauteil, zwei Darstellungen. */
  variant?: 'tabs' | 'pills';
  className?: string;
  'aria-label'?: string;
}

const fmtCount = (n: number): string => n.toLocaleString('de-DE');

/**
 * Kanonische Listen-Sicht-Tabs mit Zähler. Domänenfrei — vereint die breiten
 * unterstrichenen Tabs (Förderanträge „Offen 51 · Überfällig 251 · … · Alle
 * 387") und die kompakten Pills (Chat „Alle · Anträge · Angeheftet") in EINEM
 * Bauteil. Styling ausschließlich über --tf-*-Tokens.
 *
 * Abgrenzung: für generische Section-/Settings-Navigation bleibt
 * `@/components/ui/tabs` (Tabs) zuständig — ScopeTabs ist nur für vordefinierte
 * Listen-Sichten mit Zähler.
 */
export function ScopeTabs({
  items,
  activeKey,
  onChange,
  variant = 'tabs',
  className,
  'aria-label': ariaLabel,
}: ScopeTabsProps): React.ReactElement {
  if (variant === 'pills') {
    return (
      <div role="tablist" aria-label={ariaLabel} className={cn('flex gap-1', className)}>
        {items.map(it => {
          const active = it.key === activeKey;
          return (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(it.key)}
              className={cn(
                'h-[26px] px-[11px] rounded-full inline-flex items-center gap-[5px] text-[12px] cursor-pointer transition-colors border-[0.5px]',
                active
                  ? 'bg-[var(--tf-primary-light)] border-transparent text-[var(--tf-primary)] font-medium'
                  : 'bg-[var(--tf-bg)] border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]',
              )}
            >
              {it.label}
              {it.count != null && (
                <span
                  className={cn(
                    'text-[10px] [font-family:var(--tf-font-mono)]',
                    active ? 'text-[var(--tf-primary)] opacity-75' : 'text-[var(--tf-text-tertiary)]',
                  )}
                >
                  {fmtCount(it.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // variant === 'tabs'
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex items-end gap-5 min-w-0 overflow-x-auto overflow-y-hidden', className)}
    >
      {items.map(it => {
        const active = it.key === activeKey;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={cn(
              'pb-2.5 text-[14px] whitespace-nowrap cursor-pointer transition-colors',
              active
                ? 'text-[var(--tf-primary)] font-medium border-b-2 border-[var(--tf-primary)] -mb-px'
                : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]',
            )}
          >
            {it.label}
            {it.count != null && (
              <>
                {' '}
                <span className="text-[12px] text-[var(--tf-text-tertiary)]">{fmtCount(it.count)}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

import { cn } from '@/lib/utils';

export interface ScopeTabItem {
  key: string;
  label: string;
  /** Optionaler Zähler hinter dem Label. */
  count?: number;
  /**
   * Optionales Vorsatz-Element vor dem Label — z.B. ein Statuspunkt bei
   * Schritt-Tabs eines geführten Ablaufs. Bewusst ein Slot am Primitiv statt
   * einer nachgebauten Tab-Leiste (Guard `no-parallel-scope-tabs`).
   */
  leading?: React.ReactNode;
  /** Deaktiviert den Tab: nicht klickbar, gedimmt (Auswahl bleibt möglich per Tooltip-Hinweis). */
  disabled?: boolean;
  /** Nativer title-Tooltip (z.B. Grund der Deaktivierung). */
  title?: string;
}

export interface ScopeTabsProps {
  items: ScopeTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  /** 'tabs' = breit/unterstrichen (Default — Förderanträge-Scope-Tabs);
   *  'pills' = kompakt (Chat-Historie-Filter);
   *  'segmented' = gefülltes Segmented-Control (aktiv = --tf-primary, Feedback-Board).
   *  EIN Bauteil, drei Darstellungen. */
  variant?: 'tabs' | 'pills' | 'segmented';
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
  if (variant === 'segmented') {
    // Gefülltes Segmented-Control: grauer Track, aktives Segment = --tf-primary-Fill.
    // Kein Unterstrich-Signatur (no-parallel-scope-tabs) und kein hover:opacity
    // (no-raw-cta-fill) → beide Guards bleiben grün.
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'inline-flex gap-0.5 p-[3px] rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] border-[0.5px] border-[var(--tf-border)]',
          className,
        )}
      >
        {items.map(it => {
          const active = it.key === activeKey;
          return (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={it.disabled || undefined}
              title={it.title}
              onClick={() => { if (!it.disabled) onChange(it.key); }}
              className={cn(
                'h-7 px-4 rounded-[var(--tf-radius-sm)] inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors',
                it.disabled
                  ? 'text-[var(--tf-text-tertiary)] cursor-not-allowed'
                  : active
                    ? 'bg-[var(--tf-primary)] text-[var(--tf-on-primary)] shadow-sm cursor-pointer'
                    : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer',
              )}
            >
              {it.leading}
              {it.label}
              {it.count != null && (
                <span
                  className={cn(
                    'text-[11px] [font-family:var(--tf-font-mono)]',
                    active ? 'text-[var(--tf-on-primary)] opacity-75' : 'text-[var(--tf-text-tertiary)]',
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
              aria-disabled={it.disabled || undefined}
              title={it.title}
              onClick={() => { if (!it.disabled) onChange(it.key); }}
              className={cn(
                'h-[26px] px-[11px] rounded-full inline-flex items-center gap-[5px] text-[12px] transition-colors border-[0.5px]',
                it.disabled
                  ? 'bg-[var(--tf-bg)] border-[var(--tf-border)] text-[var(--tf-text-tertiary)] cursor-not-allowed'
                  : active
                    ? 'bg-[var(--tf-primary-light)] border-transparent text-[var(--tf-primary)] font-medium cursor-pointer'
                    : 'bg-[var(--tf-bg)] border-[var(--tf-border-hover)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer',
              )}
            >
              {it.leading}
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
            aria-disabled={it.disabled || undefined}
            title={it.title}
            onClick={() => { if (!it.disabled) onChange(it.key); }}
            className={cn(
              'pb-2.5 text-[14px] whitespace-nowrap transition-colors inline-flex items-center gap-2',
              it.disabled
                ? 'text-[var(--tf-text-tertiary)] cursor-not-allowed'
                : active
                  ? 'text-[var(--tf-primary)] font-medium border-b-2 border-[var(--tf-primary)] -mb-px cursor-pointer'
                  : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer',
            )}
          >
            {it.leading}
            {it.label}
            {it.count != null && (
              <span className="text-[12px] text-[var(--tf-text-tertiary)]">{fmtCount(it.count)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

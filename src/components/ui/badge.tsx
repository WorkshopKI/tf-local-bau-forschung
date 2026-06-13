interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  /** Optional extra Tailwind-Klassen — z.B. `min-w-[130px] justify-center`
   *  für uniforme Pillen-Breite in Listen. Wird hinten angehängt, sodass
   *  z.B. ein eigenes `min-w-[…]` das Default-Auto-Width überschreibt. */
  className?: string;
}

const variantClasses: Record<string, string> = {
  default: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
  info: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
  success: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  warning: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
  error: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
};

export function Badge({ variant = 'default', children, className }: BadgeProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-normal px-2.5 py-[3px] rounded-full ${variantClasses[variant] ?? ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </span>
  );
}

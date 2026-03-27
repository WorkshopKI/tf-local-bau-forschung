interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  default: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
  info: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
  success: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  warning: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
  error: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
};

export function Badge({ variant = 'default', children }: BadgeProps): React.ReactElement {
  return (
    <span className={`inline-flex items-center text-[11px] font-normal px-2.5 py-[3px] rounded-full ${variantClasses[variant] ?? ''}`}>
      {children}
    </span>
  );
}

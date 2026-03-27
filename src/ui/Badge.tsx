interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  default: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export function Badge({ variant = 'default', children }: BadgeProps): React.ReactElement {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${variantClasses[variant] ?? ''}`}>
      {children}
    </span>
  );
}

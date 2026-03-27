import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85',
  secondary: 'bg-transparent text-[var(--tf-text)] hover:bg-[var(--tf-hover)]',
  ghost: 'bg-transparent text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]',
  danger: 'bg-transparent text-[var(--tf-danger-text)] hover:bg-[var(--tf-danger-bg)]',
};

const variantBorders: Record<string, string> = {
  primary: 'none',
  secondary: '0.5px solid var(--tf-border-hover)',
  ghost: 'none',
  danger: '0.5px solid var(--tf-danger-border)',
};

const sizeClasses: Record<string, string> = {
  sm: 'gap-1.5 text-[12.5px]',
  md: 'gap-2 text-[13px]',
  lg: 'gap-2 text-[14px]',
};

const sizePadding: Record<string, string> = {
  sm: '5px 12px',
  md: '8px 18px',
  lg: '10px 22px',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  disabled,
  className = '',
  children,
  style,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-[var(--tf-radius)] font-normal transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${variantClasses[variant] ?? ''} ${sizeClasses[size] ?? ''} ${className}`}
      style={{ border: variantBorders[variant], padding: sizePadding[size], ...style }}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : Icon ? <Icon size={14} /> : null}
      {children}
    </button>
  );
}

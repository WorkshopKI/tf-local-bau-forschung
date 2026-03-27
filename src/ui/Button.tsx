import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
}

const variantClasses: Record<string, string> = {
  primary: 'bg-[var(--tf-primary)] text-white hover:opacity-90',
  secondary: 'bg-transparent border border-[var(--tf-border)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]',
  ghost: 'bg-transparent text-[var(--tf-text)] hover:bg-[var(--tf-hover)]',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-2.5 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-[var(--tf-radius-sm)] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant] ?? ''} ${sizeClasses[size] ?? ''} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

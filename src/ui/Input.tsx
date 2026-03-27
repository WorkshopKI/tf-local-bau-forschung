import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  description?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, description, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--tf-text)]">
            {label}
          </label>
        )}
        {description && (
          <p className="text-xs text-[var(--tf-text-secondary)]">{description}</p>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border rounded-[var(--tf-radius-sm)] outline-none transition-colors placeholder:text-[var(--tf-text-secondary)] focus:ring-2 focus:ring-[var(--tf-primary)] focus:border-transparent ${
            error ? 'border-red-500' : 'border-[var(--tf-border)]'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

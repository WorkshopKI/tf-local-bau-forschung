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
          <label htmlFor={inputId} className="text-[13px] font-medium text-[var(--tf-text)]">
            {label}
          </label>
        )}
        {description && (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">{description}</p>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none transition-colors placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)] ${className}`}
          style={{ border: `0.5px solid ${error ? 'var(--tf-danger-border)' : 'var(--tf-border)'}` }}
          {...props}
        />
        {error && <p className="text-[12px] text-[var(--tf-danger-text)]">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

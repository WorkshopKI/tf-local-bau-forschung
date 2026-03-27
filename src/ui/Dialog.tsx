import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps): React.ReactElement | null {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-[var(--tf-bg)] rounded-[16px] w-full max-w-md mx-4 p-6 animate-[dialog-in_150ms_ease-out]"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-medium text-[var(--tf-text)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div>{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 mt-6 pt-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

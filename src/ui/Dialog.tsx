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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-xl w-full max-w-md mx-4 animate-[dialog-in_150ms_ease-out]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--tf-border)]">
          <h2 className="text-lg font-semibold text-[var(--tf-text)]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--tf-radius-sm)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-secondary)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--tf-border)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Auto-dismiss-Toast (3s) fuer Action-Feedback. Tone bestimmt Border-Farbe.
 * Position fixed bottom-right; nicht modal, nicht blockierend.
 */
import { useDokumentReviewStore } from '../store';

export function ReviewToast(): React.ReactElement | null {
  const toast = useDokumentReviewStore(s => s.toast);
  const dismiss = useDokumentReviewStore(s => s.dismissToast);

  if (!toast) return null;

  const toneColors: Record<typeof toast.tone, { border: string; text: string }> = {
    success: { border: 'var(--tf-success-border, #16a34a)', text: 'var(--tf-success-text, #166534)' },
    info: { border: 'var(--tf-info-border, #0284c7)', text: 'var(--tf-info-text, #075985)' },
    error: { border: 'var(--tf-danger-border)', text: 'var(--tf-danger-text)' },
  };
  const c = toneColors[toast.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={dismiss}
      className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-[10px] bg-[var(--tf-bg)] text-[12.5px] cursor-pointer shadow-lg max-w-[420px]"
      style={{ border: `0.5px solid ${c.border}`, color: c.text }}
    >
      {toast.message}
    </div>
  );
}

/**
 * Toast des Boards (v3.12) — Rückmeldung samt „Rückgängig".
 *
 * Optik nach dem Muster von `ReviewToast` (dokument-review), Position aber
 * mittig-unten statt rechts: rechts unten sitzt der Feedback-FAB, und der
 * Toast soll ihn nicht verdecken.
 */
import { Undo2, X } from 'lucide-react';
import type { ToastZustand } from './useTicketAktionen';

export function TicketToast({ toast, onClose }: {
  toast: ToastZustand;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div
      className="fb-toast"
      role="status"
      aria-live="polite"
      style={toast.ton === 'fehler'
        ? { background: 'var(--tf-danger-text)', color: 'var(--tf-bg)' }
        : undefined}
    >
      <span>{toast.text}</span>
      {toast.rueckgaengig && (
        <button type="button" onClick={() => { toast.rueckgaengig?.(); onClose(); }}>
          <Undo2 size={13} aria-hidden />
          Rückgängig
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Meldung schließen"
        style={{ textDecoration: 'none', opacity: 0.7 }}
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  );
}

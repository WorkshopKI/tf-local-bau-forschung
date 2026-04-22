// Dismissible info banner explaining the sponsoring system.
// Shown once at the top of the Feedback Board; persists dismissal in localStorage.

import { useState } from 'react';
import { X } from 'lucide-react';

const LS_KEY = 'teamflow_sponsoring_banner_dismissed';

export function SponsoringInfoBanner(): React.ReactElement | null {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === 'true'; }
    catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = (): void => {
    setDismissed(true);
    try { localStorage.setItem(LS_KEY, 'true'); } catch { /* ignore */ }
  };

  return (
    <div
      className="flex items-start gap-3 p-3 mb-4 rounded-[var(--tf-radius)] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="text-[14px] shrink-0 mt-0.5" aria-hidden>🎯</span>
      <div className="flex-1 text-[12.5px] leading-relaxed">
        <span className="font-medium">So funktioniert Sponsoring:</span>{' '}
        Du hast 10 Punkte pro Quartal. Setze sie auf Features die dir wichtig sind.
        Bugs werden immer bearbeitet.
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex items-center gap-1 text-[11.5px] font-medium shrink-0 cursor-pointer hover:opacity-70"
      >
        Verstanden <X size={12} />
      </button>
    </div>
  );
}

/**
 * ModulLoadingBanner (v2.10) — prominenter Spinner + Countdown waehrend
 * der Auslastungs-Modul-Mount-Phase.
 *
 * Aktiv solange `useAuslastungReady().ready === false`. Zeigt:
 *  - Loader2-Icon mit `animate-spin`
 *  - Haupttext "Lade Auslastungsdaten ..."
 *  - Sekundaer-Text mit Sekunden-Countdown 5 → 0 (Heuristik). Bei 0 wird
 *    der Text "fast geschafft ..." — kein negativer Counter.
 *
 * Skeleton-UI aus v2.7 bleibt parallel sichtbar; der Spinner ist das
 * primaere "etwas-passiert"-Signal, das Skeleton der sekundaere
 * Struktur-Hinweis.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuslastungReady } from '../hooks/useAuslastungReady';

const INITIAL_COUNTDOWN = 5;

export function ModulLoadingBanner(): React.ReactElement | null {
  const { ready } = useAuslastungReady();
  const [remaining, setRemaining] = useState(INITIAL_COUNTDOWN);

  useEffect(() => {
    if (ready) return;
    const t = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [ready]);

  if (ready) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-[var(--tf-radius)] mb-4"
      style={{
        background: 'var(--tf-bg-secondary)',
        border: '0.5px solid var(--tf-border)',
      }}
      role="status"
      aria-live="polite"
    >
      <Loader2 size={20} className="animate-spin text-[var(--tf-primary)] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--tf-text)]">
          Lade Auslastungsdaten …
        </p>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {remaining > 0 ? `noch etwa ${remaining}s` : 'fast geschafft …'}
        </p>
      </div>
    </div>
  );
}

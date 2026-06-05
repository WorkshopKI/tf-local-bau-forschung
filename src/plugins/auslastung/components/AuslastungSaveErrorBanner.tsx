/**
 * AuslastungSaveErrorBanner (v2.25) — macht Schreib-/Lade-Fehler des
 * Auslastungs-Stores sichtbar.
 *
 * Viele Auslastungs-Buttons rufen Store-Mutationen in fire-and-forget-`onClick`-
 * Handlern auf und schlucken eine Promise-Rejection still (Pitfall #15). Der Store setzt
 * bei einem fehlgeschlagenen Persist aber `error` (vor dem Rethrow) — dieses
 * Banner zeigt es prominent an, statt dass ein verlorener Write (z.B. fehlendes
 * Schreibrecht durch eine parallel offene Nur-Lese-Variante) unbemerkt bleibt.
 */
import { AlertTriangle, X } from 'lucide-react';
import { useAuslastungData } from '../hooks/useAuslastungData';

export function AuslastungSaveErrorBanner(): React.ReactElement | null {
  const error = useAuslastungData(s => s.error);
  const clearError = useAuslastungData(s => s.clearError);
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 px-4 py-3 rounded-[var(--tf-radius)] mb-4"
      style={{
        background: 'var(--tf-danger-bg, #fee2e2)',
        color: 'var(--tf-danger-text, #991b1b)',
        border: '0.5px solid var(--tf-danger-border, #fecaca)',
      }}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1 min-w-0 text-[12.5px] leading-relaxed">{error}</p>
      <button
        type="button"
        onClick={clearError}
        aria-label="Meldung schließen"
        className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer"
      >
        <X size={15} />
      </button>
    </div>
  );
}

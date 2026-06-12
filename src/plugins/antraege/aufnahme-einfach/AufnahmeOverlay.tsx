/**
 * Overlay-Hülle der einfachen Aufnahme. Hält die `useAufnahme`-Instanz (Zustand
 * überlebt den Phasenwechsel) und schaltet zwischen Aufnahme- und Abschluss-
 * Panel. Der Batch-Einstieg (Teil B) wird über `AbschlussPanel.onBatchStart`
 * verdrahtet.
 */
import { X } from 'lucide-react';
import { useAufnahmeUiStore } from './useAufnahmeUiStore';
import { useAufnahme } from './useAufnahme';
import { AufnahmePanel } from './AufnahmePanel';
import { AbschlussPanel } from './AbschlussPanel';

export function AufnahmeOverlay(): React.ReactElement | null {
  const open = useAufnahmeUiStore(s => s.open);
  const close = useAufnahmeUiStore(s => s.close);
  const a = useAufnahme();

  if (!open) return null;

  const schliessen = (): void => { a.reset(); close(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) schliessen(); }}
    >
      <div className="relative w-full max-w-3xl mx-4 rounded-2xl bg-[var(--tf-bg)] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <button
          type="button"
          onClick={schliessen}
          aria-label="Schließen"
          className="absolute top-4 right-4 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
        >
          <X size={18} />
        </button>

        {a.abschluss
          ? <AbschlussPanel info={a.abschluss} onNeu={a.reset} onClose={schliessen} />
          : <AufnahmePanel a={a} />}
      </div>
    </div>
  );
}

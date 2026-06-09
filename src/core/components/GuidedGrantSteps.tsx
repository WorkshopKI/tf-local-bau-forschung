/**
 * GuidedGrantSteps (v2.55).
 *
 * Geführter Schritt-für-Schritt-Freigabe-Flow für File-System-Access-Handles.
 * Unter `file://` zeigt Chrome pro User-Gesture nur EINEN Permission-Prompt
 * (siehe docs/architecture/recurring-bug-classes.md §2). Statt mehrere Handles
 * in einem Klick anzufragen (→ nur der erste promptet, der Rest verhungert
 * still), rendert dieser Stepper pro noch-nicht-`granted` Handle GENAU EINEN
 * Klick-Schritt: ein Klick = ein `requestPermission` = ein zuverlässiger Prompt.
 *
 * Eingesetzt vom StartupScreen-Default-Zweig. Die Pending-Liste kommt non-
 * invasiv aus `listPendingGrants`; ist sie leer, rendert der StartupScreen den
 * Stepper gar nicht erst (Warm-Start → direkt durchstarten).
 */

import { useState } from 'react';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/ui';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { grantPending, type PendingGrant } from '@/core/services/infrastructure/smb-handle';

type PermState = 'granted' | 'denied' | 'prompt';

interface GuidedGrantStepsProps {
  /** Non-leer (der StartupScreen rendert den Stepper nur bei pending.length > 0). */
  pending: PendingGrant[];
  /** Läuft, wenn alle Schritte durch sind ODER der User „ohne Freigabe fortfahren" wählt. */
  onComplete: () => void | Promise<void>;
}

export function GuidedGrantSteps({ pending, onComplete }: GuidedGrantStepsProps): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PermState[]>([]);
  const total = pending.length;

  const grantCurrent = useAsyncAction(async () => {
    const grant = pending[index];
    if (!grant) return;
    const state = await grantPending(grant);
    setResults(prev => [...prev, state]);
    if (index + 1 >= total) {
      await onComplete();
    } else {
      setIndex(index + 1);
    }
  });

  const skipRemaining = useAsyncAction(async () => {
    await onComplete();
  });

  const current = pending[index];

  return (
    <>
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] leading-relaxed mb-4">
        Chrome fragt für jeden benötigten Ordner einzeln nach Erlaubnis — bitte
        nacheinander bestätigen. Diese Abfragen erscheinen nach jedem
        Browser-Neustart erneut; das ist eine Sicherheitsvorgabe für lokale Apps
        und lässt sich nicht abschalten.
      </p>

      <div className="mb-5 space-y-1.5">
        {pending.map((g, i) => {
          const done = i < index;
          const state = results[i];
          const isCurrent = i === index;
          return (
            <div
              key={g.slot}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--tf-radius)] text-[12.5px] ${
                isCurrent ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'
              }`}
            >
              <span className="shrink-0 w-4 inline-flex justify-center">
                {done ? (
                  state === 'granted' ? (
                    <Check size={14} className="text-[var(--tf-primary)]" />
                  ) : (
                    <AlertTriangle size={14} className="text-[var(--tf-danger-text)]" />
                  )
                ) : isCurrent ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-primary)]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-border)]" />
                )}
              </span>
              <span className="flex-1">{g.label}</span>
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                {g.mode === 'readwrite' ? 'Lesen + Schreiben' : 'Nur lesen'}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-2">
        Schritt {Math.min(index + 1, total)} von {total}
      </p>

      <Button
        icon={ArrowRight}
        onClick={() => grantCurrent.run()}
        disabled={grantCurrent.busy || !current}
        className="w-full"
      >
        {grantCurrent.busy ? 'Wird freigegeben…' : current ? `„${current.label}" freigeben` : 'Starten'}
      </Button>

      {grantCurrent.error && (
        <p className="mt-2 text-[12.5px] text-[var(--tf-danger-text)]">{grantCurrent.error}</p>
      )}

      <button
        type="button"
        onClick={() => skipRemaining.run()}
        disabled={skipRemaining.busy}
        className="mt-4 w-full text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-pointer"
      >
        Ohne Freigabe fortfahren (eingeschränkter Offline-Modus)
      </button>
    </>
  );
}

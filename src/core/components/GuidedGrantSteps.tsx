/**
 * GuidedGrantSteps (v2.55, kollabierend seit v2.59.2).
 *
 * Geführter Schritt-für-Schritt-Freigabe-Flow für File-System-Access-Handles.
 * Unter `file://` zeigt älteres Chromium pro User-Gesture nur EINEN Permission-
 * Prompt (siehe docs/architecture/recurring-bug-classes.md §2). Statt mehrere
 * Handles in einem Klick anzufragen (→ nur der erste promptet, der Rest
 * verhungert still), rendert dieser Stepper pro noch-nicht-`granted` Handle
 * GENAU EINEN Klick-Schritt: ein Klick = ein `requestPermission` = ein
 * zuverlässiger Prompt.
 *
 * v2.59.2 — manche Chromium-Browser (in Edge beobachtet; in Chrome unter
 * `file://` NICHT, bis v149) zeigen einen konsolidierten „Wiederherstellen"-
 * Prompt: EIN `requestPermission()` kann via Sammel-Box MEHRERE gespeicherte
 * Handles auf einmal gewähren (Option „Bei jedem Besuch zulassen" macht sie
 * sogar persistent). Browser-/kontextabhängig, nicht erzwingbar. Damit der
 * Stepper danach keinen überflüssigen Schritt zeigt, prüft er nach jedem Grant
 * per `rescan` neu, markiert alle nun gewährten Slots als erledigt und schließt
 * ab, sobald nichts mehr aussteht — dort kollabiert er auf EINEN Klick. Wo der
 * Browser einzeln promptet (z.B. Chrome/`file://`), bleibt es Schritt-für-Schritt.
 */

import { useState } from 'react';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/ui';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { grantPending, type PendingGrant } from '@/core/services/infrastructure/smb-handle';
import { resolveAfterGrant, type GrantOutcome } from './guided-grant-progress';

interface GuidedGrantStepsProps {
  /** Non-leer (der StartupScreen rendert den Stepper nur bei pending.length > 0). */
  pending: PendingGrant[];
  /** Non-invasives Re-Query (nur queryPermission) der noch ausstehenden Grants. */
  rescan: () => Promise<PendingGrant[]>;
  /** Läuft, wenn alle Schritte durch sind ODER der User „ohne Freigabe fortfahren" wählt. */
  onComplete: () => void | Promise<void>;
}

export function GuidedGrantSteps({ pending, rescan, onComplete }: GuidedGrantStepsProps): React.ReactElement {
  const [resolved, setResolved] = useState<Record<string, GrantOutcome>>({});

  const pendingSlots = pending.map(g => g.slot);
  const current = pending.find(g => resolved[g.slot] === undefined) ?? null;
  const resolvedCount = pending.filter(g => resolved[g.slot] !== undefined).length;
  const total = pending.length;

  const grantCurrent = useAsyncAction(async () => {
    if (!current) {
      await onComplete();
      return;
    }
    await grantPending(current);
    // Re-Scan: welche Slots sind JETZT noch ungranted? Eine Sammel-Box (modernes
    // Chromium) kann mehrere auf einmal gewährt haben → nicht stur weiterklicken.
    let remainingSlots: Set<string>;
    try {
      remainingSlots = new Set((await rescan()).map(g => g.slot));
    } catch {
      remainingSlots = new Set(); // Scan-Fehler best-effort → als alles-erledigt behandeln.
    }
    const next = resolveAfterGrant(pendingSlots, resolved, current.slot, remainingSlots);
    setResolved(next.resolved);
    if (next.complete) await onComplete();
  });

  const skipRemaining = useAsyncAction(async () => {
    await onComplete();
  });

  return (
    <>
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)] leading-relaxed mb-4">
        Der Browser fragt für die benötigten Ordner nach Erlaubnis. Tipp: Falls
        Ihr Browser „Bei jedem Besuch zulassen" anbietet, wählen Sie das — dann
        entfällt die Abfrage künftig. Sonst erscheint sie nach jedem
        Browser-Neustart erneut (Sicherheitsvorgabe für lokale Apps).
      </p>

      <div className="mb-5 space-y-1.5">
        {pending.map((g) => {
          const state = resolved[g.slot];
          const isCurrent = current?.slot === g.slot;
          return (
            <div
              key={g.slot}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--tf-radius)] text-[12.5px] ${
                isCurrent ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'
              }`}
            >
              <span className="shrink-0 w-4 inline-flex justify-center">
                {state === 'granted' ? (
                  <Check size={14} className="text-[var(--tf-primary)]" />
                ) : state === 'denied' ? (
                  <AlertTriangle size={14} className="text-[var(--tf-danger-text)]" />
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
        Schritt {Math.min(resolvedCount + 1, total)} von {total}
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

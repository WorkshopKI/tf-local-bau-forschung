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
 *
 * v2.275 — Wege verkürzen, ohne die Gesture-Robustheit anzutasten:
 *  - **Auto-Fokus:** nach jedem Schritt bekommt der Freigabe-Button den Fokus.
 *    Der User klickt „Zulassen" im Browser-Popup (oben am Viewport) und drückt
 *    danach nur noch Enter — kein Mausweg zurück zur Karte. Enter auf einem
 *    Button ist eine vollwertige User-Geste, der Prompt kommt zuverlässig.
 *  - **Optimistische Auto-Kette:** nach einem erfolgreichen Grant wird der
 *    nächste Slot sofort probiert, statt auf den Klick zu warten. Zeigt der
 *    Browser dabei keinen Prompt mehr (Activation verbraucht → Rückkehr in
 *    <300ms), bricht die Kette ab OHNE den Slot aufzulösen; er bleibt der
 *    nächste Klick-Schritt. In Chrome/`file://` ändert das nichts, in Browsern
 *    mit persistenten Permissions spart es Klicks.
 */

import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { grantPending, type PendingGrant } from '@/core/services/infrastructure/smb-handle';
import {
  resolveAfterGrant,
  darfWeiterketten,
  ketteAbgebrochenOhnePrompt,
  type GrantOutcome,
} from './guided-grant-progress';

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

    // Re-Scan: welche Slots sind JETZT noch ungranted? Eine Sammel-Box (modernes
    // Chromium) kann mehrere auf einmal gewährt haben → nicht stur weiterklicken.
    // Definition ist synchron — die User-Activation bleibt bis grantPending live.
    const offeneSlots = async (): Promise<Set<string>> => {
      try {
        return new Set((await rescan()).map(g => g.slot));
      } catch {
        return new Set(); // Scan-Fehler best-effort → als alles-erledigt behandeln.
      }
    };

    // Schritt 1 = der geklickte Slot. Bewusst OHNE Dauer-Heuristik, damit der
    // kritische Startup-Pfad sich exakt wie bisher verhält.
    const ergebnis = await grantPending(current);
    let stand = resolveAfterGrant(pendingSlots, resolved, current.slot, await offeneSlots());

    // Auto-Kette: solange der Browser weiter prompted, die restlichen Slots ohne
    // zusätzlichen Klick nachziehen. Obergrenze = Slot-Anzahl (kein Endlos-Lauf).
    let weiter = darfWeiterketten(ergebnis);
    for (let runde = 0; weiter && !stand.complete && runde < pending.length; runde++) {
      const naechster = pending.find(g => stand.resolved[g.slot] === undefined);
      if (!naechster) break;

      const start = performance.now();
      const kettenErgebnis = await grantPending(naechster);
      const dauerMs = performance.now() - start;

      // Kein Prompt mehr gezeigt (Activation verbraucht, z.B. Chrome/file://):
      // Slot NICHT auflösen — sonst würde resolveAfterGrant ihn als 'denied'
      // verbrennen. So bleibt er der nächste reguläre Klick-Schritt.
      if (ketteAbgebrochenOhnePrompt(kettenErgebnis, dauerMs)) break;

      stand = resolveAfterGrant(pendingSlots, stand.resolved, naechster.slot, await offeneSlots());
      weiter = darfWeiterketten(kettenErgebnis);
    }

    setResolved(stand.resolved);
    if (stand.complete) await onComplete();
  });

  const skipRemaining = useAsyncAction(async () => {
    await onComplete();
  });

  // Auto-Fokus ab dem ZWEITEN Schritt: der User klickt „Zulassen" oben im
  // Browser-Popup und kommt mit Enter direkt zum nächsten Ordner, ohne die Maus
  // zur Karte zurückzuführen. Erst ab Schritt 2, damit ein noch gedrückter
  // Enter aus dem vorgelagerten Login-Gate den ersten Schritt nicht versehentlich
  // auslöst — der Gewinn ist derselbe, Schritt 1 wird ohnehin mit der Maus geklickt.
  const grantButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (current && resolvedCount > 0 && !grantCurrent.busy) grantButtonRef.current?.focus();
  }, [current, resolvedCount, grantCurrent.busy]);

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
        ref={grantButtonRef}
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

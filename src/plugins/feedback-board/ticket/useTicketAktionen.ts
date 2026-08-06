/**
 * Feldänderungen am Ticket samt Toast und „Rückgängig" (v3.12).
 *
 * Warum überhaupt eine Rückgängig-Funktion: die Verwaltung sitzt jetzt an der
 * Karte. Ein Statuswechsel ist einen Klick weit entfernt — und ein Fehlklick
 * genauso. Ohne Rückweg müsste man den vorherigen Wert erst wieder wissen.
 *
 * Der Rückweg ist bewusst *derselbe* Schreibvorgang mit den alten Werten, kein
 * Sonderpfad: `updateFeedback` schreibt `{...item, ...updates}`, ein explizites
 * `undefined` löscht also wieder. Damit gilt für das Zurücknehmen exakt dieselbe
 * Share-Logik (Lage lesen, bei `unlesbar` abbrechen) wie fürs Setzen.
 *
 * Fehler landen im Toast statt in einem Banner: die auslösenden Bedienelemente
 * sind über das ganze Board verstreut, ein Banner am Seitenkopf hätte keinen
 * Bezug zu der Karte, die gerade nicht gespeichert werden konnte.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import { updateFeedback } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
import type { TicketPatch } from './typen';

const TOAST_MS = 4200;

export interface ToastZustand {
  text: string;
  ton: 'info' | 'fehler';
  /** Fehlt bei Fehlern und bei Aktionen ohne sinnvollen Rückweg. */
  rueckgaengig?: () => void;
}

export interface TicketAktionen {
  aendere: (t: FeedbackItem, patch: TicketPatch, meldung: string) => void;
  busy: boolean;
  toast: ToastZustand | null;
  schliesseToast: () => void;
}

/** Die Werte, die `patch` überschreiben würde — inklusive der noch leeren.
 *  `undefined` ist hier ein WERT („war nicht gesetzt"), kein „nicht anfassen". */
function vorherigeWerte(t: FeedbackItem, patch: TicketPatch): TicketPatch {
  const vorher: TicketPatch = {};
  for (const key of Object.keys(patch) as Array<keyof TicketPatch>) {
    // Zuweisung über einen Zwischenschritt, weil TS die Union sonst nicht
    // korreliert (jeder Key hat einen eigenen Werttyp).
    (vorher as Record<string, unknown>)[key] = (t as unknown as Record<string, unknown>)[key];
  }
  return vorher;
}

export function useTicketAktionen(onChanged: () => void): TicketAktionen {
  const storage = useStorage();
  const [toast, setToast] = useState<ToastZustand | null>(null);
  const timer = useRef<number | null>(null);

  const schliesseToast = useCallback((): void => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    setToast(null);
  }, []);

  const zeige = useCallback((z: ToastZustand): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setToast(z);
    timer.current = window.setTimeout(() => { setToast(null); timer.current = null; }, TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const lauf = useAsyncAction(
    async (fn: () => Promise<void>) => { await fn(); },
    {
      onError: err => {
        const msg = err instanceof Error ? err.message : String(err);
        // Kein Auto-Ausblenden über den Toast-Timer hinaus: die Meldung nennt
        // den Grund, und der Nutzer soll sie lesen können, bevor sie geht.
        zeige({ text: `Nicht gespeichert — ${msg}`, ton: 'fehler' });
      },
    },
  );
  // `run` wechselt bei jedem Render die Identität (opts-Objekt in den Deps);
  // über eine Ref bleibt `aendere` stabil und die Karten rendern nicht neu.
  const runRef = useRef(lauf.run);
  runRef.current = lauf.run;

  const aendere = useCallback((t: FeedbackItem, patch: TicketPatch, meldung: string): void => {
    const vorher = vorherigeWerte(t, patch);
    void runRef.current(async () => {
      await updateFeedback(storage, t.id, patch);
      onChanged();
      zeige({
        text: meldung,
        ton: 'info',
        rueckgaengig: () => {
          void runRef.current(async () => {
            await updateFeedback(storage, t.id, vorher);
            onChanged();
            zeige({ text: 'Rückgängig gemacht.', ton: 'info' });
          });
        },
      });
    });
  }, [storage, onChanged, zeige]);

  return { aendere, busy: lauf.busy, toast, schliesseToast };
}

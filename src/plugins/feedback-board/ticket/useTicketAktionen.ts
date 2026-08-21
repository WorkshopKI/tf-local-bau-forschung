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
import { addComment, FEEDBACK_STATUS, updateFeedback, updateFeedbackMany } from '@/core/services/feedback';
import { feedbackNummer } from '@/components/feedback/feedbackUi';
import type { FeedbackItem } from '@/core/types/feedback';
import type { KommentarArt, TicketPatch } from './typen';

const TOAST_MS = 4200;

export interface ToastZustand {
  text: string;
  ton: 'info' | 'fehler';
  /** Fehlt bei Fehlern und bei Aktionen ohne sinnvollen Rückweg. */
  rueckgaengig?: () => void;
}

export interface TicketAktionen {
  aendere: (t: FeedbackItem, patch: TicketPatch, meldung: string) => void;
  /** Dieselbe Änderung auf mehrere Tickets — ein Share-Lauf, ein Toast, ein Rückweg. */
  aendereViele: (tickets: readonly FeedbackItem[], patch: TicketPatch, meldung: string) => void;
  /** `false` = nichts geschrieben; der Entwurf des Aufrufers muss stehenbleiben. */
  kommentiere: (t: FeedbackItem, text: string, art: KommentarArt) => Promise<boolean>;
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

export function useTicketAktionen(
  onChanged: () => void,
  /** Eigene kanonische Schreib-Id + Anzeigename — für Kommentare. */
  meId: string | undefined,
  meName: string | undefined,
): TicketAktionen {
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

  const aendereViele = useCallback((
    tickets: readonly FeedbackItem[],
    patch: TicketPatch,
    meldung: string,
  ): void => {
    if (tickets.length === 0) return;
    // Je Ticket den EIGENEN Vorher-Zustand merken: „alle zurück auf X" wäre
    // kein Rückgängig, sondern eine zweite Massenänderung.
    const vorher = tickets.map(t => ({ id: t.id, werte: vorherigeWerte(t, patch) }));
    const ids = tickets.map(t => t.id);
    void runRef.current(async () => {
      await updateFeedbackMany(storage, ids, patch);
      onChanged();
      zeige({
        text: meldung,
        ton: 'info',
        rueckgaengig: () => {
          void runRef.current(async () => {
            // Gruppiert nach identischem Vorher-Zustand, damit auch das
            // Zurücknehmen mit wenigen Share-Läufen auskommt.
            const gruppen = new Map<string, { werte: TicketPatch; ids: string[] }>();
            for (const v of vorher) {
              const schluessel = JSON.stringify(v.werte);
              const g = gruppen.get(schluessel);
              if (g) g.ids.push(v.id);
              else gruppen.set(schluessel, { werte: v.werte, ids: [v.id] });
            }
            for (const g of gruppen.values()) {
              await updateFeedbackMany(storage, g.ids, g.werte);
            }
            onChanged();
            zeige({ text: `${tickets.length} Tickets zurückgesetzt.`, ton: 'info' });
          });
        },
      });
    });
  }, [storage, onChanged, zeige]);

  // Liefert, OB geschrieben wurde. Der Aufrufer hält den Entwurf in einem
  // Textfeld — leert er ihn auf Verdacht, ist der Text bei einem Share-Fehler
  // weg, und die Fehlermeldung im Toast sagt ihm nur, dass er ihn neu tippen
  // darf. `run` verschluckt die Rejection (Toast via onError), deshalb wird der
  // Erfolg im Abschluss festgehalten statt am geworfenen Fehler abgelesen.
  const kommentiere = useCallback(async (
    t: FeedbackItem,
    text: string,
    art: KommentarArt,
  ): Promise<boolean> => {
    if (!meId || !text.trim()) return false;
    let geschrieben = false;
    await runRef.current(async () => {
      // `addComment` liefert `ok:false` statt zu werfen — das muss der Aufrufer
      // auswerten (Pitfall #15 deckt nur geworfene Fehler ab). Ein verlorener
      // Kommentar ohne Meldung wäre der schlimmste Fall: der Text ist die
      // einzige Kopie.
      const res = await addComment(storage, t.id, meId, text, meName, art);
      if (!res.ok) {
        throw new Error(
          res.error === 'share_unreadable'
            ? 'Die geteilte Feedback-Datei ist gerade nicht lesbar.'
            : 'Der Kommentar konnte nicht gespeichert werden.',
        );
      }
      // „Als Rückfrage" ist beides in einem Zug: Beitrag UND Zustandswechsel.
      // Zuerst der Kommentar — wäre der Status gesetzt und der Text verloren,
      // stünde das Ticket auf „wartet auf dich", ohne zu sagen worauf.
      if (art === 'rueckfrage') {
        await updateFeedback(storage, t.id, { kurator_status: FEEDBACK_STATUS.rueckfrage });
      }
      geschrieben = true;
      onChanged();
      zeige({
        text: art === 'rueckfrage'
          ? `#${feedbackNummer(t)} → Rückfrage · Ersteller benachrichtigt`
          : art === 'ergaenzung'
            ? `#${feedbackNummer(t)} · Ergänzung angehängt`
            : 'Kommentar gesendet.',
        ton: 'info',
      });
      if (res.warning === 'no_personal_folder') {
        zeige({
          text: 'Kommentar lokal gespeichert — ohne verbundenen persönlichen Ordner erreicht er das Team noch nicht.',
          ton: 'fehler',
        });
      }
    });
    return geschrieben;
  }, [storage, meId, meName, onChanged, zeige]);

  return { aendere, aendereViele, kommentiere, busy: lauf.busy, toast, schliesseToast };
}

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
 *    nächste Slot sofort probiert, statt auf den Klick zu warten. Sie bucht
 *    ausschliesslich Erfolge — ob der Browser mangels Activation überhaupt
 *    einen Dialog gezeigt hat, ist von aussen nicht feststellbar, also darf aus
 *    einem Misserfolg NIE eine Ablehnung werden (v2.276.0, siehe
 *    guided-grant-progress.ts). Bleibt ein Ordner ungewährt, ist er einfach der
 *    nächste Klick-Schritt.
 *
 * v4.40.1 — die Kette lief, die Karte schwieg. Chrome zeigt unter `file://`
 * inzwischen mehrere Dialoge hintereinander (die v2.59.2-Beobachtung gilt nicht
 * mehr allgemein), der Fortschritt wurde aber erst HINTER der Schleife gebucht:
 * die Karte stand während aller Dialoge auf „Schritt 1 von 3" und sprang dann
 * direkt in die App. Zwei Korrekturen:
 *  - **Enge Kette + Live-Buchung:** jeder Grant wird sofort gebucht und
 *    gerendert (`buchErgebnis`), der Rescan läuft nur noch EINMAL am Ende. Der
 *    Sweep zwischen zwei Prompts verbrauchte das Zeitfenster der Activation,
 *    das der nächste Prompt braucht — daher brach die Kette mal nach zwei, mal
 *    nach drei Ordnern ab. Für die Sammel-Box ist er nicht nötig: ein bereits
 *    gewährtes Handle beantwortet `requestPermission` sofort mit `'granted'`,
 *    ganz ohne Dialog.
 *  - **Rest-Ordner hält an:** bleibt nach dem Lauf etwas offen, benennt die
 *    Karte es, statt still zu starten (siehe `abschlussStand`, Rescan-Fehler).
 */

import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { grantPending, type PendingGrant } from '@/core/services/infrastructure/smb-handle';
import { buchErgebnis, abschlussStand, darfWeiterketten, type GrantOutcome } from './guided-grant-progress';

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
  const offeneAnzahl = total - resolvedCount;

  const grantCurrent = useAsyncAction(async () => {
    if (!current) {
      await onComplete();
      return;
    }

    // Re-Scan: welche Slots sind JETZT noch ungranted? Eine Sammel-Box (modernes
    // Chromium) kann mehrere auf einmal gewährt haben → nicht stur weiterklicken.
    // `null` bei Fehler — „ich weiß es nicht" darf nie als „alles gewährt"
    // gelesen werden (siehe abschlussStand).
    const offeneSlots = async (): Promise<Set<string> | null> => {
      try {
        return new Set((await rescan()).map(g => g.slot));
      } catch {
        return null;
      }
    };

    // Schritt 1 = der geklickte Slot, die einzige echte User-Geste dieses Laufs.
    // Nur er darf aus einem Misserfolg eine Ablehnung machen.
    let ergebnis = await grantPending(current);
    let stand = buchErgebnis(resolved, current.slot, ergebnis, true);
    setResolved(stand);

    // Enge Auto-Kette: solange der Browser weiter prompted, die restlichen Slots
    // ohne zusätzlichen Klick nachziehen — direkt hintereinander, ohne Rescan
    // dazwischen (der verbraucht die Activation, die der nächste Prompt braucht).
    // Jeder Grant wird sofort gebucht und gerendert, damit die Karte mit den
    // Browser-Dialogen mitläuft. Obergrenze = Slot-Anzahl (kein Endlos-Lauf).
    for (let runde = 0; darfWeiterketten(ergebnis) && runde < pending.length; runde++) {
      const naechster = pending.find(g => stand[g.slot] === undefined);
      if (!naechster) break;

      ergebnis = await grantPending(naechster);
      stand = buchErgebnis(stand, naechster.slot, ergebnis, false);
      setResolved(stand);
    }

    // Ein Rescan am Ende: fängt die Sammel-Box (ein Prompt gewährte mehrere) und
    // korrigiert ein zu früh gebuchtes 'denied', falls der Ordner doch offen ist.
    const abschluss = abschlussStand(pendingSlots, stand, await offeneSlots());
    setResolved(abschluss.resolved);
    if (abschluss.complete) await onComplete();
  });

  const skipRemaining = useAsyncAction(async () => {
    await onComplete();
  });

  // Ein Lauf ist durch, es bleibt aber etwas offen: der Browser hat die Kette
  // nicht weitergeführt (Activation verfallen) oder der User hat abgelehnt und
  // die Reihe geht weiter. Beides braucht einen benannten nächsten Schritt — die
  // Ursache nur dort nennen, wo sie feststeht (eine Ablehnung ist in der Liste
  // ohnehin markiert). „Enter genügt" stimmt hier immer: der Auto-Fokus greift
  // ab Schritt 2, und Schritt 1 kann nie offen sein, wenn resolvedCount > 0 ist.
  const restOffen = !grantCurrent.busy && resolvedCount > 0 && current !== null;
  const hatAblehnung = pending.some(g => resolved[g.slot] === 'denied');
  const restHinweis = restOffen
    ? `${offeneAnzahl === 1 ? 'Noch ein Ordner ist' : `Noch ${offeneAnzahl} Ordner sind`} offen` +
      `${hatAblehnung ? '' : ' — Ihr Browser hat nicht von selbst weitergefragt'}. ` +
      'Bitte unten freigeben (Enter genügt).'
    : null;

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
                {isCurrent && grantCurrent.busy
                  ? 'wartet auf Ihre Bestätigung'
                  : g.mode === 'readwrite'
                    ? 'Lesen + Schreiben'
                    : 'Nur lesen'}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-2">
        Schritt {Math.min(resolvedCount + 1, total)} von {total}
      </p>

      {/* Die Reihe ist stehengeblieben — das benennen, statt den Ordner still zu
          überspringen. */}
      {restHinweis && (
        <p className="mb-2 text-[12px] text-[var(--tf-text-secondary)] leading-relaxed">
          {restHinweis}
        </p>
      )}

      <Button
        ref={grantButtonRef}
        icon={ArrowRight}
        onClick={() => grantCurrent.run()}
        disabled={grantCurrent.busy || !current}
        className="w-full"
      >
        {grantCurrent.busy && current
          ? `„${current.label}" wird abgefragt…`
          : current
            ? `„${current.label}" freigeben`
            : 'Starten'}
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

/**
 * Pure Fortschritts-Logik für den GuidedGrantSteps-Stepper (v2.59.2, Auto-Kette
 * seit v2.275).
 *
 * Hintergrund: Manche Chromium-Browser (in Edge beobachtet; in Chrome unter
 * `file://` NICHT, getestet bis v149) zeigen einen konsolidierten
 * „Wiederherstellen"-Prompt mit persistenten FSAPI-Permissions — EIN
 * `requestPermission()` kann dort via Sammel-Box MEHRERE gespeicherte Handles
 * auf einmal gewähren. Das ist browser-/kontextabhängig und nicht erzwingbar.
 * Der Stepper darf danach nicht stur den nächsten Schritt zeigen, sondern muss
 * alle bereits gewährten Slots als erledigt erkennen und ggf. sofort abschließen.
 *
 * Diese Funktionen kapseln genau diese Entscheidungen — pure, damit sie ohne
 * React-Rendering (kein RTL/jsdom im Projekt) unit-testbar sind.
 */

export type GrantOutcome = 'granted' | 'denied';

/** Rückgabewerte von `requestPermission` (smb-handle hält den Typ intern). */
export type GrantErgebnis = 'granted' | 'denied' | 'prompt';

/**
 * Untergrenze, ab der ein NICHT-`granted`-Ergebnis als echte User-Entscheidung
 * gilt. Ein Browser-Prompt zu lesen und wegzuklicken dauert einen Menschen
 * deutlich länger; kommt die Antwort schneller zurück, hat der Browser gar
 * keinen Prompt gezeigt (transiente User-Activation bereits verbraucht).
 */
export const AUTO_CHAIN_MIN_PROMPT_MS = 300;

/**
 * Aktualisiert den Resolved-Status nach einem Einzel-Grant.
 *
 * @param pendingSlots  Alle ursprünglich ausstehenden Slots (Anzeige-Reihenfolge).
 * @param prior         Bisher aufgelöste Slots.
 * @param attemptedSlot Der Slot, für den gerade `requestPermission` lief.
 * @param remainingSlots Slots, die laut Re-Scan (queryPermission) JETZT noch
 *                       NICHT granted sind.
 * @returns Neuer Resolved-Status + ob alle Slots erledigt sind.
 */
export function resolveAfterGrant(
  pendingSlots: string[],
  prior: Record<string, GrantOutcome>,
  attemptedSlot: string,
  remainingSlots: Set<string>,
): { resolved: Record<string, GrantOutcome>; complete: boolean } {
  const resolved: Record<string, GrantOutcome> = { ...prior };

  // Jeder Slot, der nach dem Grant nicht mehr ungranted ist → granted.
  // Fängt den Sammel-Box-Effekt: ein Klick kann mehrere Handles gewährt haben.
  for (const slot of pendingSlots) {
    if (!remainingSlots.has(slot)) resolved[slot] = 'granted';
  }

  // Der gerade versuchte Slot, der noch ungranted ist → denied. Sonst würde der
  // Stepper denselben Slot endlos erneut anbieten (User hat „Nicht zulassen"
  // gewählt). Als „erledigt" markieren, um zum nächsten Slot zu springen.
  if (remainingSlots.has(attemptedSlot)) resolved[attemptedSlot] = 'denied';

  const complete = pendingSlots.every(slot => resolved[slot] !== undefined);
  return { resolved, complete };
}

/**
 * Darf der Stepper nach diesem Grant OHNE neuen Klick direkt den nächsten Slot
 * anfragen? Nur nach einem echten Erfolg — jedes andere Ergebnis beendet die
 * Kette (entweder hat der User abgelehnt, oder der Browser hat gar nicht mehr
 * gefragt; in beiden Fällen bringt ein Weiterketten nichts).
 */
export function darfWeiterketten(ergebnis: GrantErgebnis): boolean {
  return ergebnis === 'granted';
}

/**
 * Ist die Auto-Kette abgebrochen, WEIL der Browser keinen Prompt mehr gezeigt
 * hat (statt weil der User abgelehnt hat)?
 *
 * ⚠️ Sicherheits-kritisch: Chromium verbraucht die transiente User-Activation
 * pro `requestPermission` — der zweite Aufruf in derselben Geste kehrt sofort
 * und still zurück (Chrome/`file://`). Dieser Fall darf NIEMALS als „denied"
 * gebucht werden, sonst überspringt `resolveAfterGrant` den Ordner endgültig
 * und der User kommt nie wieder an ihn heran. Stattdessen bleibt der Slot
 * unaufgelöst und der Stepper bietet ihn als nächsten Klick-Schritt an.
 */
export function ketteAbgebrochenOhnePrompt(ergebnis: GrantErgebnis, dauerMs: number): boolean {
  return ergebnis !== 'granted' && dauerMs < AUTO_CHAIN_MIN_PROMPT_MS;
}

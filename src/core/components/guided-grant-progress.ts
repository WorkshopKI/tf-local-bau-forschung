/**
 * Pure Fortschritts-Logik für den GuidedGrantSteps-Stepper (v2.59.2).
 *
 * Hintergrund: Manche Chromium-Browser (in Edge beobachtet; in Chrome unter
 * `file://` NICHT, getestet bis v149) zeigen einen konsolidierten
 * „Wiederherstellen"-Prompt mit persistenten FSAPI-Permissions — EIN
 * `requestPermission()` kann dort via Sammel-Box MEHRERE gespeicherte Handles
 * auf einmal gewähren. Das ist browser-/kontextabhängig und nicht erzwingbar.
 * Der Stepper darf danach nicht stur den nächsten Schritt zeigen, sondern muss
 * alle bereits gewährten Slots als erledigt erkennen und ggf. sofort abschließen.
 *
 * Diese Funktion kapselt genau diese Entscheidung — als pure Funktion, damit
 * sie ohne React-Rendering (kein RTL/jsdom im Projekt) unit-testbar ist.
 */

export type GrantOutcome = 'granted' | 'denied';

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

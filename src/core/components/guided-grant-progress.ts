/**
 * Pure Fortschritts-Logik für den GuidedGrantSteps-Stepper (v2.59.2, enge
 * Auto-Kette seit v4.40.1).
 *
 * Hintergrund: Manche Chromium-Browser (in Edge beobachtet; in Chrome unter
 * `file://` NICHT, getestet bis v149) zeigen einen konsolidierten
 * „Wiederherstellen"-Prompt mit persistenten FSAPI-Permissions — EIN
 * `requestPermission()` kann dort via Sammel-Box MEHRERE gespeicherte Handles
 * auf einmal gewähren. Das ist browser-/kontextabhängig und nicht erzwingbar.
 * Der Stepper darf danach nicht stur den nächsten Schritt zeigen, sondern muss
 * alle bereits gewährten Slots als erledigt erkennen und ggf. sofort abschließen.
 *
 * Zwei Buchungswege, bewusst getrennt:
 *  - `buchErgebnis` bucht das DIREKTE Resultat eines `requestPermission` — das
 *    ist die Wahrheit, die die Kette ohne Rescan zwischen den Prompts braucht.
 *  - `resolveAfterGrant` / `abschlussStand` buchen aus dem Rescan
 *    (`queryPermission`-Sweep) und fangen damit die Sammel-Box.
 *
 * Diese Funktionen kapseln genau diese Entscheidungen — pure, damit sie ohne
 * React-Rendering (kein RTL/jsdom im Projekt) unit-testbar sind.
 */

export type GrantOutcome = 'granted' | 'denied';

/** Rückgabewerte von `requestPermission` (smb-handle hält den Typ intern). */
export type GrantErgebnis = 'granted' | 'denied' | 'prompt';

/**
 * Aktualisiert den Resolved-Status nach einem Einzel-Grant.
 *
 * @param pendingSlots  Alle ursprünglich ausstehenden Slots (Anzeige-Reihenfolge).
 * @param prior         Bisher aufgelöste Slots.
 * @param attemptedSlot Der Slot, für den gerade `requestPermission` in einer
 *                      ECHTEN User-Geste lief — nur er darf `denied` werden.
 *                      `null` = Auflösung ohne Geste (Auto-Kette): dann werden
 *                      ausschließlich gewährte Slots gebucht, nie eine Ablehnung.
 * @param remainingSlots Slots, die laut Re-Scan (queryPermission) JETZT noch
 *                       NICHT granted sind.
 * @returns Neuer Resolved-Status + ob alle Slots erledigt sind.
 */
export function resolveAfterGrant(
  pendingSlots: string[],
  prior: Record<string, GrantOutcome>,
  attemptedSlot: string | null,
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
  //
  // NUR bei echter User-Geste (attemptedSlot != null). In der Auto-Kette fehlt
  // die Activation womöglich, der Browser zeigt dann gar keinen Dialog — eine
  // Ablehnung daraus abzuleiten würde den Ordner dauerhaft überspringen.
  if (attemptedSlot !== null && remainingSlots.has(attemptedSlot)) resolved[attemptedSlot] = 'denied';

  const complete = pendingSlots.every(slot => resolved[slot] !== undefined);
  return { resolved, complete };
}

/**
 * Bucht das DIREKTE Ergebnis eines `requestPermission` — ohne Rescan.
 *
 * Die Kette fragt die restlichen Ordner unmittelbar hintereinander an; ein
 * Rescan dazwischen (IDB + `queryPermission` über SMB-Handles) verbraucht das
 * Zeitfenster der User-Activation, das der nächste Prompt braucht. Der
 * Rückgabewert von `requestPermission` reicht als Wahrheit: `'granted'` ist
 * `'granted'`, egal ob eine Geste dahinterstand.
 *
 * @param echteGeste `true` nur für den geklickten Slot. Ausschliesslich dann
 *                   darf aus einem Misserfolg eine Ablehnung werden — in der
 *                   Kette ist von aussen nicht feststellbar, ob der Browser
 *                   überhaupt einen Dialog gezeigt hat, ein `denied` würde den
 *                   Ordner also dauerhaft überspringen.
 */
export function buchErgebnis(
  prior: Record<string, GrantOutcome>,
  slot: string,
  ergebnis: GrantErgebnis,
  echteGeste: boolean,
): Record<string, GrantOutcome> {
  if (ergebnis === 'granted') return { ...prior, [slot]: 'granted' };
  if (echteGeste) return { ...prior, [slot]: 'denied' };
  return prior;
}

/**
 * Abschluss nach der Kette: den Rescan einarbeiten (falls er gelang) und
 * entscheiden, ob der Stepper fertig ist.
 *
 * @param offen Slots, die laut Rescan JETZT noch nicht granted sind — oder
 *              `null`, wenn der Rescan gescheitert ist. `null` darf NIEMALS wie
 *              ein leeres Set behandelt werden: „ich weiß es nicht" ist nicht
 *              „alles gewährt". Bis v4.40.0 lieferte der Fehlerpfad ein leeres
 *              Set; ein einziger fehlgeschlagener Sweep buchte damit alle
 *              offenen Ordner als gewährt und startete die App, ohne sie je
 *              gefragt zu haben.
 */
export function abschlussStand(
  pendingSlots: string[],
  resolved: Record<string, GrantOutcome>,
  offen: Set<string> | null,
): { resolved: Record<string, GrantOutcome>; complete: boolean } {
  if (offen === null) {
    // Kein verlässlicher Rescan → nichts zusätzlich buchen. Direkt beobachtete
    // Grants zählen trotzdem, deshalb wird `complete` aus `resolved` gerechnet.
    return { resolved, complete: pendingSlots.every(slot => resolved[slot] !== undefined) };
  }
  return resolveAfterGrant(pendingSlots, resolved, null, offen);
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

// Bewusst KEINE Dauer-Heuristik mehr (bis v2.275.0 gab es hier eine 300ms-
// Schwelle, die „Browser hat nicht gefragt" von „User hat abgelehnt" trennen
// sollte). Wall-Clock ist dafür untauglich: in virtualisierten Umgebungen
// (Citrix) wird der Renderer unter Last hunderte Millisekunden weggeplant, die
// Messung läuft über ein `await` und bläht sich auf — die Schwelle kippt und
// ein nie gezeigter Dialog wird als Ablehnung gebucht. Die Kette bucht deshalb
// grundsätzlich nur noch Erfolge (`resolveAfterGrant` mit attemptedSlot=null).

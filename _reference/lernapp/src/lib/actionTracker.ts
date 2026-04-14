/* ── Leichtgewichtiger Action-Tracker ──
 * In-Memory Ring-Buffer der letzten 10 User-Aktionen.
 * Kein localStorage, kein Network — nur für die aktuelle Session.
 */

const MAX_ACTIONS = 10;
const MAX_ERRORS = 3;

const actions: string[] = [];
const capturedErrors: string[] = [];

const FEATURE_PREFIXES = [
  "acta", "chat", "ki-", "uebung", "challenge", "prompt", "pruefen", "vorschlagen", "export",
];

/** Aktion aufzeichnen (z.B. "ki-nachricht-gesendet", "uebung-abgegeben") */
export function trackAction(action: string): void {
  actions.push(action);
  if (actions.length > MAX_ACTIONS) actions.shift();
}

/** Letzte Aktionen abrufen (neueste zuerst) */
export function getRecentActions(): string[] {
  return [...actions].reverse();
}

/** Letzte aufgezeichnete Aktion */
export function getLastAction(): string {
  return actions[actions.length - 1] ?? "";
}

/** Letztes Feature (filtert nach bekannten Feature-Prefixen) */
export function getLastFeature(): string {
  for (let i = actions.length - 1; i >= 0; i--) {
    if (FEATURE_PREFIXES.some((p) => actions[i].startsWith(p))) {
      return actions[i];
    }
  }
  return "";
}

/** Erfasste Console-Errors abrufen */
export function getCapturedErrors(): string[] {
  return [...capturedErrors];
}

/** Error-Listener initialisieren (einmal beim App-Start aufrufen) */
export function initErrorCapture(): void {
  window.addEventListener("error", (e) => {
    capturedErrors.push(e.message || "Unknown error");
    if (capturedErrors.length > MAX_ERRORS) capturedErrors.shift();
  });
  window.addEventListener("unhandledrejection", (e) => {
    capturedErrors.push(String(e.reason) || "Unhandled rejection");
    if (capturedErrors.length > MAX_ERRORS) capturedErrors.shift();
  });
}

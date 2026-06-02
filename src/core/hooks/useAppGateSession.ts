/**
 * sessionStorage-Session fuer das Build-Time Rollen-Passwort-Gate (v2.16).
 *
 * TTL = Browser-Tab: beim Tab-Schliessen verfaellt der Login (Re-Login pro
 * Arbeitstag), analog der v2.11-MA-Login-Philosophie. Abgelegt wird NUR ein
 * Flag — nie Passwort oder Key. Same-Tab-Reload (F5) behaelt das Flag, das Gate
 * wird dann uebersprungen.
 *
 * Bewusste Abweichung von der Kurator-IDB-Session (12h TTL ueber Restarts): der
 * Gate-Zugang ist tab-gebunden. Die Kurator-Schreib-Session (useKuratorSession)
 * laeuft parallel weiter und wird beim Reload via rehydrate() restauriert.
 */

const APP_GATE_SESSION_KEY = 'tf-app-gate';

export function getAppGateSession(): boolean {
  try {
    return sessionStorage.getItem(APP_GATE_SESSION_KEY) === 'unlocked';
  } catch {
    return false;
  }
}

export function setAppGateSession(): void {
  try {
    sessionStorage.setItem(APP_GATE_SESSION_KEY, 'unlocked');
  } catch {
    /* sessionStorage nicht verfuegbar → kein Persist, naechster Start fragt erneut. */
  }
}

export function clearAppGateSession(): void {
  try {
    sessionStorage.removeItem(APP_GATE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

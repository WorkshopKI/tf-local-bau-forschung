// Browser-Kontext-Helpers für Feature-Detection.

/** True wenn die App in einem iframe läuft (z.B. Claude-Code-Preview-Browser).
 *  Wirft im Cross-Origin-Fall — dann auch iframe annehmen. */
export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** True wenn Origin Private File System (OPFS) im Browser verfügbar ist. */
export function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.storage
    && typeof navigator.storage.getDirectory === 'function';
}

/** UI-Sichtbarkeitsregel für OPFS-Sandbox-Buttons:
 *  Im Dev-Modus IMMER zeigen (für lokales Schnelltesten).
 *  In Production nur in iframes (Preview-Browser-Workaround). */
export function shouldShowOpfsOption(): boolean {
  if (!isOpfsAvailable()) return false;
  return import.meta.env.DEV || isInIframe();
}

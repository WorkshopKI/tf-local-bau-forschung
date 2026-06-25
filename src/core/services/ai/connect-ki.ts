/**
 * Oeffnet/verbindet die interne KI in einem parallelen Tab. EINZIGE Quelle fuer
 * den „Verbinden"-Flow — genutzt von Einstellungen (`openTab`), Homepage-Karte,
 * Sidebar-Indikator und Trennungs-Hinweis.
 *
 * Reihenfolge ist load-bearing: erst `getStreamlitTransport(url)` (synchronisiert
 * die Origin-Pruefung + behaelt das gecapturte Fenster-Handle), dann `window.open`
 * mit dem FESTEN Fensternamen `teamflow-streamlit`, damit App und Transport
 * denselben Tab teilen.
 *
 * SYNCHRON aus einem User-Gesture-Handler (onClick) aufrufen — kein `await` davor,
 * sonst greift der Popup-Blocker. Aufrufer, die die URL erst laden muessen, holen
 * sie VOR dem Klick (z. B. per useEffect in den State), nicht im Handler.
 */
import type { AIBridge } from './bridge';

export const KI_WINDOW_NAME = 'teamflow-streamlit';
export const DEFAULT_KI_URL = 'https://gpt.vdivde-it.de/';

export function connectInternalKi(aiBridge: AIBridge, url: string): Window | null {
  const target = (url || DEFAULT_KI_URL).trim();
  aiBridge.getStreamlitTransport(target);
  return window.open(target, KI_WINDOW_NAME);
}

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

/**
 * Nimmt einen noch lebenden KI-Tab wieder auf, nachdem der App-Tab neu geladen
 * wurde. KEIN Ersatz fuer `connectInternalKi` — dieser Weg oeffnet nichts.
 *
 * Warum es ihn braucht: der Transport haelt den Fenstergriff nur im Speicher
 * (`event.source` einer eingehenden Bridge-Nachricht), und das Bookmarklet meldet
 * sich nur EINMAL, beim Aktivieren (`tf-bridge-ready` an `window.opener`). Ein F5
 * im App-Tab loescht damit den einzigen Zeiger auf eine weiterlaufende Bridge; sie
 * blieb bis v6.9.6 unerreichbar, bis der Nutzer im KI-Tab die Pille drueckte
 * (`tf-app-ping`, die Gegenrichtung).
 *
 * `window.open` mit LEERER url navigiert das gefundene Fenster nicht (HTML-Spec:
 * bei leerer url findet keine Navigation statt). Genau darin liegt der Unterschied
 * zu `connectInternalKi`, das den Tab absichtlich neu laedt — und dabei das
 * injizierte Bookmarklet verliert.
 *
 * Gegenprobe gegen einen selbst erzeugten Leer-Tab: existiert das benannte Fenster
 * nicht, liefert der Aufruf ausserhalb einer Nutzergeste `null` (Popup-Blocker) —
 * wo Popups erlaubt sind, entsteht aber ein leerer Tab. Dessen `location` ist
 * LESBAR (`about:blank` erbt unsere Origin); der KI-Tab liegt immer auf fremder
 * Origin und wirft dort SecurityError. Nur der Wurf beweist den gesuchten Tab.
 */
export function findeKiFensterWieder(): Window | null {
  const gefunden = window.open('', KI_WINDOW_NAME);
  if (!gefunden) return null;
  try {
    if (gefunden.location.href === 'about:blank') gefunden.close();
    return null;
  } catch {
    return gefunden;
  }
}

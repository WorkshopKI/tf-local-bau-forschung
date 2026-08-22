/**
 * useBridgeHeartbeat — passiver Erreichbarkeits-Poller fuer die interne KI.
 *
 * Mountet EINMAL in `ShellLayout`. Haelt `useBridgeStatus` ehrlich, auch wenn
 * KEIN postMessage mehr feuert (geschlossener KI-Tab): dann erkennt nur der Poll
 * die Trennung. Zwei Stufen, gemeinsamer Takt (~3 s):
 *   - jeder Tick:  guenstiger `hasLiveBridgeWindow()`-Check (synchron, 0 Traffic)
 *                  → kein lebendes Fenster mehr ⇒ `setConnected(false)` in ~3 s.
 *   - alle 15 s:   echter passiver `ping({ openIfNeeded:false })`
 *                  → faengt „Tab offen, aber Bridge tot/weg-navigiert" ab.
 *
 * Der 15-s-Takt haengt an der UHR, nicht an der Zahl der Ticks (v6.9.6). Vorher
 * zaehlte ein `tickCount`, der erst HINTER dem `await` der Probe hochlief: waehrend
 * einer Probe (bis 5 s) sahen die folgenden Ticks denselben Stand und starteten
 * jeweils eine weitere. Ausgerechnet bei klemmender Bridge probte die App damit
 * alle 3 s statt alle 15 s. Eine laufende Probe sperrt jetzt zusaetzlich sich
 * selbst — sonst waere schnelles Tab-Wechseln ein zweiter Weg in denselben Stau.
 *
 * `getStreamlitTransport()` (nicht `getActiveTransport()`): nur diese Instanz
 * haelt das per `tf-bridge-ready` gecapturte Fenster-Handle. `ping()` traegt
 * keinen Inhalt → Pitfall #30 (no-raw-active-transport) nicht beruehrt; die Datei
 * liegt zudem ausserhalb des Test-Scopes.
 *
 * Bewusst silent (kein `useAsyncAction`, analog `useHeartbeat`): keine UI-
 * Affordance. Pausiert bei `document.hidden`; bei `visibilitychange` sofort proben
 * — waehrend der Tab verborgen lag, lief kein Poll, der Status ist dann am
 * ehesten veraltet.
 */
import { useEffect } from 'react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';

const BRIDGE_HEARTBEAT_MS = 3_000;
/** Abstand zwischen zwei aktiven Proben. */
export const PING_INTERVAL_MS = 15_000;
/**
 * Halbe Tick-Breite Nachsicht auf die Frist — sonst kaeme die Probe systematisch
 * einen Takt zu spaet (gemessen: durchgehend 18 s statt 15 s). Grund: `letzteProbe`
 * wird INNERHALB des Ticks gesetzt, also ein paar Millisekunden nach dessen
 * Zeitpunkt; der Tick 15 s spaeter verfehlt die Frist damit immer knapp und muss
 * aufs naechste Raster warten. Frueher als vorgesehen kann nichts feuern: der
 * vorherige Tick-Kandidat liegt bei 12 s und damit deutlich unter der Schwelle.
 */
const TAKT_TOLERANZ_MS = BRIDGE_HEARTBEAT_MS / 2;

/**
 * Ist jetzt eine aktive Probe faellig?
 *
 * Pur gehalten, damit ein Test den Takt festhalten kann — das Projekt rendert
 * keine Komponenten, der Hook darunter bleibt reine Anbindung.
 *
 * `laeuft` gewinnt gegen alles: zwei gleichzeitige Proben bringen keine
 * zusaetzliche Erkenntnis (eine Antwort beweist Leben fuer beide) und stauen sich
 * nur auf. `sofort` ist der Re-Fokus-Fall, `letzteProbe: null` der erste Lauf.
 */
export function probeIstFaellig(args: {
  jetzt: number;
  letzteProbe: number | null;
  laeuft: boolean;
  sofort: boolean;
}): boolean {
  if (args.laeuft) return false;
  if (args.sofort || args.letzteProbe === null) return true;
  return args.jetzt - args.letzteProbe >= PING_INTERVAL_MS - TAKT_TOLERANZ_MS;
}

export function useBridgeHeartbeat(): void {
  const aiBridge = useAIBridge();

  useEffect(() => {
    let cancelled = false;
    let letzteProbe: number | null = null;
    let laeuft = false;

    const tick = async (sofort = false): Promise<void> => {
      if (document.hidden) return; // versteckter Tab → kein Poll
      const transport = aiBridge.getStreamlitTransport();

      // Stufe 1 (jeder Tick): kostenfreier Fenster-Check. Schliesst der Nutzer
      // den KI-Tab, flippt `window.closed` sofort → Trennung in ~3 s erkannt.
      if (!transport.hasLiveBridgeWindow()) {
        if (!cancelled) useBridgeStatus.getState().setConnected(false);
        return;
      }

      // Stufe 2: aktiver passiver Ping fuer „offen, aber tot".
      if (!probeIstFaellig({ jetzt: Date.now(), letzteProbe, laeuft, sofort })) return;

      laeuft = true;
      letzteProbe = Date.now();
      try {
        const ok = await transport.ping({ openIfNeeded: false });
        if (!cancelled) useBridgeStatus.getState().setConnected(ok);
      } catch {
        if (!cancelled) useBridgeStatus.getState().setConnected(false);
      } finally {
        laeuft = false;
      }
    };

    void tick();
    const h = window.setInterval(() => void tick(), BRIDGE_HEARTBEAT_MS);
    // Beim Re-Fokus sofort proben statt bis zu 15 s zu warten.
    const onVis = (): void => { if (!document.hidden) void tick(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(h);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [aiBridge]);
}

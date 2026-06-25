/**
 * useBridgeHeartbeat — passiver Erreichbarkeits-Poller fuer die interne KI.
 *
 * Mountet EINMAL in `ShellLayout`. Haelt `useBridgeStatus` ehrlich, auch wenn
 * KEIN postMessage mehr feuert (geschlossener KI-Tab): dann erkennt nur der Poll
 * die Trennung. Zwei-Stufen-Takt (~3 s):
 *   - jeder Tick:  guenstiger `hasLiveBridgeWindow()`-Check (synchron, 0 Traffic)
 *                  → kein lebendes Fenster mehr ⇒ `setConnected(false)` in ~3 s.
 *   - jeder 5. Tick (~15 s): echter passiver `ping({ openIfNeeded:false })`
 *                  → faengt „Tab offen, aber Bridge tot/weg-navigiert" ab.
 *
 * `getStreamlitTransport()` (nicht `getActiveTransport()`): nur diese Instanz
 * haelt das per `tf-bridge-ready` gecapturte Fenster-Handle. `ping()` traegt
 * keinen Inhalt → Pitfall #30 (no-raw-active-transport) nicht beruehrt; die Datei
 * liegt zudem ausserhalb des Test-Scopes.
 *
 * Bewusst silent (kein `useAsyncAction`, analog `useHeartbeat`): keine UI-
 * Affordance. Pausiert bei `document.hidden`; bei `visibilitychange` sofort proben.
 */
import { useEffect } from 'react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';

const BRIDGE_HEARTBEAT_MS = 3_000;
/** Alle N Ticks zusaetzlich aktiv pingen (5 × 3 s ≈ 15 s). */
const PING_EVERY_N_TICKS = 5;

export function useBridgeHeartbeat(): void {
  const aiBridge = useAIBridge();

  useEffect(() => {
    let cancelled = false;
    let tickCount = 0;

    const tick = async (): Promise<void> => {
      if (document.hidden) return; // versteckter Tab → kein Poll
      const transport = aiBridge.getStreamlitTransport();

      // Stufe 1 (jeder Tick): kostenfreier Fenster-Check. Schliesst der Nutzer
      // den KI-Tab, flippt `window.closed` sofort → Trennung in ~3 s erkannt.
      if (!transport.hasLiveBridgeWindow()) {
        if (!cancelled) useBridgeStatus.getState().setConnected(false);
        tickCount++;
        return;
      }

      // Stufe 2 (jeder 5. Tick): aktiver passiver Ping fuer „offen, aber tot".
      if (tickCount % PING_EVERY_N_TICKS === 0) {
        try {
          const ok = await transport.ping({ openIfNeeded: false });
          if (!cancelled) useBridgeStatus.getState().setConnected(ok);
        } catch {
          if (!cancelled) useBridgeStatus.getState().setConnected(false);
        }
      }
      tickCount++;
    };

    void tick();
    const h = window.setInterval(() => void tick(), BRIDGE_HEARTBEAT_MS);
    // Beim Re-Fokus sofort proben statt bis zu 3 s zu warten.
    const onVis = (): void => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(h);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [aiBridge]);
}

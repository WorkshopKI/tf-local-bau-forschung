import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Bot } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import { connectInternalKi, DEFAULT_KI_URL } from '@/core/services/ai/connect-ki';
import type { AIProviderConfig } from '@/core/types/config';

/**
 * Globaler Trennungs-Hinweis fuer die interne KI (Toast, Stil analog `ReviewToast`:
 * fixed bottom-right, Theme-Tokens, `role="status"`). Erscheint NUR beim Übergang
 * `connected → disconnected` — also wenn vorher eine Verbindung bestand und der
 * Nutzer den KI-Tab (vermutlich versehentlich) geschlossen hat. `unknown →
 * disconnected` (Boot / nie verbunden) triggert NICHT.
 *
 * Verschwindet automatisch, sobald wieder `connected` (Reconnect erkannt), oder
 * per Schließen-X. Endpoint beim Mount in den State → „Erneut verbinden"-onClick
 * bleibt synchron (kein Popup-Blocker).
 */
export function BridgeDisconnectHint(): React.ReactElement | null {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const status = useBridgeStatus(s => s.status);
  const prevStatus = useRef(status);
  const [show, setShow] = useState(false);
  const [endpoint, setEndpoint] = useState(DEFAULT_KI_URL);

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(cfg => {
      if (cfg?.endpoint) setEndpoint(cfg.endpoint);
    });
  }, [storage]);

  useEffect(() => {
    // Nur eine ECHTE Trennung (vorher verbunden) zeigt den Hinweis.
    if (prevStatus.current === 'connected' && status === 'disconnected') setShow(true);
    // Reconnect → Hinweis schliessen.
    if (status === 'connected') setShow(false);
    prevStatus.current = status;
  }, [status]);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-[10px] bg-[var(--tf-bg)] shadow-lg max-w-[420px] flex items-start gap-3"
      style={{ border: '0.5px solid var(--tf-danger-border)' }}
    >
      <Bot size={16} className="mt-0.5 shrink-0 text-[var(--tf-danger-text)]" />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] text-[var(--tf-text)]">
          Interne KI getrennt — wurde der KI-Tab geschlossen?
        </p>
        <button
          onClick={() => connectInternalKi(aiBridge, endpoint)}
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--tf-primary)] hover:underline cursor-pointer"
        >
          <ExternalLink size={12} /> Erneut verbinden
        </button>
      </div>
      <button
        onClick={() => setShow(false)}
        aria-label="Hinweis schließen"
        className="shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

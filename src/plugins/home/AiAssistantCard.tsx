import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import { connectInternalKi, DEFAULT_KI_URL } from '@/core/services/ai/connect-ki';
import type { AIProviderConfig } from '@/core/types/config';

/**
 * AI-Assistent-Karte auf dem Home-Dashboard. Zeigt den LIVE-Verbindungsstatus der
 * internen KI (aus `useBridgeStatus`) — kein hartkodiertes „Nicht verbunden" mehr —
 * und erlaubt das Verbinden direkt von der Startseite (frueher nur via Einstellungen).
 *
 * Endpoint wird beim Mount in den State geladen, damit der „Verbinden"-onClick bis
 * `window.open` SYNCHRON bleibt (kein `await` im Gesture → kein Popup-Blocker).
 */
export function AiAssistantCard(): React.ReactElement {
  const { navigate } = useNavigation();
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const status = useBridgeStatus(s => s.status);
  const connected = status === 'connected';
  const [endpoint, setEndpoint] = useState(DEFAULT_KI_URL);

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(cfg => {
      if (cfg?.endpoint) setEndpoint(cfg.endpoint);
    });
  }, [storage]);

  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
      <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">AI-Assistent</p>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--tf-success-text)]' : 'bg-[var(--tf-text-tertiary)]'}`} />
        <span className="text-[13px] text-[var(--tf-text-secondary)]">{connected ? 'Verbunden' : 'Nicht verbunden'}</span>
      </div>
      {!connected && (
        <Button variant="secondary" size="sm" className="mb-2" onClick={() => connectInternalKi(aiBridge, endpoint)}>
          Verbinden
        </Button>
      )}
      <button onClick={() => navigate('chat')} className="block text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer">
        Chat öffnen →
      </button>
    </div>
  );
}

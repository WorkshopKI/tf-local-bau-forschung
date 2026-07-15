import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import { connectInternalKi, DEFAULT_KI_URL } from '@/core/services/ai/connect-ki';
import { KiVariantSelector } from '@/core/components/KiVariantSelector';
import type { AIProviderConfig } from '@/core/types/config';
import { WidgetShell } from './widgets/WidgetShell';
import type { WidgetProps } from './widgets/widgetProps';

/**
 * AI-Assistent-Widget (Home, Seitenspalte). Zeigt den LIVE-Verbindungsstatus der
 * internen KI (aus `useBridgeStatus`) — kein hartkodiertes „Nicht verbunden" mehr —
 * und erlaubt das Verbinden direkt von der Startseite (frueher nur via Einstellungen).
 *
 * Endpoint wird beim Mount in den State geladen, damit der „Verbinden"-onClick bis
 * `window.open` SYNCHRON bleibt (kein `await` im Gesture → kein Popup-Blocker).
 */
export function AiAssistentWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
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
    <WidgetShell
      titel="AI-Assistent"
      variante="seite"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        <span
          className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--tf-success-text)]' : 'bg-[var(--tf-text-tertiary)]'}`}
          title={connected ? 'Verbunden' : 'Nicht verbunden'}
          aria-hidden="true"
        />
      }
    >
      {/* Status + „Verbinden" auf EINER Zeile (v2.239, kompakter). Der „Chat
          öffnen"-Link entfällt — der Assistent ist jetzt über das Dock-Icon
          rechts auf jeder Seite erreichbar. */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--tf-success-text)]' : 'bg-[var(--tf-text-tertiary)]'}`} />
          <span className="text-[13px] text-[var(--tf-text-secondary)] truncate">{connected ? 'Verbunden' : 'Nicht verbunden'}</span>
        </span>
        {!connected && (
          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => connectInternalKi(aiBridge, endpoint)}>
            Verbinden
          </Button>
        )}
      </div>
      <div className="mt-2.5">
        <KiVariantSelector compact />
      </div>
    </WidgetShell>
  );
}

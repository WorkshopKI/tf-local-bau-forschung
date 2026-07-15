import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { connectInternalKi, DEFAULT_KI_URL } from '@/core/services/ai/connect-ki';
import { useKiConnectPrompt } from '@/core/services/ai/ki-guard';
import { KiVariantSelector } from '@/core/components/KiVariantSelector';
import type { AIProviderConfig } from '@/core/types/config';

/**
 * App-weiter „Interne KI nicht verbunden"-Dialog. Wird einmalig im ShellLayout
 * gemountet; jeder KI-CTA öffnet ihn über `kiVerbindungBereit()` statt still einen
 * KI-Tab zu öffnen und in eine Retry-Schleife zu laufen. „Jetzt verbinden" ruft
 * `connectInternalKi` SYNCHRON aus dem onClick (Popup-Blocker-sicher).
 *
 * Endpoint beim Mount in den State laden (siehe BridgeStatusIndicator).
 */
export function KiConnectPromptDialog(): React.ReactElement {
  const offen = useKiConnectPrompt(s => s.offen);
  const schliessen = useKiConnectPrompt(s => s.schliessen);
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [endpoint, setEndpoint] = useState(DEFAULT_KI_URL);

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(cfg => {
      if (cfg?.endpoint) setEndpoint(cfg.endpoint);
    });
  }, [storage]);

  return (
    <Dialog open={offen} onClose={schliessen} title="Interne KI nicht verbunden" size="sm">
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--tf-text-secondary)] leading-snug">
          Für diese Aktion wird die interne KI benötigt, sie ist aber gerade nicht verbunden.
          „Jetzt verbinden" öffnet die interne KI in einem parallelen Tab — dort einmalig das
          Lesezeichen anklicken, dann wird der Status automatisch grün. Anschließend die Aktion
          erneut starten.
        </p>
        <KiVariantSelector />
        <div className="flex gap-2">
          <Button
            variant="primary"
            icon={ExternalLink}
            onClick={() => { connectInternalKi(aiBridge, endpoint); schliessen(); }}
          >
            Jetzt verbinden
          </Button>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
        </div>
      </div>
    </Dialog>
  );
}

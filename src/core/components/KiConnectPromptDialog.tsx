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
 * Endpoint beim Mount in den State laden (siehe BridgeStatusIndicator) — aber NUR
 * aus einer Streamlit-Konfiguration. Wer als Provider einen lokalen Server führt,
 * hat dort `http://localhost:8081` stehen; als Bridge-URL übernommen zeigte der
 * Verbinden-Knopf auf denselben toten Port, an dem der Lauf gerade gescheitert ist.
 *
 * Zwei Fälle, zwei Texte (v4.68): Läuft die Bridge, fehlt nur das Lesezeichen im
 * Tab. Läuft ein direkter Server, ist er schlicht nicht erreichbar — dann ist das
 * Verbinden ein PROVIDER-WECHSEL zurück auf die Bridge, und der Dialog sagt das
 * auch, statt einen Knopf anzubieten, der den Zustand nicht ändert.
 */
export function KiConnectPromptDialog(): React.ReactElement {
  const offen = useKiConnectPrompt(s => s.offen);
  const schliessen = useKiConnectPrompt(s => s.schliessen);
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [endpoint, setEndpoint] = useState(DEFAULT_KI_URL);
  const [direkterServer, setDirekterServer] = useState<string | null>(null);

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(cfg => {
      if (!cfg?.endpoint) return;
      if (cfg.type === 'streamlit') setEndpoint(cfg.endpoint);
      else setDirekterServer(cfg.endpoint);
    });
  }, [storage]);

  // Der aktive Provider entscheidet, nicht der gespeicherte: `switchProvider`
  // kann ihn zur Laufzeit umgestellt haben.
  const bridgeAktiv = aiBridge.istBridgeAktiv();

  /**
   * Beide fenster-öffnenden Schritte SYNCHRON aus dem Klick — dazwischen kein
   * `await`, sonst greift der Popup-Blocker. Das Persistieren läuft danach
   * nebenher; es öffnet nichts.
   */
  const verbinden = (): void => {
    if (!bridgeAktiv) {
      const cfg: AIProviderConfig = { type: 'streamlit', endpoint, model: '', apiKey: '' };
      aiBridge.switchProvider(cfg);
      void storage.idb.set('ai-provider', cfg);
    }
    connectInternalKi(aiBridge, endpoint);
    schliessen();
  };

  return (
    <Dialog
      open={offen}
      onClose={schliessen}
      title={bridgeAktiv ? 'Interne KI nicht verbunden' : 'Interne KI nicht erreichbar'}
      size="sm"
    >
      <div className="space-y-4">
        {bridgeAktiv ? (
          <p className="text-[13px] text-[var(--tf-text-secondary)] leading-snug">
            Für diese Aktion wird die interne KI benötigt, sie ist aber gerade nicht verbunden.
            „Jetzt verbinden" öffnet die interne KI in einem parallelen Tab — dort einmalig das
            Lesezeichen anklicken, dann wird der Status automatisch grün. Anschließend die Aktion
            erneut starten.
          </p>
        ) : (
          <p className="text-[13px] text-[var(--tf-text-secondary)] leading-snug">
            Für diese Aktion wird die interne KI benötigt. Eingestellt ist gerade ein direkter
            Server{direkterServer ? ` (${direkterServer})` : ''}, der nicht antwortet — entweder
            läuft er nicht, oder die Adresse stimmt nicht mehr. „Auf die interne KI umstellen"
            wechselt zurück zur KI-Oberfläche und öffnet sie in einem parallelen Tab; dort
            einmalig das Lesezeichen anklicken. Den direkten Server stellt man in den
            Einstellungen unter „KI" wieder ein.
          </p>
        )}
        <KiVariantSelector />
        <div className="flex gap-2">
          <Button variant="primary" icon={ExternalLink} onClick={verbinden}>
            {bridgeAktiv ? 'Jetzt verbinden' : 'Auf die interne KI umstellen'}
          </Button>
          <Button variant="ghost" onClick={schliessen}>Abbrechen</Button>
        </div>
      </div>
    </Dialog>
  );
}

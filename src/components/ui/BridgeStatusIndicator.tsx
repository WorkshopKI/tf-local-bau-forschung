import { useState, useEffect } from 'react';
import { Bot, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/ui/Dialog';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import { connectInternalKi, DEFAULT_KI_URL } from '@/core/services/ai/connect-ki';
import type { AIProviderConfig } from '@/core/types/config';

/**
 * Sidebar-Fußzeilen-Indikator fuer die interne KI (neben dem Datenbestand-Punkt).
 * Icon-only (`Bot`), Farbe via Theme-Tokens: grün = verbunden, rot = getrennt,
 * grau = unbekannt (Boot, bevor je ein KI-Tab offen war). Klick öffnet einen
 * kleinen Detail-Dialog (analog `SyncStatusIndicator`) mit Verbinden + Einstellungen.
 *
 * Endpoint beim Mount in den State laden → „Verbinden"-onClick bleibt bis
 * `window.open` synchron (kein Popup-Blocker).
 */
export function BridgeStatusIndicator(): React.ReactElement {
  const { navigate } = useNavigation();
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const status = useBridgeStatus(s => s.status);
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState(DEFAULT_KI_URL);
  const connected = status === 'connected';

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(cfg => {
      if (cfg?.endpoint) setEndpoint(cfg.endpoint);
    });
  }, [storage]);

  const color = connected
    ? 'text-[var(--tf-success-text)]'
    : status === 'disconnected'
      ? 'text-[var(--tf-danger-text)]'
      : 'text-[var(--tf-text-tertiary)]';
  const tip = connected
    ? 'Interne KI verbunden'
    : 'Interne KI nicht verbunden — klicken zum Verbinden';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={tip}
        aria-label={tip}
        className="flex items-center justify-center p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] cursor-pointer shrink-0"
      >
        <Bot size={15} className={color} />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Interne KI">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bot size={16} className={color} />
            <span className="text-[13px] text-[var(--tf-text)]">{connected ? 'Verbunden' : 'Nicht verbunden'}</span>
          </div>

          {!connected && (
            <Button variant="secondary" icon={ExternalLink} onClick={() => connectInternalKi(aiBridge, endpoint)}>
              Interne KI verbinden
            </Button>
          )}
          <Button
            variant="ghost"
            icon={Settings}
            onClick={() => { navigate('einstellungen'); setOpen(false); }}
          >
            Zu den Einstellungen
          </Button>

          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] leading-snug">
            Die Verbindung läuft über einen parallelen KI-Tab. Nach dem Öffnen dort
            einmalig das Lesezeichen anklicken — der Status wird dann automatisch grün.
          </p>
        </div>
      </Dialog>
    </>
  );
}

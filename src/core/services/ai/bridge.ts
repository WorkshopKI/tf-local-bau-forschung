import type { AITransport } from './transports/streamlit';
import { StreamlitBridgeTransport } from './transports/streamlit';
import { DirectLLMTransport } from './transports/direct-llm';
import type { AIProviderConfig } from '@/core/types/config';
import { isOpenRouterEnabled } from '@/config/feature-flags';

export class AIBridge {
  private transports = new Map<string, AITransport>();
  private activeType = 'streamlit';

  constructor() {
    this.transports.set('streamlit', new StreamlitBridgeTransport());
  }

  switchProvider(config: AIProviderConfig): void {
    // Build-Time-Gate: OpenRouter in Builds ohne Cloud-Freigabe nie aktivieren.
    if (config.type === 'openrouter' && !isOpenRouterEnabled()) {
      console.warn('[AIBridge] OpenRouter in dieser Build-Variante deaktiviert — Provider-Wechsel wird ignoriert.');
      return;
    }
    // Weicher Heuristik-Check: Endpoint riecht nach OpenRouter, Type ist aber nicht 'openrouter'
    // (alter Storage-Eintrag). Behandeln wie oben.
    if (config.type !== 'streamlit' && typeof config.endpoint === 'string'
        && config.endpoint.includes('openrouter') && !isOpenRouterEnabled()) {
      console.warn('[AIBridge] Endpoint zeigt auf OpenRouter, OpenRouter aber deaktiviert — ignoriert.');
      return;
    }
    this.activeType = config.type;
    if (config.type === 'streamlit') {
      // Update-or-create: vorhandenen Transport per updateUrl() wiederverwenden
      // (sonst greift die geänderte URL aus den Einstellungen nie — der
      // Konstruktor legt immer schon einen mit Default-URL an —, und ein
      // Neu-Anlegen würde den globalen `message`-Listener leaken).
      const existing = this.transports.get('streamlit');
      if (existing instanceof StreamlitBridgeTransport) {
        existing.updateUrl(config.endpoint);
      } else {
        this.transports.set('streamlit', new StreamlitBridgeTransport(config.endpoint));
      }
    } else {
      this.transports.set(config.type, new DirectLLMTransport(
        config.endpoint,
        config.model,
        config.apiKey || undefined,
      ));
    }
  }

  getActiveTransport(): AITransport {
    const transport = this.transports.get(this.activeType);
    if (!transport) throw new Error(`No transport for ${this.activeType}`);
    return transport;
  }

  /** Endnutzer-tauglicher Anzeige-Name des aktiven Providers (Tooltips,
   *  Status-Dialoge). Nutzt `displayName`, fällt auf den Logik-`name` zurück. */
  getActiveProviderName(): string {
    const t = this.getActiveTransport();
    return t.displayName ?? t.name;
  }
}

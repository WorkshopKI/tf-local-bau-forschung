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

  /** Den PERSISTENTEN Streamlit-Transport holen (nicht den aktiven) — für den
   *  Verbindungstest + „Interne KI öffnen". Wichtig: nur diese eine Instanz lebt
   *  seit App-Start und hat über ihren `message`-Listener das Fenster-Handle aus
   *  dem `tf-bridge-ready`-Announce des Bookmarklets übernommen. Ein frisch
   *  angelegter Transport hätte das Handle NICHT → würde per `window.open` den
   *  KI-Tab neu laden und das Bookmarklet löschen. `url` synchronisiert die
   *  Origin-Prüfung; ändert activeType NICHT. */
  getStreamlitTransport(url?: string): StreamlitBridgeTransport {
    const existing = this.transports.get('streamlit');
    if (existing instanceof StreamlitBridgeTransport) {
      if (url) existing.updateUrl(url);
      return existing;
    }
    const created = new StreamlitBridgeTransport(url);
    this.transports.set('streamlit', created);
    return created;
  }

  /** Endnutzer-tauglicher Anzeige-Name des aktiven Providers (Tooltips,
   *  Status-Dialoge). Nutzt `displayName`, fällt auf den Logik-`name` zurück. */
  getActiveProviderName(): string {
    const t = this.getActiveTransport();
    return t.displayName ?? t.name;
  }
}

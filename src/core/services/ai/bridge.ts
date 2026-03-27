import type { AITransport } from './transports/streamlit';
import { StreamlitBridgeTransport } from './transports/streamlit';
import { DirectLLMTransport } from './transports/direct-llm';
import type { AIProviderConfig } from '@/core/types/config';

export class AIBridge {
  private transports = new Map<string, AITransport>();
  private activeType = 'streamlit';

  constructor() {
    this.transports.set('streamlit', new StreamlitBridgeTransport());
  }

  switchProvider(config: AIProviderConfig): void {
    this.activeType = config.type;
    if (config.type === 'streamlit') {
      if (!this.transports.has('streamlit')) {
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

  getActiveProviderName(): string {
    return this.getActiveTransport().name;
  }
}

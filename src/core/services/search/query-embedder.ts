import { embeddingService } from './embedding-service';
import type { EmbeddingModelConfig } from './model-registry';

export class QueryEmbedder {
  private modelConfig: EmbeddingModelConfig | null = null;

  async init(modelConfig: EmbeddingModelConfig, preferGPU = false): Promise<void> {
    this.modelConfig = modelConfig;
    await embeddingService.init(modelConfig, preferGPU);
  }

  isReady(): boolean {
    return embeddingService.isReady();
  }

  isLoading(): boolean {
    return embeddingService.isLoading();
  }

  async embed(query: string): Promise<number[]> {
    if (!this.modelConfig) throw new Error('Not initialized');
    return embeddingService.embedSingle(query, this.modelConfig, 'query');
  }

  destroy(): void {
    // Singleton wird nicht zerstoert — andere Consumer koennten ihn noch nutzen
  }
}

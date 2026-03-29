import { embeddingService } from './embedding-service';

export class QueryEmbedder {
  async init(preferGPU = false): Promise<void> {
    await embeddingService.init(preferGPU);
  }

  isReady(): boolean {
    return embeddingService.isReady();
  }

  isLoading(): boolean {
    return embeddingService.isLoading();
  }

  async embed(query: string): Promise<number[]> {
    return embeddingService.embedSingle(query);
  }

  destroy(): void {
    // Singleton wird nicht zerstoert — andere Consumer koennten ihn noch nutzen
  }
}

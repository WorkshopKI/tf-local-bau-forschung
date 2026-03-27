import EmbeddingWorker from '../../../workers/embedding.worker?worker&inline';

export class QueryEmbedder {
  private worker: Worker | null = null;
  private ready = false;
  private loading = false;

  async init(): Promise<void> {
    if (this.ready || this.loading) return;
    this.loading = true;

    this.worker = new EmbeddingWorker();

    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('Worker not created')); return; }
      this.worker.onmessage = (e: MessageEvent) => {
        const data = e.data as Record<string, unknown>;
        if (data.type === 'ready') {
          this.ready = true;
          this.loading = false;
          resolve();
        } else if (data.type === 'error') {
          this.loading = false;
          reject(new Error(data.error as string));
        }
      };
      this.worker.postMessage({ type: 'init', device: 'wasm' });
    });
  }

  async embed(text: string): Promise<number[]> {
    if (!this.worker || !this.ready) throw new Error('QueryEmbedder not ready');
    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('No worker')); return; }
      this.worker.onmessage = (e: MessageEvent) => {
        const data = e.data as Record<string, unknown>;
        if (data.type === 'embedding') resolve(data.vector as number[]);
        else if (data.type === 'error') reject(new Error(data.error as string));
      };
      this.worker.postMessage({ type: 'embed-single', text });
    });
  }

  isReady(): boolean { return this.ready; }
  isLoading(): boolean { return this.loading; }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}

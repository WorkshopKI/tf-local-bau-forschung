import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

let extractor: FeatureExtractionPipeline | null = null;

self.onmessage = async (e: MessageEvent) => {
  const data = e.data as Record<string, unknown>;

  if (data.type === 'init') {
    try {
      const device = (data.device as string) ?? 'wasm';
      extractor = await (pipeline as Function)(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          device: device as 'wasm' | 'webgpu',
          progress_callback: (progress: Record<string, unknown>) => {
            self.postMessage({
              type: 'progress',
              status: progress.status,
              loaded: progress.loaded,
              total: progress.total,
            });
          },
        },
      ) as FeatureExtractionPipeline;
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
    return;
  }

  if (!extractor) {
    self.postMessage({ type: 'error', error: 'Model not initialized. Call init first.' });
    return;
  }

  if (data.type === 'embed-batch') {
    try {
      const texts = data.texts as string[];
      const vectors: number[][] = [];
      for (const text of texts) {
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        vectors.push(Array.from(output.data as Float32Array));
      }
      self.postMessage({ type: 'embeddings', vectors });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
    return;
  }

  if (data.type === 'embed-single') {
    try {
      const text = data.text as string;
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      self.postMessage({ type: 'embedding', vector: Array.from(output.data as Float32Array) });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
  }
};

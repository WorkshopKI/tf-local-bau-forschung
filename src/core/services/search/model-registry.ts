export interface EmbeddingModelConfig {
  id: string;
  name: string;
  label: string;
  dimensions: number;
  mrlDimensions?: number;
  sizeLabel: string;
  downloadSize: string;
  strategy: 'pipeline' | 'automodel';
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4';
  pooling: 'mean' | 'cls' | 'last-token';
  normalize: boolean;
  queryPrefix: string;
  documentPrefix: string;
  description: string;
  matryoshka?: number[];
  useMRL?: boolean;
}

export const EMBEDDING_MODELS: EmbeddingModelConfig[] = [
  {
    id: 'minilm-l6-v2',
    name: 'Xenova/all-MiniLM-L6-v2',
    label: 'MiniLM L6 v2 (fp32)',
    dimensions: 384,
    sizeLabel: '22M',
    downloadSize: '~80 MB',
    strategy: 'pipeline',
    pooling: 'mean',
    normalize: true,
    queryPrefix: '',
    documentPrefix: '',
    description: 'Schnell, englisch-optimiert. Gute Baseline.',
  },
  {
    id: 'embeddinggemma-300m',
    name: 'onnx-community/embeddinggemma-300m-ONNX',
    label: 'EmbeddingGemma 300M (q8)',
    dimensions: 768,
    sizeLabel: '308M',
    downloadSize: '~200 MB (q8)',
    strategy: 'automodel',
    dtype: 'q8',
    pooling: 'mean',
    normalize: true,
    // Original (englisch): queryPrefix: 'task: search result | query: ',
    queryPrefix: 'task: Suchergebnis aus deutschen Verwaltungsdokumenten | query: ',
    documentPrefix: 'title: none | text: ',
    description: 'Google, multilingual, 100+ Sprachen. Beste Balance aus Qualitaet und Geschwindigkeit.',
    matryoshka: [768, 512, 384, 256, 128],
  },
  {
    id: 'harrier-270m',
    name: 'onnx-community/harrier-oss-v1-270m-ONNX',
    label: 'Harrier 270M (fp16)',
    dimensions: 640,
    sizeLabel: '270M',
    downloadSize: '~135 MB (fp16)',
    strategy: 'automodel',
    dtype: 'fp16',
    pooling: 'last-token',
    normalize: true,
    // Original (englisch): 'Instruct: Given a search query, retrieve relevant passages that answer the query\nQuery: '
    queryPrefix: 'Instruct: Finde relevante Textabschnitte aus deutschen Verwaltungsdokumenten die zur Suchanfrage passen\nQuery: ',
    documentPrefix: '',
    description: 'Microsoft, MTEB-SOTA, multilingual, decoder-only. Schnell wie EmbeddingGemma.',
  },
  {
    id: 'harrier-0.6b',
    name: 'onnx-community/harrier-oss-v1-0.6b-ONNX',
    label: 'Harrier 0.6B (q8)',
    dimensions: 1024,
    sizeLabel: '600M',
    downloadSize: '~1 GB (q8)',
    strategy: 'automodel',
    dtype: 'q8',
    pooling: 'last-token',
    normalize: true,
    // Original (englisch): 'Instruct: Given a search query, retrieve relevant passages that answer the query\nQuery: '
    queryPrefix: 'Instruct: Finde relevante Textabschnitte aus deutschen Verwaltungsdokumenten die zur Suchanfrage passen\nQuery: ',
    documentPrefix: '',
    description: 'Microsoft, MTEB-SOTA, multilingual, 1024d. Langsamer, beste Qualitaet. GPU empfohlen.',
  },
];

export const DEFAULT_MODEL_ID = 'embeddinggemma-300m';

const IDB_MODEL_KEY = 'embedding-model-id';

export function getModelById(id: string): EmbeddingModelConfig {
  return EMBEDDING_MODELS.find(m => m.id === id) ?? EMBEDDING_MODELS[0]!;
}

export async function getActiveModelId(
  idb: { get: <T>(key: string) => Promise<T | null> },
): Promise<string> {
  const stored = await idb.get<string>(IDB_MODEL_KEY);
  if (stored && EMBEDDING_MODELS.some(m => m.id === stored)) return stored;
  return DEFAULT_MODEL_ID;
}

export async function setActiveModelId(
  idb: { set: (key: string, value: unknown) => Promise<void> },
  modelId: string,
): Promise<void> {
  await idb.set(IDB_MODEL_KEY, modelId);
}

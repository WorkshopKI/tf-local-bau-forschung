export interface EmbeddingModelConfig {
  id: string;
  name: string;
  label: string;
  dimensions: number;
  sizeLabel: string;
  downloadSize: string;
  strategy: 'pipeline' | 'automodel';
  dtype?: 'fp32' | 'q8' | 'q4';
  pooling: 'mean' | 'cls';
  normalize: boolean;
  queryPrefix: string;
  documentPrefix: string;
  description: string;
  matryoshka?: number[];
}

export const EMBEDDING_MODELS: EmbeddingModelConfig[] = [
  {
    id: 'minilm-l6-v2',
    name: 'Xenova/all-MiniLM-L6-v2',
    label: 'MiniLM L6 v2',
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
    id: 'multilingual-e5-small',
    name: 'Xenova/multilingual-e5-small',
    label: 'Multilingual E5 Small',
    dimensions: 384,
    sizeLabel: '118M',
    downloadSize: '~118 MB (int8)',
    strategy: 'pipeline',
    dtype: 'q8',
    pooling: 'mean',
    normalize: true,
    queryPrefix: 'query: ',
    documentPrefix: 'passage: ',
    description: 'Microsoft, 100 Sprachen inkl. Deutsch. Gleiche Dimensionen wie MiniLM.',
  },
  {
    id: 'embeddinggemma-300m',
    name: 'onnx-community/embeddinggemma-300m-ONNX',
    label: 'EmbeddingGemma 300M',
    dimensions: 768,
    sizeLabel: '308M',
    downloadSize: '~200 MB (q8)',
    strategy: 'automodel',
    dtype: 'q8',
    pooling: 'mean',
    normalize: true,
    queryPrefix: 'task: search result | query: ',
    documentPrefix: 'title: none | text: ',
    description: 'Google, multilingual, 100+ Sprachen. Beste Qualitaet.',
    matryoshka: [768, 512, 384, 256, 128],
  },
];

export const DEFAULT_MODEL_ID = 'minilm-l6-v2';

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

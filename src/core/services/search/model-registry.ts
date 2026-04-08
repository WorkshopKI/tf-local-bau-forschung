export interface EmbeddingModelConfig {
  id: string;
  name: string;
  label: string;
  dimensions: number;
  mrlDimensions?: number;
  sizeLabel: string;
  downloadSize: string;
  strategy: 'pipeline' | 'automodel';
  dtype?: 'fp32' | 'q8' | 'q4';
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
  {
    id: 'qwen3-embed-0.6b',
    name: 'onnx-community/Qwen3-Embedding-0.6B-ONNX',
    label: 'Qwen3 Embedding 0.6B',
    sizeLabel: '600M',
    dimensions: 1024,
    mrlDimensions: 512,
    downloadSize: '~560 MB (q8)',
    description: 'Qwen3 Embedding, multilingual, 100+ Sprachen, MTEB Top-Scorer. Unterstuetzt MRL (Matryoshka) fuer variable Dimensionen.',
    queryPrefix: 'Instruct: Given a search query, retrieve relevant document passages\nQuery: ',
    documentPrefix: 'Instruct: Retrieve relevant passages from German administrative documents\nQuery: ',
    dtype: 'q8',
    strategy: 'automodel',
    pooling: 'mean',
    normalize: true,
    useMRL: true,
  },
  {
    id: 'harrier-270m',
    name: 'onnx-community/harrier-oss-v1-270m-ONNX',
    label: 'Harrier 270M',
    dimensions: 640,
    sizeLabel: '270M',
    downloadSize: '~270 MB (fp32)',
    strategy: 'automodel',
    dtype: 'fp32',
    pooling: 'last-token',
    normalize: true,
    queryPrefix: 'Instruct: Given a search query, retrieve relevant passages that answer the query\nQuery: ',
    documentPrefix: '',
    description: 'Microsoft, MTEB-SOTA, multilingual, decoder-only. Schnell wie EmbeddingGemma.',
  },
  // Deaktiviert: Crash mit v3.8.1, braucht Transformers.js v4. Nach Upgrade reaktivieren.
  // {
  //   id: 'harrier-0.6b',
  //   name: 'onnx-community/harrier-oss-v1-0.6b-ONNX',
  //   label: 'Harrier 0.6B',
  //   dimensions: 1024,
  //   sizeLabel: '600M',
  //   downloadSize: '~500 MB (q4)',
  //   strategy: 'automodel',
  //   dtype: 'q4',
  //   pooling: 'last-token',
  //   normalize: true,
  //   queryPrefix: 'Instruct: Given a search query, retrieve relevant passages that answer the query\nQuery: ',
  //   documentPrefix: '',
  //   description: 'Microsoft, MTEB-SOTA, multilingual, 1024d. Langsamer, beste Qualitaet.',
  // },
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

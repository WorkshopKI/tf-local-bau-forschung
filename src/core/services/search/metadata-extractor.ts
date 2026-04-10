/**
 * Extrahiert Metadaten aus Dokumenten via OpenRouter API.
 * Nutzt die bestehende DirectLLMTransport-Infrastruktur.
 * Cache in IDB vermeidet wiederholte API-Calls.
 */

import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import type { AIProviderConfig } from '@/core/types/config';
import { initLocalBackend, extractLocal, disposeLocalBackend, isLocalReady, smartTrim } from './local-llm-backend';

export interface DocumentMetadata {
  doc_type: string;
  title: string;
  date: string | null;
  organizations: string[];
  topic_tags: string[];
  micro_summary: string;
  macro_summary: string;
  language: string;
  _isFallback?: boolean;
}

const FALLBACK_METADATA = (filename: string, text: string): DocumentMetadata => ({
  doc_type: 'Sonstiges',
  title: filename.replace(/\.\w+$/, '').replace(/[_-]/g, ' '),
  date: extractDateFromText(text),
  organizations: [],
  topic_tags: [],
  micro_summary: text.slice(0, 200),
  macro_summary: text.slice(0, 500),
  language: 'de',
  _isFallback: true,
});

/* ── Model Registry ── */

export interface MetadataModelConfig {
  id: string;
  type: 'local' | 'api';
  openRouterId: string;
  label: string;
  size: string;
  description: string;
  requiresReasoning: boolean;
  localVram: string | null;
  hfRepo?: string;
  dtype?: Record<string, string>;
}

export const METADATA_LLM_MODELS: MetadataModelConfig[] = [
  {
    id: 'gemma4-e4b-local', type: 'local', openRouterId: '',
    label: 'Lokal · Gemma 4 E4B (~4 GB)', size: '~2 GB Download',
    description: 'Google Gemma 4, 4B aktiv. Laeuft im Browser via WebGPU/CPU.',
    requiresReasoning: false, localVram: '~4 GB VRAM',
    hfRepo: 'onnx-community/gemma-4-E4B-it-ONNX',
    dtype: { embed_tokens: 'q4f16', decoder_model_merged: 'q4f16' },
  },
  {
    id: 'gemma4-e2b-local', type: 'local', openRouterId: '',
    label: 'Lokal · Gemma 4 E2B (~2 GB)', size: '~1 GB Download',
    description: 'Google Gemma 4, 2B aktiv. Kleiner, weniger Speicher.',
    requiresReasoning: false, localVram: '~2 GB VRAM',
    hfRepo: 'onnx-community/gemma-4-E2B-it-ONNX',
    dtype: { embed_tokens: 'q4f16', decoder_model_merged: 'q4f16' },
  },
  {
    id: 'gpt-oss-120b', type: 'api', openRouterId: 'openai/gpt-oss-120b',
    label: 'OpenRouter · gpt-oss-120b (Referenz)', size: '$0.04/$0.19 per M',
    description: '117B MoE. Beste Qualitaet, nicht lokal laufbar.',
    requiresReasoning: true, localVram: null,
  },
  {
    id: 'qwen35-9b', type: 'api', openRouterId: 'qwen/qwen3.5-9b',
    label: 'OpenRouter · Qwen 3.5 9B', size: '$0.05/$0.15 per M',
    description: 'Alibaba, 9B. Sehr gut fuer Deutsch + JSON.',
    requiresReasoning: false, localVram: '~6 GB (q4)',
  },
  {
    id: 'gemma4-26b', type: 'api', openRouterId: 'google/gemma-4-26b-a4b-it:free',
    label: 'OpenRouter · Gemma 4 26B (Gratis)', size: 'Kostenlos',
    description: 'Google, 26B MoE (4B aktiv). Multilingual, gratis.',
    requiresReasoning: false, localVram: null,
  },
  {
    id: 'gemma4-31b', type: 'api', openRouterId: 'google/gemma-4-31b-it:free',
    label: 'OpenRouter · Gemma 4 31B (Gratis)', size: 'Kostenlos',
    description: 'Google, 31B. Groesseres Modell, ebenfalls gratis.',
    requiresReasoning: false, localVram: null,
  },
  {
    id: 'liquid-24b', type: 'api', openRouterId: 'liquid/lfm-2-24b-a2b',
    label: 'OpenRouter · Liquid LFM 24B', size: '$0.03/$0.12 per M',
    description: 'Liquid AI, 24B MoE (2B aktiv). Schnell und guenstig.',
    requiresReasoning: false, localVram: null,
  },
  {
    id: 'nemotron-120b', type: 'api', openRouterId: 'nvidia/nemotron-3-super-120b-a12b:free',
    label: 'OpenRouter · Nemotron 120B (Gratis)', size: 'Kostenlos',
    description: 'NVIDIA, 120B MoE (12B aktiv). Leistungsstark, gratis.',
    requiresReasoning: false, localVram: null,
  },
  {
    id: 'none', type: 'api', openRouterId: '',
    label: 'Kein LLM (regelbasiert)', size: '0',
    description: 'Metadata aus Dateiname + Text, ohne LLM.',
    requiresReasoning: false, localVram: null,
  },
];

/* ── LLM State ── */

interface LLMState {
  transport: DirectLLMTransport | null;
  ready: boolean;
  modelId: string | null;
  backend: 'api' | 'local' | null;
}

const llmState: LLMState = { transport: null, ready: false, modelId: null, backend: null };

/* ── Storage Interface ── */

export interface MetadataStorage {
  idb: {
    get: <T>(key: string) => Promise<T | null>;
    set: (key: string, value: unknown) => Promise<void>;
    keys: (prefix: string) => Promise<string[]>;
    delete: (key: string) => Promise<void>;
  };
}

/* ── Metadata Cache ── */

interface CachedMetadata {
  metadata: DocumentMetadata;
  docHash: string;
  modelId: string;
  timestamp: string;
}

export async function getCachedMetadata(
  storage: MetadataStorage, docId: string, docHash: string, modelId: string,
): Promise<DocumentMetadata | null> {
  const cached = await storage.idb.get<CachedMetadata>(`metadata-cache:${docId}`);
  if (cached && cached.docHash === docHash && cached.modelId === modelId) {
    return cached.metadata;
  }
  return null;
}

export async function setCachedMetadata(
  storage: MetadataStorage, docId: string, docHash: string, modelId: string, metadata: DocumentMetadata,
): Promise<void> {
  await storage.idb.set(`metadata-cache:${docId}`, {
    metadata, docHash, modelId, timestamp: new Date().toISOString(),
  } satisfies CachedMetadata);
}

export async function clearMetadataCache(storage: MetadataStorage): Promise<number> {
  const keys = await storage.idb.keys('metadata-cache:');
  for (const key of keys) await storage.idb.delete(key);
  return keys.length;
}

/* ── Init / Extract / Dispose ── */

export async function initMetadataLLM(
  modelId: string,
  onProgress?: (msg: string) => void,
  storage?: MetadataStorage,
  options?: { preferGPU?: boolean },
): Promise<boolean> {
  if (modelId === 'none') return true;
  if (llmState.ready && llmState.modelId === modelId) return true;

  const modelCfg = METADATA_LLM_MODELS.find(m => m.id === modelId);
  if (!modelCfg) return false;

  // Lokales Backend
  if (modelCfg.type === 'local') {
    if (!modelCfg.hfRepo || !modelCfg.dtype) return false;
    const ok = await initLocalBackend(modelCfg.hfRepo, modelCfg.dtype, options?.preferGPU ?? true, onProgress);
    if (ok) { llmState.ready = true; llmState.modelId = modelId; llmState.backend = 'local'; }
    return ok;
  }

  // API Backend
  if (!modelCfg.openRouterId) return false;
  onProgress?.('API-Verbindung pruefen...');
  try {
    if (!storage) { console.error('[MetadataLLM] Storage nicht verfuegbar'); return false; }
    const aiConfig = await storage.idb.get<AIProviderConfig>('ai-provider');
    if (!aiConfig?.apiKey) {
      onProgress?.('Kein API Key — Einstellungen > KI-Assistent'); return false;
    }
    const endpoint = aiConfig.endpoint || 'https://openrouter.ai/api/v1';
    llmState.transport = new DirectLLMTransport(endpoint, modelCfg.openRouterId, aiConfig.apiKey);
    const ok = await llmState.transport.ping();
    if (!ok) { onProgress?.('API nicht erreichbar'); return false; }
    llmState.ready = true;
    llmState.modelId = modelId;
    llmState.backend = 'api';
    console.log(`[MetadataLLM] ✅ API verbunden: ${modelCfg.openRouterId}`);
    onProgress?.('API verbunden');
    return true;
  } catch (err) {
    console.error('[MetadataLLM] Init failed:', err);
    onProgress?.(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function extractMetadata(filename: string, text: string, contextTokens = 4096): Promise<DocumentMetadata> {
  if (!llmState.ready || llmState.modelId === 'none') {
    return FALLBACK_METADATA(filename, text);
  }
  const systemPrompt = METADATA_SYSTEM_PROMPT;
  const trimmedText = smartTrim(text, contextTokens);
  const userPrompt = buildExtractionPrompt(trimmedText);
  try {
    if (llmState.backend === 'local' && isLocalReady()) {
      const response = await extractLocal(systemPrompt, userPrompt);
      return parseMetadataJSON(response, filename, text);
    }
    if (!llmState.transport) return FALLBACK_METADATA(filename, text);
    const modelCfg = METADATA_LLM_MODELS.find(m => m.id === llmState.modelId);
    const options = modelCfg?.requiresReasoning ? { thinkingBudget: 'low' as const } : undefined;
    const response = await llmState.transport.submitMessage(userPrompt, systemPrompt, options);
    return parseMetadataJSON(response, filename, text);
  } catch (err) {
    console.error('[MetadataLLM] Extract failed:', err);
    return FALLBACK_METADATA(filename, text);
  }
}

export function disposeMetadataLLM(): void {
  const modelName = llmState.modelId ?? 'keins';
  const backend = llmState.backend ?? 'keins';
  if (llmState.backend === 'local') disposeLocalBackend();
  llmState.transport = null;
  llmState.ready = false;
  llmState.modelId = null;
  llmState.backend = null;
  console.log(`[MetadataLLM] ❌ Entladen: ${modelName} (${backend})`);
}

/* ── Prompt + Parser ── */

export const METADATA_SYSTEM_PROMPT = 'Du bist ein Metadaten-Extraktor fuer deutsche Verwaltungsdokumente. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, keine Erklaerung, keine Backticks, kein Denkprozess.';

export function buildExtractionPrompt(text: string): string {
  return `Extrahiere Metadaten aus diesem deutschen Verwaltungsdokument.

REGELN:
- Antworte NUR mit einem JSON-Objekt
- micro_summary: EIN eigener Satz der den Inhalt beschreibt. NICHT den Text kopieren!
- macro_summary: 3-5 eigene Saetze. NICHT den Text kopieren!
- topic_tags: IMMER 3-5 deutsche Schlagwoerter
- doc_type: Waehle den passendsten Typ
- organizations: Alle genannten Behoerden, Firmen, Institute

JSON-Format:
{
  "doc_type": "Bauantrag|Foerderantrag|Gutachten|Stellungnahme|Protokoll|Nachforderung|Formular|Statik|Brandschutzkonzept|Schallschutznachweis|Energienachweis|Zwischenbericht|Review|Ethikantrag|Datenschutz|Compliance|Sonstiges",
  "title": "Kurzer beschreibender Titel",
  "date": "YYYY-MM-DD oder null",
  "organizations": ["Org1", "Org2"],
  "topic_tags": ["Tag1", "Tag2", "Tag3"],
  "micro_summary": "Ein Satz der den Dokumentinhalt beschreibt.",
  "macro_summary": "Drei bis fuenf Saetze die den Inhalt zusammenfassen.",
  "language": "de"
}

DOKUMENT:
${text}`;
}

function parseMetadataJSON(output: string, filename: string, text: string): DocumentMetadata {
  try {
    const trimmed = output.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const json = trimmed.slice(start, end + 1);
      const parsed = JSON.parse(json);
      return {
        doc_type: parsed.doc_type ?? 'Sonstiges',
        title: parsed.title ?? filename,
        date: parsed.date ?? null,
        organizations: Array.isArray(parsed.organizations) ? parsed.organizations : [],
        topic_tags: Array.isArray(parsed.topic_tags) ? parsed.topic_tags.slice(0, 5) : [],
        micro_summary: parsed.micro_summary ?? text.slice(0, 200),
        macro_summary: parsed.macro_summary ?? text.slice(0, 500),
        language: parsed.language ?? 'de',
      };
    }
  } catch { /* Parsing fehlgeschlagen */ }
  return FALLBACK_METADATA(filename, text);
}

function extractDateFromText(text: string): string | null {
  const deMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (deMatch) return `${deMatch[3]}-${deMatch[2]!.padStart(2, '0')}-${deMatch[1]!.padStart(2, '0')}`;
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0]!;
  return null;
}

/**
 * Extrahiert Metadaten aus Dokumenten via OpenRouter API.
 * Nutzt die bestehende DirectLLMTransport-Infrastruktur.
 * Cache in IDB vermeidet wiederholte API-Calls.
 */

import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import type { AIProviderConfig } from '@/core/types/config';

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
  openRouterId: string;
  label: string;
  size: string;
  description: string;
  requiresReasoning: boolean;
  localVram: string | null;
}

export const METADATA_LLM_MODELS: MetadataModelConfig[] = [
  {
    id: 'gpt-oss-120b', openRouterId: 'openai/gpt-oss-120b',
    label: 'gpt-oss-120b (Referenz)', size: '$0.04/$0.19 per M',
    description: '117B MoE. Beste Qualitaet, nicht lokal laufbar.',
    requiresReasoning: true, localVram: null,
  },
  {
    id: 'smollm3-3b', openRouterId: 'huggingfacetb/smollm3-3b',
    label: 'SmolLM3 3B', size: '~$0.01/$0.03 per M',
    description: 'HuggingFace, 3B. Deutsch nativ, Structured Output.',
    requiresReasoning: false, localVram: '~2 GB (q4)',
  },
  {
    id: 'qwen3-4b', openRouterId: 'qwen/qwen3-4b',
    label: 'Qwen 3 4B', size: '~$0.01/$0.04 per M',
    description: 'Alibaba, 4B dense. Sehr gut fuer Deutsch + JSON.',
    requiresReasoning: false, localVram: '~3 GB (q4)',
  },
  {
    id: 'phi-4-mini', openRouterId: 'microsoft/phi-4-mini-instruct',
    label: 'Phi-4 Mini (3.8B)', size: '~$0.02/$0.04 per M',
    description: 'Microsoft, 3.8B. Kompakt, gute JSON-Faehigkeit.',
    requiresReasoning: false, localVram: '~3 GB (q4)',
  },
  {
    id: 'gemma-3-4b', openRouterId: 'google/gemma-3-4b-it',
    label: 'Gemma 3 4B', size: 'Kostenlos oder guenstig',
    description: 'Google, 4B. Multilingual, gut fuer Deutsch.',
    requiresReasoning: false, localVram: '~3 GB (q4)',
  },
  {
    id: 'llama-33-8b', openRouterId: 'meta-llama/llama-3.3-8b-instruct',
    label: 'Llama 3.3 8B', size: 'Kostenlos (:free)',
    description: 'Meta, 8B. Deutsch supported. Gratis auf OpenRouter.',
    requiresReasoning: false, localVram: '~6 GB (q4)',
  },
  {
    id: 'none', openRouterId: '',
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
}

const llmState: LLMState = { transport: null, ready: false, modelId: null };

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
): Promise<boolean> {
  if (modelId === 'none') return true;
  if (llmState.ready && llmState.modelId === modelId) return true;

  const modelCfg = METADATA_LLM_MODELS.find(m => m.id === modelId);
  if (!modelCfg || !modelCfg.openRouterId) return false;

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
    onProgress?.('API verbunden');
    return true;
  } catch (err) {
    console.error('[MetadataLLM] Init failed:', err);
    onProgress?.(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function extractMetadata(filename: string, text: string): Promise<DocumentMetadata> {
  if (!llmState.ready || !llmState.transport || llmState.modelId === 'none') {
    return FALLBACK_METADATA(filename, text);
  }
  const systemPrompt = 'Du bist ein Metadaten-Extraktor fuer deutsche Verwaltungsdokumente. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, keine Erklaerung, keine Backticks, kein Denkprozess.';
  const userPrompt = buildExtractionPrompt(text.slice(0, 3000));
  try {
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
  llmState.transport = null;
  llmState.ready = false;
  llmState.modelId = null;
}

/* ── Prompt + Parser (unchanged) ── */

function buildExtractionPrompt(text: string): string {
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

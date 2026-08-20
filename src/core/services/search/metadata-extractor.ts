/**
 * Extrahiert Metadaten aus Dokumenten via OpenRouter API.
 * Nutzt die bestehende DirectLLMTransport-Infrastruktur.
 * Cache in IDB vermeidet wiederholte API-Calls.
 */

import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import { classifyProvider } from '@/core/services/ai/transport-policy';
import { isMetadatenDirektApiEnabled, isOpenRouterEnabled } from '@/config/feature-flags';
import type { AIProviderConfig } from '@/core/types/config';
import { METADATA_SYSTEM_PROMPT, METADATA_RESPONSE_FORMAT, buildExtractionPrompt } from './metadata-prompts';
import { browserLLM, checkWebGPU } from './browser-llm';

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
  maxParallelism: number;
  needsApiKey: boolean;
  backend?: 'api' | 'browser';
}

export const METADATA_LLM_MODELS: MetadataModelConfig[] = [
  {
    id: 'llamacpp-local', openRouterId: 'local-model',
    label: 'Lokale KI (lokaler Server)', size: 'Lokal',
    description: 'Dokumentenindex-aktualisieren.bat starten. Modell wird in dokumentenindex-dateien/config.json definiert.',
    requiresReasoning: false, maxParallelism: 4, needsApiKey: false,
  },
  {
    id: 'llamacpp-lan', openRouterId: 'local-model',
    label: 'LAN KI (lokaler Server)', size: 'LAN',
    description: 'llama.cpp Server im lokalen Netzwerk (IP:Port konfigurierbar).',
    requiresReasoning: false, maxParallelism: 4, needsApiKey: false,
  },
  {
    id: 'intern-gpt-oss', openRouterId: 'openai/gpt-oss-120b',
    label: 'Interne KI-API (gpt-oss-120B)', size: 'Intern',
    description: 'Interner API-Server. Kein API-Key noetig.',
    requiresReasoning: true, maxParallelism: 3, needsApiKey: false,
  },
  {
    id: 'openrouter-gpt-oss', openRouterId: 'openai/gpt-oss-120b',
    label: 'OpenRouter API (gpt-oss-120B)', size: '$0.04/$0.19 per M',
    description: 'OpenRouter Cloud. API-Key erforderlich.',
    requiresReasoning: true, maxParallelism: 5, needsApiKey: true,
  },
  {
    id: 'browser-nemotron', openRouterId: '',
    label: 'Browser-KI (Nemotron 4B, WebGPU)', size: '~2.5 GB',
    description: 'Laeuft direkt im Browser via WebGPU. Kein Server noetig.',
    requiresReasoning: false, maxParallelism: 1, needsApiKey: false,
    backend: 'browser',
  },
  {
    id: 'none', openRouterId: '',
    label: 'Kein LLM (regelbasiert)', size: '0',
    description: 'Metadata aus Dateiname + Text, ohne LLM.',
    requiresReasoning: false, maxParallelism: 1, needsApiKey: false,
  },
];

/**
 * Die Modelle, die DIESE Variante anbietet.
 *
 * Zwei Einträge bauen ihren Transport aus dem `ai-provider`-Eintrag statt aus
 * einer eigenen Adresse: „Interne KI-API" und „OpenRouter API". Den Eintrag setzt
 * nur die dev-Provider-Klappe (`isDevContext()`-gated) — in pl steht dort die
 * Streamlit-Adresse, gegen die ein OpenAI-kompatibler Ping scheitert. Ohne
 * `metadatenDirektApi` sind beide also eine Wahl ohne Wirkung und bleiben weg.
 * OpenRouter hängt zusätzlich an `ki.openrouter.enabled` — ein Eintrag für einen
 * in dieser Variante abgeschalteten Transport gehört nicht ins Menü (analog
 * `ProviderKlappe`); für Metadaten-Läufe blockt ihn ohnehin die
 * DSGVO-Transport-Policy weiter unten.
 *
 * Flags als Default-Parameter, damit der Test sie ohne Modul-Mock setzen kann.
 */
export function verfuegbareMetadataModelle(
  direktApi: boolean = isMetadatenDirektApiEnabled(),
  openRouter: boolean = isOpenRouterEnabled(),
): MetadataModelConfig[] {
  return METADATA_LLM_MODELS.filter(m => {
    if (m.id === 'intern-gpt-oss') return direktApi;
    if (m.id === 'openrouter-gpt-oss') return direktApi && openRouter;
    return true;
  });
}

/**
 * Eine gespeicherte Auswahl, die diese Variante nicht (mehr) anbietet, zählt als
 * `'none'` (regelbasiert, kein Netzwerk-Aufruf).
 *
 * Ohne diese Normalisierung zeigte das Auswahlfeld still **Option 0** („Lokale
 * KI"), während der Indexlauf weiter die alte Adresse ansprach — Anzeige und
 * Wirkung fielen auseinander. Der Rückfallwert wird ZURÜCKGEGEBEN, nie abgelegt;
 * gespeichert wird er erst mit der nächsten Nutzer-Änderung.
 */
export function normalisiereMetadataLLMId(
  id: string | null | undefined,
  verfuegbar: MetadataModelConfig[] = verfuegbareMetadataModelle(),
): string {
  if (!id) return 'none';
  return verfuegbar.some(m => m.id === id) ? id : 'none';
}

/* ── LLM State ── */

interface LLMState {
  transport: DirectLLMTransport | null;
  ready: boolean;
  modelId: string | null;
  backend: 'api' | 'browser' | null;
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
): Promise<boolean> {
  if (modelId === 'none') return true;
  if (llmState.ready && llmState.modelId === modelId) return true;

  const modelCfg = METADATA_LLM_MODELS.find(m => m.id === modelId);

  // Browser backend (Nemotron via WebGPU)
  if (modelCfg?.backend === 'browser') {
    onProgress?.('WebGPU pruefen...');
    const gpuOk = await checkWebGPU();
    if (!gpuOk) { onProgress?.('WebGPU nicht verfuegbar'); return false; }
    onProgress?.('Nemotron 4B laden (WebGPU)...');
    const ok = await browserLLM.init(
      'onnx-community/NVIDIA-Nemotron-3-Nano-4B-BF16-ONNX', onProgress,
    );
    if (!ok) { onProgress?.('Browser-LLM konnte nicht geladen werden'); return false; }
    llmState.ready = true; llmState.modelId = modelId; llmState.backend = 'browser';
    onProgress?.('Browser-LLM bereit'); return true;
  }

  if (!modelCfg || !modelCfg.openRouterId) return false;
  onProgress?.('API-Verbindung pruefen...');
  try {
    if (!storage) { console.error('[MetadataLLM] Storage nicht verfuegbar'); return false; }

    let endpoint: string;
    let apiKey = '';

    if (modelId === 'llamacpp-local') {
      const pipelineCfg = await storage.idb.get<{ localPort?: number }>('pipeline-config');
      const port = Number.isInteger(pipelineCfg?.localPort) && pipelineCfg!.localPort! > 0
        ? pipelineCfg!.localPort
        : 9090;
      endpoint = `http://localhost:${port}/v1`;
    } else if (modelId === 'llamacpp-lan') {
      const pipelineCfg = await storage.idb.get<{ lanEndpoint?: string }>('pipeline-config');
      endpoint = pipelineCfg?.lanEndpoint ?? '';
      if (!endpoint) { onProgress?.('LAN-Adresse nicht konfiguriert — Verwaltung > Metadaten-Extraktion'); return false; }
    } else {
      const aiConfig = await storage.idb.get<AIProviderConfig>('ai-provider');
      endpoint = aiConfig?.endpoint || 'https://openrouter.ai/api/v1';
      apiKey = aiConfig?.apiKey ?? '';
    }

    const isLocal = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
    if (modelCfg.needsApiKey && !apiKey) {
      onProgress?.('Kein API Key — Einstellungen > KI-Assistent'); return false;
    }
    // DSGVO-Transport-Policy (sekundär): die Metadaten-Extraktion sendet
    // Dokumentinhalt ans Modell — nur über einen internen Transport zulässig.
    // Klassifiziert der Endpoint extern (OpenRouter)? → nicht initialisieren,
    // extractMetadata fällt auf FALLBACK_METADATA zurück. Prod unverändert
    // (OpenRouter via isOpenRouterEnabled() ohnehin aus → nie extern). Siehe
    // src/core/services/ai/transport-policy.ts.
    if (classifyProvider({ type: modelId, endpoint }) === 'extern') {
      console.warn('[MetadataLLM] Externer Transport (OpenRouter) für Dokument-Metadaten blockiert (DSGVO-Transport-Policy) — interne KI nutzen.');
      onProgress?.('Externer Transport (OpenRouter) für Metadaten gesperrt — interne KI nutzen');
      return false;
    }
    llmState.transport = new DirectLLMTransport(endpoint, modelCfg.openRouterId, apiKey);
    const ok = await llmState.transport.ping(); // allow-oeffnender-ping: DirectLLM (HTTP-Fetch) — kein Fenster
    if (!ok) {
      if (modelId === 'llamacpp-lan') {
        onProgress?.(`LAN-Server nicht erreichbar: ${endpoint}`);
      } else {
        onProgress?.(isLocal
          ? 'KI-Analyse nicht verfuegbar — Dokumentenindex-aktualisieren.bat starten'
          : 'API nicht erreichbar');
      }
      return false;
    }
    llmState.ready = true;
    llmState.modelId = modelId;
    llmState.backend = 'api';
    onProgress?.('API verbunden');
    return true;
  } catch (err) {
    console.error('[MetadataLLM] Init failed:', err);
    onProgress?.(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function extractMetadata(filename: string, text: string, contextTokens = 4096, signal?: AbortSignal): Promise<DocumentMetadata> {
  if (!llmState.ready || llmState.modelId === 'none' || signal?.aborted) {
    return FALLBACK_METADATA(filename, text);
  }
  const systemPrompt = METADATA_SYSTEM_PROMPT;
  const SYSTEM_OVERHEAD = 500;  // System-Prompt + Prompt-Template + JSON-Schema
  const RESPONSE_RESERVE = 1000; // max_new_tokens fuer JSON-Antwort
  const SAFETY_MARGIN = 200;
  const effectiveTokens = Math.max(512, contextTokens - SYSTEM_OVERHEAD - RESPONSE_RESERVE - SAFETY_MARGIN);
  const trimmedText = smartTrim(text, effectiveTokens);
  const userPrompt = buildExtractionPrompt(trimmedText);

  // Browser backend (Nemotron via WebGPU)
  if (llmState.backend === 'browser') {
    try {
      const response = await browserLLM.generate(systemPrompt, userPrompt, { maxNewTokens: 1500 });
      return parseMetadataJSON(response, filename, text);
    } catch (err) {
      console.error('[MetadataLLM] Browser extract failed:', err);
      return FALLBACK_METADATA(filename, text);
    }
  }

  try {
    if (!llmState.transport) return FALLBACK_METADATA(filename, text);
    // Thinking immer aus — Metadaten-Extraktion braucht kein Reasoning, das macht den
    // Pipeline-Schritt nur unnoetig langsam. requiresReasoning aus der Model-Registry
    // bleibt als reines Anzeige-Flag, hat hier aber keine Wirkung mehr.
    const options: { thinkingBudget?: 'none' | 'low' | 'medium' | 'high'; responseFormat?: Record<string, unknown> } = {
      thinkingBudget: 'none',
      responseFormat: METADATA_RESPONSE_FORMAT,
    };
    const response = await llmState.transport.submitMessage(userPrompt, systemPrompt, options);
    return parseMetadataJSON(response, filename, text);
  } catch (err) {
    console.error('[MetadataLLM] Extract failed:', err);
    return FALLBACK_METADATA(filename, text);
  }
}

export function disposeMetadataLLM(): void {
  if (llmState.backend === 'browser') browserLLM.dispose();
  llmState.transport = null;
  llmState.ready = false;
  llmState.modelId = null;
  llmState.backend = null;
}

export async function probeActiveLocalModel(
  modelId: 'llamacpp-local' | 'llamacpp-lan',
  storage: MetadataStorage,
): Promise<string | null> {
  try {
    let endpoint: string;
    if (modelId === 'llamacpp-local') {
      const pipelineCfg = await storage.idb.get<{ localPort?: number }>('pipeline-config');
      const port = Number.isInteger(pipelineCfg?.localPort) && pipelineCfg!.localPort! > 0
        ? pipelineCfg!.localPort
        : 9090;
      endpoint = `http://localhost:${port}/v1`;
    } else {
      const pipelineCfg = await storage.idb.get<{ lanEndpoint?: string }>('pipeline-config');
      endpoint = pipelineCfg?.lanEndpoint ?? '';
      if (!endpoint) return null;
    }
    const transport = new DirectLLMTransport(endpoint, 'local-model', '');
    return await transport.getActiveModel();
  } catch {
    return null;
  }
}

/* ── Re-exports fuer Abwaertskompatibilitaet ── */
export { METADATA_SYSTEM_PROMPT, METADATA_RESPONSE_FORMAT, buildExtractionPrompt } from './metadata-prompts';

function sanitizeDate(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s === 'N/A' || s === 'null') return null;

  // Bereits korrekt: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    if (y! >= 1900 && y! <= 2100 && m! >= 1 && m! <= 12 && d! >= 1 && d! <= 31) return s;
    return null;
  }
  // Deutsches Format: DD.MM.YYYY
  const deDe = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deDe) {
    const [, dd, mm, yyyy] = deDe.map(Number);
    if (yyyy! >= 1900 && yyyy! <= 2100 && mm! >= 1 && mm! <= 12 && dd! >= 1 && dd! <= 31)
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  // YYYY-MM (ohne Tag)
  const ym = s.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    const [, yy, mm] = ym.map(Number);
    if (yy! >= 1900 && yy! <= 2100 && mm! >= 1 && mm! <= 12) return `${yy}-${String(mm).padStart(2, '0')}-01`;
  }
  // Nur Jahr
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly && Number(yearOnly[1]) >= 1900 && Number(yearOnly[1]) <= 2100) {
    return `${yearOnly[1]}-01-01`;
  }
  return null;
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
        date: sanitizeDate(parsed.date),
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

function smartTrim(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * 3.5); // Deutsch ≈ 3.5 Zeichen/Token
  if (text.length <= maxChars) return text;
  const startBudget = Math.floor(maxChars * 0.55);
  const endBudget = Math.floor(maxChars * 0.25);
  const separator = '\n\n[...gekuerzt...]\n';
  const start = text.slice(0, startBudget);
  const end = text.slice(-endBudget);
  const headings = text.match(/^#{1,3}\s+.+$/gm) ?? [];
  const headingBudget = maxChars - startBudget - endBudget - separator.length;
  const headingsText = headingBudget > 0 ? headings.join('\n').slice(0, headingBudget) : '';
  let result = headingsText
    ? `${start}\n\n[...Abschnitts-Uebersicht...]\n${headingsText}${separator}${end}`
    : `${start}${separator}${end}`;
  // Harte Obergrenze: niemals mehr als maxChars
  if (result.length > maxChars) result = result.slice(0, maxChars);
  return result;
}

function extractDateFromText(text: string): string | null {
  const deMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (deMatch) return `${deMatch[3]}-${deMatch[2]!.padStart(2, '0')}-${deMatch[1]!.padStart(2, '0')}`;
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0]!;
  return null;
}

/**
 * Extrahiert Metadaten aus Dokumenten via OpenRouter API (gpt-oss120B).
 * Nutzt die bestehende DirectLLMTransport-Infrastruktur.
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

interface LLMState {
  transport: DirectLLMTransport | null;
  ready: boolean;
  modelId: string | null;
}

const llmState: LLMState = {
  transport: null, ready: false, modelId: null,
};

export const METADATA_LLM_MODELS = [
  {
    id: 'openrouter',
    name: 'openai/gpt-oss-120b',
    label: 'OpenRouter (gpt-oss-120b)',
    size: 'API',
    description: 'Schnell, zuverlaessig, ~0.10$ fuer 90 Dokumente. Erfordert API Key in Einstellungen.',
  },
  {
    id: 'none',
    name: '',
    label: 'Kein LLM (regelbasiert)',
    size: '0 MB',
    description: 'Metadata wird aus Dateiname und Text extrahiert, ohne LLM.',
  },
];

export interface MetadataStorage {
  idb: { get: <T>(key: string) => Promise<T | null> };
}

export async function initMetadataLLM(
  modelId: string,
  onProgress?: (msg: string) => void,
  storage?: MetadataStorage,
): Promise<boolean> {
  if (modelId === 'none') return true;
  if (llmState.ready && llmState.modelId === modelId) return true;

  onProgress?.('API-Verbindung pruefen...');

  try {
    if (!storage) {
      console.error('[MetadataLLM] Storage nicht verfuegbar');
      return false;
    }
    const aiConfig = await storage.idb.get<AIProviderConfig>('ai-provider');
    if (!aiConfig?.apiKey) {
      onProgress?.('Kein API Key — bitte unter Einstellungen > KI-Assistent konfigurieren');
      return false;
    }

    const endpoint = aiConfig.endpoint || 'https://openrouter.ai/api/v1';
    const model = aiConfig.model || 'openai/gpt-oss-120b';

    llmState.transport = new DirectLLMTransport(endpoint, model, aiConfig.apiKey);

    const ok = await llmState.transport.ping();
    if (!ok) {
      onProgress?.('API nicht erreichbar — Endpoint oder Key pruefen');
      return false;
    }

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

export async function extractMetadata(
  filename: string,
  text: string,
): Promise<DocumentMetadata> {
  if (!llmState.ready || !llmState.transport || llmState.modelId === 'none') {
    return FALLBACK_METADATA(filename, text);
  }

  const systemPrompt = 'Du bist ein Metadaten-Extraktor fuer deutsche Verwaltungsdokumente. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, keine Erklaerung, keine Backticks, kein Denkprozess.';
  const userPrompt = buildExtractionPrompt(text.slice(0, 3000));

  try {
    const response = await llmState.transport.submitMessage(userPrompt, systemPrompt, { thinkingBudget: 'low' });
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

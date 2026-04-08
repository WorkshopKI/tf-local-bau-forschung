/**
 * Extrahiert Metadaten aus Dokumenten via Browser-LLM (Gemma 4 E2B oder Qwen3.5-2B).
 * Nur auf Admin-Laptop mit GPU genutzt. Komplett optional.
 */

export interface DocumentMetadata {
  doc_type: string;
  title: string;
  date: string | null;
  organizations: string[];
  topic_tags: string[];
  micro_summary: string;
  macro_summary: string;
  language: string;
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
});

interface LLMState {
  model: any | null;
  tokenizer: any | null;
  ready: boolean;
  loading: boolean;
  modelId: string | null;
}

const llmState: LLMState = {
  model: null, tokenizer: null, ready: false, loading: false, modelId: null,
};

export const METADATA_LLM_MODELS = [
  {
    id: 'gemma4-e2b',
    name: 'onnx-community/gemma-4-E2B-it-ONNX',
    label: 'Gemma 4 E2B',
    size: '~1.5 GB (q8)',
    description: 'Google Gemma 4, multimodal, effizient. Empfohlen fuer schnelle Extraktion.',
  },
  {
    id: 'gemma4-e4b',
    name: 'onnx-community/gemma-4-E4B-it-ONNX',
    label: 'Gemma 4 E4B',
    size: '~3 GB (q8)',
    description: 'Google Gemma 4, groesseres Modell, bessere Qualitaet. Braucht ~4 GB VRAM.',
  },
  {
    id: 'qwen3-4b',
    name: 'onnx-community/Qwen3-4B-ONNX',
    label: 'Qwen 3 4B',
    size: '~3.5 GB (q8)',
    description: 'Qwen 3, stark bei Deutsch + JSON-Extraktion. NICHT Qwen3.5-4B (3x langsamer auf WebGPU wegen unoptimierter Hybrid-Attention).',
  },
  {
    id: 'qwen35-2b',
    name: 'onnx-community/Qwen3.5-2B-ONNX',
    label: 'Qwen 3.5 2B',
    size: '~2.2 GB (q8)',
    description: 'Qwen 3.5, kompakt, gute JSON-Extraktion. 2B-Variante hat keine Performance-Probleme.',
  },
  {
    id: 'none',
    name: '',
    label: 'Kein LLM (regelbasiert)',
    size: '0 MB',
    description: 'Metadata wird aus Dateiname und Text extrahiert, ohne LLM.',
  },
];

export async function initMetadataLLM(
  modelId: string,
  onProgress?: (msg: string) => void,
): Promise<boolean> {
  if (modelId === 'none') return true;
  if (llmState.ready && llmState.modelId === modelId) return true;

  llmState.loading = true;
  onProgress?.('LLM laden...');

  try {
    const model = METADATA_LLM_MODELS.find(m => m.id === modelId);
    if (!model || !model.name) return false;

    const { AutoTokenizer, AutoModelForCausalLM } = await import('@huggingface/transformers');

    llmState.tokenizer = await AutoTokenizer.from_pretrained(model.name);
    llmState.model = await AutoModelForCausalLM.from_pretrained(model.name, {
      dtype: 'q8',
      device: 'webgpu',
    });
    llmState.modelId = modelId;
    llmState.ready = true;
    llmState.loading = false;
    onProgress?.('LLM bereit');
    return true;
  } catch (err) {
    llmState.loading = false;
    console.error('LLM init failed:', err);
    return false;
  }
}

export async function extractMetadata(
  filename: string,
  text: string,
): Promise<DocumentMetadata> {
  if (!llmState.ready || llmState.modelId === 'none') {
    return FALLBACK_METADATA(filename, text);
  }

  const prompt = buildExtractionPrompt(text.slice(0, 3000));

  try {
    const inputs = await llmState.tokenizer(prompt, {
      return_tensors: 'pt',
      padding: true,
      truncation: true,
      max_length: 4096,
    });

    const output = await llmState.model.generate({
      ...inputs,
      max_new_tokens: 400,
      temperature: 0.1,
      do_sample: true,
      top_p: 0.9,
    });

    const decoded = llmState.tokenizer.decode(output[0], { skip_special_tokens: true });
    return parseMetadataJSON(decoded, filename, text);
  } catch {
    return FALLBACK_METADATA(filename, text);
  }
}

export function disposeMetadataLLM(): void {
  if (llmState.model?.dispose) llmState.model.dispose();
  llmState.model = null;
  llmState.tokenizer = null;
  llmState.ready = false;
  llmState.modelId = null;
}

function buildExtractionPrompt(text: string): string {
  return `Du extrahierst Metadaten aus Dokumenten. Antworte AUSSCHLIESSLICH mit validem JSON.
Kein Markdown, keine Erklaerung, keine Backticks. Nur das JSON-Objekt.

Analysiere den folgenden Dokumentanfang und extrahiere:
{
  "doc_type": "Foerderantrag|Gutachten|Stellungnahme|Protokoll|Nachforderung|Sonstiges",
  "title": "Kurztitel",
  "date": "YYYY-MM-DD oder null",
  "organizations": ["Liste beteiligter Organisationen"],
  "topic_tags": ["maximal 5 Schlagwoerter"],
  "micro_summary": "Ein Satz",
  "macro_summary": "3-5 Saetze Zusammenfassung",
  "language": "de|en"
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

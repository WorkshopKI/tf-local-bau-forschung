/**
 * Extrahiert Metadaten aus Dokumenten via Browser-LLM (Qwen 3).
 * Nutzt pipeline("text-generation") fuer automatisches Chat-Template-Handling.
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
  generator: any | null;
  ready: boolean;
  loading: boolean;
  modelId: string | null;
}

const llmState: LLMState = {
  generator: null, ready: false, loading: false, modelId: null,
};

export const METADATA_LLM_MODELS = [
  {
    id: 'qwen3-0.6b',
    name: 'onnx-community/Qwen3-0.6B-ONNX',
    label: 'Qwen 3 0.6B',
    size: '~400 MB (q4f16)',
    dtype: 'q4f16' as const,
    description: 'Schnell, kompakt, getestet im Browser. Empfohlen.',
  },
  {
    id: 'qwen3-4b',
    name: 'onnx-community/Qwen3-4B-ONNX',
    label: 'Qwen 3 4B',
    size: '~2.5 GB (q4f16)',
    dtype: 'q4f16' as const,
    description: 'Bessere Qualitaet, braucht ~4 GB VRAM. Fuer Qualitaetstests.',
  },
  {
    id: 'none',
    name: '',
    label: 'Kein LLM (regelbasiert)',
    size: '0 MB',
    dtype: 'q4f16' as const,
    description: 'Metadata wird aus Dateiname und Text extrahiert, ohne LLM.',
  },
];

export async function initMetadataLLM(
  modelId: string,
  onProgress?: (msg: string) => void,
): Promise<boolean> {
  if (modelId === 'none') return true;
  if (llmState.ready && llmState.modelId === modelId) return true;
  if (llmState.loading) return false;

  llmState.loading = true;
  onProgress?.('LLM laden...');

  try {
    const modelCfg = METADATA_LLM_MODELS.find(m => m.id === modelId);
    if (!modelCfg || !modelCfg.name) { llmState.loading = false; return false; }

    const { pipeline } = await import('@huggingface/transformers');

    onProgress?.(`${modelCfg.label} wird geladen...`);
    llmState.generator = await pipeline(
      'text-generation',
      modelCfg.name,
      {
        dtype: modelCfg.dtype,
        device: 'webgpu',
        progress_callback: (info: any) => {
          if (info.status === 'progress' && info.total) {
            const pct = Math.round((info.loaded / info.total) * 100);
            onProgress?.(`Download: ${pct}%`);
          }
        },
      },
    );

    llmState.modelId = modelId;
    llmState.ready = true;
    llmState.loading = false;
    onProgress?.('LLM bereit');
    return true;
  } catch (err) {
    llmState.loading = false;
    llmState.generator = null;
    console.error('[MetadataLLM] Init failed:', err);
    onProgress?.(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function extractMetadata(
  filename: string,
  text: string,
): Promise<DocumentMetadata> {
  if (!llmState.ready || !llmState.generator || llmState.modelId === 'none') {
    return FALLBACK_METADATA(filename, text);
  }

  const userPrompt = buildExtractionPrompt(text.slice(0, 3000));

  try {
    const messages = [
      {
        role: 'system',
        content: 'Du bist ein Metadaten-Extraktor fuer deutsche Verwaltungsdokumente. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, keine Erklaerung, keine Backticks, kein Denkprozess.',
      },
      { role: 'user', content: userPrompt },
    ];

    const output = await llmState.generator(messages, {
      max_new_tokens: 512,
      do_sample: false,
      return_full_text: false,
    });

    const assistantMsg = output[0]?.generated_text?.at(-1)?.content
      ?? output[0]?.generated_text ?? '';

    const decoded = typeof assistantMsg === 'string'
      ? assistantMsg
      : JSON.stringify(assistantMsg);

    return parseMetadataJSON(decoded, filename, text);
  } catch (err) {
    console.error('[MetadataLLM] Extract failed:', err);
    return FALLBACK_METADATA(filename, text);
  }
}

export function disposeMetadataLLM(): void {
  if (llmState.generator?.dispose) {
    try { llmState.generator.dispose(); } catch { /* ignore */ }
  }
  llmState.generator = null;
  llmState.ready = false;
  llmState.loading = false;
  llmState.modelId = null;
}

function buildExtractionPrompt(text: string): string {
  return `Extrahiere Metadaten aus diesem deutschen Verwaltungsdokument.

REGELN:
- Antworte NUR mit einem JSON-Objekt, nichts anderes
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

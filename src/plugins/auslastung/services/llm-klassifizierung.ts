/**
 * LLM-Batch-Klassifizierung — Workflow-Revision 1.17.
 *
 * Neue Antraege haben oft nur VB-/TV-Titel (keine Deskriptoren, keine
 * Antragsteller-Zusammenfassung). Stage-1-Regel matcht dann nichts, Stage-2-
 * Embedding ist statistisch — bei Grenzfaellen und generischen Titeln versteht
 * ein LLM den Kontext besser.
 *
 * Dieser Service buendelt 10–15 Antraege pro Request an den **aktiv
 * konfigurierten AIBridge-Transport** (DirectLLM oder Streamlit), parst die
 * JSON-Antwort und liefert pro Antrag {primaer, aspekte[], begruendung}.
 *
 * Hierarchie (Workflow-Revision 1.17):
 *  Prio 1: LLM-Klassifizierung (wenn vorhanden)        → Confidence high
 *  Prio 2: Embedding-Centroid (Stage 2 in Engine)      → Confidence nach Score
 *  Prio 3: Manuelle Zuordnung durch PL                  → ueberschreibt alles
 *
 * Bei Konflikt LLM ↔ Embedding (verschiedene Primaere): Confidence wird auf
 * 'medium' herabgestuft + Begruendung enthaelt Plausibilitaets-Warnung.
 *
 * Fallback "Copy/Paste via Streamlit": exportiert `buildPromptForClipboard()`
 * und `parseClipboardResponse()`, das die UI an `navigator.clipboard.writeText`
 * bzw. einen Textarea-Paste-Dialog koppelt.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import type { UeberKategorie } from '../types';

// ─── Public Types ────────────────────────────────────────────────────────

export interface LLMAntrag {
  /** Aktenzeichen / Antrag-ID. */
  id: string;
  /** Verbund-Titel (oder leer). */
  vbTitel: string;
  /** Teilvorhaben-Titel. */
  tvTitel: string;
  /** Optional: Antragsteller-Name (zur Kontextualisierung). */
  antragsteller?: string;
}

export interface LLMKlassifizierungInput {
  antraege: LLMAntrag[];
  kategorien: UeberKategorie[];
  bridge: AIBridge;
  /** Default 12. Kleinere Batches: stabiler, mehr Roundtrips. */
  batchSize?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface LLMKlassifizierungEintrag {
  primaer: string;
  aspekte: string[];
  begruendung: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface LLMKlassifizierungResult {
  byAntragId: Map<string, LLMKlassifizierungEintrag>;
  errors: Array<{ batchIndex: number; message: string }>;
}

// ─── Prompt-Konstruktion ──────────────────────────────────────────────────

const SYSTEM_PROMPT_DE = (
  'Du bist ein Experte fuer Foerderprogramm-Klassifizierung. ' +
  'Antworte AUSSCHLIESSLICH mit einem JSON-Array. ' +
  'Kein Markdown, keine Erklaerung davor oder danach, kein Denkprozess.'
);

/**
 * Baut den User-Prompt aus Kategorien + Antraege-Liste. Konsistent fuer
 * Bridge-Mode und Clipboard-Fallback.
 */
export function buildPromptText(antraege: LLMAntrag[], kategorien: UeberKategorie[]): string {
  const katBlock = kategorien.map(k => `- ${k.id}: ${k.name}`).join('\n');
  const antraegeJson = JSON.stringify(
    antraege.map(a => ({
      id: a.id,
      vbTitel: a.vbTitel,
      tvTitel: a.tvTitel,
      ...(a.antragsteller ? { antragsteller: a.antragsteller } : {}),
    })),
    null,
    2,
  );
  return [
    'Ordne jeden Antrag einer Primaerkategorie zu und identifiziere optionale',
    'Aspekte (Querschnittstechnologien die als Werkzeug oder Methode genutzt',
    'werden, NICHT das Kernthema sind).',
    '',
    'Kategorien:',
    katBlock,
    '',
    'Beispiel: "KI-gestuetzte Schadenserkennung in Bruckenstrukturen"',
    `→ primaer: ${kategorien[0]?.id ?? 'IT'} (Strukturueberwachung ist Ingenieurtechnik)`,
    `→ aspekte: [${kategorien[1]?.id ?? 'DT'}] (KI ist das Werkzeug, nicht das Thema)`,
    '',
    'Antworte NUR als JSON-Array dieser Form, KEINE Erklaerung davor oder danach:',
    `[{"id":"AZ-1","primaer":"${kategorien[0]?.id ?? 'IT'}","aspekte":["${kategorien[1]?.id ?? 'DT'}"],"begruendung":"kurzer Satz"}]`,
    '',
    'Antraege:',
    antraegeJson,
  ].join('\n');
}

/** JSON-Schema fuer DirectLLM-`response_format`. Enum-Werte = Kategorie-IDs. */
export function buildResponseFormat(kategorien: UeberKategorie[]): Record<string, unknown> {
  const ids = kategorien.map(k => k.id);
  return {
    type: 'json_schema',
    json_schema: {
      name: 'antrag_klassifizierung',
      strict: true,
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'primaer', 'aspekte', 'begruendung'],
          properties: {
            id: { type: 'string' },
            primaer: { type: 'string', enum: ids },
            aspekte: { type: 'array', items: { type: 'string', enum: ids } },
            begruendung: { type: 'string', maxLength: 240 },
          },
        },
      },
    },
  };
}

// ─── JSON-Parsing (robust) ────────────────────────────────────────────────

interface RawLLMItem {
  id?: unknown;
  primaer?: unknown;
  /** Pruefen wir auch unter Umlautschluessel (manche Modelle setzen
   *  "primär" trotz Schema). */
  ['primär']?: unknown;
  aspekte?: unknown;
  begruendung?: unknown;
  ['begründung']?: unknown;
}

/**
 * Parser-Funktion: nimmt die LLM-Antwort als String und liefert ein Array
 * von Objekten. Robust gegen:
 *  - Markdown-Wrapping (```json ... ```)
 *  - Leading/Trailing-Whitespace + Erklaerungs-Text
 *  - Umlaut-Schluessel ("primär" statt "primaer")
 *
 * Wirft bei nicht parsebaren Antworten.
 */
export function parseLLMResponse(raw: string): Array<{ id: string; primaer: string; aspekte: string[]; begruendung: string }> {
  const stripped = stripMarkdownWrapper(raw).trim();
  // Erste eckige Klammer suchen — verhindert dass Erklaerungs-Text davor
  // den Parser blockiert.
  const start = stripped.indexOf('[');
  const end = stripped.lastIndexOf(']');
  if (start < 0 || end < start) {
    throw new Error('Keine JSON-Array-Klammer im LLM-Output gefunden.');
  }
  const slice = stripped.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch (err) {
    throw new Error(`JSON-Parse fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(parsed)) throw new Error('Erwartet JSON-Array, bekommen: ' + typeof parsed);

  const out: Array<{ id: string; primaer: string; aspekte: string[]; begruendung: string }> = [];
  for (const item of parsed as RawLLMItem[]) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id : '';
    const primaerRaw = item.primaer ?? item['primär'];
    const primaer = typeof primaerRaw === 'string' ? primaerRaw : '';
    const aspekte = Array.isArray(item.aspekte)
      ? item.aspekte.filter((a): a is string => typeof a === 'string')
      : [];
    const begRaw = item.begruendung ?? item['begründung'];
    const begruendung = typeof begRaw === 'string' ? begRaw : '';
    if (!id || !primaer) continue;
    out.push({ id, primaer, aspekte, begruendung });
  }
  return out;
}

function stripMarkdownWrapper(text: string): string {
  // Entfernt Patterns wie ```json ... ``` oder ``` ... ```
  const match = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/m.exec(text.trim());
  if (match && match[1]) return match[1];
  return text;
}

// ─── Bridge-Mode (DirectLLM / Streamlit) ─────────────────────────────────

/**
 * Klassifiziert eine Liste von Antraegen via AIBridge. Chunked in `batchSize`-
 * Paketen, mit Fehler-Tolerant (ein fehlgeschlagener Batch unterbricht nicht
 * den ganzen Lauf).
 */
export async function klassifiziereBatch(input: LLMKlassifizierungInput): Promise<LLMKlassifizierungResult> {
  const { antraege, kategorien, bridge, onProgress, signal } = input;
  const batchSize = Math.max(1, input.batchSize ?? 12);
  const out: LLMKlassifizierungResult = {
    byAntragId: new Map(),
    errors: [],
  };
  const transport = bridge.getActiveTransport();
  const responseFormat = buildResponseFormat(kategorien);
  const validKategorieIds = new Set(kategorien.map(k => k.id));
  let done = 0;
  const total = antraege.length;

  for (let i = 0; i < antraege.length; i += batchSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = antraege.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    const prompt = buildPromptText(batch, kategorien);

    try {
      const responseText = await transport.submitMessage(prompt, SYSTEM_PROMPT_DE, {
        responseFormat,
        signal,
      });
      const parsed = parseLLMResponse(responseText);
      for (const item of parsed) {
        if (!validKategorieIds.has(item.primaer)) {
          out.errors.push({
            batchIndex,
            message: `Antrag ${item.id}: unbekannte Primaer-Kategorie "${item.primaer}" — uebersprungen.`,
          });
          continue;
        }
        const aspekte = item.aspekte.filter(a => validKategorieIds.has(a));
        out.byAntragId.set(item.id, {
          primaer: item.primaer,
          aspekte,
          begruendung: item.begruendung,
          // Confidence: LLM-Ergebnis ist per Default 'high'; bei nachfolgender
          // Plausibilitaets-Pruefung gegen Embedding kann der Caller downgraden.
          confidence: 'high',
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      out.errors.push({
        batchIndex,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    done = Math.min(total, i + batchSize);
    onProgress?.(done, total);
  }

  return out;
}

// ─── Copy/Paste-Fallback (Clipboard) ─────────────────────────────────────

/**
 * Baut den Prompt-Text fuer den Clipboard-Workflow: User kopiert das in eine
 * Streamlit-/Chat-UI, kopiert die JSON-Antwort zurueck.
 */
export function buildPromptForClipboard(antraege: LLMAntrag[], kategorien: UeberKategorie[]): string {
  // Identisch zum bridge-Prompt — aber der User braucht das System-Prompt
  // explizit am Anfang (Streamlit/ChatGPT haben oft keinen separaten Slot).
  return SYSTEM_PROMPT_DE + '\n\n' + buildPromptText(antraege, kategorien);
}

/**
 * Parst die manuell zurueckgeworfene LLM-Antwort. Identisch zu
 * `parseLLMResponse`, aber als separater Export fuer den UI-Layer.
 */
export function parseClipboardResponse(raw: string): Array<{ id: string; primaer: string; aspekte: string[]; begruendung: string }> {
  return parseLLMResponse(raw);
}

/**
 * Stage 3 — Mini-Nemotron für ambige Fälle.
 *
 * Wenn Stage 0–2 keine eindeutige Klassifikation liefern, schicken wir die
 * ersten 500–1000 Tokens an den lokalen llama.cpp-Server (Nemotron 3 Nano 4B
 * Q4_K_M) und holen ein structured-output-JSON.
 *
 * Wir nutzen den bestehenden `AITransport`-Vertrag — der LLM-Endpoint wird
 * vom Caller injiziert (DirectLLMTransport in Produktion, Mock in Tests).
 */

import type { AITransport } from '../../core/services/ai/transports/streamlit';
import type { DocType, TriageResult } from '../types';

const SYSTEM_PROMPT =
  `Du klassifizierst behördliche Dokumente einer deutschen Forschungsförderung.
Deine Antwort ist ausschließlich gültiges JSON, kein Fließtext, kein Markdown.

Verfügbare doc_types:
- projektbeschreibung: Antragsunterlage mit Vorhaben-Kurzfassung
- antragsunterlagen: sonstige eingereichte Antragsunterlagen
- gutachten: fachliches Gutachten zum Vorhaben (i.d.R. PDF; DOCX = Arbeitsversion)
- gutachten_qs: Qualitätssicherung zum Antrag oder zur Betreuung
- verwendungsnachweis: vom Zuwendungsempfänger eingereicht (Sachbericht + Zahlen)
- verwendungsnachweispruefung: amtliche Prüfung des Verwendungsnachweises
- bescheid: Zuwendungs-/Schluss-/sonstige Bescheide
- aenderungsbescheid: Änderungsbescheid (Personalwechsel, Mittelumstellung)
- nachforderung: Aufforderung zur Ergänzung der Antragsunterlagen
- korrespondenz: Anschreiben/Mails zum Vorhaben
- checkliste: amtliche Checklisten
- de_minimis: De-minimis-Bescheinigungen / -Vermerke
- sonstiges: gehört zum Vorhaben, passt aber in keine der obigen Kategorien
- irrelevant: gehört gar nicht zum Vorhaben (Werbung, Privates, Systemdateien)

doc_type und relevance beschreiben ZWEI verschiedene Dinge — setze immer beide:
- doc_type sagt, WAS das Dokument ist. relevance sagt, ob es in die Pipeline gehört.
- doc_type "irrelevant" → relevance "irrelevant". Sonst immer relevance "relevant",
  auch bei doc_type "sonstiges".

Antwortschema:
{"doc_type": "<einer der obigen>", "relevance": "relevant" | "irrelevant", "confidence": 0.0..1.0, "reason": "<kurz>", "fkz": "<Format 16KN123456: 2 Ziffern, 2 Großbuchstaben, 6 Ziffern — oder null>", "akronym": "<mindestens 2 Zeichen — oder null>"}`;

export interface Stage3Input {
  filename: string;
  page1_text: string;
  /** Hint aus vorherigen Stages, wird in den Prompt eingebaut. */
  docTypeHint?: DocType;
  fkzHint?: string | null;
  akronymHint?: string | null;
  transport: AITransport;
}

export interface Stage3Output {
  result: TriageResult;
  /** Roher LLM-Output für Audit/Debug. */
  raw: string;
  /** True wenn Parsing/Validation gelungen ist. */
  parsed: boolean;
}

interface ParsedOutput {
  doc_type: DocType;
  relevance: 'relevant' | 'irrelevant';
  confidence: number;
  reason: string;
  fkz: string | null;
  akronym: string | null;
}

const VALID_DOC_TYPES: DocType[] = [
  'projektbeschreibung', 'antragsunterlagen', 'gutachten', 'gutachten_qs',
  'verwendungsnachweis', 'verwendungsnachweispruefung', 'bescheid',
  'aenderungsbescheid', 'nachforderung', 'korrespondenz', 'checkliste',
  'de_minimis', 'sonstiges', 'irrelevant',
];

function parseLlmOutput(raw: string): ParsedOutput | null {
  // LLMs umgeben JSON manchmal mit Code-Fences. Heraussuchen.
  const trimmed = raw.trim();
  let jsonStr = trimmed;
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence && fence[1]) jsonStr = fence[1].trim();
  // Sonst: nach erstem `{` und letztem `}` croppen
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  jsonStr = jsonStr.slice(start, end + 1);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
  const docType = obj.doc_type;
  if (typeof docType !== 'string' || !VALID_DOC_TYPES.includes(docType as DocType)) return null;
  const relevance = obj.relevance === 'irrelevant' ? 'irrelevant' : 'relevant';
  const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0.5;
  const reason = typeof obj.reason === 'string' ? obj.reason : '';
  const fkz = typeof obj.fkz === 'string' && /^\d{2}[A-Z]{2}\d{6}$/.test(obj.fkz) ? obj.fkz : null;
  const akronym = typeof obj.akronym === 'string' && obj.akronym.trim().length >= 2 ? obj.akronym.trim() : null;
  return { doc_type: docType as DocType, relevance, confidence, reason, fkz, akronym };
}

export async function runStage3(input: Stage3Input): Promise<Stage3Output> {
  const userPrompt = [
    `Dateiname: ${input.filename}`,
    input.docTypeHint ? `Hint aus früheren Stages: ${input.docTypeHint}` : null,
    input.fkzHint ? `Vor-extrahiertes FKZ: ${input.fkzHint}` : null,
    input.akronymHint ? `Vor-extrahiertes Akronym: ${input.akronymHint}` : null,
    '',
    'Erste Tokens des Dokuments:',
    '---',
    // Kürzung sichtbar machen: ohne Marker endet der Auszug stumm mitten im Satz und
    // das Modell muss raten, ob das Dokument dort aufhört (Prompt-Audit 2026-07).
    input.page1_text.length > 4000
      ? `${input.page1_text.slice(0, 4000)}\n[…Auszug hier gekürzt, das Dokument geht weiter]`
      : input.page1_text,
    '---',
    '',
    'Antworte mit dem JSON-Schema.',
  ].filter(Boolean).join('\n');

  let raw = '';
  try {
    raw = await input.transport.submitMessage(userPrompt, SYSTEM_PROMPT, {
      thinkingBudget: 'none',
      responseFormat: { type: 'json_object' },
    });
  } catch (e) {
    const fallback: TriageResult = {
      filename: input.filename,
      doc_type: input.docTypeHint ?? 'sonstiges',
      triage_state: 'review',
      triage_stage: 3,
      source: 'stage3',
      reason: `stage3_llm_error: ${(e as Error).message}`,
      page1_text: input.page1_text || undefined,
      extracted_fkz: input.fkzHint ?? null,
      extracted_akronym: input.akronymHint ?? null,
      creator_kuerzel: null,
      dms_bezeichnung: null,
      dms_aktenplan: null,
    };
    return { result: fallback, raw: '', parsed: false };
  }

  const parsed = parseLlmOutput(raw);
  if (!parsed) {
    const fallback: TriageResult = {
      filename: input.filename,
      doc_type: input.docTypeHint ?? 'sonstiges',
      triage_state: 'review',
      triage_stage: 3,
      source: 'stage3',
      reason: `stage3_unparseable_output: ${raw.slice(0, 100)}`,
      page1_text: input.page1_text || undefined,
      extracted_fkz: input.fkzHint ?? null,
      extracted_akronym: input.akronymHint ?? null,
      creator_kuerzel: null,
      dms_bezeichnung: null,
      dms_aktenplan: null,
    };
    return { result: fallback, raw, parsed: false };
  }

  const result: TriageResult = {
    filename: input.filename,
    doc_type: parsed.doc_type,
    triage_state: parsed.relevance,
    triage_stage: 3,
    source: 'stage3',
    reason: `stage3_llm: ${parsed.reason} (conf=${parsed.confidence.toFixed(2)})`,
    page1_text: input.page1_text || undefined,
    extracted_fkz: parsed.fkz ?? input.fkzHint ?? null,
    extracted_akronym: parsed.akronym ?? input.akronymHint ?? null,
    creator_kuerzel: null,
    dms_bezeichnung: null,
    dms_aktenplan: null,
  };
  return { result, raw, parsed: true };
}

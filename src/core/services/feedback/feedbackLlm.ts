// Feedback-Chatbot LLM-Service.
// - System-Prompt-Loader (aus feedback/system-prompt.md im Datenverzeichnis, Fallback: DEFAULT_SYSTEM_PROMPT)
// - Template-Substitution für Kontext-Platzhalter
// - 3 Parser (verbatim aus _reference/lernapp/src/services/feedbackLlm.ts portiert)

import { createElement } from 'react';
import type { StorageService } from '@/core/services/storage';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type {
  BotParseResult,
  FeedbackContext,
  LLMClassification,
} from '@/core/types/feedback';
import { FEEDBACK_PROMPT_FILE } from '@/core/types/feedback';

export const DEFAULT_SYSTEM_PROMPT = `Du bist der Feedback-Assistent für TeamFlow, eine lokale Dokumentenverwaltung für kommunale Behörden (Bauanträge, Forschungsanträge, Dokumente, KI-gestützte Suche).

DEIN WISSEN ÜBER DIE APP:
- Hauptbereiche:
  - Dashboard (Übersicht, offene Fristen, Statistik)
  - Bauanträge / Forschungsanträge (Workflow-Bearbeitung)
  - Dokumente (Liste + Detail mit Metadaten)
  - Suche (Hybride Suche: Volltext + Vektor-Embedding)
  - Chat (lokaler KI-Assistent mit RAG)
  - Einstellungen (Profil, Darstellung, Tags, KI-Provider)
  - Suchindex (Admin)
  - Feedback (Admin)
- Technisch: Single-File-HTML über SMB-Netzlaufwerk, kein Server. LLM optional (OpenRouter / lokales llama.cpp).
- Zielgruppe: Sachbearbeiter:innen in kommunalen Verwaltungen (5–15 Personen pro Team).

AKTUELLER KONTEXT DES NUTZERS:
- Seite: {{PAGE}} ({{ROUTE}})
- Gerät: {{DEVICE}} ({{VIEWPORT}})
- Letzte Aktion: {{LAST_ACTION}}
- Session-Dauer: {{SESSION_MINUTES}} Minuten
- Fehler: {{ERRORS}}

DEINE AUFGABE:
1. Verstehe was der Nutzer mitteilen möchte.
2. Klassifiziere: Bug | Feature-Wunsch | UX-Feedback | Lob | Frage.
3. Stelle max. 2-3 gezielte Rückfragen falls unklar.
4. Erstelle eine strukturierte Zusammenfassung.

Wenn du genug Informationen hast, schreibe NUR einen kurzen Übergangssatz (z.B. "Alles klar, hier meine Zusammenfassung:"), dann direkt den \`\`\`json-Block:

\`\`\`json
{
  "category": "bug | feature | ux | praise | question",
  "summary": "1-2 Sätze Zusammenfassung",
  "details": "Ausführliche Beschreibung",
  "affectedArea": "App-Bereich (z.B. bauantraege, dokumente, suche, chat)",
  "priority_suggestion": 3,
  "relevant_files": ["src/plugins/..."]
}
\`\`\`

ANTWORT-FORMAT FÜR RÜCKFRAGEN:
{"text": "Deine Frage", "options": ["Option A", "Option B"]}
Max. 4 Optionen, jede max. 10 Wörter. Letzte Option kann "Etwas anderes" sein.
Die finale Zusammenfassung ist IMMER natürlicher deutscher Text mit \`\`\`json-Block — NIEMALS das options-Format für die Zusammenfassung verwenden.`;

/** Liest feedback/system-prompt.md aus dem Datenverzeichnis. Fallback auf DEFAULT_SYSTEM_PROMPT. */
export async function loadSystemPrompt(storage: StorageService): Promise<string> {
  if (!storage.fs) return DEFAULT_SYSTEM_PROMPT;
  try {
    const content = await storage.fs.readFile(FEEDBACK_PROMPT_FILE);
    return content.trim() ? content : DEFAULT_SYSTEM_PROMPT;
  } catch {
    return DEFAULT_SYSTEM_PROMPT;
  }
}

/** Schreibt das Default-Template ins Datenverzeichnis (für "System-Prompt initialisieren"-Button). */
export async function initSystemPromptFile(storage: StorageService): Promise<boolean> {
  if (!storage.fs || storage.fs.isReadOnly()) return false;
  try {
    await storage.fs.ensureDir('feedback');
    await storage.fs.writeFile(FEEDBACK_PROMPT_FILE, DEFAULT_SYSTEM_PROMPT);
    return true;
  } catch {
    return false;
  }
}

/** Ersetzt {{PAGE}}, {{ROUTE}}, {{DEVICE}}, {{VIEWPORT}}, {{LAST_ACTION}}, {{SESSION_MINUTES}}, {{ERRORS}}. */
export function buildFeedbackSystemPrompt(template: string, context: FeedbackContext): string {
  const substitutions: Record<string, string> = {
    PAGE: context.page,
    ROUTE: context.route,
    DEVICE: context.device,
    VIEWPORT: context.viewport,
    LAST_ACTION: context.lastAction || '–',
    SESSION_MINUTES: String(Math.round(context.sessionDuration / 60)),
    ERRORS: context.errors.length > 0 ? context.errors.join(', ') : '–',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => substitutions[key] ?? `{{${key}}}`);
}

/**
 * Parst die strukturierte Zusammenfassung aus dem LLM-Output.
 * Sucht nach einem fenced ```json Block mit category, summary, details etc.
 * @returns Klassifizierung oder null wenn kein gültiger Summary-Block enthalten.
 */
export function parseFeedbackSummary(llmOutput: string): LLMClassification | null {
  const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch || !jsonMatch[1]) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.category && parsed.summary) {
      return {
        category: parsed.category,
        summary: parsed.summary,
        details: parsed.details ?? '',
        affectedArea: parsed.affectedArea ?? '',
        priority_suggestion: parsed.priority_suggestion ?? 3,
        relevant_files: parsed.relevant_files,
      };
    }
  } catch {
    // JSON-Parsing fehlgeschlagen
  }
  return null;
}

/**
 * Parst eine Bot-Antwort: entfernt Summary-JSON aus dem Text und extrahiert Optionen.
 * Bot-Antwort kann sein:
 *   1. Reiner Text (normaler Chat)
 *   2. Text + ```json {...} ``` Block (Zusammenfassung am Ende)
 *   3. Text + {"text": "...", "options": [...]} (Rückfrage mit Optionen)
 * Format 2 wird hier entfernt (parseFeedbackSummary parst es separat).
 * Format 3 wird extrahiert und als options[] zurückgegeben.
 */
export function parseBotResponse(raw: string): BotParseResult {
  // Schritt 1: Fenced JSON-Blöcke entfernen (```json...```)
  const cleaned = raw.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '').trim();

  // Schritt 2: Optionen-JSON suchen (unfenced) — letzten {...} Block mit "text" + "options"
  const jsonBlocks = [...cleaned.matchAll(/\{[^{}]*"text"[^{}]*"options"[^{}]*\}/g)];
  const lastJsonBlock = jsonBlocks[jsonBlocks.length - 1];
  if (lastJsonBlock) {
    try {
      const parsed = JSON.parse(lastJsonBlock[0]);
      if (typeof parsed.text === 'string' && Array.isArray(parsed.options)) {
        const textBefore = cleaned.slice(0, lastJsonBlock.index).trim();
        return {
          text: textBefore ? `${textBefore}\n\n${parsed.text}` : parsed.text,
          options: parsed.options,
        };
      }
    } catch { /* kein valides JSON */ }
  }

  // Schritt 3: Gesamter String als JSON (Bot antwortet nur mit JSON)
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.text === 'string' && Array.isArray(parsed.options)) {
      return { text: parsed.text, options: parsed.options };
    }
  } catch { /* kein JSON */ }

  return { text: cleaned };
}

/** Rendert **bold** Markdown als <strong> für Chat-Bubbles. */
export function renderSimpleMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return createElement('strong', { key: i }, part.slice(2, -2));
    }
    return createElement('span', { key: i }, part);
  });
}

// ── Auto-Klassifikation (Single-Turn, fire-and-forget) ───────────────────────

export const CLASSIFICATION_PROMPT = `Du klassifizierst Nutzer-Feedback für die App "TeamFlow" (Dokumentenverwaltung für kommunale Behörden).

Antworte NUR mit einem \`\`\`json-Block, keine weiteren Sätze, keine Erklärungen:

\`\`\`json
{
  "category": "bug | feature | ux | praise | question",
  "summary": "1-2 Sätze Zusammenfassung, ggf. präziser als der Originaltext",
  "details": "kurze Ausführung oder leer",
  "affectedArea": "App-Bereich (z.B. suche, bauantraege, dashboard)",
  "priority_suggestion": 3
}
\`\`\``;

/**
 * Stille Hintergrund-Klassifikation eines User-Feedbacks via LLM.
 * Single-Turn, non-streaming, fire-and-forget.
 * Returns null bei Streamlit-Transport, API-Fehler, oder unparsbarer Antwort.
 */
export async function autoClassifyFeedback(
  transport: AITransport,
  text: string,
  context: FeedbackContext,
  area?: string,
): Promise<LLMClassification | null> {
  if (typeof transport.submitMessage !== 'function') return null;
  // Streamlit-Transport unterstützt zwar submitMessage, aber keine deterministische JSON-Klassifikation
  if (transport.name === 'Streamlit') return null;

  const areaHint = area || context.page;
  const userPrompt = `Feedback-Text: "${text}"\nApp-Bereich: ${areaHint}`;

  try {
    const raw = await transport.submitMessage(userPrompt, CLASSIFICATION_PROMPT, {
      thinkingBudget: 'low',
    });
    return parseFeedbackSummary(raw);
  } catch (err) {
    console.warn('[autoClassifyFeedback] LLM call failed:', err);
    return null;
  }
}

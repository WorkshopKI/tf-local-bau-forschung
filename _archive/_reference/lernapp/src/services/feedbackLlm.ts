/* ── Feedback-LLM-Service ──
 * System-Prompt + Response-Parser für den Feedback-Chatbot.
 * Nutzt streamChat() aus llmService.ts direkt.
 */

import { createElement } from "react";
import type { FeedbackContext, Msg } from "@/types";

/** Extended message type with optional answer options (used by FeedbackChatbot) */
export interface ChatMsg extends Msg {
  options?: string[];
}

/** Builds the system prompt for the feedback chatbot, including current app context. */
export function buildFeedbackSystemPrompt(context: FeedbackContext): string {
  return `Du bist der Feedback-Assistent für KI-Werkstatt, eine Web-App zum Lernen von KI-Prompting.

DEIN WISSEN ÜBER DIE APP:
- Seiten: Prompt-Labor (Hauptarbeitsbereich mit ACTA-Baukasten und Chat), Prompt-Sammlung (Bibliothek), Onboarding (Lernpfad), Dashboard, Einstellungen
- Features: ACTA-Baukasten (4 Karten: Auftrag, Kontext, Ton, Ausgabeformat), Prüfen-Button (Qualitätscheck), Vorschlagen-Button (KI-Vorschläge), Daily Challenge, Spot the Flaw
- Modi: Workshop-Modus (mit Supabase-Login) und Standalone-Modus (eigener API-Key)
- Zielgruppe: Workshop-Teilnehmer und Selbstlerner im DACH-Raum

AKTUELLER KONTEXT DES NUTZERS:
- Seite: ${context.page} (${context.route})
- Modus: ${context.mode}
- Gerät: ${context.device} (${context.viewport})
- Letzte Aktion: ${context.lastAction || "–"}
- Session-Dauer: ${Math.round(context.sessionDuration / 60)} Minuten
${context.errors.length > 0 ? `- Letzte Fehler: ${context.errors.join(", ")}` : ""}

DEINE AUFGABE:
1. Verstehe was der Nutzer mitteilen möchte
2. Klassifiziere: Bug | Feature-Wunsch | UX-Feedback | Lob | Frage
3. Stelle max. 2-3 gezielte Rückfragen falls unklar
4. Erstelle eine strukturierte Zusammenfassung

Wenn du genug Informationen hast, schreibe NUR einen kurzen Übergangssatz wie "Alles klar, hier meine Zusammenfassung:" oder "Danke, ich fasse zusammen:" — KEINE inhaltliche Wiederholung. Dann direkt den \`\`\`json Block:

\`\`\`json
{
  "category": "bug | feature | ux | praise | question",
  "summary": "1-2 Sätze Zusammenfassung",
  "details": "Ausführliche Beschreibung",
  "affectedArea": "App-Bereich (z.B. prompt-labor, prompt-sammlung, onboarding)",
  "priority_suggestion": 1-5,
  "relevant_files": ["src/..."]
}
\`\`\`

WICHTIG:
- Antworte auf Deutsch
- Sei freundlich und konkret
- Wenn der Nutzer einen Bereich der App referenziert, bestätige welchen du meinst
- Nach max. 3 Rückfragen: Zusammenfassung erstellen
- Die finale Zusammenfassung am Ende des Gesprächs muss IMMER als natürlicher deutscher Text formuliert sein, gefolgt vom \`\`\`json Block. Schicke NIEMALS rohes JSON als Antworttext — das JSON-Format mit "options" ist NUR für Rückfragen gedacht

ANTWORT-FORMAT FÜR RÜCKFRAGEN:
- Wenn du dem Nutzer Optionen oder Rückfragen gibst, antworte in diesem JSON-Format (OHNE \`\`\`json Block):
{"text": "Deine Frage oder Nachricht", "options": ["Option A", "Option B"]}
- Maximal 4 Optionen, jede max. 10 Wörter
- Letzte Option kann "Etwas anderes" sein
- Wenn du KEINE Optionen brauchst, antworte nur mit normalem Text
- Die finale Zusammenfassung mit dem \`\`\`json Block ist IMMER normaler Text — NIEMALS das options-Format verwenden`;
}

/**
 * Extracts a structured feedback summary from the LLM output.
 * Looks for a fenced ```json block containing category, summary, details etc.
 * @returns Parsed classification object, or null if no valid summary found.
 */
export function parseFeedbackSummary(
  llmOutput: string
): {
  category: string;
  summary: string;
  details: string;
  affectedArea: string;
  priority_suggestion: number;
  relevant_files?: string[];
} | null {
  const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.category && parsed.summary) {
      return {
        category: parsed.category,
        summary: parsed.summary,
        details: parsed.details ?? "",
        affectedArea: parsed.affectedArea ?? "",
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
 *
 * Der Bot kann antworten in drei Formaten:
 * 1. Reiner Text (normaler Chat)
 * 2. Text + ```json {...} ``` Block (Zusammenfassung am Ende)
 * 3. Text + {"text": "...", "options": [...]} (Rückfrage mit Optionen)
 *
 * Format 2 wird hier entfernt (die Bestätigungs-Karte parst es separat via parseFeedbackSummary).
 * Format 3 wird extrahiert und als options[] zurückgegeben.
 */
export function parseBotResponse(raw: string): { text: string; options?: string[] } {
  // Schritt 1: Fenced JSON-Blöcke entfernen (```json...```)
  // Gleicher Ansatz wie parseFeedbackSummary — nachweislich funktionierend
  let cleaned = raw.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, "").trim();

  // Schritt 2: Optionen-JSON suchen (unfenced)
  // Suche nach dem LETZTEN {...} Block der "text" und "options" enthält
  const jsonBlocks = [...cleaned.matchAll(/\{[^{}]*"text"[^{}]*"options"[^{}]*\}/g)];
  const lastJsonBlock = jsonBlocks[jsonBlocks.length - 1];
  if (lastJsonBlock) {
    try {
      const parsed = JSON.parse(lastJsonBlock[0]);
      if (typeof parsed.text === "string" && Array.isArray(parsed.options)) {
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
    if (typeof parsed.text === "string" && Array.isArray(parsed.options)) {
      return { text: parsed.text, options: parsed.options };
    }
  } catch { /* kein JSON */ }

  return { text: cleaned };
}

/**
 * Renders **bold** markdown as <strong> in plain text.
 * Returns React elements for use in JSX.
 */
export function renderSimpleMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return createElement("strong", { key: i }, part.slice(2, -2));
    }
    return createElement("span", { key: i }, part);
  });
}

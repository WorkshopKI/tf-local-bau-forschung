/* ── Claude Code Prompt-Generator ──
 * Erstellt strukturierte Prompts aus Feedback-Tickets.
 */

import type { FeedbackItem } from "@/types";
import { FEEDBACK_CATEGORY_LABELS } from "@/types";

/**
 * Generiert einen strukturierten Claude Code Prompt aus einem Feedback-Ticket.
 * Enthält Kontext, Anforderung, automatisch erfasste Daten, betroffene Dateien und Constraints.
 * Wird im Admin-Dashboard über den "Prompt generieren"-Button aufgerufen.
 */
export function generateClaudeCodePrompt(ticket: FeedbackItem): string {
  const categoryLabel = FEEDBACK_CATEGORY_LABELS[ticket.category] ?? ticket.category;
  const classification = ticket.llm_classification;

  const affectedArea = classification?.affectedArea || ticket.context.page || ticket.context.route;
  const relevantFiles = classification?.relevant_files;
  const details = classification?.details || ticket.text;
  const summary = classification?.summary || ticket.text;

  return `## Kontext
Aktueller Stand siehe CLAUDE.md.
Betrifft: ${affectedArea}
Kategorie: ${categoryLabel}

## Anforderung (aus Nutzerfeedback #${ticket.id})

${summary}

${details !== summary ? `### Details\n${details}\n` : ""}
## Automatisch erfasster Kontext
- Route: ${ticket.context.route}
- Seite: ${ticket.context.page}
- Modus: ${ticket.context.mode}
- Gerät: ${ticket.context.device} (${ticket.context.viewport})
- Letzte Aktion: ${ticket.context.lastAction || "–"}
- Session-Dauer: ${Math.round(ticket.context.sessionDuration / 60)} Min.
${ticket.screen_ref ? `- Bereich-Referenz: ${ticket.screen_ref}` : ""}
${ticket.context.errors.length > 0 ? `- Letzte Fehler: ${ticket.context.errors.join(", ")}` : ""}

## Betroffene Dateien
${relevantFiles?.map((f) => `- ${f}`).join("\n") || "(Bitte analysieren)"}

## Constraints
- Keine neuen npm Dependencies
- Dark Mode muss funktionieren
- Bestehende Funktionalität darf nicht brechen
- Deutsche Texte, Theme-Farben verwenden
- Badge-Farben aus BADGE_COLORS importieren
- Seitentitel: page-title CSS-Klasse
- Card-Stil: card-section CSS-Klasse

## Auftrag
Starte im Planungsmodus. Analysiere die betroffenen Dateien
und schlage einen Implementierungsplan vor, bevor du Änderungen machst.
Nach Implementierung: CLAUDE.md aktualisieren falls nötig.`.trim();
}

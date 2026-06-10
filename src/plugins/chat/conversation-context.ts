/**
 * Baut aus dem Chat-Verlauf die API-Message-Liste für den LLM-Call.
 *
 * Regeln:
 * - System-Prompt zuerst (wenn nicht leer)
 * - User-Messages bekommen ihren Attachment-Kontext in den API-Content injiziert
 *   (der gespeicherte ChatMessage.content bleibt sauber für die Anzeige)
 * - extraContext (RAG + Verzeichnisse) hängt NUR an der letzten User-Message
 * - Assistant-Messages senden nur content (nie thinking/stats); leere (Abort) fliegen raus
 * - Cap von hinten: HISTORY_CHAR_BUDGET Zeichen oder HISTORY_MAX_MESSAGES Messages;
 *   die aktuelle User-Message bleibt IMMER drin
 */
import type { ConversationMessage } from '@/core/services/ai/transports/streamlit';
import { buildAttachmentContext } from './attachments/attachment-context';
import type { ChatMessage } from './types';

export const DEFAULT_SYSTEM_PROMPT =
  'Du bist ein hilfreicher Assistent für ein Förderantrags-Team. '
  + 'Antworte präzise und auf Deutsch. Nutze Markdown für Struktur (Listen, Tabellen, Code-Blöcke).';

export const HISTORY_CHAR_BUDGET = 24_000;
export const HISTORY_MAX_MESSAGES = 20;

export function buildApiMessages(
  history: ChatMessage[],
  systemPrompt: string,
  extraContext?: string,
): ConversationMessage[] {
  let lastUserIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === 'user') { lastUserIdx = i; break; }
  }

  // 1) API-Content je Message ableiten
  const derived: Array<{ msg: ConversationMessage; isCurrent: boolean }> = [];
  history.forEach((m, i) => {
    if (m.role === 'assistant') {
      if (!m.content) return; // leere/abgebrochene Antworten überspringen
      derived.push({ msg: { role: 'assistant', content: m.content }, isCurrent: false });
      return;
    }
    let content = m.content;
    if (m.attachments?.length) content += `\n\n${buildAttachmentContext(m.attachments)}`;
    const isCurrent = i === lastUserIdx;
    if (isCurrent && extraContext) content += extraContext;
    derived.push({ msg: { role: 'user', content }, isCurrent });
  });

  // 2) Cap von hinten (neueste zuerst einsammeln)
  const selected: ConversationMessage[] = [];
  let chars = 0;
  for (let i = derived.length - 1; i >= 0; i--) {
    const { msg, isCurrent } = derived[i]!;
    const len = msg.content.length;
    if (!isCurrent && (selected.length >= HISTORY_MAX_MESSAGES || chars + len > HISTORY_CHAR_BUDGET)) {
      break;
    }
    selected.unshift(msg);
    chars += len;
  }

  if (systemPrompt.trim()) {
    selected.unshift({ role: 'system', content: systemPrompt });
  }
  return selected;
}

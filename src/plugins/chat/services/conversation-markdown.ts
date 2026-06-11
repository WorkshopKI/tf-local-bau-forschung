import type { ConversationFull } from '../types';

/** Eine Konversation als Markdown serialisieren (Kontextmenü „Als Markdown kopieren"). */
export function conversationToMarkdown(full: ConversationFull): string {
  const lines: string[] = [`# ${full.title}`, ''];
  for (const m of full.messages) {
    lines.push(m.role === 'user' ? '**Du:**' : '**Assistent:**');
    lines.push(m.content || '_(leer)_');
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

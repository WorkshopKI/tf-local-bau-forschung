// Erzeugt einen Claude-Code-Prompt aus einem Feedback-Ticket.
// Nutzt llm_classification falls vorhanden, sonst Rohdaten.

import type { FeedbackItem } from '@/core/types/feedback';

const CATEGORY_LABELS_DE: Record<string, string> = {
  praise: 'Lob',
  problem: 'Problem',
  idea: 'Feature-Wunsch',
  question: 'Frage',
  bug: 'Bug',
  feature: 'Feature-Wunsch',
  ux: 'UX-Feedback',
};

export function generateClaudeCodePrompt(ticket: FeedbackItem): string {
  const cls = ticket.llm_classification;
  const category = cls?.category ?? ticket.category;
  const summary = cls?.summary ?? ticket.text;
  const details = cls?.details && cls.details !== summary ? cls.details : '';
  const affectedArea = cls?.affectedArea || ticket.context.page;
  const relevantFiles = cls?.relevant_files;

  const ctx = ticket.context;
  const sessionMin = Math.round(ctx.sessionDuration / 60);
  const errors = ctx.errors.length > 0
    ? `- Letzte ${ctx.errors.length === 1 ? 'Fehler' : 'Fehler'}: ${ctx.errors.join('; ')}`
    : '';
  const screenRef = ctx.screenRefLabel
    ? `- Bereich-Referenz: ${ctx.screenRefLabel}`
    : '';

  const filesBlock = relevantFiles && relevantFiles.length > 0
    ? relevantFiles.map(f => `- \`${f}\``).join('\n')
    : '_(Bitte selbst analysieren — siehe `CLAUDE.md` für Projekt-Struktur)_';

  return `## Kontext

Aktueller Stand siehe \`CLAUDE.md\`.
Betrifft: **${affectedArea}**
Kategorie: **${CATEGORY_LABELS_DE[category] ?? category}**

## Anforderung (aus Nutzerfeedback #${ticket.id})

${summary}
${details ? `\n${details}\n` : ''}
${ticket.user_confirmed ? '> ✅ Vom Nutzer bestätigt: "Ja, genau das meine ich"\n' : ''}
## Automatisch erfasster Kontext

- Route: \`${ctx.route}\`
- Seite: ${ctx.page}
- Gerät: ${ctx.device} (${ctx.viewport})
- Letzte Aktion: ${ctx.lastAction || '–'}
- Session-Dauer: ${sessionMin} Min.
${screenRef}
${errors}

## Betroffene Dateien

${filesBlock}

## Constraints

- **file://-Protokoll**: Kein Web Worker, kein cross-origin, kein \`fetch\` auf relative URLs (nur OpenRouter-API + localhost)
- **Single-File-Build** über \`vite-plugin-singlefile\`
- **Tailwind CSS v4 + shadcn/ui** für UI-Komponenten — Standard-Pfad \`src/components/ui/\`
- **React 19** (functional components only, custom hooks für shared logic)
- **State**: Zustand für Stores, Context für Cross-Cutting (kein Redux, kein Context für Daten)
- **Icons**: \`lucide-react\` (tree-shakeable)
- **Deutsche UI-Texte**, konsistent mit Rest der App
- **Eval- und Smoke-Tests** dürfen nicht brechen
- **Status-Mappings**: \`src/core/utils/status-mappings.ts\` als zentrale Quelle nutzen
- **CLAUDE.md** als primäre Kontext-Referenz — nach Implementierung ggf. aktualisieren

## Auftrag

Starte im Planungsmodus. Lies \`CLAUDE.md\` für den aktuellen Stand.
Analysiere die betroffenen Dateien und schlage einen Implementierungsplan vor.
Nach Implementierung: \`CLAUDE.md\` aktualisieren falls nötig.
`;
}

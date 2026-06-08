// Erzeugt einen Claude-Code-Prompt aus einem Feedback-Ticket.
// Bevorzugt die strukturierten Formular-Felder (FeedbackItem.structured), fällt
// auf llm_classification bzw. Rohtext zurück.

import type { FeedbackCategory, FeedbackItem } from '@/core/types/feedback';

const CATEGORY_LABELS_DE: Record<string, string> = {
  praise: 'Lob',
  problem: 'Problem',
  idea: 'Feature-Wunsch',
  ux: 'UX-Feedback',
  question: 'Frage',
  bug: 'Bug',
  feature: 'Feature-Wunsch',
};

/** Typspezifische Markdown-Abschnitte für FeedbackItem.structured (key → Überschrift). */
const STRUCTURED_SECTIONS: Partial<Record<FeedbackCategory, Array<{ key: string; heading: string }>>> = {
  problem: [
    { key: 'steps', heading: 'Schritte zur Reproduktion' },
    { key: 'actual', heading: 'Tatsächliches Verhalten' },
    { key: 'expected', heading: 'Erwartetes Verhalten' },
  ],
  idea: [
    { key: 'goal', heading: 'Ziel' },
    { key: 'reason', heading: 'Begründung / Kontext' },
    { key: 'idea', heading: 'Lösungsidee' },
  ],
  ux: [
    { key: 'pain', heading: 'Aktuelles Problem' },
    { key: 'better', heading: 'Gewünschte Verbesserung' },
  ],
};

/**
 * Baut den Inhalt des „## Anforderung"-Blocks. Mit `structured` entstehen
 * typspezifische `###`-Abschnitte (nur nicht-leere Felder); eine ggf. vorhandene
 * LLM-Summary wird als Einleitungssatz vorangestellt, ersetzt die Felder aber
 * NICHT. Ohne `structured` greift das bisherige Verhalten (Summary/Details/Rohtext).
 */
function buildRequirement(ticket: FeedbackItem): string {
  const cls = ticket.llm_classification;
  const sections = ticket.category ? STRUCTURED_SECTIONS[ticket.category] : undefined;
  if (ticket.structured && sections) {
    const parts: string[] = [];
    if (cls?.summary) parts.push(cls.summary);
    for (const { key, heading } of sections) {
      const val = ticket.structured[key]?.trim();
      if (val) parts.push(`### ${heading}\n\n${val}`);
    }
    if (parts.length > 0) return parts.join('\n\n');
  }
  // Fallback: kein structured (oder Lob/Frage) → Summary/Details/Rohtext.
  const summary = cls?.summary ?? ticket.text;
  const details = cls?.details && cls.details !== summary ? cls.details : '';
  return details ? `${summary}\n\n${details}` : summary;
}

/** Markdown-Block für beigefügte Screenshots (Referenzen + manueller-Anhang-Hinweis). */
function buildScreenshotsBlock(ticket: FeedbackItem): string {
  const atts = ticket.attachments;
  if (!atts || atts.length === 0) return '';
  const list = atts
    .map(a => `- \`${a.filename}\`${a.caption ? ` — ${a.caption}` : ''}`)
    .join('\n');
  return `
## Beigefügte Screenshots

${list}

> ⚠️ Die Bilddateien liegen real im Attachment-Verzeichnis (\`_intern/feedback/attachments/\`). Beim Einfügen dieses Prompts in den Coding-Agent bitte **manuell mit anhängen** — der Prompt-Text enthält sie nicht.
`;
}

export function generateClaudeCodePrompt(ticket: FeedbackItem): string {
  const cls = ticket.llm_classification;
  const category = cls?.category ?? ticket.category;
  const requirement = buildRequirement(ticket);
  const screenshotsBlock = buildScreenshotsBlock(ticket);
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
Kategorie: **${category ? (CATEGORY_LABELS_DE[category] ?? category) : 'Unklassifiziert'}**

## Anforderung (aus Nutzerfeedback #${ticket.id})

${requirement}
${ticket.user_confirmed ? '\n> ✅ Vom Nutzer bestätigt: "Ja, genau das meine ich"\n' : ''}${screenshotsBlock}
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

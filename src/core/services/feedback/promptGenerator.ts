// Erzeugt einen Claude-Code-Prompt aus einem Feedback-Ticket.
// Bevorzugt die strukturierten Formular-Felder (FeedbackItem.structured), fällt
// auf llm_classification bzw. Rohtext zurück.

import type { FeedbackCategory, FeedbackItem } from '@/core/types/feedback';

// App-Kategorien + LLM-Codes (`cls.category`) in einer Map. `ux` ist als
// App-Kategorie entfallen (v2.289), bleibt aber als LLM-Code möglich.
const CATEGORY_LABELS_DE: Record<string, string> = {
  praise: 'Lob',
  problem: 'Problem',
  idea: 'Feature-Wunsch',
  question: 'Frage',
  bug: 'Bug',
  feature: 'Feature-Wunsch',
  ux: 'Feature-Wunsch',
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
};

/**
 * Baut den Inhalt des „## Anforderung"-Blocks. Mit `structured` entstehen
 * typspezifische `###`-Abschnitte (nur nicht-leere Felder); eine ggf. vorhandene
 * LLM-Summary wird als Einleitungssatz vorangestellt, ersetzt die Felder aber
 * NICHT. Ohne `structured` greift das bisherige Verhalten (Summary/Details/Rohtext).
 * `cls.anforderung` (aus improveFeedback()) steht als eigener Ist/Soll-Abschnitt
 * VOR allem anderen — sie ist die verfeinerte Fassung, die Felder bleiben Beleg.
 */
function buildRequirement(ticket: FeedbackItem): string {
  const cls = ticket.llm_classification;
  const anforderungBlock = cls?.anforderung ? `### Anforderung (Ist/Soll)\n\n${cls.anforderung}` : '';
  const sections = ticket.category ? STRUCTURED_SECTIONS[ticket.category] : undefined;
  if (ticket.structured && sections) {
    const parts: string[] = [];
    if (anforderungBlock) parts.push(anforderungBlock);
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
  const fallbackBody = details ? `${summary}\n\n${details}` : summary;
  return anforderungBlock ? `${anforderungBlock}\n\n${fallbackBody}` : fallbackBody;
}

/** Markdown-Liste der Akzeptanzkriterien (aus improveFeedback()), leer wenn keine vorhanden. */
function buildAkzeptanzkriterienBlock(ticket: FeedbackItem): string {
  const kriterien = ticket.llm_classification?.akzeptanzkriterien;
  if (!kriterien || kriterien.length === 0) return '';
  return `\n### Akzeptanzkriterien\n\n${kriterien.map(k => `- ${k}`).join('\n')}\n`;
}

/** Markdown-Block für beigefügte Screenshots + Dateien (Referenzen + manueller-Anhang-Hinweis). */
function buildScreenshotsBlock(ticket: FeedbackItem): string {
  const atts = ticket.attachments;
  if (!atts || atts.length === 0) return '';
  const images = atts.filter(a => a.kind !== 'file');
  const files = atts.filter(a => a.kind === 'file');
  const sections: string[] = [];
  if (images.length > 0) {
    sections.push(`### Screenshots\n\n${images
      .map(a => `- \`${a.filename}\`${a.caption ? ` — ${a.caption}` : ''}`)
      .join('\n')}`);
  }
  if (files.length > 0) {
    sections.push(`### Dateien\n\n${files
      .map(a => `- \`${a.name || a.filename}\``)
      .join('\n')}`);
  }
  return `
## Beigefügte Anhänge

${sections.join('\n\n')}

> ⚠️ Die Dateien liegen real im Attachment-Verzeichnis (\`_intern/feedback/attachments/\`). Beim Einfügen dieses Prompts in den Coding-Agent bitte **manuell mit anhängen** — der Prompt-Text enthält sie nicht.
`;
}

export function generateClaudeCodePrompt(ticket: FeedbackItem): string {
  const cls = ticket.llm_classification;
  const category = cls?.category ?? ticket.category;
  const requirement = buildRequirement(ticket);
  const akzeptanzkriterienBlock = buildAkzeptanzkriterienBlock(ticket);
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
${akzeptanzkriterienBlock}${ticket.user_confirmed ? '\n> ✅ Vom Nutzer bestätigt: "Ja, genau das meine ich"\n' : ''}${cls?.verbessert ? '\n> ✨ Durch interne KI verfeinert.\n' : ''}${screenshotsBlock}
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
- **Status-Mappings**: Labels/Badges über \`src/core/utils/status-mappings.ts\`; fachliche Status-Vergleiche NIE per Literal — Helper aus \`src/core/utils/status-canonical.ts\` nutzen (CLAUDE.md Pitfall #12)
- **CLAUDE.md** als primäre Kontext-Referenz — nach Implementierung ggf. aktualisieren

## Auftrag

Starte im Planungsmodus. Lies \`CLAUDE.md\` für den aktuellen Stand.
Analysiere die betroffenen Dateien und schlage einen Implementierungsplan vor.
Nach Implementierung: \`CLAUDE.md\` aktualisieren falls nötig.
`;
}

/**
 * Transport-agnostischer Skill-Runner. Baut aus einer `SkillDefinition` + Eingaben
 * die Messages, fährt die bestehende Transport-Ladder (nicht-streamend genügt für
 * den Durchstich) und gibt die geparste Ausgabe zurück.
 *
 * Bewusst KEINE modell-spezifische Sonderlogik — Modell-Overrides kommen erst mit
 * der Registry. Abbruch via `AbortSignal` (durchgereicht an den Transport).
 */
import type { AITransport, ConversationMessage } from '@/core/services/ai/transports/streamlit';
import type { ParsedSkillOutput, SkillDefinition, SkillModifierKey } from './types';

/** VB-Markdown wird vor dem Senden auf diese Zeichenzahl gekappt (am Absatzende). */
export const VB_CHAR_CAP = 24_000;

export interface SkillRunInput {
  /** Stammdaten-Block (aktenzeichen, titel, akronym, antragsteller). */
  stammdaten: string;
  /** Markdown der Vorhabensbeschreibung (wird ggf. gekürzt). */
  vbMarkdown: string;
  /** Bei Re-Invocation: Modifier-Instruktion anhängen. */
  modifier?: SkillModifierKey;
  /** Bei Re-Invocation: vorheriger finaler Text als Überarbeitungs-Referenz. */
  vorherigerText?: string;
  signal?: AbortSignal;
}

export interface SkillRunResult {
  raw: string;
  parsed: ParsedSkillOutput;
  /** True, wenn die VB für den Prompt gekürzt wurde (im UI vermerken). */
  vbGekuerzt: boolean;
}

/** Kürzt zu langes VB-Markdown am letzten Absatzumbruch vor dem Cap. */
export function capVbMarkdown(md: string, cap = VB_CHAR_CAP): { text: string; gekuerzt: boolean } {
  if (md.length <= cap) return { text: md, gekuerzt: false };
  const slice = md.slice(0, cap);
  const lastBreak = slice.lastIndexOf('\n\n');
  const cut = lastBreak > cap * 0.5 ? slice.slice(0, lastBreak) : slice;
  return { text: `${cut.trimEnd()}\n\n…`, gekuerzt: true };
}

function buildUserContent(skill: SkillDefinition, input: SkillRunInput, vb: string): string {
  let content = skill.promptTemplate
    .replace('{{stammdaten}}', input.stammdaten)
    .replace('{{vbMarkdown}}', vb);
  if (input.vorherigerText) {
    content += `\n\n## Bisheriger finaler Text (zur Überarbeitung)\n${input.vorherigerText}`;
  }
  if (input.modifier) {
    content += `\n\n## Zusätzliche Anweisung\n${skill.modifiers[input.modifier]}`;
  }
  return content;
}

export async function runSkill(
  transport: AITransport,
  skill: SkillDefinition,
  input: SkillRunInput,
): Promise<SkillRunResult> {
  const { text: vb, gekuerzt } = capVbMarkdown(input.vbMarkdown);
  const userContent = buildUserContent(skill, input, vb);

  let raw: string;
  if (typeof transport.submitConversation === 'function') {
    const messages: ConversationMessage[] = [
      { role: 'system', content: skill.systemPrompt },
      { role: 'user', content: userContent },
    ];
    raw = await transport.submitConversation(messages, {
      maxTokens: skill.maxTokens,
      thinkingBudget: 'none',
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } else {
    // Streamlit-Bridge: Single-Turn — System-Rolle als Prefix in die Message.
    raw = await transport.submitMessage(
      `${skill.systemPrompt}\n\n${userContent}`,
      skill.systemPrompt,
      input.signal ? { signal: input.signal } : undefined,
    );
  }

  return { raw, parsed: skill.parse(raw), vbGekuerzt: gekuerzt };
}

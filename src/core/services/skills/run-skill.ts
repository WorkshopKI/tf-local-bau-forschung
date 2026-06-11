/**
 * Transport-agnostischer Skill-Runner. Baut aus einem `SkillRecord` (Registry-
 * Daten) + den zugeordneten Qualitätsregeln + Eingaben die Messages, fährt die
 * bestehende Transport-Ladder (nicht-streamend genügt) und gibt die geparste
 * Ausgabe zurück.
 *
 * Die Regel-Hinweise werden via `buildPromptVorgaben` an den Prompt angehängt —
 * dieselbe Quelle, die auch die Checks erzeugt (keine Drift). Modell-Overrides
 * sind weiterhin v2; hier KEINE modell-spezifische Sonderlogik.
 */
import type { AITransport, ConversationMessage } from '@/core/services/ai/transports/streamlit';
import {
  buildPromptVorgaben,
  type QualitaetsRegel,
  type SkillModifierKey,
  type SkillRecord,
} from '@/core/services/skill-registry';
import { parseSkillOutput } from './parse';
import type { ParsedSkillOutput } from './types';

/**
 * VB-Markdown wird vor dem Senden auf diese Zeichenzahl gekappt (am Absatzende).
 * Dimensioniert für das kleinste produktiv genutzte Kontextfenster (lokales LLM
 * ~50k Tokens): 100k Zeichen ≈ 30–33k Tokens VB + ~2k Output (`maxTokens`) +
 * System-/Template-/Vorgaben-Overhead (+ bei Re-Lauf vorheriger Text) → bleibt
 * mit Headroom unter 50k; Cloud (128k) ist ein Superset. Eine vollständige
 * ZIM-Verbund-VB (~25 Seiten ≈ 75k Zeichen) passt damit komplett ins LLM →
 * `vbGekuerzt` (UI-Hinweis) greift nur noch bei echten Ausreißern.
 * Größer machen erst, wenn das kleinste Zielmodell ein größeres Fenster hat
 * (sonst still serverseitiger Context-Shift statt sichtbarem Hinweis).
 */
export const VB_CHAR_CAP = 100_000;
const DEFAULT_MAX_TOKENS = 2048;

/**
 * Persönliche Stil-Schicht des Bearbeiters (User-Tweaks v2) — minimale, vom
 * Store-Record entkoppelte Form. `SkillTweak` erfüllt sie strukturell. Der Block
 * wird NUR bei `aktiv` + nicht-leeren Feldern emittiert und steht im Prompt VOR
 * den „Formalen Vorgaben" → die Kurator-Regeln behalten (Recency) Vorrang.
 */
export interface SkillTweakPromptInput {
  aktiv: boolean;
  stilHinweise: string;
  beispielFormulierungen: string;
}

export interface SkillRunInput {
  /** Stammdaten-Block (aktenzeichen, titel, akronym, antragsteller). */
  stammdaten: string;
  /** Markdown der Vorhabensbeschreibung (wird ggf. gekürzt). */
  vbMarkdown: string;
  /** Bei Re-Invocation: Modifier-Instruktion anhängen. */
  modifier?: SkillModifierKey;
  /** Bei Re-Invocation: vorheriger finaler Text als Überarbeitungs-Referenz. */
  vorherigerText?: string;
  /** Optionaler persönlicher Tweak (User-Tweaks v2). Fehlt er, ist die Ausgabe identisch zum tweaklosen Lauf. */
  tweak?: SkillTweakPromptInput;
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

/** Ersetzt alle Vorkommen eines `{{slot}}`-Platzhalters (kein $-Sonderhandling). */
function fillSlot(template: string, slot: string, value: string): string {
  return template.split(`{{${slot}}}`).join(value);
}

/**
 * Baut den klar delimitierten Tweak-Block (User-Tweaks v2). Gibt `''` zurück,
 * wenn beide Felder leer sind. Keine Interpolation/Logik im Tweak-Text — die
 * Inhalte werden 1:1 mit kurzen Labels eingesetzt. Wird sowohl von
 * `composeSkillPrompt` als auch von der Editor-Vorschau genutzt (eine Quelle).
 */
export function buildTweakBlock(stilHinweise: string, beispielFormulierungen: string): string {
  const stil = stilHinweise.trim();
  const bsp = beispielFormulierungen.trim();
  if (!stil && !bsp) return '';
  const lines = ['## Persönliche Stil-Präferenzen des Bearbeiters (heben die formalen Vorgaben nicht auf)'];
  if (stil) lines.push(`Stil: ${stil}`);
  if (bsp) {
    lines.push('Beispiel-Formulierungen:');
    lines.push(bsp);
  }
  return lines.join('\n');
}

/**
 * EINZIGE Prompt-Kompositionsstelle (vormals `buildUserContent`). Feste, nicht
 * konfigurierbare Rangfolge:
 *   (1) gefülltes Kurator-Template
 *   (2) persönlicher Tweak-Block — nur bei `tweak.aktiv` + nicht-leer
 *   (3) „Formale Vorgaben" (aus `buildPromptVorgaben`) — bewusst ZULETZT vor den
 *       Re-Invocation-Blöcken, damit die Kurator-Regeln Instruktions-Vorrang behalten
 *   (+) Re-Invocation: vorheriger Text + Modifier
 * Reine Funktion (getestet). Ohne (oder mit inaktivem/leerem) Tweak ist die
 * Ausgabe byte-identisch zum tweaklosen Lauf.
 */
export function composeSkillPrompt(
  skill: SkillRecord,
  regeln: QualitaetsRegel[],
  input: SkillRunInput,
  vb: string,
): string {
  let content = fillSlot(fillSlot(skill.promptTemplate, 'stammdaten', input.stammdaten), 'vbMarkdown', vb);
  if (input.tweak?.aktiv) {
    const tweakBlock = buildTweakBlock(input.tweak.stilHinweise, input.tweak.beispielFormulierungen);
    if (tweakBlock) content += `\n\n${tweakBlock}`;
  }
  const vorgaben = buildPromptVorgaben(regeln);
  if (vorgaben) content += `\n\n${vorgaben}`;
  if (input.vorherigerText) {
    content += `\n\n## Bisheriger finaler Text (zur Überarbeitung)\n${input.vorherigerText}`;
  }
  if (input.modifier) {
    const mod = skill.modifiers[input.modifier];
    if (mod) content += `\n\n## Zusätzliche Anweisung\n${mod}`;
  }
  return content;
}

export async function runSkill(
  transport: AITransport,
  skill: SkillRecord,
  regeln: QualitaetsRegel[],
  input: SkillRunInput,
): Promise<SkillRunResult> {
  const { text: vb, gekuerzt } = capVbMarkdown(input.vbMarkdown);
  const userContent = composeSkillPrompt(skill, regeln, input, vb);
  const systemPrompt = skill.systemPrompt ?? '';
  const maxTokens = skill.maxTokens ?? DEFAULT_MAX_TOKENS;

  let raw: string;
  if (typeof transport.submitConversation === 'function') {
    const messages: ConversationMessage[] = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt } as ConversationMessage] : []),
      { role: 'user', content: userContent },
    ];
    raw = await transport.submitConversation(messages, {
      maxTokens,
      thinkingBudget: 'none',
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } else {
    // Streamlit-Bridge: Single-Turn — System-Rolle als Prefix in die Message.
    raw = await transport.submitMessage(
      systemPrompt ? `${systemPrompt}\n\n${userContent}` : userContent,
      systemPrompt || undefined,
      input.signal ? { signal: input.signal } : undefined,
    );
  }

  return { raw, parsed: parseSkillOutput(raw), vbGekuerzt: gekuerzt };
}

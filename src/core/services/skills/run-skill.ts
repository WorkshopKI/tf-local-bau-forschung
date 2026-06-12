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
import { extractThinking } from '@/core/services/ai/thinking-parser';
import {
  buildPromptVorgaben,
  type QualitaetsRegel,
  type SkillModifierKey,
  type SkillRecord,
} from '@/core/services/skill-registry';
import { parseSkillOutput } from './parse';
import type { ParsedSkillOutput } from './types';

/** Reasoning-/Thinking-Budget (durchgereicht an die Transport-Ladder). */
export type ThinkingBudget = 'none' | 'low' | 'medium' | 'high';

/**
 * Statischer **Fallback**-Cap für `capVbMarkdown` (direkte/Test-Aufrufe). Zur
 * Laufzeit liefert `getVbCharCap()` ([llm-context.ts]) den aus der vom Nutzer
 * gemeldeten LLM-Kontextlänge (Einstellungen → KI-Assistent) abgeleiteten Wert;
 * die Aufrufer reichen ihn über `SkillRunInput.vbCharCap` durch. Der Default
 * hier entspricht ~`DEFAULT_LLM_CONTEXT_TOKENS` (32k) → ~86k Zeichen.
 */
export const VB_CHAR_CAP = 86_000;
const DEFAULT_MAX_TOKENS = 2048;

/**
 * Handlungsempfehlung, wenn die VB den Cap überschreitet (Inhalt fehlt dem LLM).
 * Einmalige Quelle für alle UI-Stellen (Kurzfassung + Gutachten-Workflow).
 */
export const VB_KUERZEN_HINWEIS =
  'Entfernen Sie unwichtige Abschnitte (z. B. Anhänge, Literaturverzeichnis, ausführliche Tabellen) direkt im Original-Dokument, laden Sie die gekürzte VB über „VB ersetzen" neu hoch und generieren Sie erneut. Falls Ihr LLM ein größeres Kontextfenster verarbeiten kann, erhöhen Sie es in Einstellungen → KI-Assistent.';

/** True, wenn das VB-Markdown den Cap überschreitet (würde gekürzt) — für den proaktiven UI-Check. */
export function vbUeberschreitetCap(md: string, cap: number): boolean {
  return md.length > cap;
}

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
  /**
   * Bereits freigegebene frühere Abschnitte (Gutachten-Workflow B–G) als Block
   * für den `{{vorherigeAbschnitte}}`-Slot. Fehlt er / Template ohne Platzhalter
   * → keine Wirkung (A-Prompt byte-identisch). Siehe gutachten/context-provider.ts.
   */
  vorherigeAbschnitte?: string;
  /** Bei Re-Invocation: Modifier-Instruktion anhängen. */
  modifier?: SkillModifierKey;
  /** Bei Re-Invocation: vorheriger finaler Text als Überarbeitungs-Referenz. */
  vorherigerText?: string;
  /** Optionaler persönlicher Tweak (User-Tweaks v2). Fehlt er, ist die Ausgabe identisch zum tweaklosen Lauf. */
  tweak?: SkillTweakPromptInput;
  /** VB-Zeichen-Cap aus der LLM-Kontextlänge (`getVbCharCap()`). Fehlt er → statischer `VB_CHAR_CAP`. */
  vbCharCap?: number;
  /**
   * Reasoning-/Thinking-Budget (`getLlmThinkingBudget()`, Einstellungen →
   * KI-Assistent). Fehlt es → `'none'` (Verhalten byte-identisch zu vorher).
   * Bei `!== 'none'` fährt der Runner den Streaming-Pfad und erfasst den
   * Denkprozess (`SkillRunResult.thinking`).
   */
  thinkingBudget?: ThinkingBudget;
  signal?: AbortSignal;
}

export interface SkillRunResult {
  raw: string;
  parsed: ParsedSkillOutput;
  /** True, wenn die VB für den Prompt gekürzt wurde (im UI vermerken). */
  vbGekuerzt: boolean;
  /** Erfasster Reasoning-/Thinking-Text, falls das Modell welchen lieferte. */
  thinking?: string;
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
  let content = fillSlot(
    fillSlot(fillSlot(skill.promptTemplate, 'stammdaten', input.stammdaten), 'vbMarkdown', vb),
    'vorherigeAbschnitte',
    input.vorherigeAbschnitte ?? '',
  );
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
  const { text: vb, gekuerzt } = capVbMarkdown(input.vbMarkdown, input.vbCharCap);
  const userContent = composeSkillPrompt(skill, regeln, input, vb);
  const systemPrompt = skill.systemPrompt ?? '';
  const maxTokens = skill.maxTokens ?? DEFAULT_MAX_TOKENS;
  const budget: ThinkingBudget = input.thinkingBudget ?? 'none';

  let raw: string;
  let thinking: string | undefined;
  if (typeof transport.submitConversation === 'function') {
    const messages: ConversationMessage[] = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt } as ConversationMessage] : []),
      { role: 'user', content: userContent },
    ];
    if (budget !== 'none' && typeof transport.streamConversation === 'function') {
      // Thinking aktiv: Streaming-Pfad — er trennt Reasoning robust (Feld
      // reasoning_content|reasoning UND <think>-Fallback). Wir streamen nur, um
      // den Denkprozess zu ERFASSEN (kein Live-UI nötig) → no-op onDelta.
      const r = await transport.streamConversation(messages, { onDelta: () => {} }, {
        maxTokens,
        thinkingBudget: budget,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      // streamConversation wirft bei Abbruch NICHT, sondern liefert aborted:true
      // (Partial-Content). Damit der Caller den bewussten Stop wie beim
      // submitConversation-Pfad als Abort behandelt (kein Teil-Record): werfen.
      if (r.aborted) throw new DOMException('Aborted', 'AbortError');
      raw = r.content;
      thinking = r.reasoning;
    } else {
      raw = await transport.submitConversation(messages, {
        maxTokens,
        thinkingBudget: budget,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    }
  } else {
    // Streamlit-Bridge: Single-Turn — System-Rolle als Prefix in die Message.
    raw = await transport.submitMessage(
      systemPrompt ? `${systemPrompt}\n\n${userContent}` : userContent,
      systemPrompt || undefined,
      input.signal ? { signal: input.signal } : undefined,
    );
  }

  // Fallback: Thinking war angefordert, kam aber (mangels Streaming) inline als
  // <think>…</think> im Content → abtrennen, damit es nicht im Fließtext landet.
  if (budget !== 'none' && !thinking) {
    const ext = extractThinking(raw);
    raw = ext.content;
    thinking = ext.thinking;
  }

  return { raw, parsed: parseSkillOutput(raw), vbGekuerzt: gekuerzt, ...(thinking ? { thinking } : {}) };
}

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
import { starteFrischenChat, type ChatResetStatus } from '@/core/services/ai/chat-reset';
import {
  buildPromptVorgaben,
  type QualitaetsRegel,
  type SkillModifierKey,
  type SkillRecord,
  type TeilDeklaration,
} from '../registry';
import { parseSkillOutput } from './parse';
import { protokolliereEreignis } from '@/core/services/assistent/protokoll';
import type { ParsedSkillOutput } from './types';

/** Reasoning-/Thinking-Budget (durchgereicht an die Transport-Ladder). */
export type ThinkingBudget = 'none' | 'low' | 'medium' | 'high';

/**
 * Statischer **Fallback**-Cap für `capVbMarkdown` (direkte/Test-Aufrufe). Zur
 * Laufzeit liefert `getVbCharCap()` ([llm-context.ts]) den aus der LLM-Kontextlänge
 * (manuell/erkannt/Default, Einstellungen → KI-Assistent) abgeleiteten Wert; die
 * Aufrufer reichen ihn über `SkillRunInput.vbCharCap` durch. Der Default hier
 * entspricht ~`DEFAULT_LLM_CONTEXT_TOKENS` (~80k) → ~233k Zeichen.
 */
export const VB_CHAR_CAP = 233_000;
const DEFAULT_MAX_TOKENS = 2048;
/**
 * Zusätzliches Output-Token-Budget, wenn Thinking aktiv ist. `max_tokens` deckelt
 * Reasoning UND Antwort GEMEINSAM — ohne Aufschlag frisst der Denkprozess das
 * ganze Budget und die eigentliche Antwort wird abgeschnitten (leerer finaler
 * Text, „Antwort ohne erwartete Abschnitte"). Der Aufschlag schafft Platz für
 * den (oft langen) Reasoning-Block; das Kontextfenster (≥32k) trägt das locker.
 */
const THINKING_OUTPUT_HEADROOM = 8192;

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
  /**
   * Relevanz-Map: wortgetreu ausgewählte VB-Sektionen für den `{{vbRelevant}}`-Slot
   * (kuratierter Kontext statt Volltext). Fehlt er / Template ohne Platzhalter →
   * keine Wirkung (Bestands-Skills byte-identisch). Siehe gutachten/relevanz-map.ts.
   */
  vbRelevant?: string;
  /** Bei Re-Invocation: Modifier-Instruktion anhängen. */
  modifier?: SkillModifierKey;
  /** Bei Re-Invocation: vorheriger finaler Text als Überarbeitungs-Referenz. */
  vorherigerText?: string;
  /**
   * Regel-gebundene Zusatz-Anweisung (Journey-Paket 3): eine konkrete Korrektur-
   * Vorgabe aus einem verletzten Check (`regelKorrekturAnweisung`). Wird
   * unmittelbar NACH dem Modifier-Block eingesetzt und VERSCHÄRFT den Modifier
   * (ersetzt ihn nicht). Fehlt sie → No-op (Bestandsläufe byte-identisch).
   */
  zusatzAnweisung?: string;
  /** Optionaler persönlicher Tweak (User-Tweaks v2). Fehlt er, ist die Ausgabe identisch zum tweaklosen Lauf. */
  tweak?: SkillTweakPromptInput;
  /**
   * LLM-QS: zu bewertender Abschnittstext für den `{{zielText}}`-Slot. Fehlt der
   * Platzhalter im Template → keine Wirkung (Bestands-Skills byte-identisch).
   */
  zielText?: string;
  /** LLM-QS: Zweck/Überschrift des bewerteten Abschnitts für den `{{abschnittszweck}}`-Slot. */
  abschnittszweck?: string;
  /**
   * NF: der wortgetreue Baustein-Katalog (relevante Bausteine, formatiert) für den
   * `{{nfBausteine}}`-Slot. Fehlt der Platzhalter im Template → keine Wirkung.
   */
  nfBausteine?: string;
  /**
   * NF: Quellanalyse/Kontext des Teilvorhabens für den `{{tvKontext}}`-Slot
   * (dokument-tragend → intern). Fehlt der Platzhalter → keine Wirkung.
   */
  tvKontext?: string;
  /**
   * NF: Verbund-/Gesamtvorhaben-Kontext für den `{{verbundKontext}}`-Slot
   * (dokument-tragend → intern). Fehlt der Platzhalter → keine Wirkung.
   */
  verbundKontext?: string;
  /** VB-Zeichen-Cap aus der LLM-Kontextlänge (`getVbCharCap()`). Fehlt er → statischer `VB_CHAR_CAP`. */
  vbCharCap?: number;
  /**
   * Reasoning-/Thinking-Budget (`getLlmThinkingBudget()`, Einstellungen →
   * KI-Assistent). Fehlt es → `'none'` (Verhalten byte-identisch zu vorher).
   * Bei `!== 'none'` wird Reasoning angefordert (`reasoning.effort`) und der
   * inline-`<think>`-Block aus dem Content getrennt (`extractThinking`). Der
   * Streaming-Pfad wird dadurch NICHT mehr ausgelöst — dafür braucht es einen
   * Delta-Consumer (`onContentDelta`/`onThinkingDelta`, s. u.).
   */
  thinkingBudget?: ThinkingBudget;
  /**
   * Live-Streaming-Callbacks für die UI-Vorschau („mitlesen, während das LLM
   * arbeitet"). Ist mind. einer gesetzt UND der Transport kann streamen, fährt
   * der Runner den Streaming-Pfad und meldet Antwort- bzw. Reasoning-Deltas
   * inkrementell. Das Endergebnis (`raw`/`thinking`) ist identisch zum
   * Nicht-Streaming-Pfad.
   */
  onContentDelta?: (text: string) => void;
  onThinkingDelta?: (text: string) => void;
  /**
   * Nur Streamlit-Bridge: Abschluss-Marker für die Bridge-Finalisierung. Die Bridge
   * finalisiert die Antwort NICHT auf dem kurzen Idle-Fenster, solange sie diesen Text
   * nicht enthält — verhindert, dass ein langer, zweiteiliger Lauf (großer erster
   * Abschnitt, Pause, dann Schluss-Abschnitt) vor dem Schluss abgeschnitten wird. Nur
   * der Gutachten-Abschnitts-Pfad setzt ihn (`'Finaler Text'`); sonst No-op. Auf
   * Nicht-Streamlit-Transporten wirkungslos (Option wird ignoriert).
   */
  erwarteAbschluss?: string;
  signal?: AbortSignal;
}

export interface SkillRunResult {
  raw: string;
  parsed: ParsedSkillOutput;
  /** True, wenn die VB für den Prompt gekürzt wurde (im UI vermerken). */
  vbGekuerzt: boolean;
  /** Erfasster Reasoning-/Thinking-Text, falls das Modell welchen lieferte. */
  thinking?: string;
  /**
   * Nur gesetzt, wenn ein Lektor-Zweitpass lief (`skill.lektorPromptTemplate`):
   * der `finalerText` VOR der Lektor-Überarbeitung. `parsed.finalerText` ist dann
   * das Lektor-Ergebnis. Erlaubt Eval/UI ein Vorher/Nachher.
   */
  entwurfVorLektor?: string;
  /**
   * Ergebnis des Chat-Resets VOR dem Lauf (Streamlit-Chat ist stateful, Pitfall
   * #36). `'nicht-gefunden'`/`'timeout'` = Reset nicht bestätigt → das UI markiert
   * den Lauf als möglicherweise verlaufskontaminiert; `'ok'` /
   * `'nicht-unterstuetzt'` (stateless-API-Transport) = unkritisch.
   */
  chatResetStatus?: ChatResetStatus;
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
 * Autoritativer Override-Block für die strukturierte Ausgabe des `### Finaler
 * Text`-Blocks. Deklariert dem Modell GENAU die erlaubten Keys (Reihenfolge +
 * Inhalt aus `teilStruktur`); der Parser verwirft alles, was nicht passt. Die
 * Labels sind reine Inhalts-Hinweise — sie landen nie im JSON-`text` (das Badge
 * ist render-only).
 */
function buildTeilStrukturInstruktion(teile: TeilDeklaration[]): string {
  const beispiel = teile.map(t => `{"key":"${t.key}","text":"…"}`).join(', ');
  const mapping = teile.map(t => `- \`${t.key}\`: ${t.label}`).join('\n');
  return [
    '## Ausgabe des „Finaler Text"-Blocks (strukturiert)',
    'Gib im Abschnitt `### Finaler Text` NICHT direkt Fließtext aus, sondern AUSSCHLIESSLICH '
      + 'ein JSON-Array mit GENAU diesen Schlüsseln — in dieser Reihenfolge, NUR diese Schlüssel, '
      + 'jeder `text` als zusammenhängender Fließtext (kein Markdown, keine Aufzählungszeichen, '
      + 'keine Überschriften, kein Label im Text):',
    `[${beispiel}]`,
    'Schlüssel → Inhalt des jeweiligen `text`:',
    mapping,
    'Die Abschnitte `### Quellenanalyse` und (falls vorhanden) `### Entwurf` bleiben unverändert Fließtext.',
  ].join('\n');
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
  // LLM-QS-Slots — No-op, wenn die Platzhalter im Template fehlen (alle Bestands-
  // Skills bleiben byte-identisch; nur der `qs-basis`-Skill nutzt sie).
  content = fillSlot(content, 'zielText', input.zielText ?? '');
  content = fillSlot(content, 'abschnittszweck', input.abschnittszweck ?? '');
  // Relevanz-Map-Slot — No-op, wenn der Platzhalter fehlt (Seed-Templates nutzen
  // {{vbMarkdown}}; auf {{vbRelevant}} umzustellen ist eine spätere Kurator-Entscheidung).
  content = fillSlot(content, 'vbRelevant', input.vbRelevant ?? '');
  // NF-Slots — No-op, wenn die Platzhalter fehlen (nur der NF-Skill nutzt sie;
  // alle Bestands-Skills bleiben byte-identisch).
  content = fillSlot(content, 'nfBausteine', input.nfBausteine ?? '');
  content = fillSlot(content, 'tvKontext', input.tvKontext ?? '');
  content = fillSlot(content, 'verbundKontext', input.verbundKontext ?? '');
  if (input.tweak?.aktiv) {
    const tweakBlock = buildTweakBlock(input.tweak.stilHinweise, input.tweak.beispielFormulierungen);
    if (tweakBlock) content += `\n\n${tweakBlock}`;
  }
  const vorgaben = buildPromptVorgaben(regeln);
  if (vorgaben) content += `\n\n${vorgaben}`;
  // Opt-in: strukturierte Ausgabe des „Finaler Text"-Blocks (additiv, nur bei
  // teilStruktur). Autoritativer Override-Block NACH den formalen Vorgaben — die
  // Prosa-Instruktion im Template bleibt für Quellenanalyse/Entwurf gültig, der
  // Finaler-Text-Block wird hier auf JSON umgelenkt. Ohne teilStruktur: No-op
  // (Ausgabe byte-identisch zum heutigen Lauf).
  if (skill.teilStruktur && skill.teilStruktur.length > 0) {
    content += `\n\n${buildTeilStrukturInstruktion(skill.teilStruktur)}`;
  }
  if (input.vorherigerText) {
    content += `\n\n## Bisheriger finaler Text (zur Überarbeitung)\n${input.vorherigerText}`;
  }
  if (input.modifier) {
    const mod = skill.modifiers[input.modifier];
    if (mod) content += `\n\n## Zusätzliche Anweisung\n${mod}`;
  }
  // Regel-gebundene Zusatz-Anweisung (Journey-Paket 3) — unmittelbar NACH dem
  // Modifier-Block, klar als eigene Vorgabe markiert. Verschärft den Modifier mit
  // einer konkreten Korrektur-Vorgabe (Zielwert/Ist-Wert). No-op ohne Wert.
  if (input.zusatzAnweisung && input.zusatzAnweisung.trim()) {
    content += `\n\nZusätzliche Vorgabe: ${input.zusatzAnweisung.trim()}`;
  }
  return content;
}

export async function runSkill(
  transport: AITransport,
  skill: SkillRecord,
  regeln: QualitaetsRegel[],
  input: SkillRunInput,
): Promise<SkillRunResult> {
  // Assistent-Protokoll (fire-and-forget, gated): Start/Ende des Skill-Laufs.
  // Der eigentliche Runner (runSkillInner) bleibt unangetastet — nur Telemetrie
  // umhüllt ihn. Abbruch (User-Stop, AbortError) ist kein Fehlschlag.
  void protokolliereEreignis({
    typ: 'skill_gestartet',
    entitaet: { art: 'skill', id: skill.id },
    detail: { skillId: skill.id },
  });
  try {
    const ergebnis = await runSkillInner(transport, skill, regeln, input);
    void protokolliereEreignis({
      typ: 'skill_abgeschlossen',
      entitaet: { art: 'skill', id: skill.id },
      detail: { skillId: skill.id, erfolg: true },
    });
    return ergebnis;
  } catch (e) {
    if ((e as Error)?.name !== 'AbortError') {
      void protokolliereEreignis({
        typ: 'skill_abgeschlossen',
        entitaet: { art: 'skill', id: skill.id },
        detail: { skillId: skill.id, erfolg: false },
      });
    }
    throw e;
  }
}

async function runSkillInner(
  transport: AITransport,
  skill: SkillRecord,
  regeln: QualitaetsRegel[],
  input: SkillRunInput,
): Promise<SkillRunResult> {
  const { text: vb, gekuerzt } = capVbMarkdown(input.vbMarkdown, input.vbCharCap);
  const userContent = composeSkillPrompt(skill, regeln, input, vb);
  const systemPrompt = skill.systemPrompt ?? '';
  const budget: ThinkingBudget = input.thinkingBudget ?? 'none';
  // Bei aktivem Thinking Platz für den Reasoning-Block aufschlagen, sonst frisst
  // er das gemeinsame max_tokens-Budget und die Antwort wird leer abgeschnitten.
  const maxTokens = (skill.maxTokens ?? DEFAULT_MAX_TOKENS) + (budget !== 'none' ? THINKING_OUTPUT_HEADROOM : 0);

  // Frischer Chat-Verlauf vor JEDEM Skill-Lauf: der Streamlit-Chat ist stateful,
  // stateless-Läufe würden sonst über den alten Verlauf kontaminieren (Kontext-
  // Überlauf / vermischte VBs, Pitfall #36). Best-effort — Fehlschlag bricht NIE
  // ab, wird aber über `chatResetStatus` ans UI markiert. Stateless-API-Transporte
  // (DirectLLM) haben kein `resetChat` → `'nicht-unterstuetzt'` (keine Warnung).
  const chatResetStatus = await starteFrischenChat(transport);

  let raw: string;
  let thinking: string | undefined;
  // Streamen NUR, wenn (a) der Transport es kann UND (b) jemand die Deltas
  // konsumiert (UI-Live-Vorschau zum Mitlesen). Thinking allein triggert KEIN
  // Streaming mehr: der Streaming-Loop (DirectLLM/llama.cpp) terminiert nur über
  // `[DONE]`/Verbindungsschluss und HAT KEINEN TIMEOUT — liefert der Server nach
  // Generierungsende kein erkanntes Abschluss-Signal, hängt das Promise ewig.
  // Nicht-interaktive Läufe (Anonymisieren, Glätten, NF, Eval, Batch, Testlauf)
  // haben keinen Delta-Consumer → sie fahren den robusten non-streaming-Pfad
  // (`submitConversation` → `res.json()`, gebundene Completion wie die
  // Auslastungs-Klassifizierung). Reasoning + `<think>`-Bereinigung bleiben
  // erhalten (Body sendet weiter `reasoning.effort`; `extractThinking` unten
  // greift bei `budget !== 'none'`).
  const wantsStream = typeof transport.streamConversation === 'function'
    && (!!input.onContentDelta || !!input.onThinkingDelta);
  if (typeof transport.submitConversation === 'function') {
    const messages: ConversationMessage[] = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt } as ConversationMessage] : []),
      { role: 'user', content: userContent },
    ];
    if (wantsStream && transport.streamConversation) {
      const r = await transport.streamConversation(messages, {
        onDelta: (t) => input.onContentDelta?.(t),
        onReasoningDelta: (t) => input.onThinkingDelta?.(t),
      }, {
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
    // `erwarteAbschluss` schützt lange, zweiteilige Antworten vor zu früher Bridge-
    // Finalisierung (Abschluss-Marker-Schutz); auf DirectLLM ignoriert.
    const streamlitOpts = {
      ...(input.signal ? { signal: input.signal } : {}),
      ...(input.erwarteAbschluss ? { erwarteAbschluss: input.erwarteAbschluss } : {}),
    };
    raw = await transport.submitMessage(
      systemPrompt ? `${systemPrompt}\n\n${userContent}` : userContent,
      systemPrompt || undefined,
      Object.keys(streamlitOpts).length > 0 ? streamlitOpts : undefined,
    );
  }

  // Fallback: Thinking war angefordert, kam aber (mangels Streaming) inline als
  // <think>…</think> im Content → abtrennen, damit es nicht im Fließtext landet.
  if (budget !== 'none' && !thinking) {
    const ext = extractThinking(raw);
    raw = ext.content;
    thinking = ext.thinking;
  }

  let parsed = parseSkillOutput(raw, skill.teilStruktur, skill.teilJoin);
  let entwurfVorLektor: string | undefined;
  // Optionaler Lektor-Zweitpass (opt-in): überarbeitet den finalen Entwurf rein
  // sprachlich/formal über DENSELBEN Transport (non-streaming), gleiches
  // maxTokens/budget-Schema. Der Lektor sieht NUR den Entwurf (Slot {{entwurf}}),
  // nicht den VB — kein erneutes Einspeisen von Dokumentinhalt.
  // Empty-Entwurf-Guard: bei leerem finalerText (z. B. Empty-Completion des
  // Inhalts-Calls) den Lektor überspringen — sonst macht er aus dem leeren
  // {{entwurf}} eine „Bitte fügen Sie den Entwurf ein"-Meldung im Gutachten.
  if (skill.lektorPromptTemplate?.trim() && parsed.finalerText.trim()) {
    entwurfVorLektor = parsed.finalerText;
    const lektorContent = fillSlot(skill.lektorPromptTemplate, 'entwurf', entwurfVorLektor);
    let lektorRaw: string;
    if (typeof transport.submitConversation === 'function') {
      lektorRaw = await transport.submitConversation(
        [{ role: 'user', content: lektorContent } as ConversationMessage],
        { maxTokens, thinkingBudget: budget, ...(input.signal ? { signal: input.signal } : {}) },
      );
    } else {
      lektorRaw = await transport.submitMessage(
        lektorContent,
        undefined,
        input.signal ? { signal: input.signal } : undefined,
      );
    }
    // Inline-<think> abtrennen (analog oben), falls non-streaming mit aktivem Budget.
    if (budget !== 'none') lektorRaw = extractThinking(lektorRaw).content;
    const lektorText = parseSkillOutput(lektorRaw).finalerText;
    // Leeres Lektor-Ergebnis (z. B. Truncation) → Entwurf behalten statt Leertext.
    // Der Lektor schreibt den (flachen) finalerText neu → strukturierte `teile`
    // würden divergieren (Invariante „finalerText = teile joined") → verwerfen.
    if (lektorText.trim()) parsed = { ...parsed, finalerText: lektorText, teile: undefined };
  }

  return {
    raw,
    parsed,
    vbGekuerzt: gekuerzt,
    chatResetStatus,
    ...(thinking ? { thinking } : {}),
    ...(entwurfVorLektor !== undefined ? { entwurfVorLektor } : {}),
  };
}

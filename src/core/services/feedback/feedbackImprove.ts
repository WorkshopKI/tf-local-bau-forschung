// Feedback-Verbesserung (geführt): formt Roh-Feedback via interne KI in einen
// zweistufigen Ablauf um — (1) 1–3 gezielte Rückfragen, (2) eine klare
// Feedback-Fassung PLUS umsetzbare Anforderung (Ist/Soll + Akzeptanzkriterien).
// Ersetzt den früheren Einschuss-Verbesserer + den Multi-Turn-Chatbot (beide
// zusammengeführt), siehe docs/architecture/feedback-system.md.
//
// DSGVO: Feedback-Text ist in Produktion Echt-Nutzertext → läuft AUSSCHLIESSLICH
// über die interne Bridge (Streamlit), nie OpenRouter — siehe
// docs/architecture/transport-policy.md. Kein getTransportForSkillRun-Umweg:
// Feedback ist kein Skill-Run im Registry-Sinn, das Gate hier ist die harte
// transport.name-Prüfung.
//
// ZWEI weitere harte Invarianten (v2.291):
//  1. IMMER der Standard-Tab (`FEEDBACK_ZIEL`) — nicht `aktivesZielFuerLauf()`. Die
//     globale KI-Variante gilt für Skill-/Chat-Läufe; hier geht es um einen engen,
//     einschüssigen JSON-Auftrag, bei dem der agentische Chat keinen Mehrwert bringt,
//     aber Minuten kostet und in seine eigene Loop-Erkennung laufen kann.
//  2. IMMER frischer Chat vor JEDEM Submit (auch vor dem Retry) — der Streamlit-Chat
//     ist stateful, sonst kontaminieren sich Rückfragen-, Verbesserungs- und
//     Retry-Lauf gegenseitig (Pitfall #36).
//
// WICHTIG (Transport-Bug-Klasse): StreamlitBridgeTransport.submitMessage
// IGNORIERT den systemPrompt-Arg (2. Param `_systemPrompt`, ungenutzt). Der
// System-Prompt MUSS in die Message inlined werden (Codebase-Konvention:
// run-skill.ts, suche/analyse/llm-client.ts, gutachten/relevanz-map.ts). Der
// 2. Arg bleibt gesetzt, damit DirectLLM-Transporte (Eval-CLI) ihn trotzdem
// als System-Rolle nutzen.

import { einZugRegel } from '@/core/services/ai/ein-schuss-lauf';
import type { AITransport, BridgeZiel, SubmitMessageOptions } from '@/core/services/ai/transports/streamlit';
import type { FeedbackCategory, FeedbackContext, LLMClassification } from '@/core/types/feedback';
import { FEEDBACK_TYPES, TEAMFLOW_AREAS } from '@/components/feedback/constants';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';
import { buildFeedbackSystemPrompt } from './feedbackLlm';
import { getAppOverview, getScreenContext } from './screenContext';

/** Interner Logik-Name des Bridge-Transports (Capability-/Domain-Gate). */
const INTERNE_KI = 'Streamlit';

/** Ziel-Tab für ALLE Feedback-Läufe — siehe Invariante 1 im Kopfkommentar. */
const FEEDBACK_ZIEL: BridgeZiel = 'standard';

export interface FeedbackImprovePayload {
  text: string;
  structured?: Record<string, string>;
  /** Deterministische Typ-Kategorie aus der Typ-Wahl — steuert die Rückfrage-Dimensionen. */
  category?: FeedbackCategory;
}

/** Eine beantwortete (ggf. übersprungene) Rückfrage aus Phase 1. */
export interface FeedbackQA {
  frage: string;
  antwort: string;
}

/** Ergebnis der Verbesserung: klarer Feedback-Text + strukturierte Anforderung. */
export interface GuidedImproveResult {
  /** Klar umformulierter Feedback-Text (Nutzer-Perspektive) — wird als `item.text` gespeichert. */
  verbesserterText: string;
  /** Strukturierte Anforderung (Ist/Soll + Kriterien) — wird in `llm_classification` gespeichert. */
  classification: LLMClassification;
}

/** Platzhalter-Template für den Automatisch-erfasster-Kontext-Block. */
const KONTEXT_TEMPLATE = `AUTOMATISCH ERFASSTER KONTEXT:
- Seite: {{PAGE}} ({{ROUTE}})
- Gerät: {{DEVICE}} ({{VIEWPORT}})
- Letzte Aktion: {{LAST_ACTION}}
- Session-Dauer: {{SESSION_MINUTES}} Minuten
- Fehler: {{ERRORS}}`;

/**
 * Single-Turn-Call, der auf JEDEM Transport funktioniert: der System-Prompt wird
 * in die Message inlined (Streamlit verwirft sonst den 2. Arg), bleibt aber als
 * 2. Arg für DirectLLM erhalten.
 *
 * Setzt VOR dem Submit einen frischen Chat auf demselben Tab (Invariante 2) und
 * pinnt das `ziel` auf den Standard-Tab (Invariante 1). `thinkingBudget` wirkt nur
 * auf DirectLLM (Eval-CLI) — die Bridge sendet ausschliesslich message/ziel/erwarte.
 */
async function submitInline(
  transport: AITransport,
  systemPrompt: string,
  userPrompt: string,
  options?: SubmitMessageOptions,
): Promise<string> {
  await starteFrischenChat(transport, FEEDBACK_ZIEL);
  return transport.submitMessage(`${systemPrompt}\n\n${userPrompt}`, systemPrompt, {
    ...options,
    ziel: FEEDBACK_ZIEL,
  });
}

/** Baut die geteilten Kontext-Bausteine (App-Overview + Bildschirmseiten-Doc + erfasster Kontext). */
function buildKontextBloecke(
  context: FeedbackContext,
  pluginId: string,
): { overview: string; screenDoc: string | null; kontextBlock: string } {
  return {
    overview: getAppOverview(),
    screenDoc: getScreenContext(pluginId),
    kontextBlock: buildFeedbackSystemPrompt(KONTEXT_TEMPLATE, context),
  };
}

/** Baut den User-Prompt (Feedback-Text + optionaler Bereich + optionale Rückfrage-Antworten). */
function buildUserPrompt(payload: FeedbackImprovePayload, context: FeedbackContext, answers?: FeedbackQA[]): string {
  let s = `Feedback-Text:\n"""\n${payload.text}\n"""`;
  if (context.screenRefLabel) s += `\nGewählter Bereich: ${context.screenRefLabel}`;
  const beantwortet = (answers ?? []).filter(qa => qa.antwort.trim().length > 0);
  if (beantwortet.length > 0) {
    s += `\n\nRückfragen & Antworten des Nutzers:\n${beantwortet
      .map(qa => `- ${qa.frage}\n  → ${qa.antwort.trim()}`)
      .join('\n')}`;
  }
  return s;
}

/**
 * Regel, die JEDER Prompt hier trägt: die Bridge ist einschüssig, und der
 * agentische Chat (falls die KI-Oberfläche keine Tab-Leiste hat und `ziel` ins
 * Leere greift) neigt sonst zu mehrstufigen Plan-/Werkzeug-Schleifen, die Minuten
 * kosten und in seiner Wiederholungs-Erkennung enden.
 */
const EIN_ZUG_REGEL = einZugRegel('der JSON-Block');

/** Typ-Definition zur deterministisch feststehenden Kategorie (aus der Typ-Wahl). */
function typDef(category?: FeedbackCategory): (typeof FEEDBACK_TYPES)[number] | undefined {
  return category ? FEEDBACK_TYPES.find(t => t.category === category) : undefined;
}

/**
 * Braucht dieses Feedback überhaupt KI-Rückfragen? Rein deterministisch — ein
 * LLM-Lauf, der garantiert nichts zu fragen hat, kostet den Nutzer nur Wartezeit
 * (und lieferte in der Praxis statt `{fragen:[]}` gern Prosa, die still verworfen
 * wurde). `false`, wenn der Typ nur ein Feld hat (Lob/Frage) oder alle nicht-
 * optionalen Felder befüllt sind. Ohne bekannten Typ: `true` (altes Verhalten).
 */
export function brauchtRueckfragen(payload: FeedbackImprovePayload): boolean {
  const def = typDef(payload.category);
  if (!def) return true;
  if (def.fields.length <= 1) return false;
  return def.fields.some(f => !f.optional && !(payload.structured?.[f.key] ?? '').trim());
}

/** Extrahiert das erste balancierte JSON-Objekt (tolerant gegen Fences/Prosa drumherum). */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return raw.slice(start, end + 1);
}

// ── Phase 1: Rückfragen ──────────────────────────────────────────────────────

/**
 * Baut System- + User-Prompt für die Rückfragen-Phase. `pluginId` steuert das
 * Bildschirmseiten-Kontext-Doc; `payload.category` steuert die aus `FEEDBACK_TYPES`
 * abgeleiteten Rückfrage-Dimensionen ("welche Fragen man stellen kann").
 */
export function buildClarifyPrompt(
  payload: FeedbackImprovePayload,
  context: FeedbackContext,
  pluginId: string,
): { systemPrompt: string; userPrompt: string } {
  const { overview, screenDoc, kontextBlock } = buildKontextBloecke(context, pluginId);
  const def = typDef(payload.category);
  const dimensionen = def
    ? def.fields
        .map(f => `- ${f.label}${(payload.structured?.[f.key] ?? '').trim() ? ' (bereits beantwortet)' : ' (offen)'}`)
        .join('\n')
    : '';

  // Bewusst OHNE Kategorie-Abgrenzung: diese Phase gibt keine Kategorie aus (die
  // steht aus der Typ-Wahl fest) — der Block wäre nur Ballast und lüde das Modell
  // zum Klassifizieren statt zum Fragen ein.
  const systemPrompt = `Du hilfst, gerade abgeschicktes Nutzer-Feedback zur App TeamFlow Local zu schärfen, bevor es ein Coding-Agent (Claude Code) umsetzt.

${overview}
${screenDoc ? `\n${screenDoc}\n` : ''}
${kontextBlock}
${def ? `\nFEEDBACK-TYP (steht fest, nicht hinterfragen): ${def.label}\n` : ''}${dimensionen ? `\nRELEVANTE DIMENSIONEN für diesen Feedback-Typ:\n${dimensionen}\n` : ''}
AUFGABE: Stelle 1–3 kurze, gezielte Rückfragen zu den für die Umsetzung WICHTIGSTEN noch fehlenden Informationen.

REGELN:
- Frage NUR zu Dingen, die für die Umsetzung fehlen oder unklar sind — niemals nach bereits Beantwortetem.
- Max. 3 Fragen, jede ein einzelner konkreter deutscher Satz.
- Bleibe strikt beim Thema des Feedbacks — erfinde keinen zusätzlichen Scope.
- Ist das Feedback bereits klar genug, gib ein leeres Array zurück.
- ${EIN_ZUG_REGEL}

Antworte NUR mit einem \`\`\`json-Block, keine weiteren Sätze:

\`\`\`json
{ "fragen": ["…"] }
\`\`\``;

  return { systemPrompt, userPrompt: buildUserPrompt(payload, context) };
}

/** Parst `{ "fragen": [...] }` tolerant; max. 3 nichtleere Strings, sonst `[]`. */
function parseFragen(raw: string): string[] {
  const body = extractJsonObject(raw);
  if (!body) return [];
  try {
    const parsed = JSON.parse(body) as { fragen?: unknown };
    const fragen = Array.isArray(parsed.fragen) ? parsed.fragen : [];
    return fragen
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .map(f => f.trim())
      .slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * Phase 1: lässt die interne KI 0–3 gezielte Rückfragen stellen. Intern-only
 * (bei jedem anderen Transport `[]`), tolerant, wirft nie — bei Fehler `[]`
 * (der Aufrufer überspringt dann die Rückfragen und geht direkt zur Verbesserung).
 *
 * Hat das Formular gar keine Lücke (`brauchtRueckfragen`), entfällt der Aufruf
 * komplett — der Nutzer wartet dann nur EINEN statt zwei LLM-Läufe.
 */
export async function askClarifyingQuestions(
  transport: AITransport,
  payload: FeedbackImprovePayload,
  context: FeedbackContext,
  pluginId: string,
): Promise<string[]> {
  if (typeof transport.submitMessage !== 'function') return [];
  if (transport.name !== INTERNE_KI) return [];
  if (!brauchtRueckfragen(payload)) return [];

  const { systemPrompt, userPrompt } = buildClarifyPrompt(payload, context, pluginId);
  try {
    const raw = await submitInline(transport, systemPrompt, userPrompt, { thinkingBudget: 'low' });
    return parseFragen(raw);
  } catch (err) {
    console.warn('[askClarifyingQuestions] LLM call failed:', err);
    return [];
  }
}

// ── Phase 2: Verbesserung ────────────────────────────────────────────────────

/**
 * Baut System- + User-Prompt für die Verbesserungs-Phase (klare Feedback-Fassung
 * PLUS Anforderung Ist/Soll + Kriterien). `answers` sind die Rückfrage-Antworten
 * aus Phase 1 (können leer sein → einstufige Verbesserung).
 */
export function buildGuidedImprovePrompt(
  payload: FeedbackImprovePayload,
  answers: FeedbackQA[],
  context: FeedbackContext,
  pluginId: string,
): { systemPrompt: string; userPrompt: string } {
  const { overview, screenDoc, kontextBlock } = buildKontextBloecke(context, pluginId);
  const areaRefs = TEAMFLOW_AREAS.map(a => a.ref).join(', ');
  // Kategorie ist aus der Typ-Wahl deterministisch gesetzt (FeedbackPanel) → sie wird
  // VORGEGEBEN, nicht erfragt. Damit entfällt die komplette Kategorie-Abgrenzung im
  // Prompt, und das Modell kann die Nutzer-Wahl nicht überstimmen (Parität zum
  // Nicht-Verbessern-Pfad, wo autoClassifyFeedback sie ebenfalls nicht überschreibt).
  const festeKategorie = typDef(payload.category)?.llmHint;

  const systemPrompt = `Du verfeinerst Nutzer-Feedback zur App TeamFlow Local zu (1) einer klaren, vollständigen Feedback-Fassung UND (2) einem Arbeitsauftrag, den ein Coding-Agent (Claude Code) direkt umsetzen kann.

${overview}
${screenDoc ? `\n${screenDoc}\n` : ''}
${kontextBlock}

REGELN:
- Bleibe der Intention des Nutzers treu — erfinde KEINEN zusätzlichen Scope über das Feedback (inkl. seiner Rückfrage-Antworten) hinaus.
- "verbesserterText": das Feedback klar und vollständig umformuliert, in der Perspektive des Nutzers ("Ich…"), 2–5 Sätze, deutsch. Beziehe die Rückfrage-Antworten ein. KEINE Meta-Kommentare, kein "Der Nutzer…".
- Fehlt trotz Rückfragen eine wichtige Information, benenne sie in "details" als offene Frage statt zu raten.
- "affectedArea" NUR aus dieser Liste wählen: ${areaRefs}.
- "relevant_files" nur nennen, wenn aus dem Code-Kontext oben klar ableitbar — sonst leeres Array.
${festeKategorie ? `- "category" steht aus der Typ-Wahl des Nutzers fest: "${festeKategorie}". Übernimm sie unverändert, klassifiziere nicht neu.\n` : ''}- ${EIN_ZUG_REGEL}

Antworte NUR mit einem \`\`\`json-Block, keine weiteren Sätze, keine Erklärungen:

\`\`\`json
{
  "verbesserterText": "Feedback klar umformuliert, 2-5 Sätze, Ich-Perspektive",
  "category": "${festeKategorie ?? 'bug | feature | praise | question'}",
  "summary": "1-2 Sätze Zusammenfassung",
  "details": "Ausführliche Beschreibung, ggf. offene Fragen",
  "anforderung": "IST: <aktueller Zustand> SOLL: <gewünschter Zustand>",
  "akzeptanzkriterien": ["Kriterium 1", "Kriterium 2", "max. 5 Kriterien"],
  "affectedArea": "einer der oben genannten Bereiche",
  "priority_suggestion": 3,
  "relevant_files": ["src/plugins/..."]
}
\`\`\``;

  return { systemPrompt, userPrompt: buildUserPrompt(payload, context, answers) };
}

/**
 * Parst die Verbesserungs-Antwort tolerant (kein Verlass auf ```json-Fence).
 * `festeKategorie` (aus der Typ-Wahl) gewinnt IMMER gegen den Modell-Vorschlag;
 * ohne sie (kein Typ bekannt) gilt weiter der Modell-Wert.
 */
function parseGuidedImprove(
  raw: string,
  fallbackText: string,
  festeKategorie?: LLMClassification['category'],
): GuidedImproveResult | null {
  const body = extractJsonObject(raw);
  if (!body) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof parsed.category !== 'string' || typeof parsed.summary !== 'string') return null;

  const classification: LLMClassification = {
    category: festeKategorie ?? (parsed.category as LLMClassification['category']),
    summary: parsed.summary,
    details: typeof parsed.details === 'string' ? parsed.details : '',
    affectedArea: typeof parsed.affectedArea === 'string' ? parsed.affectedArea : '',
    priority_suggestion: typeof parsed.priority_suggestion === 'number' ? parsed.priority_suggestion : 3,
    relevant_files: Array.isArray(parsed.relevant_files) ? (parsed.relevant_files as string[]) : undefined,
    anforderung: typeof parsed.anforderung === 'string' ? parsed.anforderung : undefined,
    akzeptanzkriterien: Array.isArray(parsed.akzeptanzkriterien) ? (parsed.akzeptanzkriterien as string[]) : undefined,
    verbessert: true,
  };
  const vt = typeof parsed.verbesserterText === 'string' ? parsed.verbesserterText.trim() : '';
  return { verbesserterText: vt || classification.summary.trim() || fallbackText, classification };
}

/**
 * Phase 2: verfeinert das Feedback (mit den Rückfrage-Antworten) via interne KI
 * zu `{ verbesserterText, classification }`. Intern-only (sonst `null`), ein
 * Retry mit verschärfter Formatanweisung, wirft nie — Fehler → `console.warn`
 * + `null`. `verbesserterText` fällt auf Zusammenfassung bzw. Roh-Text zurück.
 */
export async function improveFeedbackGuided(
  transport: AITransport,
  payload: FeedbackImprovePayload,
  answers: FeedbackQA[],
  context: FeedbackContext,
  pluginId: string,
): Promise<GuidedImproveResult | null> {
  if (typeof transport.submitMessage !== 'function') return null;
  if (transport.name !== INTERNE_KI) return null;

  const { systemPrompt, userPrompt } = buildGuidedImprovePrompt(payload, answers, context, pluginId);
  const festeKategorie = typDef(payload.category)?.llmHint;
  try {
    const raw = await submitInline(transport, systemPrompt, userPrompt, { thinkingBudget: 'low' });
    const parsed = parseGuidedImprove(raw, payload.text, festeKategorie);
    if (parsed) return parsed;

    // Der Retry ist ein EIGENER Lauf mit eigenem Chat-Reset (submitInline), damit die
    // kaputte erste Antwort nicht im Streamlit-Verlauf steht (Pitfall #36).
    const retrySystem = `${systemPrompt}\n\nAntworte NUR mit dem \`\`\`json-Block, ohne weitere Sätze.`;
    const retryRaw = await submitInline(transport, retrySystem, userPrompt, { thinkingBudget: 'low' });
    return parseGuidedImprove(retryRaw, payload.text, festeKategorie);
  } catch (err) {
    console.warn('[improveFeedbackGuided] LLM call failed:', err);
    return null;
  }
}

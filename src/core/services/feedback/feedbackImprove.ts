// Feedback-Verbesserung: formt Roh-Feedback via interne KI in eine umsetzbare
// Anforderung für Claude Code um (Ist/Soll, Akzeptanzkriterien). Eigene Datei
// getrennt von feedbackLlm.ts (andere Verantwortung: dort Auto-Klassifikation +
// Chatbot-Prompts, hier die explizite Nutzer-Verbesserung).
//
// DSGVO: Feedback-Text ist in Produktion Echt-Nutzertext → läuft AUSSCHLIESSLICH
// über die interne Bridge (Streamlit), nie OpenRouter — siehe
// docs/architecture/transport-policy.md. Bewusst umgekehrte Transport-Polarität
// zu autoClassifyFeedback (die läuft NIE auf Streamlit, s. feedbackLlm.ts).
// Kein getTransportForSkillRun-Umweg: Feedback ist kein Skill-Run im
// Registry-Sinn, das Gate hier ist die harte transport.name-Prüfung unten.

import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { FeedbackContext, LLMClassification } from '@/core/types/feedback';
import { TEAMFLOW_AREAS } from '@/components/feedback/constants';
import { buildFeedbackSystemPrompt, buildKategorieAbgrenzung, parseFeedbackSummary } from './feedbackLlm';
import { getAppOverview, getScreenContext } from './screenContext';

export interface FeedbackImprovePayload {
  text: string;
  structured?: Record<string, string>;
}

/** Platzhalter-Template für den Automatisch-erfasster-Kontext-Block — Substitution über buildFeedbackSystemPrompt. */
const KONTEXT_TEMPLATE = `AUTOMATISCH ERFASSTER KONTEXT:
- Seite: {{PAGE}} ({{ROUTE}})
- Gerät: {{DEVICE}} ({{VIEWPORT}})
- Letzte Aktion: {{LAST_ACTION}}
- Session-Dauer: {{SESSION_MINUTES}} Minuten
- Fehler: {{ERRORS}}`;

/**
 * Baut System- + User-Prompt für die Feedback-Verbesserung. `pluginId` steuert,
 * welches Bildschirmseiten-Kontext-Doc (docs/feedback-kontext/) beigelegt wird —
 * fehlt ein Doc, fällt der Prompt implizit auf den reinen App-Overview zurück.
 */
export function buildFeedbackImprovePrompt(
  payload: FeedbackImprovePayload,
  context: FeedbackContext,
  pluginId: string,
): { systemPrompt: string; userPrompt: string } {
  const overview = getAppOverview();
  const screenDoc = getScreenContext(pluginId);
  const kontextBlock = buildFeedbackSystemPrompt(KONTEXT_TEMPLATE, context);
  const areaRefs = TEAMFLOW_AREAS.map(a => a.ref).join(', ');

  const systemPrompt = `Du verfeinerst Nutzer-Feedback zur App TeamFlow Local zu einem Arbeitsauftrag, den ein Coding-Agent (Claude Code) direkt umsetzen kann.

${overview}
${screenDoc ? `\n${screenDoc}\n` : ''}
${kontextBlock}

${buildKategorieAbgrenzung()}

REGELN:
- Bleibe der Intention des Nutzers treu — erfinde KEINEN zusätzlichen Scope über das Feedback hinaus.
- Fehlt eine für die Umsetzung wichtige Information, formuliere sie als offene Frage in "details" statt zu raten.
- "affectedArea" NUR aus dieser Liste wählen: ${areaRefs}.
- "relevant_files" nur nennen, wenn aus dem Code-Kontext oben klar ableitbar — sonst leeres Array.

Antworte NUR mit einem \`\`\`json-Block, keine weiteren Sätze, keine Erklärungen:

\`\`\`json
{
  "category": "bug | feature | ux | praise | question",
  "summary": "1-2 Sätze Zusammenfassung",
  "details": "Ausführliche Beschreibung, ggf. offene Fragen",
  "anforderung": "IST: <aktueller Zustand> SOLL: <gewünschter Zustand>",
  "akzeptanzkriterien": ["Kriterium 1", "Kriterium 2", "max. 5 Kriterien"],
  "affectedArea": "einer der oben genannten Bereiche",
  "priority_suggestion": 3,
  "relevant_files": ["src/plugins/..."]
}
\`\`\``;

  const userPrompt = `Feedback-Text:\n"""\n${payload.text}\n"""${
    context.screenRefLabel ? `\nGewählter Bereich: ${context.screenRefLabel}` : ''
  }`;

  return { systemPrompt, userPrompt };
}

/**
 * Verfeinert Roh-Feedback via interne KI zu einer umsetzbaren Anforderung.
 * Läuft AUSSCHLIESSLICH über den internen Streamlit-Transport (DSGVO — s.o.),
 * bei jedem anderen Transport sofort `null`, KEIN OpenRouter-Fallback (auch
 * nicht in dev). Wirft nie — Fehler landen als `console.warn` + `null`.
 */
export async function improveFeedback(
  transport: AITransport,
  payload: FeedbackImprovePayload,
  context: FeedbackContext,
  pluginId: string,
): Promise<LLMClassification | null> {
  if (typeof transport.submitMessage !== 'function') return null;
  if (transport.name !== 'Streamlit') return null;

  const { systemPrompt, userPrompt } = buildFeedbackImprovePrompt(payload, context, pluginId);

  try {
    const raw = await transport.submitMessage(userPrompt, systemPrompt, { thinkingBudget: 'low' });
    const parsed = parseFeedbackSummary(raw);
    if (parsed) return { ...parsed, verbessert: true };

    // Ein Retry mit verschärfter Formatanweisung, bevor wir aufgeben.
    const retryRaw = await transport.submitMessage(
      userPrompt,
      `${systemPrompt}\n\nAntworte NUR mit dem \`\`\`json-Block, ohne weitere Sätze.`,
      { thinkingBudget: 'low' },
    );
    const retryParsed = parseFeedbackSummary(retryRaw);
    return retryParsed ? { ...retryParsed, verbessert: true } : null;
  } catch (err) {
    console.warn('[improveFeedback] LLM call failed:', err);
    return null;
  }
}

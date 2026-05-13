import { complete } from "./completionService";
import { DEFAULT_MODEL } from "@/lib/constants";
import { getActiveConstraints } from "@/services/constraintService";
import type { Msg } from "@/types";

export interface ConstraintCheckResult {
  constraintId: string;
  constraintTitle: string;
  met: boolean;
  explanation: string;
}

const SYSTEM_PROMPT = `Du bist ein KI-Kompetenz-Tutor. Der Benutzer übt, KI-Prompts zu verbessern und KI-Outputs kritisch zu bewerten.
Bewerte den verbesserten Prompt auf einer Skala von 0-100:
- Kontext und Hintergrund (25%)
- Spezifität und Klarheit (25%)
- Einschränkungen und Format (25%)
- Gesamtqualität (25%)

Antworte NUR mit einem JSON-Objekt (kein Markdown, kein Preamble):
{"score": <0-100>, "feedback": "<2-3 Sätze Feedback auf Deutsch>", "strengths": ["..."], "improvements": ["..."]}`;

interface EvalResult {
  score: number;
  feedback: string;
  strengths?: string[];
  improvements?: string[];
}

export async function evaluatePromptDirect(
  userPrompt: string,
  badPrompt: string,
  context?: string,
  model?: string,
): Promise<EvalResult> {
  const messages: Msg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Originaler schlechter Prompt: "${badPrompt}"\n${context ? `Kontext: ${context}\n` : ""}Verbesserter Prompt: "${userPrompt}"\n\nBewerte jetzt.`,
    },
  ];

  const text = await complete({
    messages,
    model: model || DEFAULT_MODEL,
    temperature: 0.3,
  });

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { score: 50, feedback: text.slice(0, 300) };
  }
}

// ═══ Constraint-Check ═══

const CONSTRAINT_CHECK_PROMPT = `Du bist ein KI-Qualitätsprüfer. Prüfe den folgenden KI-Output gegen die domänenspezifischen Qualitätsregeln des Nutzers.

Qualitätsregeln:
{CONSTRAINTS}

Antworte NUR mit einem JSON-Array (kein Markdown, kein Preamble):
[
  {
    "constraintId": "ID der Regel",
    "constraintTitle": "Titel der Regel",
    "met": true/false,
    "explanation": "Kurze Begründung auf Deutsch (1 Satz)"
  }
]`;

export async function evaluateWithConstraints(
  output: string,
  model?: string,
): Promise<ConstraintCheckResult[]> {
  const constraints = getActiveConstraints();
  if (constraints.length === 0) return [];

  const constraintList = constraints.map(c =>
    `- ID: ${c.id} | Titel: "${c.title}" | Regel: "${c.rule}"`
  ).join("\n");

  const systemPrompt = CONSTRAINT_CHECK_PROMPT.replace("{CONSTRAINTS}", constraintList);

  const messages: Msg[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Prüfe diesen KI-Output:\n\n"${output.slice(0, 2000)}"` },
  ];

  const text = await complete({
    messages,
    model: model || DEFAULT_MODEL,
    temperature: 0.2,
  });

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return [];
  }
}

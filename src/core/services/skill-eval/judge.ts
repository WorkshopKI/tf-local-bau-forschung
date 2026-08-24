/**
 * LLM-Judge: bewertet einen generierten Abschnitt gegen seine Vorhabens-
 * beschreibung + Regeln und liefert Subscores (1–5) plus konkrete Prompt-
 * Verbesserungsvorschläge.
 *
 * Der Judge ist OPTIONAL (teuer). Er läuft nur, wenn eine Judge-Modell-Config
 * gegeben ist; sonst `--no-judge`. Weil die Fixtures fiktiv sind, DARF der Judge
 * extern (OpenRouter) laufen.
 *
 * Robustheit ist hier zentral: LLM-JSON ist nie verlässlich. `parseJudgeResult`
 * WIRFT NIE — fehlende Felder → `null`, unlesbare Ausgabe → `{ fehler: true }`.
 * `response_format: json_object` greift bei OpenRouter, NICHT bei llama.cpp →
 * wir verlassen uns nicht darauf, sondern parsen tolerant.
 */
import { buildPromptVorgaben, type QualitaetsRegel } from '@/core/services/skills';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { JudgeScores } from './types';

/**
 * VB-Kürzung im Judge-Prompt.
 *
 * Der frühere Wert 12.000 war eine reine Kostenbremse — und er machte
 * `fachliche_korrektheit` unbrauchbar: echte VBs sind 100.000–120.000 Zeichen lang, der
 * Judge sah also 10–12 %. Kennzahlen, die das Modell korrekt aus Kapitel 9 übernommen
 * hatte, standen hinter dem Schnitt und wurden als „nicht belegt" abgewertet (gemessen
 * 08/2026: „98 % Druckgenauigkeit" steht bei Zeichen 103.507). Der Judge bestrafte damit
 * richtige Arbeit, und die Note war nach oben gedeckelt.
 *
 * Default deckt jetzt den echten Bestand ab; `--judge-vb-cap` senkt ihn für billige
 * Durchläufe. Wird tatsächlich gekürzt, sagt der Prompt das ausdrücklich (`capVb`) —
 * sonst liest der Judge „steht nicht in meinem Auszug" als „ist erfunden".
 */
export const JUDGE_VB_CAP_DEFAULT = 120000;

export const JUDGE_SYSTEM_PROMPT =
  'Du bist ein strenger, erfahrener ZIM-Gutachten-Bewerter. Du bewertest einen ' +
  'von einer KI erzeugten Gutachten-Abschnitt gegen die Vorhabensbeschreibung ' +
  'und die formalen Vorgaben. Antworte AUSSCHLIESSLICH mit EINEM JSON-Objekt — ' +
  'kein Markdown, keine Backticks, keine Erklärung außerhalb des JSON.';

export interface JudgeArgs {
  /** Vorhabensbeschreibung (Markdown) — Grundlage der fachlichen Bewertung. */
  vb: string;
  /** Der zu bewertende finale Text des Abschnitts. */
  finalerText: string;
  /** Die Qualitätsregeln des Skills (für die `regeltreue`-Dimension). */
  regeln: QualitaetsRegel[];
  /** Kurzbeschreibung des Skills (was der Abschnitt leisten soll). */
  skillBeschreibung: string;
  /** VB-Kürzung im Prompt; fehlt → `JUDGE_VB_CAP_DEFAULT` (siehe dort, warum großzügig). */
  vbCap?: number;
}

/**
 * Kürzt die VB am letzten Absatzumbruch vor dem Cap — und sagt dem Judge, DASS gekürzt
 * wurde. Ohne diesen Satz liest er „steht nicht in meinem Text" als „ist erfunden" und
 * wertet korrekt übernommene Angaben aus den hinteren Kapiteln ab.
 */
function capVb(vb: string, cap: number): string {
  if (vb.length <= cap) return vb;
  const slice = vb.slice(0, cap);
  const lastBreak = slice.lastIndexOf('\n\n');
  const text = (lastBreak > cap * 0.5 ? slice.slice(0, lastBreak) : slice).trimEnd();
  const anteil = Math.round((text.length / vb.length) * 100);
  return `> HINWEIS: Dies ist ein AUSZUG (${anteil} % der VB, vorne beginnend) — der Rest ist gekürzt.\n`
    + `> Werte eine Angabe NICHT als erfunden, nur weil sie hier fehlt; sie kann hinter dem Schnitt stehen.\n`
    + `> Senke \`fachliche_korrektheit\` nur, wenn eine Aussage dem Auszug WIDERSPRICHT.\n\n${text}\n\n…`;
}

/** Baut den Judge-User-Prompt (das System-Prompt ist `JUDGE_SYSTEM_PROMPT`). */
export function buildJudgePrompt(
  vb: string,
  finalerText: string,
  regeln: QualitaetsRegel[],
  skillBeschreibung: string,
  vbCap: number = JUDGE_VB_CAP_DEFAULT,
): string {
  const vorgaben = buildPromptVorgaben(regeln);
  return [
    `# Aufgabe des Abschnitts\n${skillBeschreibung || '(keine Beschreibung)'}`,
    `# Formale Vorgaben\n${vorgaben || '(keine formalen Vorgaben hinterlegt)'}`,
    `# Vorhabensbeschreibung (Quelle der Wahrheit)\n${capVb(vb, vbCap)}`,
    `# Zu bewertender Abschnitt\n${finalerText}`,
    [
      '# Bewertung',
      'Bewerte den Abschnitt auf einer Skala von 1 (unbrauchbar) bis 5 (exzellent) ' +
        'in vier Dimensionen und antworte mit EXAKT diesem JSON-Objekt:',
      '{',
      '  "fachliche_korrektheit": <1-5, deckt sich der Inhalt mit der VB, keine Erfindungen?>,',
      '  "vollstaendigkeit": <1-5, sind die für den Abschnitt nötigen Aspekte abgedeckt?>,',
      '  "sprachqualitaet": <1-5, präzises, gutachterliches Deutsch?>,',
      '  "regeltreue": <1-5, sind die formalen Vorgaben eingehalten?>,',
      '  "begruendung": "<2-4 Sätze, die die Scores stützen>",',
      '  "prompt_verbesserung": "<konkreter Vorschlag, wie der Skill-Prompt das Ergebnis verbessern würde>"',
      '}',
    ].join('\n'),
  ].join('\n\n');
}

/** Strippt einen umschließenden ```json-Fence, falls vorhanden. */
function stripFence(s: string): string {
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence?.[1] ? fence[1].trim() : s;
}

/** Tolerantes JSON-Parsen: direkt, sonst das äußerste `{…}` aus Prosa ziehen. */
function tolerantJsonParse(raw: string): Record<string, unknown> | null {
  const cleaned = stripFence(raw.trim());
  try {
    const obj = JSON.parse(cleaned);
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : null;
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        const obj = JSON.parse(cleaned.slice(first, last + 1));
        return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Subscore 1–5 (geklemmt) oder `null`, wenn fehlend/kein endliche Zahl. */
function subscore(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  if (typeof v === 'number' && Number.isFinite(v)) return Math.min(5, Math.max(1, v));
  return null;
}

function optString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/**
 * Parst die rohe Judge-Antwort tolerant zu `JudgeScores`. WIRFT NIE: unlesbare
 * Ausgabe → alle Scores `null` + `fehler: true`.
 */
export function parseJudgeResult(raw: string): JudgeScores {
  const obj = tolerantJsonParse(raw);
  if (!obj) {
    return {
      fachliche_korrektheit: null,
      vollstaendigkeit: null,
      sprachqualitaet: null,
      regeltreue: null,
      begruendung: null,
      prompt_verbesserung: null,
      fehler: true,
    };
  }
  return {
    fachliche_korrektheit: subscore(obj, 'fachliche_korrektheit'),
    vollstaendigkeit: subscore(obj, 'vollstaendigkeit'),
    sprachqualitaet: subscore(obj, 'sprachqualitaet'),
    regeltreue: subscore(obj, 'regeltreue'),
    begruendung: optString(obj, 'begruendung'),
    prompt_verbesserung: optString(obj, 'prompt_verbesserung'),
  };
}

/**
 * Führt den Judge aus. Fängt Transport-Fehler (Netz/HTTP) → `fehler: true`, mit
 * der Meldung in `begruendung`, damit ein Judge-Ausfall den Lauf nicht killt.
 */
export async function runJudge(transport: AITransport, args: JudgeArgs): Promise<JudgeScores> {
  const prompt = buildJudgePrompt(args.vb, args.finalerText, args.regeln, args.skillBeschreibung, args.vbCap);
  try {
    const raw = await transport.submitMessage(prompt, JUDGE_SYSTEM_PROMPT, {
      responseFormat: { type: 'json_object' },
    });
    return parseJudgeResult(raw);
  } catch (err) {
    return {
      fachliche_korrektheit: null,
      vollstaendigkeit: null,
      sprachqualitaet: null,
      regeltreue: null,
      begruendung: `Judge-Transportfehler: ${err instanceof Error ? err.message : String(err)}`,
      prompt_verbesserung: null,
      fehler: true,
    };
  }
}

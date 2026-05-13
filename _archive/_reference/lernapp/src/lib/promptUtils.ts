import type { PromptItem } from "@/data/prompts";

/** Prüft ob ein Prompt zur gewählten Kategorie gehört. */
export function matchesCategory(prompt: PromptItem, category: string): boolean {
  if (category === "alle") return true;
  if (category === "bueroalltag") return prompt.level === "beruf" || prompt.type === "blueprint";
  if (category === "recherche") return prompt.level === "websuche";
  if (category === "deep-research") return prompt.level === "research";
  if (category === "mini-apps") return prompt.level === "miniapps";
  if (category === "privat") return prompt.level === "alltag";
  return true;
}

/** Extrahiert {{Platzhalter}} aus einem Prompt-Text. */
export function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(.+?)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

/**
 * Zerlegt einen Fließtext-Prompt heuristisch in ACTA-Felder.
 * Wird als Fallback genutzt, wenn ein PromptItem keine actaFields hat.
 */
export function splitPromptToACTA(promptText: string, _title?: string): {
  act: string;
  context: string;
  task: string;
  ausgabe: string;
  extensions?: {
    examples: string[];
    rules: string;
    reasoning: string;
    verification: boolean;
    verificationNote: string;
    reversePrompt: boolean;
    negatives: string;
  };
} {
  const sentences = promptText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return { act: "", context: "", task: promptText, ausgabe: "" };

  const formatKeywords = /struktur|format|länge|wörter|sätze|spalten|tabelle|absatz|bullet|sprache|sprachniveau|ton:|max\.|maximal|min\./i;
  const contextKeywords = /zielgruppe|hintergrund|kontext|thema|gendersensib|barrierefrei|bürger|keine.*daten|regeln?:|anforderung/i;
  const negativesKeywords = /nicht|kein(?:e|en|er)?|ohne|vermeide|NICHT|WICHTIG.*NICHT/i;

  const taskParts: string[] = [];
  const ausgabeParts: string[] = [];
  const contextParts: string[] = [];
  const negativesParts: string[] = [];

  sentences.forEach((s, i) => {
    if (i === 0) {
      taskParts.push(s);
    } else if (formatKeywords.test(s)) {
      ausgabeParts.push(s);
    } else if (contextKeywords.test(s)) {
      contextParts.push(s);
    } else if (negativesKeywords.test(s) && s.length < 100) {
      negativesParts.push(s);
    } else {
      taskParts.push(s);
    }
  });

  return {
    act: "",
    context: contextParts.join(" "),
    task: (taskParts.length > 0 ? taskParts : [sentences[0]]).join(" "),
    ausgabe: ausgabeParts.join(" "),
    extensions: negativesParts.length > 0 ? {
      examples: [],
      rules: "",
      reasoning: "",
      verification: false,
      verificationNote: "",
      reversePrompt: false,
      negatives: negativesParts.join(" "),
    } : undefined,
  };
}

/**
 * Template-Engine fuer die LLM-Prompts der Analyse-Pipeline.
 *
 * Die `.md`-Files unter `./prompts/` werden via Vite `?raw`-Import zur
 * Build-Zeit als Strings eingebunden. Variablen-Substitution per
 * `{{KEY}}`-Pattern.
 */
import queryUnderstandingTemplate from './prompts/query-understanding.md?raw';
import batchExtractionTemplate from './prompts/batch-extraction.md?raw';
import validationTemplate from './prompts/validation.md?raw';

export const PROMPT_TEMPLATES = {
  queryUnderstanding: queryUnderstandingTemplate,
  batchExtraction: batchExtractionTemplate,
  validation: validationTemplate,
} as const;

export type PromptTemplateKey = keyof typeof PROMPT_TEMPLATES;

/** Ersetzt `{{KEY}}`-Platzhalter im Template. Unbekannte Platzhalter bleiben
 *  stehen (sichtbar fuer Debugging). */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match;
  });
}

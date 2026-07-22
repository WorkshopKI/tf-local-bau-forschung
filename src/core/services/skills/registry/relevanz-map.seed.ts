/**
 * Relevanz-Map — interner Auswahl-Lauf (kuratierter VB-Kontext statt Volltext).
 *
 * Bis zum Konsolidierungs-Pass Teil von `seed.ts`. Reine Verschiebung.
 */
import { SEED_TS } from './ga-seed-basis';
import type { SkillRecord } from './types';

/** Skill-ID des Relevanz-Map-Skills (interner Auswahl-Lauf, Pitfall #30 intern-pflichtig). */
export const RELEVANZ_MAP_SKILL_ID = 'relevanz-map';

const SEED_RELEVANZ_MAP_SYSTEM_PROMPT =
  'Du ordnest VB-Abschnitte den Teilen eines ZIM-Gutachtens zu. Du WÄHLST AUS und '
  + 'fasst NICHTS zusammen — du gibst ausschließlich Heading-IDs zurück, keinen Fließtext. '
  + 'Wähle großzügig (Recall vor Precision); im Zweifel einen Abschnitt mehr.';

/**
 * Relevanz-Map-Skill. Das eigentliche Prompt baut zur Laufzeit `buildRelevanzPrompt`
 * (nummerierte Heading-Liste + Gutachten-Teile + VB); dieser Record ist
 * Policy-Subjekt (`{{vbMarkdown}}` → `skillEnthaeltDokumentInhalte` true →
 * intern-pflichtig, Pitfall #30) + System-Rolle + Token-Budget. KEINE Regeln
 * (kein Fließtext-Ergebnis, nichts maschinell zu prüfen).
 */
export const SEED_RELEVANZ_MAP_SKILL: SkillRecord = {
  id: RELEVANZ_MAP_SKILL_ID,
  name: 'Relevanz-Map (VB-Auswahl)',
  beschreibung: 'Interner Auswahl-Lauf: ordnet VB-Abschnitte den Gutachten-Teilen zu (wählt aus, fasst nicht zusammen).',
  version: 1,
  promptTemplate: `Wähle je Gutachten-Teil die relevanten VB-Abschnitte (Heading-IDs) aus. Fasse NICHTS zusammen.

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

Gib je Gutachten-Teil eine Zeile „<teil-id>: h0, h3, …" aus — ausschließlich Heading-IDs.`,
  systemPrompt: SEED_RELEVANZ_MAP_SYSTEM_PROMPT,
  maxTokens: 1024,
  // Re-Invocation spielt keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: SEED_TS,
};

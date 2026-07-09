/**
 * Seed-Skill „Steckbrief" der Antrag-Aufbereitung (Paket 2, nur dev). Extrahiert
 * die VB-abgeleiteten Kernaussagen eines Förderantrags als strukturiertes JSON —
 * jede Aussage mit ihren Sektions-IDs als Fundstelle. Stammdaten (Antragsteller,
 * FKZ, Projektform) kommen deterministisch aus dem Store und werden dem LLM NICHT
 * abverlangt.
 *
 * `aktiv: false` geseedet (Konvention wie der Aspekt-Skill / `types.ts`
 * `aktiv?`-Kommentar); dev läuft über `istAufbereitungBausteinFreigeschaltet`.
 *
 * Das eigentliche Prompt baut zur Laufzeit `buildSteckbriefPrompt`
 * (`aufbereitung/steckbrief.ts`); dieser Record ist Policy-Subjekt
 * (`{{vbMarkdown}}` → intern-pflichtig, Pitfall #30) + System-Rolle + Token-Budget.
 */
import type { SkillRecord } from './types';

export const AUFBEREITUNG_STECKBRIEF_SKILL_ID = 'aufbereitung-steckbrief';

const SYSTEM_PROMPT =
  'Du extrahierst Kernaussagen wortnah aus dem Antrag und gibst zu JEDER Aussage die '
  + 'Sektions-IDs an. Du erfindest nichts; fehlt eine Angabe, lässt du das Feld leer. Du '
  + 'antwortest ausschließlich mit dem geforderten JSON-Objekt.';

export const AUFBEREITUNG_STECKBRIEF_SKILL: SkillRecord = {
  id: AUFBEREITUNG_STECKBRIEF_SKILL_ID,
  name: 'Aufbereitung — Steckbrief',
  beschreibung: 'Interner Extraktions-Lauf: liest die VB-abgeleiteten Kernaussagen eines Antrags als strukturiertes JSON mit Fundstellen (dev).',
  version: 1,
  promptTemplate: `Extrahiere die Kernaussagen der Vorhabensbeschreibung als JSON. Jede Aussage trägt ihre Sektions-IDs. Erfinde nichts.

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

Gib ausschließlich das geforderte JSON-Objekt zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 2048,
  // Re-Invocation spielt keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-09T00:00:00.000Z',
  aktiv: false,
  enthaeltDokumentInhalte: true,
};

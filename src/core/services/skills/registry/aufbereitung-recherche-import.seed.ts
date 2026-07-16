/**
 * Seed-Skill „Recherche-Import strukturieren" der Antrag-Aufbereitung (Paket 5, Phase 2,
 * nur dev). EIN interner Lauf strukturiert einen von AUSSEN hereingebrachten Deep-Research-
 * Text (Report/PDF/Word-Extrakt) in das geteilte JSON-Schema. KEIN VB-Inhalt in diesem
 * Prompt — der Slot ist `{{externText}}` (nicht `{{vbMarkdown}}`).
 *
 * `{{externText}}` ist in `INHALTS_SLOTS` (transport-policy.ts) deklariert → intern-
 * pflichtig (fail-safe, Pitfall #30/#35): der Import-Lauf läuft nie versehentlich extern.
 * `aktiv: false` geseedet (dev läuft über den Runtime-Override). Das eigentliche Prompt
 * baut zur Laufzeit `buildRechercheImportPrompt` (`aufbereitung/recherche-import.ts`).
 */
import type { SkillRecord } from './types';

export const AUFBEREITUNG_RECHERCHE_IMPORT_SKILL_ID = 'aufbereitung-recherche-import';

const SYSTEM_PROMPT =
  'Du strukturierst einen extern erstellten Recherche-Report in ein vorgegebenes JSON-Schema. '
  + 'Du WÄHLST die belegten Aussagen + Quellen AUS und ordnest jede Aussage einer Kategorie zu — '
  + 'du erfindest nichts und fügst kein Weltwissen hinzu. Du antwortest ausschließlich mit dem '
  + 'geforderten JSON-Codeblock.';

export const AUFBEREITUNG_RECHERCHE_IMPORT_SKILL: SkillRecord = {
  id: AUFBEREITUNG_RECHERCHE_IMPORT_SKILL_ID,
  name: 'Aufbereitung — Recherche-Import strukturieren',
  beschreibung: 'Interner Lauf: strukturiert einen externen Deep-Research-Text in das geteilte JSON-Schema (Aussagen + Quellen) (dev).',
  version: 1,
  promptTemplate: `Strukturiere den folgenden externen Recherche-Text in das geforderte JSON-Schema. Wähle belegte Aussagen + Quellen AUS und ordne jede Aussage einer Kategorie zu.

## Externer Recherche-Text
{{externText}}

Gib ausschließlich das geforderte JSON-Objekt zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 4096,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['externText'],
  geaendert_am: '2026-07-16T00:00:00.000Z',
  aktiv: false,
  enthaeltDokumentInhalte: true,
};

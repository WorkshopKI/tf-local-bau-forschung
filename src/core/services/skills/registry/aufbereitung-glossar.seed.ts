/**
 * Seed-Skill „Glossar" der Antrag-Aufbereitung (v2.219, nur dev). Wählt die
 * Fachbegriffe/Abkürzungen der Vorhabensbeschreibung AUS und gibt zu jedem eine kurze
 * Definition (wortnah) + die Sektions-IDs — er erfindet keine Begriffe/Definitionen.
 * Muster: Zahlen-Skill.
 *
 * `aktiv: false` geseedet (Konvention wie die übrigen Aufbereitungs-Skills); dev läuft
 * über `istAufbereitungBausteinFreigeschaltet`. Das eigentliche Prompt baut zur Laufzeit
 * `buildGlossarPrompt` (`aufbereitung/glossar.ts`); dieser Record ist Policy-Subjekt
 * (`{{vbMarkdown}}` → `skillEnthaeltDokumentInhalte` true → intern-pflichtig, Pitfall #30)
 * + System-Rolle + Token-Budget.
 */
import type { SkillRecord } from './types';

export const AUFBEREITUNG_GLOSSAR_SKILL_ID = 'aufbereitung-glossar';

const SYSTEM_PROMPT =
  'Du erstellst ein Glossar eines Förderantrags. Du WÄHLST die Fachbegriffe/Abkürzungen '
  + 'aus dem Text AUS und gibst zu jedem eine kurze, wortnahe Definition sowie die '
  + 'Sektions-IDs an. Du erfindest keine Begriffe und keine Definitionen aus Weltwissen. '
  + 'Du antwortest ausschließlich mit dem geforderten JSON-Objekt in einem Codeblock — '
  + 'niemals als Tabelle, Aufzählung oder Fließtext.';

export const AUFBEREITUNG_GLOSSAR_SKILL: SkillRecord = {
  id: AUFBEREITUNG_GLOSSAR_SKILL_ID,
  name: 'Aufbereitung — Glossar',
  beschreibung: 'Interner Auswahl-Lauf: sammelt die Fachbegriffe eines Antrags mit kurzer Definition + Fundstellen als strukturiertes JSON (dev).',
  version: 1,
  promptTemplate: `Sammle die Fachbegriffe/Abkürzungen der Vorhabensbeschreibung mit kurzer Definition als JSON. Wähle AUS und referenziere — erfinde nichts.

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

Gib ausschließlich das geforderte JSON-Objekt zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 4096,
  // Re-Invocation spielt keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-10T18:00:00.000Z',
  // Noch nicht per Eval abgesichert → gesperrt geseedet; dev läuft über den Runtime-Override.
  aktiv: false,
  // Redundant zur Slot-Ableitung, aber explizit: trägt VB-Volltext (intern-pflichtig).
  enthaeltDokumentInhalte: true,
};

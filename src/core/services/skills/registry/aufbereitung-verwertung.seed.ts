/**
 * Seed-Skill „Verwertung/Markt" der Antrag-Aufbereitung (Stufe 2, nur dev).
 * Extrahiert die Verwertungs-/Markt-Aussagen aus dem KORPUS (VB + narrative
 * Zusatzdokumente) — kategorisiert, wortnah, mit Sektions-IDs. Erfindet nichts.
 * Muster: Glossar-Skill.
 *
 * `aktiv: false` geseedet (Konvention wie die übrigen Aufbereitungs-Skills); dev läuft
 * über `istAufbereitungBausteinFreigeschaltet`. Das eigentliche Prompt baut zur Laufzeit
 * `buildVerwertungPrompt` (`aufbereitung/verwertung.ts`) über den Korpus; dieser Record
 * ist Policy-Subjekt (`{{vbMarkdown}}` → `skillEnthaeltDokumentInhalte` true →
 * intern-pflichtig, Pitfall #30 + #35) + System-Rolle + Token-Budget.
 */
import type { SkillRecord } from './types';

export const AUFBEREITUNG_VERWERTUNG_SKILL_ID = 'aufbereitung-verwertung';

const SYSTEM_PROMPT =
  'Du bereitest die Verwertungs- und Markt-Aussagen eines Förderantrags auf. Du '
  + 'EXTRAHIERST wortnah, was im Antragsmaterial steht (Vorhabensbeschreibung und ggf. '
  + 'angehängte Zusatzdokumente), ordnest jede Aussage einer der fünf vorgegebenen '
  + 'Kategorien zu und gibst die Sektions-IDs an. Du erfindest nichts und ergänzt kein '
  + 'Weltwissen. Du antwortest ausschließlich mit dem geforderten JSON-Objekt in einem '
  + 'Codeblock — niemals als Tabelle, Aufzählung oder Fließtext.';

export const AUFBEREITUNG_VERWERTUNG_SKILL: SkillRecord = {
  id: AUFBEREITUNG_VERWERTUNG_SKILL_ID,
  name: 'Aufbereitung — Verwertung/Markt',
  beschreibung: 'Interner Extraktions-Lauf: sammelt die Verwertungs-/Markt-Aussagen eines Antrags kategorisiert mit Fundstellen als strukturiertes JSON (dev).',
  version: 1,
  promptTemplate: `Extrahiere die Verwertungs-/Markt-Aussagen aus dem Antragsmaterial als JSON (kategorisiert, wortnah, mit Fundstellen) — erfinde nichts.

## Antragsmaterial (Quelle)
{{vbMarkdown}}

Gib ausschließlich das geforderte JSON-Objekt zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 4096,
  // Re-Invocation spielt keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-13T00:00:00.000Z',
  // Noch nicht per Eval abgesichert → gesperrt geseedet; dev läuft über den Runtime-Override.
  aktiv: false,
  // Redundant zur Slot-Ableitung, aber explizit: trägt Dokument-Volltext (intern-pflichtig).
  enthaeltDokumentInhalte: true,
};

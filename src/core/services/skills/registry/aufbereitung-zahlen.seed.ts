/**
 * Seed-Skill „Zahlen-Inventar" der Antrag-Aufbereitung (Paket 4, nur dev). Wählt die
 * Claims mit Zahlenwerten aus der Vorhabensbeschreibung AUS und verankert sie per
 * Sektions-ID — er rechnet, normalisiert und summiert NICHTS (das machen die
 * deterministischen Quervergleiche im Code). Muster: Steckbrief-Skill.
 *
 * `aktiv: false` geseedet (Konvention wie Aspekt-/Steckbrief-Skill); dev läuft über
 * `istAufbereitungBausteinFreigeschaltet`. Das eigentliche Prompt baut zur Laufzeit
 * `buildZahlenPrompt` (`aufbereitung/zahlen.ts`); dieser Record ist Policy-Subjekt
 * (`{{vbMarkdown}}` → `skillEnthaeltDokumentInhalte` true → intern-pflichtig,
 * Pitfall #30) + System-Rolle + Token-Budget.
 */
import type { SkillRecord } from './types';

export const AUFBEREITUNG_ZAHLEN_SKILL_ID = 'aufbereitung-zahlen';

const SYSTEM_PROMPT =
  'Du erstellst ein Zahlen-Inventar eines Förderantrags. Du WÄHLST Zahlenwerte wörtlich '
  + 'aus dem Text AUS und gibst zu jedem die Sektions-IDs an. Du rechnest nichts, rechnest '
  + 'nichts um, fasst nichts zusammen und erfindest keine Werte. Du antwortest ausschließlich '
  + 'mit dem geforderten JSON-Objekt in einem Codeblock — niemals als Tabelle, Aufzählung '
  + 'oder Fließtext.';

export const AUFBEREITUNG_ZAHLEN_SKILL: SkillRecord = {
  id: AUFBEREITUNG_ZAHLEN_SKILL_ID,
  name: 'Aufbereitung — Zahlen-Inventar',
  beschreibung: 'Interner Auswahl-Lauf: sammelt die Zahlen-Claims eines Antrags wörtlich mit Fundstellen als strukturiertes JSON (dev).',
  version: 2,
  promptTemplate: `Sammle die Claims mit Zahlenwerten der Vorhabensbeschreibung als JSON. Wähle AUS und referenziere — rechne nichts, rechne nichts um, erfinde nichts.

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

Gib ausschließlich das geforderte JSON-Objekt zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  // 4096 (statt 2048): das claims-Array wächst mit der Antragsgröße; der knappere Wert
  // schnitt lange Inventare ab (der Parser rettet die vollständigen Claims jetzt zwar
  // truncation-tolerant, mehr Budget hebt aber den Recall). Greift für Fresh-Seeds; auf
  // bereits geseedeten Shares zählt der persistierte Registry-Wert (mergeMissingSeeds).
  maxTokens: 4096,
  // Re-Invocation spielt keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-10T12:00:00.000Z',
  // Noch nicht per Eval abgesichert → gesperrt geseedet; dev läuft über den Runtime-Override.
  aktiv: false,
  // Redundant zur Slot-Ableitung, aber explizit: trägt VB-Volltext (intern-pflichtig).
  enthaeltDokumentInhalte: true,
};

/**
 * Seed-Skill „Aspekt-Mapping" der Antrag-Aufbereitung (Paket 2, nur dev). Ordnet
 * die Sektionen einer Vorhabensbeschreibung den festen Prüfaspekten A–J zu und
 * benennt fehlende Pflichtangaben — auswählen + referenzieren, nicht zusammenfassen
 * (Muster Relevanz-Map).
 *
 * `aktiv: false` geseedet: die geteilte `registry.json` ist über alle
 * Build-Varianten sichtbar; ein noch nicht per Eval abgesicherter Skill startet
 * gesperrt (Konvention siehe `types.ts` `aktiv?`-Kommentar). Die Aufrufstelle
 * (`aufbereitung/bausteine.ts` → `istAufbereitungBausteinFreigeschaltet`) läuft in
 * dev über den Runtime-Override; die Seite selbst ist zusätzlich
 * `antragAufbereitung`-gated (nur dev).
 *
 * Das eigentliche Prompt baut zur Laufzeit `buildAspektePrompt`
 * (`aufbereitung/aspekte.ts`); dieser Record ist Policy-Subjekt
 * (`{{vbMarkdown}}` → `skillEnthaeltDokumentInhalte` true → intern-pflichtig,
 * Pitfall #30) + System-Rolle + Token-Budget. Keine Regeln (kein Fließtext-Ergebnis).
 */
import type { SkillRecord } from './types';

export const AUFBEREITUNG_ASPEKTE_SKILL_ID = 'aufbereitung-aspekte';

const SYSTEM_PROMPT =
  'Du ordnest Sektionen eines Förderantrags festen Prüfaspekten zu und benennst fehlende '
  + 'Pflichtangaben. Du wählst aus und referenzierst — du fasst nichts zusammen. Du gibst '
  + 'ausschließlich Sektions-IDs und Aspekt-Buchstaben im vorgegebenen Zeilenformat aus.';

export const AUFBEREITUNG_ASPEKTE_SKILL: SkillRecord = {
  id: AUFBEREITUNG_ASPEKTE_SKILL_ID,
  name: 'Aufbereitung — Aspekt-Mapping',
  beschreibung: 'Interner Auswahl-Lauf: ordnet VB-Sektionen den Prüfaspekten A–J zu und benennt fehlende Pflichtangaben (dev).',
  version: 1,
  promptTemplate: `Ordne die Sektionen der Vorhabensbeschreibung den Prüfaspekten A–J zu. Wähle aus, fasse NICHTS zusammen.

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

Gib je Aspekt eine Zeile „<Aspekt>: <sektion-id>, …" aus, danach je fehlender Pflichtangabe eine Zeile „<Aspekt>-fehlt: <Text>".`,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 1024,
  // Re-Invocation spielt keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-09T00:00:00.000Z',
  // Noch nicht per Eval abgesichert → gesperrt geseedet; dev läuft über den Runtime-Override.
  aktiv: false,
  // Redundant zur Slot-Ableitung, aber explizit: trägt VB-Volltext (intern-pflichtig).
  enthaeltDokumentInhalte: true,
};

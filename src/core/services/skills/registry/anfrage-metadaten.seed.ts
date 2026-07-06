/**
 * Seed-Skill für das interne KI-Tagging einer E-Mail-Kurzanfrage (Modul
 * „Anfragen"): extrahiert strukturierte Metadaten (Antragsart, Name, Firma,
 * Themengruppe) aus dem Original-Mailtext. Liegt in der geteilten
 * `registry.json` und ist damit über alle Build-Varianten sichtbar.
 *
 * FREIGESCHALTET (`aktiv: true`) ab Werk — anders als der Anonymisierer braucht
 * dieser Skill KEIN Recall-Gate: Seine Ausgabe verlässt das System NIE (rein
 * interner Convenience-Lauf, dient nur der lokalen Sortier-/Filter-Tabelle). Der
 * Originaltext kommt über den `{{zielText}}`-Inhalts-Slot → die DSGVO-Transport-
 * Policy (`skillEnthaeltDokumentInhalte`) erzwingt automatisch einen INTERNEN
 * Transport (Ableitung schlägt Flag); `name`/`firma` bleiben Klartext-PII und
 * werden nur lokal gespeichert.
 *
 * ACHTUNG — Bestands-Installationen: `mergeMissingSeeds` (storage.ts) ergänzt nur
 * FEHLENDE Seeds und überschreibt bestehende Registry-Einträge NIE — der Skill
 * wird also in bestehende wie frische Shares additiv aufgenommen.
 */
import type { SkillRecord } from './types';

export const ANFRAGE_METADATEN_SKILL_ID = 'anfrage-metadaten';

/**
 * Festes Themengruppen-Vokabular (kontrolliert → saubere Filter). Die KI wählt
 * genau einen Wert; Unbekanntes/Leeres normalisiert `parseMetadaten` auf
 * „Sonstiges". Starter-Set für den ZIM-FAQ-Kontext — bei Bedarf hier erweitern
 * (Filter passen sich automatisch an).
 */
export const THEMENGRUPPEN: readonly string[] = [
  'Antragstellung & Formalitäten',
  'Förderfähigkeit & Voraussetzungen',
  'Finanzen & Abrechnung',
  'Fristen & Projektänderungen',
  'Technik & Inhaltliches',
  'Kooperation & Partner',
  'Sonstiges',
];

const SYSTEM_PROMPT = [
  'Du bist ein Werkzeug zur Metadaten-Extraktion für Förderreferenten. Deine Aufgabe ist es,',
  'aus dem Text einer eingegangenen E-Mail-Kurzanfrage vier strukturierte Metadaten-Felder',
  'zu bestimmen, mit denen die Anfrage später sortiert und gefiltert wird.',
  '',
  'Felder:',
  '- `antragsart`: Um welche Art von Anliegen geht es? Kurzes Substantiv/Nominalphrase',
  '  (z. B. „Förderantrag", „Nachfrage", „Fristverlängerung", „Mittelabruf", „Verwendungsnachweis").',
  '- `name`: Name der absendenden Person, falls im Text erkennbar (z. B. „Dr. Anna Schmidt").',
  '  Nicht das Team/die Kollegen, an die die E-Mail gerichtet ist — die ABSENDENDE Person.',
  '- `firma`: Firma/Institut/Organisation der absendenden Person, falls erkennbar.',
  '- `themengruppe`: Genau EINER der vorgegebenen Werte (siehe Prompt). Wähle den am besten',
  '  passenden; passt keiner klar, wähle „Sonstiges".',
  '',
  'Regeln:',
  '- Erfinde NICHTS. Ist ein Wert nicht erkennbar, gib einen leeren String "" zurück',
  '  (bei `themengruppe`: „Sonstiges").',
  '- Gib AUSSCHLIESSLICH ein JSON-Objekt zurück — ohne weiteren Text, ohne Markdown-Codefences.',
].join('\n');

const PROMPT_TEMPLATE = [
  'Bestimme die Metadaten der folgenden E-Mail-Kurzanfrage.',
  '',
  '`themengruppe` MUSS genau einer dieser Werte sein:',
  ...THEMENGRUPPEN.map(t => `- ${t}`),
  '',
  'Gib AUSSCHLIESSLICH dieses JSON zurück (keine Erklärung, kein Markdown, keine Codefences):',
  '{"antragsart":"<kurze Art des Anliegens>","name":"<Name der absendenden Person oder \\"\\">",'
    + '"firma":"<Firma/Institut oder \\"\\">","themengruppe":"<einer der Werte oben>"}',
  '',
  'E-Mail-Text:',
  '{{zielText}}',
].join('\n');

export const ANFRAGE_METADATEN_SKILL: SkillRecord = {
  id: ANFRAGE_METADATEN_SKILL_ID,
  name: 'Anfrage taggen',
  beschreibung: 'Extrahiert aus einer E-Mail-Kurzanfrage strukturierte Metadaten (Antragsart, Name, '
    + 'Firma, Themengruppe) für die Sortier-/Filter-Tabelle. Rein intern (Dokumentinhalte); Ausgabe '
    + 'verlässt das System nie.',
  version: 1,
  promptTemplate: PROMPT_TEMPLATE,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 1024,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['zielText'],
  geaendert_am: '2026-07-06T00:00:00.000Z',
  // Kein Recall-Gate: reiner interner Convenience-Lauf, Ausgabe verlässt das System nie.
  aktiv: true,
  // Redundant zur Slot-Ableitung, aber explizit dokumentiert: trägt Dokumentinhalte.
  enthaeltDokumentInhalte: true,
};

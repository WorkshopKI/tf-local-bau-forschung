/**
 * Seed-Skill „Deep-Research-Auftrag" der Antrag-Aufbereitung (Paket 5, nur dev). EIN
 * interner Lauf erzeugt aus dem Korpus einen deutschen Deep-Research-Auftrag (neutraler
 * Analysten-Frame) für externe Dienste (ChatGPT/Claude/Mistral) — zwei Teile: (a) Stand
 * der Technik zum Themengebiet, (b) Markt + Wettbewerber + vergleichbare Produkte.
 *
 * DSGVO-Schicht 1 (Prompt-Constraints): Der ERZEUGTE Auftrag beschreibt ausschließlich
 * das THEMENGEBIET (Technologiefeld, Problemklasse, angestrebte Leistungsklasse) und
 * enthält NIEMALS Antragsteller-/Firmennamen, FKZ/Aktenzeichen, Personennamen,
 * Ortsangaben aus den Stammdaten oder wörtliche VB-Passagen; kein Behördenkontext.
 * Schicht 2 (deterministischer Leak-Check) + Schicht 3 (Pflicht-Review) sitzen im Code.
 *
 * `aktiv: false` geseedet (Konvention; dev läuft über `istAufbereitungBausteinFreigeschaltet`).
 * Der Lauf trägt VB-Volltext (`{{vbMarkdown}}` → intern-pflichtig, Pitfall #30). Das
 * eigentliche Prompt baut zur Laufzeit `buildRecherchePromptPrompt`
 * (`aufbereitung/recherche-prompt.ts`); dieser Record ist Policy-Subjekt + System-Rolle.
 */
import type { SkillRecord } from './types';

export const AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID = 'aufbereitung-recherche-prompt';

const SYSTEM_PROMPT =
  'Du bist ein Analyst und formulierst einen deutschen Deep-Research-Auftrag für ein '
  + 'Technologie-/Themengebiet. Der Auftrag beschreibt AUSSCHLIESSLICH das Themengebiet '
  + '(Technologiefeld, Problemklasse, angestrebte Leistungsklasse) in neutraler, '
  + 'analytischer Sprache. Er nennt NIEMALS: Antragsteller-/Firmennamen, Förderkennzeichen '
  + 'oder Aktenzeichen, Personennamen, konkrete Ortsangaben, oder wörtliche Passagen aus der '
  + 'Vorlage. KEIN Behördenkontext — die Wörter „Förderantrag", „Prüfer", „Gutachten", „ZIM" '
  + 'kommen nicht vor. Du antwortest mit dem Auftragstext und schließt mit genau einem '
  + 'JSON-Codeblock ab.';

export const AUFBEREITUNG_RECHERCHE_PROMPT_SKILL: SkillRecord = {
  id: AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID,
  name: 'Aufbereitung — Deep-Research-Auftrag',
  beschreibung: 'Interner Lauf: erzeugt aus dem Korpus einen anonymen Deep-Research-Auftrag (Stand der Technik + Markt) für externe Dienste (dev).',
  version: 1,
  promptTemplate: `Erzeuge aus der folgenden Vorhabensbeschreibung EINEN deutschen Deep-Research-Auftrag (neutraler Analysten-Frame) für ein externes Recherche-Modell.

## Vorhabensbeschreibung (Quelle — bleibt intern)
{{vbMarkdown}}

Beschreibe ausschließlich das Themengebiet — keine identifizierenden Angaben. Gib den Auftrag als letzten JSON-Codeblock zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 2048,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-16T00:00:00.000Z',
  // Noch nicht per Eval abgesichert → gesperrt geseedet; dev läuft über den Runtime-Override.
  aktiv: false,
  // Redundant zur Slot-Ableitung, aber explizit: trägt VB-Volltext (intern-pflichtig).
  enthaeltDokumentInhalte: true,
};

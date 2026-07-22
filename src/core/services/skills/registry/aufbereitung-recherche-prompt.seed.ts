/**
 * Seed-Skill „Deep-Research-Stichworte" der Antrag-Aufbereitung (Paket 5, nur dev). EIN
 * interner Lauf zieht aus dem Korpus die **Stichworte** des Themengebiets; den
 * eigentlichen Deep-Research-Auftrag für externe Dienste (ChatGPT/Claude/Mistral) baut
 * daraus die feste Vorlage im Code (`aufbereitung/recherche-auftrag.ts`).
 *
 * Bis v2.299 formulierte das Modell den ganzen Auftrag selbst — und schrieb dabei die
 * Antworten des Antrags hinein (identifizierte Lücken, Marktzahlen, Wettbewerber,
 * Zielkennwerte). Der externe Dienst bestätigte dann nur noch den Antrag, statt
 * unabhängig zu recherchieren. Seither liefert das Modell nur noch Nominalphrasen.
 *
 * DSGVO-Schicht 1 ist damit die VORLAGE (Code), nicht mehr die Prompt-Bitte; Schicht 1b
 * ist der deterministische Sanitizer (`recherche-stichworte.ts`: Zahlwert-, Leak- und
 * Wortgrenzen-Guard), Schicht 2 der Leak-Check auf dem zusammengebauten Auftrag,
 * Schicht 3 die Pflicht-Review im UI.
 *
 * `aktiv: false` geseedet (Konvention; dev läuft über `istAufbereitungBausteinFreigeschaltet`).
 * Der Lauf trägt VB-Volltext (`{{vbMarkdown}}` → intern-pflichtig, Pitfall #30/#35). Das
 * eigentliche Prompt baut zur Laufzeit `buildStichwortePrompt`
 * (`aufbereitung/recherche-prompt.ts`); dieser Record ist Policy-Subjekt + System-Rolle.
 */
import type { SkillRecord } from './types';

export const AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID = 'aufbereitung-recherche-prompt';

/** Eingefrorener v1-System-Prompt (Pristine-Guard der Stichwort-Migration). */
export const RECHERCHE_PROMPT_SYSTEM_ALT =
  'Du bist ein Analyst und formulierst einen deutschen Deep-Research-Auftrag für ein '
  + 'Technologie-/Themengebiet. Der Auftrag beschreibt AUSSCHLIESSLICH das Themengebiet '
  + '(Technologiefeld, Problemklasse, angestrebte Leistungsklasse) in neutraler, '
  + 'analytischer Sprache. Er nennt NIEMALS: Antragsteller-/Firmennamen, Förderkennzeichen '
  + 'oder Aktenzeichen, Personennamen, konkrete Ortsangaben, oder wörtliche Passagen aus der '
  + 'Vorlage. KEIN Behördenkontext — die Wörter „Förderantrag", „Prüfer", „Gutachten", „ZIM" '
  + 'kommen nicht vor. Deine Antwort besteht aus GENAU EINEM JSON-Codeblock, der den '
  + 'Auftragstext als Feld enthält — kein Fließtext davor oder danach.';

/** Eingefrorenes v1-Template (Pristine-Guard der Stichwort-Migration). */
export const RECHERCHE_PROMPT_TEMPLATE_ALT = `Erzeuge aus der folgenden Vorhabensbeschreibung EINEN deutschen Deep-Research-Auftrag (neutraler Analysten-Frame) für ein externes Recherche-Modell.

## Vorhabensbeschreibung (Quelle — bleibt intern)
{{vbMarkdown}}

Beschreibe ausschließlich das Themengebiet — keine identifizierenden Angaben. Gib den Auftrag als letzten JSON-Codeblock zurück.`;

const SYSTEM_PROMPT =
  'Du bist ein Analyst und benennst das Themengebiet eines Vorhabens in STICHWORTEN — '
  + 'kurze Nominalphrasen, keine Sätze. Du formulierst keinen Auftrag und keine '
  + 'Zusammenfassung. Du nennst NIEMALS: Zahlen, Zielwerte, Marktgrößen, Prozente oder '
  + 'Geldbeträge; Antragsteller-/Firmennamen, Förderkennzeichen oder Aktenzeichen, '
  + 'Personennamen, Ortsangaben, Projektakronym oder Projekttitel. Du sagst auch nicht, '
  + 'was fehlt oder was das Vorhaben erreichen will — nur, worum es fachlich geht. Deine '
  + 'Antwort besteht aus GENAU EINEM kompakten JSON-Codeblock — kein Fließtext davor oder danach.';

export const AUFBEREITUNG_RECHERCHE_PROMPT_SKILL: SkillRecord = {
  id: AUFBEREITUNG_RECHERCHE_PROMPT_SKILL_ID,
  name: 'Aufbereitung — Deep-Research-Stichworte',
  beschreibung: 'Interner Lauf: zieht aus dem Korpus die Stichworte des Themengebiets; den Deep-Research-Auftrag für externe Dienste baut daraus die feste Vorlage (dev).',
  version: 2,
  promptTemplate: `Lies die folgende Vorhabensbeschreibung und gib das Themengebiet als Stichworte zurück — kurze Nominalphrasen, keine Sätze.

## Vorhabensbeschreibung (Quelle — bleibt intern)
{{vbMarkdown}}

Nur Begriffe: keine Zahlen, keine Namen, keine Bewertung, keine Lücken-Aussagen. Gib die Stichworte als letzten JSON-Codeblock zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  // Stichworte statt Auftragstext — knapp gehalten, das bremst zugleich die Essay-Drift.
  maxTokens: 512,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-22T00:00:00.000Z',
  // Noch nicht per Eval abgesichert → gesperrt geseedet; dev läuft über den Runtime-Override.
  aktiv: false,
  // Redundant zur Slot-Ableitung, aber explizit: trägt VB-Volltext (intern-pflichtig).
  enthaeltDokumentInhalte: true,
};

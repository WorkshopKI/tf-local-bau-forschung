/**
 * LLM-QS — qualitativer, BERATENDER Prüf-Skill (ergänzt die mechanischen Checks).
 *
 * Bis zum Konsolidierungs-Pass Teil von `seed.ts`. Reine Verschiebung.
 */
import { SEED_TS } from './ga-seed-basis';
import type { SkillRecord } from './types';

/** Skill-ID des QS-Basis-Skills (für Lookups + Default-`skillId` von QS-Schritten). */
export const QS_BASIS_SKILL_ID = 'qs-basis';

const SEED_QS_SYSTEM_PROMPT =
  'Du bist ein erfahrener qualitativer Gutachten-QS für ZIM-Gutachten. Du bewertest '
  + 'einen bereits erstellten Abschnitt BERATEND entlang fester Dimensionen — du schreibst '
  + 'den Text NICHT um und gibst KEINE neue Fassung aus. Antworte ausschließlich auf Deutsch '
  + 'und halte dich exakt an das vorgegebene Ausgabeformat.';

const SEED_QS_PROMPT_TEMPLATE = `Bewerte den folgenden, bereits erstellten Gutachten-Abschnitt **qualitativ und beratend**. Du beurteilst NUR die inhaltliche Qualität — Zeichen-, Wort- und Satzzahlen prüft ein separates System, dazu schreibst du nichts.

## Zweck des Abschnitts
{{abschnittszweck}}

## Vorhabensbeschreibung (Quelle der Wahrheit)
{{vbMarkdown}}

## Zu bewertender Abschnitt
{{zielText}}

## Aufgabe
Bewerte den Abschnitt entlang dieser Dimensionen:
- **Erdung in der VB**: Sind die Aussagen durch die VB gedeckt? Gibt es Erfindungen/Spekulation?
- **Kohärenz**: Logischer Aufbau, klare Argumentation, keine inneren Widersprüche?
- **Vollständigkeit**: Deckt der Abschnitt seinen Zweck inhaltlich ab? Fehlt Wesentliches?
- **Ton**: Sachlich-gutachterlich, aktiver Stil, keine Werbe-/Floskel-Sprache?

## Ausgabeformat (genau ein Block je Dimension, jeweils mit der ###-Überschrift)
### Erdung in der VB
Bewertung: ok | hinweis
Eine bis zwei Sätze Begründung mit konkreter Belegstelle.

### Kohärenz
Bewertung: ok | hinweis
Eine bis zwei Sätze Begründung.

### Vollständigkeit
Bewertung: ok | hinweis
Eine bis zwei Sätze Begründung.

### Ton
Bewertung: ok | hinweis
Eine bis zwei Sätze Begründung.

„Bewertung: ok" = keine Beanstandung; „Bewertung: hinweis" = beratender Verbesserungshinweis. Erfinde nichts und schreibe den Abschnitt NICHT um.`;

/** QS-Basis-Skill — nutzt die Slots `abschnittszweck`/`vbMarkdown`/`zielText`; KEINE Regeln (beratend). */
export const SEED_QS_SKILL: SkillRecord = {
  id: QS_BASIS_SKILL_ID,
  name: 'KI-Qualitäts-Check (beratend)',
  beschreibung: 'Bewertet einen Gutachten-Abschnitt qualitativ entlang fester Dimensionen (Erdung, Kohärenz, Vollständigkeit, Ton). Beratend — überschreibt nie den Text.',
  version: 1,
  promptTemplate: SEED_QS_PROMPT_TEMPLATE,
  systemPrompt: SEED_QS_SYSTEM_PROMPT,
  maxTokens: 1536,
  // Re-Invocation spielt für die QS keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['abschnittszweck', 'vbMarkdown', 'zielText'],
  geaendert_am: SEED_TS,
};

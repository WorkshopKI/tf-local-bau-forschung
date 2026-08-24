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

/** Name/Beschreibung vor dem Prüfer-Umbau — eingefroren als Guard der Migration. */
export const QS_NAME_ALT = 'KI-Qualitäts-Check (beratend)';
export const QS_BESCHREIBUNG_ALT = 'Bewertet einen Gutachten-Abschnitt qualitativ entlang fester Dimensionen (Erdung, Kohärenz, Vollständigkeit, Ton). Beratend — überschreibt nie den Text.';

/**
 * QS-Basis-Skill — nutzt die Slots `abschnittszweck`/`vbMarkdown`/`zielText`; KEINE
 * Regeln (beratend).
 *
 * Seit v6.27 ist er zugleich **der fachliche Prüfer** des GA-Artefakts
 * (`ZIM_EP_DEF.pruefer`); seit v6.36 ist er **an** und läuft damit nach jeder
 * Erzeugung automatisch — als drittes Bein neben Generierung und Feinschliff, auf der
 * Gegenrolle der Generierung.
 *
 * Er stand von v6.27 bis v6.36 auf `aktiv: false`, weil sein Prompt nie an echten
 * Abschnitten gemessen worden war und ein Prüfer, der überall etwas findet, schlechter
 * ist als keiner. Freigeschaltet wurde er trotz noch ausstehender Messung, weil er
 * ausschließlich in **dev und pl** einkompiliert ist und pl produktiv nicht genutzt
 * wird: der einzige Preis ist die eigene Wartezeit (ein Abschnitt kostet damit drei
 * KI-Läufe statt zwei), und die Messung findet an echten Läufen statt.
 *
 * **Der Kill-Switch bleibt genau hier**: `aktiv: false` in der Skill-Verwaltung nimmt
 * ihn wieder aus der Kette (`prueferFuerArtefakt` filtert), ohne dass irgendein
 * Abschnitt eine Form-Regel verliert — die hängen seit v6.36 am Workflow, nicht am
 * Prüfer.
 */
export const SEED_QS_SKILL: SkillRecord = {
  id: QS_BASIS_SKILL_ID,
  name: 'Fachliche Prüfung (beratend)',
  beschreibung: 'Prüft einen erzeugten Abschnitt fachlich — entlang des Prüfkatalogs, sonst entlang fester Dimensionen (Erdung, Kohärenz, Vollständigkeit, Ton). Beratend: überschreibt nie den Text und blockiert nie.',
  // v2: fachlicher Prüfer des GA-Artefakts (Prüfart + Kill-Switch).
  // v3: freigeschaltet (siehe Docblock) — Rollout auf Bestands-Shares `applyPrueferAktiv`.
  version: 3,
  pruefart: 'fachlich',
  aktiv: true,
  promptTemplate: SEED_QS_PROMPT_TEMPLATE,
  systemPrompt: SEED_QS_SYSTEM_PROMPT,
  maxTokens: 1536,
  // Re-Invocation spielt für die QS keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['abschnittszweck', 'vbMarkdown', 'zielText'],
  geaendert_am: SEED_TS,
};

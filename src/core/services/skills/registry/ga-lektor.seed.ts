/**
 * Lektor-Skill für Gutachten-Abschnitte — der letzte, rein SPRACHLICHE Arbeitsgang
 * vor der Freigabe („Sprachlicher Feinschliff" in der Abschnitts-Karte).
 *
 * Abgrenzung zu Neu/Kürzer/Länger: die Modifier generieren aus der Vorhabens-
 * beschreibung NEU (Inhalt kann sich verschieben). Der Lektor sieht die VB
 * bewusst NICHT — sein Prompt trägt nur `{{zielText}}` (den abgenommenen
 * Abschnitt) + `{{abschnittszweck}}`. Damit kann er strukturell nichts
 * hinzuerfinden; was er trotzdem verändert, fängt der deterministische
 * Zahlen-/Längen-Wächter ab (`gutachten/lektorat.ts`).
 *
 * DSGVO: `zielText` ist ein Inhalts-Slot (`transport-policy.ts`) → der Skill ist
 * intern-pflichtig; der Aufrufer holt den Transport über
 * `bridge.getTransportForSkillRun` (Pitfall #30/#35).
 *
 * KEINE eigenen Regeln: geprüft wird nach dem Lauf mit den Regeln DES ABSCHNITTS
 * (Zeichen/Wörter/Sätze bleiben damit die maßgebliche Umfangs-Instanz). Genau daraus
 * fällt auch der Nachweis der Interpunktions-Pflicht ohne Zusatzcode an: die Regel
 * `seed-keine-semikolon-gedankenstrich` hängt an jedem Abschnitts-Skill, also prüft
 * der Lauf nach dem Feinschliff, ob der Lektor die Zeichen wirklich aufgelöst hat.
 */
import type { SkillRecord } from './types';

const SEED_TS = '2026-07-22T00:00:00.000Z';

/** Skill-ID des Gutachten-Lektors (sprachlicher Feinschliff). */
export const GA_LEKTOR_SKILL_ID = 'ga-lektor';

const GA_LEKTOR_SYSTEM_PROMPT =
  'Du bist Lektor für behördliche Gutachtentexte. Du überarbeitest ausschließlich die '
  + 'SPRACHE eines bereits inhaltlich abgenommenen Textes. Du fügst keine Information hinzu, '
  + 'entfernst keine und änderst keine Zahl, keinen Namen und keinen Fachbegriff. Antworte '
  + 'ausschließlich auf Deutsch und halte dich exakt an das vorgegebene Ausgabeformat.';

/**
 * EINGEFRORENER Alt-Stand des Lektor-Templates (v1, vor der Interpunktions-Pflicht).
 * Ausschließlich für die BYTE-genaue Migrations-Erkennung (`applyInterpunktion`) —
 * NICHT mehr live geseedet. Muster wie `B_ABSCHNITT_OPTS_UMFANG_ALT` in `seed.ts`.
 */
export const GA_LEKTOR_PROMPT_TEMPLATE_ALT = `Redigiere den folgenden Gutachten-Abschnitt sprachlich. Der Inhalt ist bereits abgenommen und FERTIG — du überarbeitest nur die Formulierung.

## Zweck des Abschnitts
{{abschnittszweck}}

## Abschnitt (zu redigieren)
{{zielText}}

## Erlaubt
- Satzbau glätten, Schachtelsätze auflösen, Satzanschlüsse verbessern
- Wortwiederholungen, Füllwörter und Floskeln ersetzen oder streichen
- Passiv- in Aktivkonstruktionen wandeln, wo es den Satz klarer macht
- Grammatik, Zeichensetzung und Rechtschreibung korrigieren
- Terminologie innerhalb des Abschnitts vereinheitlichen (auf die im Text bereits verwendete Variante)

## Verboten
- Aussagen ergänzen, weglassen oder in ihrer Bedeutung verschieben
- Zahlen, Einheiten, Prozentwerte, Jahreszahlen, Geldbeträge, Eigennamen, Produkt- und Firmennamen, Fachbegriffe oder Abkürzungen verändern
- den Abschnitt kürzen oder ausbauen — der Umfang bleibt praktisch gleich (± 10 %)
- Überschriften, Aufzählungen oder Markdown-Struktur einführen, die der Ausgangstext nicht hat
- Kommentare, Erläuterungen, Änderungslisten oder Rückfragen ausgeben

## Ausgabeformat (genau ein Block, keine Vorbemerkung)
### Finaler Text
<der vollständige redigierte Abschnitt>`;

/**
 * Live-Template (v2): zusätzlich zur allgemeinen Redaktion ein PFLICHT-Auftrag,
 * Semikolons und Gedankenstriche aufzulösen.
 *
 * Zwei Dinge sind hier Absicht:
 *  1. Der Auftrag steht als eigener Block VOR „Erlaubt" und nicht als Bullet unter
 *     „Zeichensetzung korrigieren" — er ist die einzige Änderung, die der Lektor
 *     vornehmen MUSS, nicht eine unter vielen, die er vornehmen darf.
 *  2. Das Template selbst ist frei von Semikolon und Gedankenstrich (die Alt-Fassung
 *     nutzte mehrfach „—"). Ein Prompt, der vorführt, was er verbietet, ist ein
 *     gemischtes Signal: Modelle spiegeln den Stil ihrer Instruktion.
 */
const GA_LEKTOR_PROMPT_TEMPLATE = `Redigiere den folgenden Gutachten-Abschnitt sprachlich. Der Inhalt ist bereits abgenommen und FERTIG, du überarbeitest nur die Formulierung.

## Zweck des Abschnitts
{{abschnittszweck}}

## Abschnitt (zu redigieren)
{{zielText}}

## Pflicht bei jedem Lauf
Der redigierte Abschnitt enthält kein Semikolon und keinen Gedankenstrich, auch nicht in der Schreibweise mit einfachem Bindestrich zwischen Leerzeichen. Löse jede solche Stelle auf: bilde zwei eigenständige Sätze oder verbinde mit einer Konjunktion, einem Komma oder Klammern. Bindestriche innerhalb von Wortverbindungen wie „KI-gestützt" oder „Know-how" bleiben unverändert, ebenso Zahlenbereiche ohne Leerzeichen wie „2024–2026".

## Erlaubt
- Satzbau glätten, Schachtelsätze auflösen, Satzanschlüsse verbessern
- einen Satz in zwei Sätze teilen (das gilt als sprachliche, nicht als inhaltliche Änderung)
- Wortwiederholungen, Füllwörter und Floskeln ersetzen oder streichen
- Passiv- in Aktivkonstruktionen wandeln, wo es den Satz klarer macht
- Grammatik, Zeichensetzung und Rechtschreibung korrigieren
- Terminologie innerhalb des Abschnitts vereinheitlichen (auf die im Text bereits verwendete Variante)

## Verboten
- Aussagen ergänzen, weglassen oder in ihrer Bedeutung verschieben
- Zahlen, Einheiten, Prozentwerte, Jahreszahlen, Geldbeträge, Eigennamen, Produkt- und Firmennamen, Fachbegriffe oder Abkürzungen verändern
- den Abschnitt kürzen oder ausbauen (der Umfang bleibt praktisch gleich, ± 10 %)
- Überschriften, Aufzählungen oder Markdown-Struktur einführen, die der Ausgangstext nicht hat
- Kommentare, Erläuterungen, Änderungslisten oder Rückfragen ausgeben

## Ausgabeformat (genau ein Block, keine Vorbemerkung)
### Finaler Text
<der vollständige redigierte Abschnitt>`;

/**
 * Lektor-Skill. Kurator-pflegbar wie jeder Registry-Skill (Skill-Verwaltung);
 * `aktiv: false` wirkt als Kill-Switch — dann blendet die Abschnitts-Karte den
 * Knopf aus. `maxTokens` bewusst großzügig: der REDIGIERTE Abschnitt muss
 * vollständig zurückkommen (Default 2048 reicht für lange Abschnitte nicht),
 * ein trotzdem abgeschnittenes Ergebnis verwirft der Verdächtig-Guard.
 */
export const SEED_GA_LEKTOR_SKILL: SkillRecord = {
  id: GA_LEKTOR_SKILL_ID,
  name: 'Sprachlicher Feinschliff (Lektor)',
  beschreibung: 'Redigiert einen abgenommenen Gutachten-Abschnitt rein sprachlich — ohne Vorhabensbeschreibung, ohne inhaltliche Änderung, ohne Umfangsänderung. Entfernt dabei verpflichtend Semikolons und Gedankenstriche.',
  // v2: Pflicht-Block „kein Semikolon, kein Gedankenstrich" (Rollout auf Bestands-
  // Shares über `applyInterpunktion`).
  version: 2,
  promptTemplate: GA_LEKTOR_PROMPT_TEMPLATE,
  systemPrompt: GA_LEKTOR_SYSTEM_PROMPT,
  maxTokens: 4096,
  // Re-Invocation spielt für den Lektor keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['abschnittszweck', 'zielText'],
  geaendert_am: SEED_TS,
};

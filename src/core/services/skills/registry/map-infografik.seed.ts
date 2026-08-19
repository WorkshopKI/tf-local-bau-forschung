/**
 * Seed-Skill „MAP — Infografik-Extraktion" (nur dev).
 *
 * EIN Lauf je Einreichung liefert die Textanteile für drei Ansichten: Projekt-
 * Canvas, Delta zum Stand der Technik und Wirkungskette. Bewusst gebündelt statt
 * drei Läufe — die drei Ansichten lesen dieselbe Vorhabensbeschreibung, und
 * jeder zusätzliche Lauf kostet Wartezeit und Bridge-Kapazität.
 *
 * Deterministisches bleibt draussen: Arbeitsplan, Budget, Antragsteller und die
 * Schutzrechte-Kennzeichen kommen aus dem importierten Strukturmodell und werden
 * dem Modell nicht abverlangt.
 *
 * Leitplanke: Was die Vorhabensbeschreibung nicht hergibt, wird als vage oder
 * fehlend gekennzeichnet — nicht ausgefüllt. Das ist der eigentliche Prüfnutzen:
 * die Ansichten sollen Lücken zeigen, nicht kaschieren.
 *
 * `aktiv: false` geseedet wie die übrigen Aufbereitungs-Skills; das Prompt baut
 * zur Laufzeit `buildInfografikPrompt`. Dieser Record ist Policy-Subjekt
 * (`{{vbMarkdown}}` → intern-pflichtig, Pitfall #30) + System-Rolle + Budget.
 */
import type { SkillRecord } from './types';

export const MAP_INFOGRAFIK_SKILL_ID = 'map-infografik';

const SYSTEM_PROMPT =
  'Du extrahierst Aussagen wortnah aus der Vorhabensbeschreibung und gibst zu jeder '
  + 'Aussage die Sektions-IDs als Fundstelle an. Du erfindest nichts. Ist eine Angabe '
  + 'nur vage oder gar nicht belegt, kennzeichnest du sie als solche, statt sie zu '
  + 'ergänzen. Zusätzlich hältst du den Fliesstext gegen die verbindlichen Fakten der '
  + 'Einreichung und meldest ausschließlich echte Abweichungen — findest du keine, '
  // Vorher: „Du bewertest die Textqualität nicht." — unbedingt und unscoped, und damit
  // im Widerspruch zum Pflichtfeld `unschaerfeBegriffe`, das genau eine Formulierungs-
  // Beurteilung verlangt. Jetzt auf das gemeinte Verbot begrenzt (Prompt-Audit 2026-07).
  + 'bleibt die Liste leer. Du beurteilst weder Stil noch fachliche Güte des Textes; '
  + 'ob eine Aussage quantifiziert ist, stellst du aber fest — das ist eine Sachfrage. '
  // Dieselbe Falle wie beim Vorgänger-Satz: eine unbedingte Verbots-Formulierung
  // stünde im Widerspruch zum Pflichtfeld `innoZweitmeinung`, das eine Einordnung
  // VERLANGT. Deshalb der Zusatz eng gefasst — Zuordnung zu vorgegebenen
  // Ankertexten, ausdrücklich unverbindlich, ohne Empfehlung.
  + 'Zusätzlich ordnest du die Kategorien des Innovationsgrads den vorgegebenen '
  + 'Ankertexten zu. Diese Einordnung ist eine unverbindliche Zweitmeinung; sie '
  + 'entscheidet nichts und spricht keine Förderempfehlung aus. '
  + 'Du antwortest ausschließlich mit dem geforderten JSON-Objekt.';

export const MAP_INFOGRAFIK_SKILL: SkillRecord = {
  id: MAP_INFOGRAFIK_SKILL_ID,
  name: 'MAP — Infografik-Extraktion',
  beschreibung:
    'Interner Extraktions-Lauf für Projekt-Canvas, Delta zum Stand der Technik, '
    + 'Wirkungskette, den Substanzcheck (Widersprüche Text↔Einreichung, '
    + 'Unschärfe-Begriffe) und die KI-Zweitmeinung zum Innovationsgrad; '
    + 'ein Lauf je Einreichung, Ergebnis je VB-Hash gecacht (dev).',
  version: 3,
  promptTemplate: `Extrahiere aus der Vorhabensbeschreibung die Angaben für die Prüfansichten als JSON und gleiche den Text gegen die verbindlichen Fakten der Einreichung ab. Kennzeichne Vages als vage, statt es zu ergänzen. Melde nur echte Abweichungen.

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

Gib ausschließlich das geforderte JSON-Objekt zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  // Zwei zusätzliche Listen je Antwort — der alte Deckel schnitt die hinteren
  // Felder ab. Wirkt nur auf dem `submitConversation`-Pfad; die Streamlit-Bridge
  // trägt kein per-Request-Budget.
  //
  // 6144 → 8192 mit der Zweitmeinung. Die reine Nutzlast wächst nur um ~400 Token;
  // ausschlaggebend ist, dass eine Einstufung eine KLASSIFIKATIONS-Aufgabe ist und
  // ein Reasoning-Modell zum Abwägen zwischen zwei Nachbarstufen einlädt — Denken
  // und Antwort teilen sich das Budget. Und `extractLastJsonObject` braucht ein
  // VOLLSTÄNDIGES Objekt: eine abgeschnittene Antwort kostet nicht nur die
  // Zweitmeinung, sondern macht den ganzen Lauf zu `null`.
  // Über der Reserve-Obergrenze (4096) und trotzdem unbedenklich: dieser Skill läuft
  // über `runBaustein` (map/substanz/smoke-runner.ts), nicht über `runSkill`. Der
  // Baustein-Pfad ruft nie `capVbMarkdown` und schlägt kein Thinking-Headroom auf — der
  // aus RESERVE_TOKENS abgeleitete VB-Cap wird hier also nirgends angewandt. Die MAP misst
  // ihren Korpus selbst (`vb/korpus.ts`) und warnt, statt zu kürzen.
  maxTokens: 8192, // allow-reserve-output-budget: Baustein-Pfad, kein abgeleiteter VB-Cap
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-20T00:00:00.000Z',
  aktiv: false,
  enthaeltDokumentInhalte: true,
};

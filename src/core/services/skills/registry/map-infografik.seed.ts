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
  + 'ergänzen. Du antwortest ausschließlich mit dem geforderten JSON-Objekt.';

export const MAP_INFOGRAFIK_SKILL: SkillRecord = {
  id: MAP_INFOGRAFIK_SKILL_ID,
  name: 'MAP — Infografik-Extraktion',
  beschreibung:
    'Interner Extraktions-Lauf für Projekt-Canvas, Delta zum Stand der Technik und '
    + 'Wirkungskette; ein Lauf je Einreichung, Ergebnis je VB-Hash gecacht (dev).',
  version: 1,
  promptTemplate: `Extrahiere aus der Vorhabensbeschreibung die Angaben für drei Ansichten als JSON. Kennzeichne Vages als vage, statt es zu ergänzen.

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

Gib ausschließlich das geforderte JSON-Objekt zurück.`,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 4096,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: '2026-07-20T00:00:00.000Z',
  aktiv: false,
  enthaeltDokumentInhalte: true,
};

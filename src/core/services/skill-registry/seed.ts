/**
 * In-Memory-Seed der Skill-Registry, abgeleitet vom Gutachten-Testballon
 * (vormals `skills/kurzfassung-skill.ts` + `skills/checks.ts`).
 *
 * Verwendung:
 *  - Read-only-Fallback, solange keine `registry.json` existiert
 *    (Nicht-Kuratoren / vor dem ersten Seed-on-open) — UI-Hinweis
 *    „Standard-Skill (noch nicht kuratiert)".
 *  - Startbestand, den ein Schreibberechtigter beim Öffnen der Skill-
 *    Verwaltung einmalig auf den Share persistiert (Seed-on-open).
 *
 * Das `promptTemplate` ist der bestehende Testballon-Prompt UNVERÄNDERT — die
 * formalen Vorgaben kommen zusätzlich aus den Regeln (siehe `buildPromptVorgaben`),
 * damit das Gutachter-Verhalten gleich bleibt.
 */
import type { QualitaetsRegel, SkillRecord, SkillRegistryFile } from './types';

/** Fester Seed-Zeitstempel — deterministisch (kein `new Date()` zur Seed-Zeit). */
const SEED_TS = '2026-06-11T00:00:00.000Z';

const SEED_SYSTEM_PROMPT =
  'Du bist ein erfahrener Textassistent für ZIM-Gutachten. Du erstellst streng '
  + 'quellenbasierte Kurzfassungen von Vorhabensbeschreibungen. Antworte ausschließlich '
  + 'auf Deutsch und halte dich exakt an das vorgegebene Ausgabeformat.';

const SEED_PROMPT_TEMPLATE = `Erstelle die **Kurzfassung** der folgenden Vorhabensbeschreibung (VB) für ein ZIM-Gutachten.

## Stammdaten des Antrags
{{stammdaten}}

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

## Aufgabe & Kontrakt
Fasse die VB zu einer Kurzfassung von ca. 10 Sätzen zusammen (Toleranz 8–12 Sätze). Struktur, soweit im Antrag vorhanden:
1. Ausgangsproblem (1–2 Sätze)
2. Projektziel (2–3 Sätze)
3. Technischer Ansatz (3–4 Sätze)
4. Erwartetes Ergebnis (1–2 Sätze)
5. Anwendungsbereich (1 Satz)

Regeln:
- **Streng quellenbasiert:** Nutze ausschließlich Inhalte der VB. Erfinde nichts.
- Fehlende Angaben kennzeichne wörtlich mit „[Im Antrag nicht genannt]".
- **Aktiver Stil:** Formuliere „Das Vorhaben…" statt „Der Antragsteller plant…". Keine Arbeitspaket-Verweise („AP1").
- **Fließtext** im finalen Teil — KEINE Aufzählungen, keine Zwischenüberschriften.

## Ausgabeformat (genau diese drei Abschnitte, jeweils mit der ###-Überschrift)
### Quellenanalyse
Gruppierte wörtliche Kurz-Zitate aus der VB, die du als Beleg nutzt — je mit knapper Fundstellen-Angabe.

### Entwurf
Ein erster, noch ungeschliffener Entwurf der Kurzfassung.

### Finaler Text
Der finale, geschliffene Fließtext der Kurzfassung (ca. 10 Sätze, KEIN Listenformat).`;

/** Skill-ID des Kurzfassung-Skills — Konstante für Lookups (Antragsdetail). */
export const KURZFASSUNG_SKILL_ID = 'gutachten-kurzfassung';

function regel(
  id: string,
  name: string,
  typ: string,
  params: Record<string, unknown>,
  schweregrad: 'fehler' | 'hinweis',
): QualitaetsRegel {
  return { id, name, typ, params, schweregrad, aktiv: true, erstellt_am: SEED_TS, geaendert_am: SEED_TS };
}

/** Die 5 Default-Regeln (Testballon-Checks + zwei Praxis-Befunde). */
export const SEED_REGELN: QualitaetsRegel[] = [
  regel('seed-satzanzahl', 'Satzanzahl', 'satzanzahl', { min: 8, max: 12 }, 'fehler'),
  regel('seed-zeichen-max', 'Zeichenlimit', 'zeichen_max', { max: 1000 }, 'fehler'),
  regel('seed-satzlaenge', 'Satzlänge', 'satzlaenge_max', { maxWoerter: 25 }, 'hinweis'),
  regel(
    'seed-passiv-stil',
    'Passiv-Floskel',
    'verbotenes_muster',
    {
      muster: [
        'Der Antragsteller plant',
        'Der Antragsteller (?:beabsichtigt|möchte|will|wird|hat)',
        'Der Antrag\\b',
        '\\bAP\\s?\\d+',
      ],
      istRegex: true,
    },
    'hinweis',
  ),
  regel('seed-keine-aufzaehlungen', 'Keine Aufzählungen', 'keine_aufzaehlungen', {}, 'fehler'),
];

export const SEED_SKILL: SkillRecord = {
  id: KURZFASSUNG_SKILL_ID,
  name: 'Kurzfassung (Gutachten)',
  beschreibung: 'Erstellt die Kurzfassung eines ZIM-Gutachtens aus der Vorhabensbeschreibung.',
  version: 1,
  promptTemplate: SEED_PROMPT_TEMPLATE,
  systemPrompt: SEED_SYSTEM_PROMPT,
  maxTokens: 2048,
  modifiers: {
    neu: 'Erstelle eine **vollständig neue** Variante der Kurzfassung mit anderer Formulierung und '
      + 'anderer Schwerpunktsetzung — gleiche Faktenbasis, gleicher Kontrakt.',
    kuerzer: 'Kürze die Kurzfassung spürbar (Richtung 8 Sätze). Streiche Redundanzen und Nebenaspekte; '
      + 'behalte Ausgangsproblem, Projektziel und den Kern des technischen Ansatzes.',
    laenger: 'Erweitere die Kurzfassung systematisch um etwa 50 % (Richtung 12 Sätze), indem du zusätzliche '
      + 'im Antrag genannte Details zu technischem Ansatz und erwartetem Ergebnis aufnimmst. Erfinde nichts — '
      + 'nutze ausschließlich Inhalte der VB.',
  },
  regelIds: SEED_REGELN.map(r => r.id),
  slots: ['stammdaten', 'vbMarkdown'],
  geaendert_am: SEED_TS,
};

/** Vollständiger Seed-Registry-Stand (Startbestand / Read-only-Fallback). */
export const SEED_REGISTRY: SkillRegistryFile = {
  version: 1,
  updated_at: SEED_TS,
  skills: [SEED_SKILL],
  regeln: SEED_REGELN,
};

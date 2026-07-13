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
import type {
  QualitaetsRegel, SkillModifierKey, SkillRecord, SkillRegistryFile, WorkflowDef, WorkflowStep,
} from './types';
import { SEED_NF_SKILL, SEED_NF_REGELN, NF_DEF } from './nf-skill.seed';
import { GA_QS_REGELN } from './ga-qs.seed';
import { ANFRAGE_ANONYMISIEREN_SKILL } from './anfrage-anonymisieren.seed';
import { ANFRAGE_METADATEN_SKILL } from './anfrage-metadaten.seed';
import { AUFBEREITUNG_ASPEKTE_SKILL } from './aufbereitung-aspekte.seed';
import { AUFBEREITUNG_STECKBRIEF_SKILL } from './aufbereitung-steckbrief.seed';
import { AUFBEREITUNG_ZAHLEN_SKILL } from './aufbereitung-zahlen.seed';
import { AUFBEREITUNG_GLOSSAR_SKILL } from './aufbereitung-glossar.seed';
import { GRUNDSATZ_REGELN } from './grundsatz';

/** Fester Seed-Zeitstempel — deterministisch (kein `new Date()` zur Seed-Zeit). */
const SEED_TS = '2026-06-11T00:00:00.000Z';

const SEED_SYSTEM_PROMPT =
  'Du bist ein erfahrener Textassistent für ZIM-Gutachten. Du erstellst streng '
  + 'quellenbasierte Kurzfassungen von Vorhabensbeschreibungen. Antworte ausschließlich '
  + 'auf Deutsch und halte dich exakt an das vorgegebene Ausgabeformat.';

/** Basis-Beschreibung des `### Quellenanalyse`-Blocks (A + B teilen sie wortgleich). */
const QUELLENANALYSE_KONTRAKT =
  'Gruppierte wörtliche Kurz-Zitate aus der VB, die du als Beleg nutzt — je mit knapper Fundstellen-Angabe.';

/**
 * Zusatz-Instruktion (Journey-Paket 4): jede Zitat-Zeile mit der gestützten
 * Satz-Referenz abschließen. ZURÜCKGEBAUT (2026-07): die live A/B-Skills tragen den
 * Kontrakt NICHT mehr (`buildKurzfassungPrompt(false)`), weil das interne Modell damit
 * in einen Reasoning-Loop lief. Der `true`-Zweig bleibt NUR erhalten, damit die
 * Rückbau-Migration (`applyBelegKontraktRevert`) das Kontrakt-Template byte-genau
 * erkennen und auf den Alt-Stand zurücksetzen kann.
 */
const BELEG_KONTRAKT_SUFFIX =
  ' Schließe jede Zitat-Zeile mit einem Verweis auf die gestützten Sätze deines finalen Textes ab: '
  + '„ → stützt Satz N" (N = 1-basierte Satznummer; mehrere Sätze „→ stützt Sätze N, M"). '
  + 'Beispiel: „…wörtliches Zitat…" (Abschn. 1.1) → stützt Satz 2.';

/** Quellenanalyse-Kontrakt-Zeile, optional mit Beleg→Satz-Zusatz (opt-in pro Skill). */
function quellenanalyseKontrakt(belegKontrakt: boolean): string {
  return belegKontrakt ? QUELLENANALYSE_KONTRAKT + BELEG_KONTRAKT_SUFFIX : QUELLENANALYSE_KONTRAKT;
}

/**
 * A-Prompt (Kurzfassung). `belegKontrakt=false` reproduziert das Template BYTE-
 * IDENTISCH zum Vor-Paket-4-Stand (kritisch: die Rollout-Migration vergleicht den
 * Share-Stand gegen `buildKurzfassungPrompt(false)`, um kuratierte Edits zu schützen).
 */
export function buildKurzfassungPrompt(belegKontrakt: boolean): string {
  return `Erstelle die **Kurzfassung** der folgenden Vorhabensbeschreibung (VB) für ein ZIM-Gutachten.

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

${GRUNDSATZ_REGELN}
- **Fließtext** im finalen Teil — KEINE Aufzählungen, keine Zwischenüberschriften.

## Ausgabeformat (genau diese drei Abschnitte, jeweils mit der ###-Überschrift)
### Quellenanalyse
${quellenanalyseKontrakt(belegKontrakt)}

### Entwurf
Ein erster, noch ungeschliffener Entwurf der Kurzfassung.

### Finaler Text
Der finale, geschliffene Fließtext der Kurzfassung (ca. 10 Sätze, KEIN Listenformat).

## Stilbeispiel (nur Schreibstil — Inhalt stammt aus einem anderen Antrag, NICHT übernehmen)
Das Vorhaben beschreibt die Entwicklung eines Bio-Inkjet-Drucksystems, das durch eine begleitende Diagnose-App individuelle Hautpflegeprodukte direkt auf die Haut des Nutzers aufbringt. Das System kombiniert Mikrofluidik, biokompatible Tinten und präzise Düsentechnologie, um Tintentröpfchen im Mikrometer-Bereich exakt zu positionieren.`;
}

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
  // v2: Der Beleg→Satz-Marker-Kontrakt (Journey-Paket 4) ist zurückgebaut — das interne
  // Modell lief mit dem Kontrakt in einen langen Reasoning-Loop und lieferte keine
  // verwertbare Ausgabe mehr. Der Quellenbezug wird jetzt rein deterministisch aus der
  // Wortüberlappung abgeleitet (belegAbleitung.ts), NICHT vom Modell erfragt.
  version: 2,
  promptTemplate: buildKurzfassungPrompt(false),
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
  // Strukturierte Ausgabe (Mess-Gate 2026-06 für A bestätigt: 5/5 robustes Parsen,
  // flüssiger ~10-Satz-Block unter teilJoin '\n', keine deterministische Regression).
  // B bewusst NICHT strukturiert (Absatz-Regel-Konflikt). Der `### Finaler Text`-Block
  // wird als JSON-Array dieser Keys geliefert; finalerText bleibt die flache Quelle der
  // Wahrheit (Teile per '\n' verbunden), Badges sind render-only.
  teilStruktur: [
    { key: 'ausgangsproblem', label: 'Ausgangsproblem' },
    { key: 'projektziel', label: 'Projektziel' },
    { key: 'technischer_ansatz', label: 'Technischer Ansatz' },
    { key: 'erwartetes_ergebnis', label: 'Erwartetes Ergebnis' },
    { key: 'anwendungsbereich', label: 'Anwendungsbereich' },
  ],
  teilJoin: '\n',
  geaendert_am: SEED_TS,
};

/* -------------------------------------------------------------------------- */
/* Abschnitte B–G des Gutachten-Workflows (additiv zum Kurzfassung-Seed A)      */
/* -------------------------------------------------------------------------- */

/** System-Rolle der Abschnitts-Skills B–G (allgemeiner als der A-Prompt). */
const SEED_SYSTEM_PROMPT_ABSCHNITT =
  'Du bist ein erfahrener Textassistent für ZIM-Gutachten. Du erstellst streng '
  + 'quellenbasierte Abschnitte eines ZIM-Gutachtens aus der Vorhabensbeschreibung. '
  + 'Antworte ausschließlich auf Deutsch und halte dich exakt an das vorgegebene Ausgabeformat.';

/** Re-Invocation-Instruktionen für die Abschnitte B–G (für alle gleich). */
const ABSCHNITT_MODIFIERS: Record<SkillModifierKey, string> = {
  neu: 'Erstelle eine **vollständig neue** Variante dieses Abschnitts mit anderer Formulierung und '
    + 'anderer Schwerpunktsetzung — gleiche Faktenbasis, gleicher Kontrakt.',
  kuerzer: 'Kürze diesen Abschnitt spürbar. Streiche Redundanzen und Nebenaspekte; behalte die '
    + 'Kernaussagen und die geforderte Struktur.',
  laenger: 'Erweitere diesen Abschnitt systematisch um etwa 50 % (Ziellänge), indem du zusätzliche '
    + 'im Antrag genannte Details — Teilschritte, Wechselwirkungen, Datenflüsse — aufnimmst. Erfinde '
    + 'nichts; nutze ausschließlich Inhalte der VB.',
};

/** Deklarierte Slots der Abschnitts-Skills (inkl. {{vorherigeAbschnitte}}). */
const ABSCHNITT_SLOTS = ['stammdaten', 'vbMarkdown', 'vorherigeAbschnitte'];

/** Pflicht-Anfang für Abschnitt G (Check + Prompt nutzen denselben String). */
const G_PFLICHT_ANFANG =
  'Das Vorhaben wird sehr positive Auswirkungen auf das FuE-Potenzial und Know-how der '
  + 'Antragsteller haben. Im Unternehmen wird die Technologiekompetenz im Bereich';

/** Baut ein Abschnitts-Template (gemeinsame Hülle, abschnittsspezifischer Kontrakt). */
export function abschnittTemplate(opts: {
  name: string;
  aufgabe: string;
  formatRegeln: readonly string[];
  finalText: string;
  /** Optionales Stilbeispiel (nur Schreibstil; wird klar markiert angehängt). */
  stilbeispiel?: string;
  /**
   * Journey-Paket 4: Zitat→Satz-Referenz-Zusatz im Quellenanalyse-Kontrakt (opt-in
   * pro Abschnitt, aktuell nur B). `false`/undefined reproduziert das Template
   * BYTE-IDENTISCH zum Vor-Paket-4-Stand (kritisch für die Rollout-Migration).
   */
  belegKontrakt?: boolean;
}): string {
  const extra = opts.formatRegeln.map(r => `- ${r}`).join('\n');
  const stil = opts.stilbeispiel
    ? `\n\n## Stilbeispiel (nur Schreibstil — Inhalt stammt aus einem anderen Antrag, NICHT übernehmen)\n${opts.stilbeispiel}`
    : '';
  return `Erstelle den Abschnitt **${opts.name}** eines ZIM-Gutachtens aus der folgenden Vorhabensbeschreibung (VB).

## Stammdaten des Antrags
{{stammdaten}}

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

## Bereits freigegebene frühere Abschnitte (Konsistenz-Referenz — Terminologie und keine Widersprüche)
{{vorherigeAbschnitte}}

## Aufgabe & Kontrakt
${opts.aufgabe}

${GRUNDSATZ_REGELN}
${extra}

## Ausgabeformat (genau diese zwei Abschnitte, jeweils mit der ###-Überschrift)
### Quellenanalyse
${quellenanalyseKontrakt(opts.belegKontrakt ?? false)}

### Finaler Text
${opts.finalText}${stil}`;
}

/** Regel-Seeds der Abschnitte B–G (nur maschinell prüfbare Kontrakte). */
export const SEED_REGELN_BG: QualitaetsRegel[] = [
  // B
  regel('seed-b-wortanzahl', 'Wortanzahl', 'wortanzahl', { min: 750 }, 'fehler'),
  regel('seed-b-absatz-min', 'Absätze', 'absatz_min', { min: 4 }, 'fehler'),
  regel('seed-b-keine-aufzaehlungen', 'Keine Aufzählungen', 'keine_aufzaehlungen', {}, 'fehler'),
  // C
  regel('seed-c-wortanzahl', 'Wortanzahl', 'wortanzahl', { min: 300, max: 350 }, 'fehler'),
  // D
  regel('seed-d-wortanzahl', 'Wortanzahl', 'wortanzahl', { min: 300, max: 350 }, 'fehler'),
  regel('seed-d-keine-aufzaehlungen', 'Keine Aufzählungen', 'keine_aufzaehlungen', {}, 'fehler'),
  // G
  regel('seed-g-pflicht-anfang', 'Pflicht-Anfang', 'pflicht_anfang', { text: G_PFLICHT_ANFANG }, 'fehler'),
];

/** Skill-ID des Abschnitts B (Konstante für Lookups + Rollout-Migration). */
export const AUSGANGSLAGE_SKILL_ID = 'gutachten-ausgangslage';

/**
 * `abschnittTemplate`-Optionen für Abschnitt B — als Konstante herausgezogen, damit
 * die Rollout-Migration (Journey-Paket 4) den Alt-Stand (`belegKontrakt` weg) gegen
 * den Neu-Stand (`belegKontrakt: true`) byte-genau bilden kann.
 */
export const B_ABSCHNITT_OPTS = {
  name: 'Hintergrund, Stand der Technik, Lösungsweg',
  aufgabe:
    'Stelle Hintergrund, Stand der Technik und Lösungsweg des Vorhabens in drei gedanklichen Teilen dar:\n'
    + '1. **Hintergrund / Ausgangssituation** (Richtwert ≥ 150 Wörter): Problem, Bedarf, Motivation.\n'
    + '2. **Stand der Technik** (Richtwert ≥ 150 Wörter): bestehende Ansätze/Lösungen und ihre Grenzen.\n'
    + '3. **Lösungsweg** (Richtwert ≥ 450 Wörter): der im Antrag beschriebene Lösungsansatz in einigen '
    + 'Absätzen — KEINE mehrseitige, ins Detail gehende Darstellung des Lösungswegs.',
  formatRegeln: [
    'Gliedere den finalen Text in **mindestens vier Absätze**.',
    '**Fließtext** — keine Aufzählungen, keine Zwischenüberschriften.',
    'Gesamtumfang **mindestens 750 Wörter**.',
  ],
  finalText:
    'Der finale Fließtext (mindestens 750 Wörter, mindestens vier Absätze): Hintergrund, Stand der '
    + 'Technik und Lösungsweg in dieser Reihenfolge, ohne Aufzählungen.',
} as const;

/** Die Abschnitts-Skills B–G (Schritt A = SEED_SKILL bleibt unverändert). */
export const SEED_SKILLS_BG: SkillRecord[] = [
  {
    id: AUSGANGSLAGE_SKILL_ID,
    name: 'Hintergrund, Stand der Technik, Lösungsweg (B)',
    beschreibung: 'Abschnitt B des ZIM-Gutachtens: Hintergrund, Stand der Technik und Lösungsweg.',
    // v2: Beleg→Satz-Marker-Kontrakt zurückgebaut (wie A) — Quellenbezug rein
    // deterministisch (belegAbleitung.ts), nicht vom Modell erfragt.
    version: 2,
    promptTemplate: abschnittTemplate({ ...B_ABSCHNITT_OPTS }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 4096,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: ['seed-b-wortanzahl', 'seed-b-absatz-min', 'seed-b-keine-aufzaehlungen', 'seed-passiv-stil'],
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: 'gutachten-risiken',
    name: 'Technische Risiken (C)',
    beschreibung: 'Abschnitt C des ZIM-Gutachtens: technische Risiken des Vorhabens.',
    version: 1,
    promptTemplate: abschnittTemplate({
      name: 'Technische Risiken',
      aufgabe:
        'Beschreibe die technischen Risiken des Vorhabens. Nenne ausschließlich Risiken, die im Antrag '
        + 'explizit benannt sind. Stelle je Risiko einen kurzen Kurztitel voran und erläutere es in 2–3 Sätzen.',
      formatRegeln: [
        'Format je Risiko: „**Kurztitel:** 2–3 Sätze" (Kurztitel fett, danach Fließtext — KEINE Spiegelstrich-Liste).',
        'Gesamtumfang **300–350 Wörter**.',
      ],
      finalText:
        'Der finale Text (300–350 Wörter): je technisches Risiko ein fett gesetzter Kurztitel, gefolgt '
        + 'von 2–3 erläuternden Sätzen.',
      stilbeispiel:
        'Im Vorhaben werden mehrere technische Risiken explizit benannt. Die Feinabstimmung der '
        + 'Drucktechnologie stellt eine Kernherausforderung dar, weil die Druckkopftechnologie hochpräzise '
        + 'mechanische Komponenten erfordert.',
    }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 2048,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: ['seed-c-wortanzahl', 'seed-passiv-stil'],
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: 'gutachten-markt',
    name: 'Markt (D)',
    beschreibung: 'Abschnitt D des ZIM-Gutachtens: Markt für die Projektergebnisse.',
    version: 1,
    promptTemplate: abschnittTemplate({
      name: 'Markt',
      aufgabe:
        'Stelle den Markt für die Projektergebnisse dar — ausschließlich auf Basis der Antragsinhalte: '
        + 'anvisierte Märkte und Kundengruppen, Marktgröße/Marktanteile, ggf. Stückpreise/Stückzahlen sowie '
        + 'den Wettbewerbsvergleich.',
      formatRegeln: [
        '**Fließtext** — keine Aufzählungen.',
        'Gesamtumfang **300–350 Wörter**.',
      ],
      finalText:
        'Der finale Fließtext (300–350 Wörter) zum Markt — nur Antragsinhalte, keine externen Marktkenntnisse.',
    }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 2048,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: ['seed-d-wortanzahl', 'seed-d-keine-aufzaehlungen', 'seed-passiv-stil'],
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: 'gutachten-unternehmen',
    name: 'Unternehmensgegenstand (E)',
    beschreibung: 'Abschnitt E des ZIM-Gutachtens: Unternehmensgegenstand der Partner.',
    version: 1,
    promptTemplate: abschnittTemplate({
      name: 'Unternehmensgegenstand',
      aufgabe:
        'Beschreibe den Unternehmensgegenstand der antragstellenden Partner — je Partner 2–3 Sätze. Nutze '
        + 'ausschließlich die Angaben aus dem Antrag (keine externen Unternehmenskenntnisse, keine '
        + 'Entwicklungshistorie).',
      formatRegeln: ['**Fließtext**, je Partner 2–3 Sätze.'],
      finalText: 'Der finale Text: je antragstellendem Partner 2–3 Sätze zum Unternehmensgegenstand.',
    }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 2048,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: [],
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: 'gutachten-verwertung',
    name: 'Ergebnisverwertung (F)',
    beschreibung: 'Abschnitt F des ZIM-Gutachtens: Ergebnisverwertung und Einfluss auf das Unternehmen.',
    version: 1,
    promptTemplate: abschnittTemplate({
      name: 'Ergebnisverwertung',
      aufgabe:
        'Beschreibe die Ergebnisverwertung und den erwarteten Einfluss auf die Entwicklung des Unternehmens '
        + '— je Firma 3 Sätze. Orientiere dich am Muster: „Bei erfolgreichem Abschluss erwartet das Unternehmen '
        + 'Umsatz- und Mitarbeiterzuwächse durch …" (ohne konkrete Stückpreise/Stückzahlen).',
      formatRegeln: ['**Fließtext**, je Firma 3 Sätze.'],
      finalText: 'Der finale Text: je Firma 3 Sätze zur Ergebnisverwertung nach dem genannten Muster.',
    }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 2048,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: [],
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: 'gutachten-kompetenz',
    name: 'Technologiekompetenz (G)',
    beschreibung: 'Abschnitt G des ZIM-Gutachtens: Auswirkungen auf die Technologiekompetenz.',
    version: 1,
    promptTemplate: abschnittTemplate({
      name: 'Technologiekompetenz',
      aufgabe:
        'Beschreibe die Auswirkungen des FuE-Projektes auf die Technologiekompetenz der Antragsteller. '
        + 'Beginne mit dem vorgegebenen Pflicht-Satz und führe ihn fort, indem du das konkrete Technologiefeld '
        + 'und den Kompetenzgewinn aus dem Antrag benennst.',
      formatRegeln: [
        `Beginne den finalen Text **exakt** mit: „${G_PFLICHT_ANFANG} …" und führe den Satz fort.`,
      ],
      finalText:
        'Der finale Fließtext, der mit dem Pflicht-Satz beginnt und den Kompetenzgewinn (Technologiefeld aus '
        + 'dem Antrag) beschreibt.',
      stilbeispiel:
        'Das Vorhaben wird sehr positive Auswirkungen auf das FuE-Potenzial und Know-how der Antragsteller '
        + 'haben. Im Unternehmen wird die Technologiekompetenz im Bereich hochpräziser Bio-Inkjet-'
        + 'Drucktechnologie, integrierter Echtzeit-Hautanalyse-Sensorik und adaptiver Formulierungsmethoden '
        + 'deutlich erweitert.',
    }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 2048,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: ['seed-g-pflicht-anfang', 'seed-passiv-stil'],
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
];

/* -------------------------------------------------------------------------- */
/* LLM-QS — qualitativer, BERATENDER Prüf-Skill (ergänzt die mechanischen Checks) */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Relevanz-Map — interner Auswahl-Lauf (kuratierter VB-Kontext statt Volltext) */
/* -------------------------------------------------------------------------- */

/** Skill-ID des Relevanz-Map-Skills (interner Auswahl-Lauf, Pitfall #30 intern-pflichtig). */
export const RELEVANZ_MAP_SKILL_ID = 'relevanz-map';

const SEED_RELEVANZ_MAP_SYSTEM_PROMPT =
  'Du ordnest VB-Abschnitte den Teilen eines ZIM-Gutachtens zu. Du WÄHLST AUS und '
  + 'fasst NICHTS zusammen — du gibst ausschließlich Heading-IDs zurück, keinen Fließtext. '
  + 'Wähle großzügig (Recall vor Precision); im Zweifel einen Abschnitt mehr.';

/**
 * Relevanz-Map-Skill. Das eigentliche Prompt baut zur Laufzeit `buildRelevanzPrompt`
 * (nummerierte Heading-Liste + Gutachten-Teile + VB); dieser Record ist
 * Policy-Subjekt (`{{vbMarkdown}}` → `skillEnthaeltDokumentInhalte` true →
 * intern-pflichtig, Pitfall #30) + System-Rolle + Token-Budget. KEINE Regeln
 * (kein Fließtext-Ergebnis, nichts maschinell zu prüfen).
 */
export const SEED_RELEVANZ_MAP_SKILL: SkillRecord = {
  id: RELEVANZ_MAP_SKILL_ID,
  name: 'Relevanz-Map (VB-Auswahl)',
  beschreibung: 'Interner Auswahl-Lauf: ordnet VB-Abschnitte den Gutachten-Teilen zu (wählt aus, fasst nicht zusammen).',
  version: 1,
  promptTemplate: `Wähle je Gutachten-Teil die relevanten VB-Abschnitte (Heading-IDs) aus. Fasse NICHTS zusammen.

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

Gib je Gutachten-Teil eine Zeile „<teil-id>: h0, h3, …" aus — ausschließlich Heading-IDs.`,
  systemPrompt: SEED_RELEVANZ_MAP_SYSTEM_PROMPT,
  maxTokens: 1024,
  // Re-Invocation spielt keine Rolle — neutrale Pflichtwerte.
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['vbMarkdown'],
  geaendert_am: SEED_TS,
};

/* -------------------------------------------------------------------------- */
/* Workflow-Definition „zim-ep" — geordnete Schritte A–G als kuratierbare Daten */
/* -------------------------------------------------------------------------- */

/** Baut einen ZIM-EP-Seed-Schritt (id == nr == kurz == ankerKey == Buchstabe). */
function epStep(id: string, label: string, skillId: string, retrievalQueries?: string[]): WorkflowStep {
  return {
    id, nr: id, kurz: id, label, skillId, ankerKey: id, gateExpr: 'immer',
    ...(retrievalQueries ? { retrievalQueries } : {}),
  };
}

/**
 * Seed-Workflow „zim-ep" — spiegelt die bisher hart verdrahtete `ZIM_EP_WORKFLOW`
 * (Reihenfolge / Skills / Anker; alle Gates `'immer'`, da A–G keine Gate-Funktion
 * trugen). Quelle der Wahrheit für die Laufzeit, solange keine kuratierte
 * `WorkflowDef` vorliegt. Ein Cross-Layer-Test (`gutachten/__tests__`) sichert die
 * Deckungsgleichheit mit `ZIM_EP_WORKFLOW` gegen Drift.
 */
export const ZIM_EP_DEF: WorkflowDef = {
  id: 'zim-ep',
  name: 'ZIM-EP-Gutachten',
  version: 1,
  steps: [
    epStep('A', 'Kurzfassung', 'gutachten-kurzfassung'),
    epStep('B', 'Hintergrund, Stand der Technik, Lösungsweg', 'gutachten-ausgangslage'),
    epStep('C', 'Technische Risiken', 'gutachten-risiken', ['technische Risiken Herausforderungen']),
    epStep('D', 'Markt', 'gutachten-markt', ['Markt Zielgruppen Stückpreis Wettbewerb']),
    epStep('E', 'Unternehmensgegenstand', 'gutachten-unternehmen'),
    epStep('F', 'Ergebnisverwertung', 'gutachten-verwertung', ['Verwertung Umsatz Markteinführung']),
    epStep('G', 'Technologiekompetenz', 'gutachten-kompetenz'),
  ],
};

export const SEED_WORKFLOWS: WorkflowDef[] = [ZIM_EP_DEF, NF_DEF];

/** Vollständiger Seed-Registry-Stand (Startbestand / Read-only-Fallback). */
export const SEED_REGISTRY: SkillRegistryFile = {
  version: 1,
  updated_at: SEED_TS,
  skills: [
    SEED_SKILL, ...SEED_SKILLS_BG, SEED_QS_SKILL, SEED_RELEVANZ_MAP_SKILL, SEED_NF_SKILL,
    ANFRAGE_ANONYMISIEREN_SKILL, ANFRAGE_METADATEN_SKILL,
    AUFBEREITUNG_ASPEKTE_SKILL, AUFBEREITUNG_STECKBRIEF_SKILL, AUFBEREITUNG_ZAHLEN_SKILL,
    AUFBEREITUNG_GLOSSAR_SKILL,
  ],
  regeln: [...SEED_REGELN, ...SEED_REGELN_BG, ...SEED_NF_REGELN, ...GA_QS_REGELN],
  workflows: SEED_WORKFLOWS,
};

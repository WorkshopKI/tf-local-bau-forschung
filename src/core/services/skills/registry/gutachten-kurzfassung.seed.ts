/**
 * Seed des Kurzfassungs-Skills A + der geteilten Gutachten-Regelbibliothek.
 *
 * Das `promptTemplate` ist der bestehende Testballon-Prompt UNVERÄNDERT — die
 * formalen Vorgaben kommen zusätzlich aus den Regeln (siehe `buildPromptVorgaben`),
 * damit das Gutachter-Verhalten gleich bleibt.
 *
 * Bis zum Konsolidierungs-Pass lag dieser Inhalt in `seed.ts`; dort blieb nur noch
 * der Registry-Zusammenbau. Reine Verschiebung — jedes Byte der Prompts, Regel-IDs
 * und `version`-Zahlen ist unverändert (mehrere Migrationen vergleichen byte-genau).
 */
import { GRUNDSATZ_REGELN } from './grundsatz';
import { SEED_TS, quellenanalyseKontrakt, regel } from './ga-seed-basis';
import type { QualitaetsRegel, SkillModifierKey, SkillRecord, SkillVorgaben } from './types';

const SEED_SYSTEM_PROMPT =
  'Du bist ein erfahrener Textassistent für ZIM-Gutachten. Du erstellst streng '
  + 'quellenbasierte Kurzfassungen von Vorhabensbeschreibungen. Antworte ausschließlich '
  + 'auf Deutsch und halte dich exakt an das vorgegebene Ausgabeformat.';

/**
 * A-Prompt (Kurzfassung). `belegKontrakt=false` reproduziert das Template BYTE-
 * IDENTISCH zum Vor-Paket-4-Stand (kritisch: die Rollout-Migration vergleicht den
 * Share-Stand gegen `buildKurzfassungPrompt(false)`, um kuratierte Edits zu schützen).
 */
/**
 * Vor-Dedup-Aufgabenzeile von A („ca. 10 Sätze, Toleranz 8–12"). Eingefroren für zwei
 * byte-genaue Migrations-Vergleiche: `applyUmfangDedup` (ganzes Template) und
 * `applyAUmfangKuratiert` (nur diese Zeile, auf einem kuratierten A-Prompt).
 */
export const A_AUFGABE_ZEILE_UMFANG_ALT =
  'Fasse die VB zu einer Kurzfassung von ca. 10 Sätzen zusammen (Toleranz 8–12 Sätze). Struktur, soweit im Antrag vorhanden:';

/** Live-Aufgabenzeile von A — ohne Satzzahl (die kommt allein aus der `satzanzahl`-Vorgabe). */
export const A_AUFGABE_ZEILE =
  'Fasse die VB zu einer Kurzfassung zusammen. Struktur, soweit im Antrag vorhanden:';

export function buildKurzfassungPrompt(belegKontrakt: boolean, umfangAlt = false): string {
  // Umfang single-source (2026-07): die feste Satzzahl in der Prosa dupliziert die
  // `satzanzahl`-Regel und lief bei Regel-Edits auseinander. Der Live-Seed nennt
  // die Zahl daher NICHT mehr — sie kommt allein aus der Regel (`## Formale Vorgaben`).
  // `umfangAlt: true` reproduziert den Vor-Dedup-Wortlaut („ca. 10 Sätze") BYTE-GENAU —
  // ausschließlich für die `applyUmfangDedup`-Migrations-Erkennung.
  const aufgabeZeile = umfangAlt ? A_AUFGABE_ZEILE_UMFANG_ALT : A_AUFGABE_ZEILE;
  const finalZeile = umfangAlt
    ? 'Der finale, geschliffene Fließtext der Kurzfassung (ca. 10 Sätze, KEIN Listenformat).'
    : 'Der finale, geschliffene Fließtext der Kurzfassung (KEIN Listenformat).';
  return `Erstelle die **Kurzfassung** der folgenden Vorhabensbeschreibung (VB) für ein ZIM-Gutachten.

## Stammdaten des Antrags
{{stammdaten}}

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

## Aufgabe & Kontrakt
${aufgabeZeile}
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
${finalZeile}

## Stilbeispiel (nur Schreibstil — Inhalt stammt aus einem anderen Antrag, NICHT übernehmen)
Das Vorhaben beschreibt die Entwicklung eines Bio-Inkjet-Drucksystems, das durch eine begleitende Diagnose-App individuelle Hautpflegeprodukte direkt auf die Haut des Nutzers aufbringt. Das System kombiniert Mikrofluidik, biokompatible Tinten und präzise Düsentechnologie, um Tintentröpfchen im Mikrometer-Bereich exakt zu positionieren.`;
}

/** Skill-ID des Kurzfassung-Skills — Konstante für Lookups (Antragsdetail). */
export const KURZFASSUNG_SKILL_ID = 'gutachten-kurzfassung';

/**
 * ID der Interpunktions-Regel („kein Semikolon, kein Gedankenstrich"). Konstante,
 * weil sie an allen generativen Gutachten-Skills hängt und von der einmaligen
 * Migration (`applyInterpunktion`) referenziert wird.
 */
export const INTERPUNKTION_REGEL_ID = 'seed-keine-semikolon-gedankenstrich';

/**
 * Bibliotheks-Regeln des Gutachten-Stamms.
 *
 * Bis v2.295 standen hier zusätzlich Satzanzahl/Zeichenlimit/Satzlänge/Keine
 * Aufzählungen — je Skill ein eigener Record. Diese Ein-Skill-Werte leben seit
 * v2.296 als `SkillRecord.vorgaben` am Skill (siehe `vorgaben.ts`); die Bibliothek
 * führt nur noch, was mehrere Skills teilen.
 */
export const SEED_REGELN: QualitaetsRegel[] = [
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
  // Generelle Vorgabe für JEDEN generierten Gutachten-Fließtext (v2.297): weder
  // Semikolon noch Gedankenstrich im Satz — beides ist typische LLM-Manier und im
  // ZIM-Gutachten unerwünscht (eigenständige Hauptsätze).
  //
  // Die Muster sind bewusst eng gefasst: ein nacktes `[–—]` träfe auch Zahlen-
  // bereiche („2024–2026"), ein nacktes `-` jede Wortverbindung („KI-gestützt",
  // „Know-how"). Der gemeinte Gebrauch als Gedankenstrich steht IMMER zwischen
  // Leerzeichen — genau darauf zielen die drei Dash-Muster.
  //
  // Regex-Modus ⇒ der Prompt-Hinweis kommt AUSSCHLIESSLICH aus `hinweisVermeiden`/
  // `hinweisStattdessen` (`check-engine.ts`), nie aus den Mustern selbst.
  regel(
    INTERPUNKTION_REGEL_ID,
    'Semikolon & Gedankenstrich',
    'verbotenes_muster',
    {
      muster: [';', '\\s[–—]\\s', '\\s-\\s', '--'],
      eingabeModus: 'regex',
      hinweisVermeiden: 'Semikolons und Gedankenstriche im Satz',
      hinweisStattdessen:
        'eigenständige Hauptsätze oder eine Verbindung mit „und", „aber", „dabei", „dadurch". '
        + 'Bindestriche in Wortverbindungen wie „KI-gestützt" bleiben unverändert',
    },
    'fehler',
  ),
];

/** Zeichenlimit von A vor dem Herkunfts-Fix — eingefroren für den Guard der Migration. */
export const A_ZEICHEN_MAX_ALT = 1000;
/** Zeichenlimit von A: „900 ± 200" gegen ein Formularfeld, das 1.200 fasst. */
export const A_ZEICHEN_MAX = 1100;
/** Der Grund hinter `A_ZEICHEN_MAX` — Anzeige-Text, geht NICHT in den Prompt. */
export const A_ZEICHEN_HERKUNFT =
  'Formularfeld der Fachprüfung, in das die Kurzfassung kopiert wird — es fasst '
  + 'max. 1.200 Zeichen. Vorgabe „900 ± 200" lässt Luft zum harten Rand.';

/**
 * Umfangs-/Form-Vorgaben des Kurzfassung-Skills A (vormals die Regel-Records
 * `seed-satzanzahl` / `seed-zeichen-max` / `seed-satzlaenge` /
 * `seed-keine-aufzaehlungen` — Werte unverändert übernommen).
 */
const SEED_VORGABEN_A: SkillVorgaben = {
  // 9–11 statt 8–12 (2026-08): der kuratierte Share führte die Kurzfassung längst auf
  // 9–11, während die Prompt-Prosa noch „ca. 10 Sätze (Toleranz 8–12)" sagte. Beide
  // Zahlen standen im selben Prompt (Haiku lieferte 8 Sätze — nach dem Prosa-Text
  // korrekt, nach der Regel ein Hinweis). Der Prosa-Satz ist weg, die Regel ist die
  // einzige Quelle, und ihr Wert ist der des Teams. Rollout: `applyAUmfangKuratiert`.
  satzanzahl: { schweregrad: 'fehler', min: 9, max: 11, persoenlichAnpassbar: true },
  // 1.100 statt 1.000 (2026-08) — und erstmals mit dem Grund daneben. Das Limit ist
  // keine Stilentscheidung: die Kurzfassung wird in ein fremdes Formularfeld kopiert,
  // das 1.200 Zeichen fasst. Der Kurator hat daraus „900 ± 200" gemacht, also 1.100 als
  // Obergrenze mit hundert Zeichen Luft zum harten Rand. Nebenwirkung: der in v2.372
  // beschriebene Widerspruch zur Satzzahl entspannt sich (9–11 Sätze à ≤ 25 Wörter
  // sprengten 1.000 rechnerisch). Rollout: `applyAZeichenHerkunft`.
  zeichenMax: {
    schweregrad: 'fehler',
    max: A_ZEICHEN_MAX,
    herkunft: A_ZEICHEN_HERKUNFT,
  },
  satzlaengeMax: { schweregrad: 'hinweis', maxWoerter: 25 },
  keineAufzaehlungen: { schweregrad: 'fehler' },
};

/**
 * Vor-Fix-Modifier von A: „Richtung 8 Sätze" / „Richtung 12 Sätze" — die Ränder der
 * ALTEN Satzanzahl-Vorgabe. Eingefroren für den byte-genauen Vergleich in
 * `applyAUmfangKuratiert`; NICHT mehr geseedet.
 */
export const A_MODIFIERS_UMFANG_ALT: Record<SkillModifierKey, string> = {
  neu: 'Erstelle eine **vollständig neue** Variante der Kurzfassung mit anderer Formulierung und '
    + 'anderer Schwerpunktsetzung — gleiche Faktenbasis, gleicher Kontrakt.',
  kuerzer: 'Kürze die Kurzfassung spürbar (Richtung 8 Sätze). Streiche Redundanzen und Nebenaspekte; '
    + 'behalte Ausgangsproblem, Projektziel und den Kern des technischen Ansatzes.',
  laenger: 'Erweitere die Kurzfassung systematisch um etwa 50 % (Richtung 12 Sätze), indem du zusätzliche '
    + 'im Antrag genannte Details zu technischem Ansatz und erwartetem Ergebnis aufnimmst. Erfinde nichts — '
    + 'nutze ausschließlich Inhalte der VB.',
};

/**
 * Live-Modifier von A. Die Richtwerte nennen die Ränder der `satzanzahl`-Vorgabe (9–11)
 * — die dritte Stelle, an der die Satzzahl in A stand. Sie zeigte weiter auf 8/12 und
 * wurde damit brisant, als der beschränkte Auto-Retry `kuerzer` selbsttätig auslöst:
 * eine Zeichen-Überschreitung hätte den Text auf 8 Sätze gezogen und damit unter die
 * geprüfte Untergrenze.
 */
const A_MODIFIERS: Record<SkillModifierKey, string> = {
  neu: A_MODIFIERS_UMFANG_ALT.neu,
  kuerzer: 'Kürze die Kurzfassung spürbar (Richtung 9 Sätze). Streiche Redundanzen und Nebenaspekte; '
    + 'behalte Ausgangsproblem, Projektziel und den Kern des technischen Ansatzes.',
  laenger: 'Erweitere die Kurzfassung systematisch um etwa 50 % (Richtung 11 Sätze), indem du zusätzliche '
    + 'im Antrag genannte Details zu technischem Ansatz und erwartetem Ergebnis aufnimmst. Erfinde nichts — '
    + 'nutze ausschließlich Inhalte der VB.',
};

export const SEED_SKILL: SkillRecord = {
  id: KURZFASSUNG_SKILL_ID,
  name: 'Kurzfassung (Gutachten)',
  beschreibung: 'Erstellt die Kurzfassung eines ZIM-Gutachtens aus der Vorhabensbeschreibung.',
  // v2: Der Beleg→Satz-Marker-Kontrakt (Journey-Paket 4) ist zurückgebaut — das interne
  // Modell lief mit dem Kontrakt in einen langen Reasoning-Loop und lieferte keine
  // verwertbare Ausgabe mehr. Der Quellenbezug wird jetzt rein deterministisch aus der
  // Wortüberlappung abgeleitet (belegAbleitung.ts), NICHT vom Modell erfragt.
  // v3: Satzzahl einheitlich 9–11 (Vorgabe + Modifier-Richtwerte, Prosa nennt keine
  // Zahl mehr) — Rollout auf Bestands-Shares über `applyAUmfangKuratiert`.
  // v4: Zeichenlimit 1.000 → 1.100 mit Herkunft am Wert — Rollout über
  // `applyAZeichenHerkunft`.
  version: 4,
  promptTemplate: buildKurzfassungPrompt(false),
  systemPrompt: SEED_SYSTEM_PROMPT,
  maxTokens: 2048,
  modifiers: A_MODIFIERS,
  regelIds: SEED_REGELN.map(r => r.id),
  vorgaben: SEED_VORGABEN_A,
  slots: ['stammdaten', 'vbMarkdown'],
  // KEINE `teilStruktur` (entfernt 2026-08, Migration `ga-teilstruktur-entfernen-2026-08`):
  // Der Block hätte den finalen Text als JSON-Felder verlangt und sich dabei Vorrang vor
  // der Formatangabe der Vorlage zugesprochen. Seit v2.335 hängt an jeder Generierung
  // automatisch der Feinschliff, und `applyLektorat` verwirft `teile` — die JSON-Ausgabe
  // wurde also immer weggeworfen. Zugleich stand die im Seed festgelegte Schlüssel-
  // Reihenfolge quer zu jeder kuratierten Umsortierung der Teile im Prompt-Text, ohne dass
  // der Kurator das im Editor sehen konnte. Details: docs/architecture/teilstruktur.md.
  geaendert_am: SEED_TS,
};

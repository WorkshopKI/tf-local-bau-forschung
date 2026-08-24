/**
 * Seeds der Gutachten-Abschnitte B–G (additiv zum Kurzfassungs-Seed A).
 *
 * Die sechs Abschnitts-Skills teilen System-Rolle, Modifier, Slots und die
 * Template-Hülle und ändern sich in der Praxis gemeinsam — deshalb liegen sie in
 * EINER Datei statt in sechs.
 *
 * ACHTUNG: mehrere `*_ALT`-Konstanten sind EINGEFRORENE Vor-Fix-Wortlaute. Sie
 * werden nicht mehr geseedet, sondern dienen ausschließlich dem byte-genauen
 * Vergleich in `migrations.ts` — nur so bleibt ein kuratierter Share-Edit
 * unberührt. Sie sehen aus wie toter Code und sind es nicht.
 *
 * Bis zum Konsolidierungs-Pass lag dieser Inhalt in `seed.ts`. Reine Verschiebung.
 */
import { SEED_TS, abschnittTemplate } from './ga-seed-basis';
import { INTERPUNKTION_REGEL_ID } from './gutachten-kurzfassung.seed';
import type { QualitaetsRegel, SkillModifierKey, SkillRecord, SkillVorgaben } from './types';

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

/**
 * Bibliotheks-Regeln, die JEDER generative Gutachten-Abschnitt B–G trägt. Eine
 * Konstante statt sieben Literale, damit die nächste geteilte Regel an genau einer
 * Stelle nachgezogen wird. (A erbt die Bibliothek ohnehin komplett.)
 */
const GA_ABSCHNITT_REGEL_IDS = ['seed-passiv-stil', INTERPUNKTION_REGEL_ID];

/**
 * Bibliotheks-Regeln der Abschnitte B–G — seit v2.296 LEER.
 *
 * Hier standen neun Ein-Skill-Records (3× Keine Aufzählungen, 3× Wortanzahl, Absätze,
 * Pflicht-Anfang, dazu die schon damals als Waise markierte `seed-c-wortanzahl`). Sie
 * parametrisierten jeweils GENAU einen Abschnitt und waren damit keine Bibliothek,
 * sondern Skill-Eigenschaften. Die Werte stehen jetzt unverändert in
 * `SEED_VORGABEN_B/C/D/G` am jeweiligen Skill.
 *
 * Der Export bleibt (Barrel + Merge-Tests referenzieren ihn) und ist bewusst als
 * leeres Array erhalten statt gelöscht — `mergeMissingSeeds` ergänzt dadurch auf
 * Bestands-Shares nichts mehr nach, was `applySkillVorgaben` gerade weggeräumt hat.
 */
export const SEED_REGELN_BG: QualitaetsRegel[] = [];

/**
 * Umfangs-/Form-Vorgaben des Abschnitts B (vormals `seed-b-*`).
 *
 * Wortanzahl **400–500** statt der alten 750: das ist der Wert, den das Team im Editor
 * gesetzt hat und den jeder Bestands-Share führt. Der Seed trug weiter die 750 und
 * hätte einen frischen Share auf ein Ziel gestellt, das nachgemessen niemand erreicht
 * (Haiku landet auch nach der Korrektur bei rund 430).
 */
const SEED_VORGABEN_B: SkillVorgaben = {
  wortanzahl: { schweregrad: 'fehler', min: 400, max: 500, persoenlichAnpassbar: true },
  absatzMin: { schweregrad: 'fehler', min: 4 },
  keineAufzaehlungen: { schweregrad: 'fehler' },
};

/**
 * Umfangs-/Form-Vorgaben des Abschnitts C (vormals `seed-c-umfang`/`seed-c-keine-aufzaehlungen`).
 *
 * Wortanzahl als **`fehler`**: als `hinweis` hatte die Vorgabe keinen Durchsetzungsweg —
 * `chooseRetryModifier` startet einen Korrektur-Versuch nur bei `fehler`, der
 * `laenger`-Zweig war für einen zu kurzen Abschnitt also unerreichbar. Gemessen hob das
 * den Abschnitt von 244–321 auf 288–378 Wörter (Haiku, drei fiktive VBs, je drei Läufe).
 */
const SEED_VORGABEN_C: SkillVorgaben = {
  wortanzahl: { schweregrad: 'fehler', min: 300, max: 350, persoenlichAnpassbar: true },
  keineAufzaehlungen: { schweregrad: 'fehler' },
};

/** Umfangs-/Form-Vorgaben des Abschnitts D (vormals `seed-d-*`). */
const SEED_VORGABEN_D: SkillVorgaben = {
  wortanzahl: { schweregrad: 'fehler', min: 300, max: 350, persoenlichAnpassbar: true },
  keineAufzaehlungen: { schweregrad: 'fehler' },
};

/**
 * Umfangs-/Form-Vorgaben der Abschnitte E und F (2026-08 ergänzt).
 *
 * Vorher prüfte an beiden Abschnitten NUR die Interpunktions-Regel — je ein Check
 * gegen sechs an A und fünf an B. Ob der Text zu dünn war oder in eine Aufzählung
 * kippte, maß nichts, und im Messlauf waren E und F mit 451 bzw. 711 Zeichen die
 * kürzesten Abschnitte überhaupt.
 *
 * Beide Abschnitte skalieren mit der Zahl der Partner („je Partner 2–3 Sätze",
 * „je Firma 3 Sätze"). Eine Obergrenze wäre damit falsch — sie träfe jeden
 * Verbund. Gesetzt ist deshalb nur ein **Boden**, geeicht am kleinsten
 * rechtmäßigen Fall (Einzelvorhaben, ein Antragsteller): E kam dort auf 48, F auf
 * 85 Wörter. Der Boden fängt den entarteten Lauf, nicht den normalen — und er ist
 * ein `hinweis`, weil eine einzige Messung keine Fehlergrenze hat.
 *
 * `keineAufzaehlungen` ist dagegen hart: beide Prompts verlangen ausdrücklich
 * Fließtext, und alle übrigen Abschnitte führen die Vorgabe seit jeher als Fehler.
 */
const SEED_VORGABEN_E: SkillVorgaben = {
  wortanzahl: { schweregrad: 'hinweis', min: 40, persoenlichAnpassbar: true },
  satzlaengeMax: { schweregrad: 'hinweis', maxWoerter: 25 },
  keineAufzaehlungen: { schweregrad: 'fehler' },
};

/** Siehe `SEED_VORGABEN_E` — F fordert je Firma drei Sätze, der Boden liegt entsprechend höher. */
const SEED_VORGABEN_F: SkillVorgaben = {
  wortanzahl: { schweregrad: 'hinweis', min: 60, persoenlichAnpassbar: true },
  satzlaengeMax: { schweregrad: 'hinweis', maxWoerter: 25 },
  keineAufzaehlungen: { schweregrad: 'fehler' },
};

/** Form-Vorgabe des Abschnitts G (vormals `seed-g-pflicht-anfang`). */
const SEED_VORGABEN_G: SkillVorgaben = {
  pflichtAnfang: { schweregrad: 'fehler', text: G_PFLICHT_ANFANG },
};

/** Skill-ID des Abschnitts B (Konstante für Lookups + Rollout-Migration). */
export const AUSGANGSLAGE_SKILL_ID = 'gutachten-ausgangslage';

/**
 * Vor-Dedup-Wortlaut von Abschnitt B (feste „mindestens 750 Wörter" / „vier Absätze" in
 * der Prosa), eingefroren für die BYTE-genaue `applyUmfangDedup`-Migrations-Erkennung.
 * NICHT mehr live geseedet — Muster wie `C_ABSCHNITT_OPTS_ALT`.
 */
export const B_ABSCHNITT_OPTS_UMFANG_ALT = {
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

/**
 * Zwischenstand von B: Prosa ohne Total-Zahl, Teil-Richtwerte aber weiter als feste
 * Wortzahlen (≥150/≥150/≥450). Eingefroren für die BYTE-genaue Erkennung der
 * `ga-b-teil-anteile`-Migration. NICHT mehr live geseedet — Muster wie
 * `C_ABSCHNITT_OPTS_NEU`.
 */
export const B_ABSCHNITT_OPTS_TEILE_ABSOLUT = {
  name: B_ABSCHNITT_OPTS_UMFANG_ALT.name,
  aufgabe: B_ABSCHNITT_OPTS_UMFANG_ALT.aufgabe,
  formatRegeln: [
    '**Fließtext** — keine Aufzählungen, keine Zwischenüberschriften.',
  ],
  finalText:
    'Der finale Fließtext: Hintergrund, Stand der Technik und Lösungsweg in dieser '
    + 'Reihenfolge, ohne Aufzählungen.',
} as const;

/**
 * Live-Seed-Optionen für Abschnitt B — **Umfang single-source, jetzt auch in den Teilen**.
 *
 * Die Total-Zahl war bereits aus der Prosa entfernt (sie kommt aus `seed-b-wortanzahl`),
 * die drei Teil-Richtwerte blieben als „weiche Struktur-Hinweise" stehen — aber als feste
 * Wortzahlen. Damit war die Ent-Dopplung nur halb: das Team kurierte die Regel später von
 * „mindestens 750" auf „400–500", und die Prosa verlangte unverändert ≥150 + ≥150 + ≥450,
 * also mindestens 750. Teil 3 allein riss schon die Obergrenze.
 *
 * Gemessen (Haiku, drei fiktive VBs, 08/2026): 360 / 364 / 364 Wörter — das Modell brach
 * BEIDE Vorgaben und wurde kürzer, statt sich für eine zu entscheiden. Dieselbe Reaktion
 * wie an Abschnitt A, wo Umfang und Inhalt gegeneinander zogen.
 *
 * Aufgelöst über die Form, nicht über eine neue Zahl: die Teile nennen jetzt ihren
 * **Anteil am Gesamtumfang** (ein Fünftel / ein Fünftel / drei Fünftel = das alte
 * Verhältnis 1:1:3). Ein Anteil kann dem Ganzen nicht widersprechen, gleich wie der
 * Kurator die Regel setzt. `findeUmfangKonflikte` meldet die Summen-Variante seither.
 */
export const B_ABSCHNITT_OPTS = {
  name: B_ABSCHNITT_OPTS_UMFANG_ALT.name,
  aufgabe:
    'Stelle Hintergrund, Stand der Technik und Lösungsweg des Vorhabens in drei gedanklichen Teilen dar:\n'
    + '1. **Hintergrund / Ausgangssituation** (rund ein Fünftel des Gesamtumfangs): Problem, Bedarf, Motivation.\n'
    + '2. **Stand der Technik** (rund ein Fünftel des Gesamtumfangs): bestehende Ansätze/Lösungen und ihre Grenzen.\n'
    + '3. **Lösungsweg** (rund drei Fünftel des Gesamtumfangs): der im Antrag beschriebene Lösungsansatz in '
    + 'einigen Absätzen — KEINE mehrseitige, ins Detail gehende Darstellung des Lösungswegs.',
  formatRegeln: [
    ...B_ABSCHNITT_OPTS_TEILE_ABSOLUT.formatRegeln,
    'Der Gesamtumfang aus den formalen Vorgaben gilt für den **finalen Text** und verteilt sich im '
      + 'Verhältnis 1:1:3 auf die drei Teile — der Lösungsweg wird also rund dreimal so lang wie '
      + 'jeder der beiden anderen. Schöpfe den Umfang aus: die Vorhabensbeschreibung trägt zu jedem '
      + 'der drei Teile mehr Material, als in den Abschnitt passt.',
  ],
  finalText: B_ABSCHNITT_OPTS_TEILE_ABSOLUT.finalText,
} as const;

/** Skill-ID des Abschnitts C (Konstante für Lookups + Rollout-Migration). */
export const RISIKEN_SKILL_ID = 'gutachten-risiken';

/**
 * Alt-Stand der C-Optionen (2-Abschnitt-Liste, je Risiko fett gesetzter Kurztitel). Wird
 * NICHT mehr aktiv geseedet — dient nur dem BYTE-genauen Vergleich der
 * `ga-risiken-entwurf`-Migration, damit kuratierte C-Edits unberührt bleiben.
 */
export const C_ABSCHNITT_OPTS_ALT = {
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
} as const;

/**
 * Neu-Stand der C-Optionen (3-Abschnitt: Entwurf → gefilterter Fließtext) MIT fester
 * Umfangs-Prosa („Richtwert 300–350 Wörter"), eingefroren für die BYTE-genaue
 * `applyUmfangDedupCD`-Migrations-Erkennung. NICHT mehr live geseedet — der Live-Seed
 * (`C_ABSCHNITT_OPTS_NEU`) nennt die Wortzahl nicht mehr (Umfang single-source).
 */
export const C_ABSCHNITT_OPTS_NEU_UMFANG_ALT = {
  name: 'Technische Risiken',
  aufgabe:
    'Ermittle die im Antrag explizit benannten technischen Risiken des Vorhabens und leite daraus '
    + 'einen finalen Fließtext ab. Erstelle zunächst einen Entwurf mit ALLEN genannten technischen '
    + 'Risiken. Beschränke den finalen Text anschließend auf die zentralen Risiken, die auf dem '
    + 'Lösungsweg des Vorhabens liegen und vom Vorhaben beeinflussbar sind.',
  formatRegeln: [
    'Entwurf: je im Antrag genanntem technischem Risiko ein fett gesetzter Kurztitel, gefolgt von '
      + '2–3 Sätzen (vollständige Liste).',
    'Finaler Text: durchgehender **Fließtext ohne Kurztitel und ohne Aufzählung**.',
    'Nur Risiken, die auf dem **Lösungsweg des Vorhabens** liegen und vom Vorhaben **beeinflussbar** '
      + 'sind, gehören in den finalen Text. Externe, nicht beeinflussbare Risiken (z. B. Marktlage, '
      + 'Regulatorik, Verhalten Dritter) werden im finalen Text weggelassen.',
    'Enthält der Entwurf mehr als drei Risiken, beschränke den finalen Text auf **höchstens drei** '
      + 'zentrale Risiken des Lösungswegs.',
    'Umfang des finalen Textes: Richtwert 300–350 Wörter.',
  ],
  entwurf:
    'Ein Entwurf mit ALLEN im Antrag genannten technischen Risiken: je Risiko ein fett gesetzter '
    + 'Kurztitel, gefolgt von 2–3 erläuternden Sätzen (auch externe / nicht beeinflussbare Risiken '
    + 'hier aufführen).',
  finalText:
    'Der finale Fließtext (Richtwert 300–350 Wörter, KEINE Kurztitel, KEINE Aufzählung): die '
    + 'höchstens drei zentralen, auf dem Lösungsweg liegenden und vom Vorhaben beeinflussbaren '
    + 'technischen Risiken als zusammenhängender Fließtext.',
  stilbeispiel:
    'Ein zentrales technisches Risiko betrifft die Feinabstimmung der Drucktechnologie. Da die '
    + 'Druckkopftechnologie hochpräzise mechanische Komponenten erfordert, kann eine unzureichende '
    + 'Kalibrierung die Tröpfchenpositionierung beeinträchtigen und den angestrebten '
    + 'Automatisierungsgrad senken.',
} as const;

/**
 * Live-Seed der C-Optionen — **Umfang single-source**: wie der eingefrorene Stand, aber OHNE
 * feste Wortzahl in `formatRegeln`/`finalText`. Der Umfang kommt allein aus der Regel
 * `seed-c-umfang` (300–350, hinweis). `name`/`aufgabe`/`entwurf`/`stilbeispiel` byte-identisch
 * zum Alt-Stand; `formatRegeln` = Alt ohne die letzte (Umfangs-)Zeile.
 */
export const C_ABSCHNITT_OPTS_NEU = {
  name: C_ABSCHNITT_OPTS_NEU_UMFANG_ALT.name,
  aufgabe: C_ABSCHNITT_OPTS_NEU_UMFANG_ALT.aufgabe,
  formatRegeln: C_ABSCHNITT_OPTS_NEU_UMFANG_ALT.formatRegeln.slice(0, -1),
  entwurf: C_ABSCHNITT_OPTS_NEU_UMFANG_ALT.entwurf,
  finalText:
    'Der finale Fließtext (KEINE Kurztitel, KEINE Aufzählung): die '
    + 'höchstens drei zentralen, auf dem Lösungsweg liegenden und vom Vorhaben beeinflussbaren '
    + 'technischen Risiken als zusammenhängender Fließtext.',
  stilbeispiel: C_ABSCHNITT_OPTS_NEU_UMFANG_ALT.stilbeispiel,
} as const;

/**
 * Live-Seed der C-Optionen seit 2026-08: **fünf statt drei** Risiken im finalen Text.
 *
 * Der Abschnitt forderte etwas, das er selbst verbot. Der Prompt deckelte auf höchstens
 * drei Risiken, die Vorgabe verlangte 300–350 Wörter — drei Risiken à zwei bis drei
 * Sätze ergeben rund 200. Gemessen unterschritten ALLE vier Modelle: die interne KI mit
 * 106 Wörtern, Haiku 188, Sonnet 248, Opus 288. Ein Befund, der über die Modellklassen
 * hinweg gleich ausfällt, ist kein Modelldefekt.
 *
 * Aufgelöst über die Risiko-Grenze, nicht über die Wortzahl: fünf Risiken à zwei bis
 * drei Sätze treffen die 300–350 Wörter, ohne dass die Vorgabe (weicher Hinweis, vom
 * Kurator gesetzt) angefasst werden muss. `name`/`aufgabe`/`entwurf`/`stilbeispiel`
 * bleiben byte-identisch; geändert sind genau die zwei Stellen, die „drei" sagten.
 */
export const C_ABSCHNITT_OPTS_FUENF = {
  name: C_ABSCHNITT_OPTS_NEU.name,
  aufgabe: C_ABSCHNITT_OPTS_NEU.aufgabe,
  formatRegeln: [
    ...C_ABSCHNITT_OPTS_NEU.formatRegeln.slice(0, -1),
    'Enthält der Entwurf mehr als fünf Risiken, beschränke den finalen Text auf **höchstens fünf** '
      + 'zentrale Risiken des Lösungswegs.',
  ],
  entwurf: C_ABSCHNITT_OPTS_NEU.entwurf,
  finalText:
    'Der finale Fließtext (KEINE Kurztitel, KEINE Aufzählung): die '
    + 'höchstens fünf zentralen, auf dem Lösungsweg liegenden und vom Vorhaben beeinflussbaren '
    + 'technischen Risiken als zusammenhängender Fließtext.',
  stilbeispiel: C_ABSCHNITT_OPTS_NEU.stilbeispiel,
} as const;

/**
 * Live-Seed der C-Optionen seit 08/2026 — der finale Text bekommt eine **eigene**
 * Umfangs-Ansage.
 *
 * Der Vorgänger-Stand hob die Risiko-Grenze von drei auf fünf, mit der Rechnung „fünf
 * Risiken à zwei bis drei Sätze treffen die 300–350 Wörter". Nachgemessen (Haiku, drei
 * fiktive VBs) trug sie nicht: 203 / 235 / 218 Wörter bei 12–14 Sätzen. Das Modell hielt
 * sich exakt an „fünf × 2–3 Sätze" — die Rechnung unterstellte nur rund 24 Wörter je
 * Satz, geschrieben werden 15 bis 17.
 *
 * Der eigentliche Grund liegt eine Ebene tiefer: „2–3 Sätze je Risiko" ist im Prompt am
 * **Entwurf** festgemacht, der finale Text hatte gar keine eigene Tiefenangabe. Das Modell
 * übernahm mangels Alternative die Rate, mit der es gerade den Entwurf geschrieben hatte
 * (gemessen 25–32 Wörter je Risiko) — und traf damit zwangsläufig ein Fünftel bis ein
 * Drittel unter dem Ziel.
 *
 * Eine feste Satzzahl je Risiko kann das nicht heilen: die Zahl der aufgenommenen Risiken
 * schwankt (7–10 im Entwurf, bis zu fünf im finalen Text), eine feste Rate × schwankende
 * Anzahl trifft keine feste Summe. Der finale Text bekommt darum den **Gesamtumfang als
 * Budget**, das sich auf die aufgenommenen Risiken verteilt — bei wenigen Risiken
 * entsprechend ausführlicher je Risiko. Dieselbe Auflösung wie an B (Anteil statt fester
 * Zahl); die kuratierte 300–350-Vorgabe bleibt unangetastet.
 */
export const C_ABSCHNITT_OPTS = {
  name: C_ABSCHNITT_OPTS_FUENF.name,
  aufgabe: C_ABSCHNITT_OPTS_FUENF.aufgabe,
  formatRegeln: [
    ...C_ABSCHNITT_OPTS_FUENF.formatRegeln,
    'Der Gesamtumfang aus den formalen Vorgaben gilt für den **finalen Text** und verteilt sich zu '
      + 'gleichen Teilen auf die dort aufgenommenen Risiken. Je Risiko fällt er damit deutlich '
      + 'ausführlicher aus als die 2–3 Sätze des Entwurfs: der Entwurf listet, der finale Text erklärt '
      + '(Ursache, Auswirkung auf das Vorhabenziel, Umgang im Vorhaben). Schöpfe den Umfang aus — '
      + 'nimmst du weniger Risiken auf, wird jedes entsprechend ausführlicher.',
  ],
  entwurf: C_ABSCHNITT_OPTS_FUENF.entwurf,
  finalText: C_ABSCHNITT_OPTS_FUENF.finalText,
  stilbeispiel: C_ABSCHNITT_OPTS_FUENF.stilbeispiel,
} as const;

/** Skill-ID des Abschnitts D (Markt) — Konstante für Lookups + Umfang-Dedup-Migration. */
export const MARKT_SKILL_ID = 'gutachten-markt';

/**
 * Vor-Dedup-Wortlaut von Abschnitt D (feste „300–350 Wörter"), eingefroren für die
 * BYTE-genaue `applyUmfangDedupCD`-Migrations-Erkennung. NICHT mehr live geseedet.
 */
export const D_ABSCHNITT_OPTS_UMFANG_ALT = {
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
} as const;

/**
 * Live-Seed der D-Optionen — Umfang single-source: OHNE feste Wortzahl. Der Umfang kommt allein
 * aus der Regel `seed-d-wortanzahl` (300–350). `name`/`aufgabe` byte-identisch zum Alt-Stand.
 */
export const D_ABSCHNITT_OPTS = {
  name: D_ABSCHNITT_OPTS_UMFANG_ALT.name,
  aufgabe: D_ABSCHNITT_OPTS_UMFANG_ALT.aufgabe,
  formatRegeln: [
    '**Fließtext** — keine Aufzählungen.',
  ],
  finalText:
    'Der finale Fließtext zum Markt — nur Antragsinhalte, keine externen Marktkenntnisse.',
} as const;

/** Skill-ID des Abschnitts E (Unternehmensgegenstand) — Konstante für die Vorgaben-Migration. */
export const UNTERNEHMEN_SKILL_ID = 'gutachten-unternehmen';

/** Skill-ID des Abschnitts F (Ergebnisverwertung) — Konstante für die Vorgaben-Migration. */
export const VERWERTUNG_SKILL_ID = 'gutachten-verwertung';

/** Skill-ID des Abschnitts G (Technologiekompetenz) — Konstante für Lookups + Migration. */
export const KOMPETENZ_SKILL_ID = 'gutachten-kompetenz';

const G_AUFGABE =
  'Beschreibe die Auswirkungen des FuE-Projektes auf die Technologiekompetenz der Antragsteller. '
  + 'Beginne mit dem vorgegebenen Pflicht-Satz und führe ihn fort, indem du das konkrete Technologiefeld '
  + 'und den Kompetenzgewinn aus dem Antrag benennst.';

const G_FINAL_TEXT =
  'Der finale Fließtext, der mit dem Pflicht-Satz beginnt und den Kompetenzgewinn (Technologiefeld aus '
  + 'dem Antrag) beschreibt.';

const G_STILBEISPIEL =
  'Das Vorhaben wird sehr positive Auswirkungen auf das FuE-Potenzial und Know-how der Antragsteller '
  + 'haben. Im Unternehmen wird die Technologiekompetenz im Bereich hochpräziser Bio-Inkjet-'
  + 'Drucktechnologie, integrierter Echtzeit-Hautanalyse-Sensorik und adaptiver Formulierungsmethoden '
  + 'deutlich erweitert.';

/**
 * Vor-Fix-Wortlaut von Abschnitt G: der Pflicht-Anfang steckte als zitierte, mit „…"
 * abgeschnittene Inline-Regel in `formatRegeln`. Eingefroren für die BYTE-genaue
 * `applyPflichtAnfangKlar`-Migrations-Erkennung — NICHT mehr live geseedet.
 */
export const G_ABSCHNITT_OPTS_PFLICHT_ALT = {
  name: 'Technologiekompetenz',
  aufgabe: G_AUFGABE,
  formatRegeln: [
    `Beginne den finalen Text **exakt** mit: „${G_PFLICHT_ANFANG} …" und führe den Satz fort.`, // allow-elidierte-wortlaut-vorgabe: eingefrorener Vor-Fix-Wortlaut, nur Migrations-Erkennung — GENAU dieser Text löste den Reasoning-Loop aus
  ],
  finalText: G_FINAL_TEXT,
  stilbeispiel: G_STILBEISPIEL,
} as const;

/**
 * Live-Seed der G-Optionen: der Pflicht-Anfang wandert aus der zitierten Inline-Regel in
 * den eigenen `pflichtAnfang`-Block (unzitiert, zeilenbegrenzt, mit explizitem Hinweis auf
 * das absichtliche Satz-Ende). Siehe die Begründung an `abschnittTemplate.pflichtAnfang`.
 */
export const G_ABSCHNITT_OPTS = {
  name: G_ABSCHNITT_OPTS_PFLICHT_ALT.name,
  aufgabe: G_AUFGABE,
  formatRegeln: [
    'Der finale Text beginnt mit dem unten vorgegebenen Pflicht-Anfang und führt ihn fort.',
  ],
  pflichtAnfang: G_PFLICHT_ANFANG,
  finalText: G_FINAL_TEXT,
  stilbeispiel: G_STILBEISPIEL,
} as const;

/** Die Abschnitts-Skills B–G (Schritt A = SEED_SKILL bleibt unverändert). */
export const SEED_SKILLS_BG: SkillRecord[] = [
  {
    id: AUSGANGSLAGE_SKILL_ID,
    name: 'Hintergrund, Stand der Technik, Lösungsweg (B)',
    beschreibung: 'Abschnitt B des ZIM-Gutachtens: Hintergrund, Stand der Technik und Lösungsweg.',
    // v2: Beleg→Satz-Marker-Kontrakt zurückgebaut (wie A) — Quellenbezug rein
    // deterministisch (belegAbleitung.ts), nicht vom Modell erfragt.
    // v4: Teil-Richtwerte als Anteil statt fester Wortzahl (`applyBTeilAnteile`) — die
    // festen ≥150/≥150/≥450 summierten sich auf 750 gegen eine kuratierte Regel „400–500".
    version: 4,
    promptTemplate: abschnittTemplate({ ...B_ABSCHNITT_OPTS }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 4096,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: [...GA_ABSCHNITT_REGEL_IDS],
    vorgaben: SEED_VORGABEN_B,
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: RISIKEN_SKILL_ID,
    name: 'Technische Risiken (C)',
    beschreibung: 'Abschnitt C des ZIM-Gutachtens: technische Risiken des Vorhabens.',
    // v2: Entwurf → gefilterter Fließtext. `### Entwurf` = vollständige Risiko-Liste
    // (Zwischenschritt, im KontextPanel sichtbar); `### Finaler Text` = Fließtext ohne
    // Kurztitel, ≤3 Risiken auf dem Lösungsweg (externe/nicht beeinflussbare Risiken weg).
    // maxTokens 2048 → 4096: 3-Abschnitt-Ausgabe (Liste + Fließtext + Quellenanalyse) würde
    // sonst auf dem DirectLLM-/Eval-Pfad abgeschnitten. Rollout: `applyRisikenEntwurf`.
    // v3: Risiko-Deckel drei → fünf (`applyCFuenfRisiken`), damit Deckel und
    // Wortzahl-Vorgabe nicht länger gegeneinander stehen.
    // v4: der finale Text bekommt eine eigene Tiefenangabe (`applyCFinalUmfang`) — der
    // Deckel-Fix von v3 hielt nachgemessen nicht (203–235 statt 300–350 Wörter).
    version: 4,
    promptTemplate: abschnittTemplate({ ...C_ABSCHNITT_OPTS }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 4096,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: [...GA_ABSCHNITT_REGEL_IDS],
    vorgaben: SEED_VORGABEN_C,
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: MARKT_SKILL_ID,
    name: 'Markt (D)',
    beschreibung: 'Abschnitt D des ZIM-Gutachtens: Markt für die Projektergebnisse.',
    version: 1,
    promptTemplate: abschnittTemplate({ ...D_ABSCHNITT_OPTS }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 2048,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: [...GA_ABSCHNITT_REGEL_IDS],
    vorgaben: SEED_VORGABEN_D,
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: UNTERNEHMEN_SKILL_ID,
    name: 'Unternehmensgegenstand (E)',
    beschreibung: 'Abschnitt E des ZIM-Gutachtens: Unternehmensgegenstand der Partner.',
    // v2: erstmals eigene Vorgaben (`SEED_VORGABEN_E`) — Rollout `applyEfVorgaben`.
    version: 2,
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
    // E + F tragen bewusst KEINE Passiv-Regel (reine Prompt-Abschnitte), die
    // Interpunktions-Vorgabe gilt aber für jeden generierten Fließtext.
    regelIds: [INTERPUNKTION_REGEL_ID],
    vorgaben: SEED_VORGABEN_E,
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: VERWERTUNG_SKILL_ID,
    name: 'Ergebnisverwertung (F)',
    beschreibung: 'Abschnitt F des ZIM-Gutachtens: Ergebnisverwertung und Einfluss auf das Unternehmen.',
    // v2: erstmals eigene Vorgaben (`SEED_VORGABEN_F`) — Rollout `applyEfVorgaben`.
    version: 2,
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
    // Siehe E: nur die Interpunktions-Vorgabe, keine Passiv-Regel.
    regelIds: [INTERPUNKTION_REGEL_ID],
    vorgaben: SEED_VORGABEN_F,
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
  {
    id: KOMPETENZ_SKILL_ID,
    name: 'Technologiekompetenz (G)',
    beschreibung: 'Abschnitt G des ZIM-Gutachtens: Auswirkungen auf die Technologiekompetenz.',
    version: 2,
    promptTemplate: abschnittTemplate({ ...G_ABSCHNITT_OPTS }),
    systemPrompt: SEED_SYSTEM_PROMPT_ABSCHNITT,
    maxTokens: 2048,
    modifiers: ABSCHNITT_MODIFIERS,
    regelIds: [...GA_ABSCHNITT_REGEL_IDS],
    vorgaben: SEED_VORGABEN_G,
    slots: ABSCHNITT_SLOTS,
    geaendert_am: SEED_TS,
  },
];

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

// ---------------------------------------------------------------------------
// Veröffentlichungs-Kontrakt von A (2026-08)
// ---------------------------------------------------------------------------
//
// Die Kurzfassung wird VERÖFFENTLICHT (u. a. zur Prüfung auf Doppelförderung) und steht
// dort allein, ohne den Antrag daneben. Das stand nirgends — und ohne den Zweck war auch
// nicht begründbar, warum so vieles NICHT hineingehört. Der Messlauf 08/2026 zeigte
// beides: der Judge vermisste Antragsteller, FuE-Risiko und Abgrenzung zum Stand der
// Technik, während das Zeichenlimit schon gerissen war. Die Fachentscheidung des Teams:
// diese drei gehören nicht hinein, der Platz reicht dafür nicht.
//
// Drei Ergänzungen, alle additiv:
//  1. der Zweck (wer liest das, und wo steht es hinterher),
//  2. eine Weglass-Liste — ein Prompt ohne Weglass-Gebot lädt zum Ergänzen ein,
//  3. das Zeichenlimit als SCHREIB-Anweisung statt als Nachkontrolle: 1.100 Zeichen auf
//     zehn Sätze sind rund 15 Wörter je Satz. („Zähle nach und kürze" half nicht —
//     Modelle zählen Zeichen schlecht; die Wortlänge vorweg zu geben half.)

/** Zweck-Satz von A — Anker der Idempotenz von `mitVeroeffentlichungsKontrakt`. */
export const A_ZWECK_BLOCK =
  'Zweck: Die Kurzfassung erklärt einem fachfremden Leser, was in diesem Vorhaben gemacht '
  + 'werden soll. Sie wird veröffentlicht — unter anderem zur Prüfung auf Doppelförderung — '
  + 'und steht dort für sich allein, ohne den Antrag daneben.';

/** Ersatz für die „Erwartetes Ergebnis"-Zeile: der Judge nannte sie dreimal zu unbestimmt. */
export const A_ERGEBNIS_ZUSATZ =
  ' — nenne hier die konkreten Zielgrößen, die in der VB stehen (Kennwerte, Genauigkeiten, '
  + 'Bandbreiten, Prototyp). Ein allgemeines „ein funktionsfähiges System" ist zu wenig.';

/** Die vier zusätzlichen Regel-Bullets von A (nach der Fließtext-Zeile). */
export const A_ZUSATZ_REGELN = [
  '- Genau diese fünf Punkte und nichts darüber hinaus. NICHT hinein gehören: FuE-Risiko, '
    + 'Abgrenzung zum Stand der Technik, Angaben zum Antragsteller, Kosten, Personalaufwand, '
    + 'Laufzeit, Arbeitspakete, Kooperationspartner. Für all das reicht der Platz nicht — es '
    + 'steht an anderer Stelle im Gutachten.',
  '- Ohne Antragsteller als Satzsubjekt: „Im Vorhaben soll…", „Im Vorhaben ist geplant…", '
    + '„Das Vorhaben…" — nicht „Der Antragsteller plant…" und nicht der Firmenname.',
  '- Keine schmückenden Zusätze: „in Echtzeit", „intelligent", „IoT-gestützt", „hochpräzise" '
    + 'nur dann, wenn die VB sie selbst schreibt. Sachlicher Gutachtenton, kein Werbeton.',
  '- Der finale Text hat ZEHN Sätze und höchstens 1.100 Zeichen — beides gilt zugleich, also '
    + 'rund 15 Wörter je Satz. Schreibe von Anfang an in dieser Länge, statt am Ende zu kürzen: '
    + 'ein Gedanke je Satz, keine Doppelungen, keine Füllwörter. Weniger als neun Sätze sind '
    + 'ein Fehler, nicht eine gelungene Kürzung.',
].join('\n');

/**
 * Ausgabeformat-Block — nur nötig, wo er fehlt.
 *
 * Der kuratierte Share hatte ihn verloren. Folge: `parseSkillOutput` fand keine
 * `###`-Überschrift, nahm die GANZE Antwort als finalen Text und setzte die Warnung
 * „Antwort ohne erwartete Abschnitte". Gemessen wurde damit die vom Modell erfundene
 * Hülle mit — Titelzeile, Förderkennzeichen, Akronym, sogar eine Antragsteller-Zeile.
 * Das Zeichenlimit riss an dieser Hülle, nicht am Text.
 */
export const A_AUSGABEFORMAT_BLOCK = `

Ausgabeformat (genau diese drei Abschnitte, jeweils mit der ###-Überschrift)
### Quellenanalyse
${quellenanalyseKontrakt(false)}

### Entwurf
Ein erster, noch ungeschliffener Entwurf der Kurzfassung.

### Finaler Text
Der finale, geschliffene Fließtext der Kurzfassung — NUR der Fließtext selbst, ohne Überschrift, ohne Förderkennzeichen, ohne Akronym, ohne Antragsteller-Zeile und ohne Listenformat.

Genau zehn Sätze in dieser Verteilung: 2 zum Projektziel, 2 zum Ausgangsproblem, 3 zum technischen Ansatz, 2 zum erwarteten Ergebnis, 1 zum Anwendungsbereich. Jeder rund 15 Wörter, zusammen höchstens 1.100 Zeichen.`;

/**
 * Trägt den Veröffentlichungs-Kontrakt in ein A-Template — **dieselbe Funktion für den
 * Seed und für die Migration des kuratierten Shares**, damit beide nicht auseinanderlaufen.
 *
 * Rein und **idempotent** (der Zweck-Satz ist der Marker). Sie greift ausschließlich über
 * Anker, die BEIDE Fassungen tragen: das Seed-Template und der kuratierte Share führen
 * andere Satzzahlen und eine andere Punkt-Reihenfolge, aber dieselben Zeilen-Anfänge.
 * Fehlt ein Anker, bleibt der betroffene Teil aus — nie wird geraten.
 */
export function mitVeroeffentlichungsKontrakt(template: string): string {
  if (template.includes(A_ZWECK_BLOCK)) return template;
  let t = template;

  // 1. Zweck vor die Aufgaben-Zeile.
  if (t.includes(A_AUFGABE_ZEILE)) {
    t = t.replace(A_AUFGABE_ZEILE, `${A_ZWECK_BLOCK}\n\n${A_AUFGABE_ZEILE}`);
  }
  // 2. „Erwartetes Ergebnis"-Zeile schärfen (Satzzahl variiert je Fassung → Regex).
  t = t.replace(/^(4\. Erwartetes Ergebnis \([^)]*\))\s*$/m, `$1${A_ERGEBNIS_ZUSATZ}`);
  // 3. Zusatz-Regeln hinter die Fließtext-Zeile (Fett-Marker variieren → Regex).
  t = t.replace(/^(- \*{0,2}Fließtext\*{0,2} im finalen Teil.*)$/m, `$1\n${A_ZUSATZ_REGELN}`);
  // 4. Ausgabeformat nur, wo es fehlt — sonst stünde es doppelt im Prompt.
  if (!/^[ \t]*(?:#{1,6}|\*{1,3})[ \t#*]*Finaler[ \t]+Text\b/im.test(t)) {
    t = `${t.trimEnd()}${A_AUSGABEFORMAT_BLOCK}`;
  }
  return t;
}

/**
 * Beschreibung von A. Sie ist NICHT nur Anzeige-Text: der LLM-Judge der Eval bekommt
 * ausschließlich sie, um zu wissen, was der Abschnitt leisten soll. Stand der Umfang
 * nicht darin, wertete er gegen seine eigene Vorstellung — und zog Punkte für genau das
 * ab, was das Team bewusst weggelassen hat (Messlauf 08/2026: `vollstaendigkeit` 3,00
 * mit alter Beschreibung, 4,00 mit dieser, bei identischem Text).
 */
export const A_BESCHREIBUNG =
  'Erstellt die Kurzfassung eines ZIM-Gutachtens aus der Vorhabensbeschreibung. Sie erklärt '
  + 'einem fachfremden Leser in zehn Sätzen, was im Vorhaben gemacht werden soll, und wird '
  + 'veröffentlicht — unter anderem zur Prüfung auf Doppelförderung. Inhalt sind genau fünf '
  + 'Punkte: Projektziel, Ausgangsproblem, technischer Ansatz, erwartetes Ergebnis, '
  + 'Anwendungsbereich. Bewusst NICHT enthalten: Antragsteller und Firmenname, FuE-Risiko, '
  + 'Abgrenzung zum Stand der Technik, Kosten, Personalaufwand, Laufzeit, Arbeitspakete und '
  + 'Kooperationspartner — die stehen an anderer Stelle im Gutachten und passen in die Kürze '
  + 'nicht hinein. Ihr Fehlen ist kein Mangel.';

/** Beschreibung von A vor dem Veröffentlichungs-Kontrakt — Pristine-Guard der Migration. */
export const A_BESCHREIBUNG_ALT =
  'Erstellt die Kurzfassung eines ZIM-Gutachtens aus der Vorhabensbeschreibung.';

/** Skill-ID des Kurzfassung-Skills — Konstante für Lookups (Antragsdetail). */
export const KURZFASSUNG_SKILL_ID = 'gutachten-kurzfassung';

/**
 * ID der Interpunktions-Regel („kein Semikolon, kein Gedankenstrich"). Konstante,
 * weil sie an allen generativen Gutachten-Skills hängt und von der einmaligen
 * Migration (`applyInterpunktion`) referenziert wird.
 */
export const INTERPUNKTION_REGEL_ID = 'seed-keine-semikolon-gedankenstrich';

/** ID der geteilten „kein Markdown im Fließtext"-Regel (A–G). */
export const UEBERSCHRIFTEN_REGEL_ID = 'seed-keine-ueberschriften';

/**
 * ID der geteilten Aufzählungs-Regel (A–G).
 *
 * Bewusst NICHT die alte `seed-keine-aufzaehlungen`: unter der ID lief bis v2.296 eine
 * Ein-Skill-Regel, die `applySkillVorgaben` aus der Bibliothek entfernt hat. Ein Share,
 * der sie aus irgendeinem Grund noch trüge, brächte unbekannte Parameter in den
 * Standardsatz — `mergeMissingSeeds` überschreibt Bestehendes nie.
 */
export const AUFZAEHLUNGEN_REGEL_ID = 'seed-fliesstext-aufzaehlungen';

/** ID der Passiv-Floskel-Regel (Standardsatz; E und F wählen sie bewusst ab). */
export const PASSIV_REGEL_ID = 'seed-passiv-stil';

/**
 * **Der Standardsatz des ZIM-EP-Gutachtens** — die Regeln, die für JEDEN Abschnitt
 * A–G gelten, gebunden an `ZIM_EP_DEF.standardRegelIds` statt siebenmal am Skill.
 *
 * Die Reihenfolge ist Prompt-Text: die ersten drei standen bisher in genau dieser
 * Folge an den Abschnitten, die Aufzählungs-Regel kommt als einzige neu hinzu (sie
 * war bis v6.36 eine Vorgabe je Skill) und darum ans Ende.
 *
 * `satzlaengeMax: 25` gehört bewusst NICHT dazu: es steht nur an A, E und F — drei von
 * sieben ist keine Norm, sondern eine Eigenschaft dieser Abschnitte.
 */
export const GA_STANDARD_REGEL_IDS: readonly string[] = [
  PASSIV_REGEL_ID,
  INTERPUNKTION_REGEL_ID,
  UEBERSCHRIFTEN_REGEL_ID,
  AUFZAEHLUNGEN_REGEL_ID,
];

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
    PASSIV_REGEL_ID,
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
  // Geschwister zur `keineAufzaehlungen`-Vorgabe: dieselbe Absicht („ein geschlossener
  // Fließtext"), die andere Hälfte der Umsetzung. Gemessen an 224 echten
  // Abschnitts-Texten (08/2026) trug JEDER B-Lauf drei Markdown-Überschriften im
  // finalen Text, obwohl der Prompt „keine Zwischenüberschriften" verlangt — die
  // Listen-Marker-Regel ließ sie durch, bis in den DOCX-Export.
  //
  // Als `hinweis` gebunden, NICHT als `fehler`: ein `fehler` löste den Auto-Retry mit
  // `neu` aus und verwürfe damit einen sonst brauchbaren Abschnitt. Wie oft er danach
  // sauber wäre, ist ungemessen (das Mess-Budget war erschöpft). Die Verschärfung ist
  // eine Team-Entscheidung, die eine Messung braucht — nicht eine Vermutung.
  regel(
    UEBERSCHRIFTEN_REGEL_ID,
    'Keine Überschriften im Fließtext',
    'keine_ueberschriften',
    {},
    'hinweis',
  ),
  // Die andere Hälfte derselben Absicht — bis v6.36 lag sie als `keineAufzaehlungen`
  // sechsmal einzeln an den Skills, während ihre beiden Geschwister längst geteilte
  // Bibliotheks-Regeln waren. Der Seed-Kommentar der Bibliothek nennt das Kriterium
  // selbst: „die Bibliothek führt nur noch, was mehrere Skills teilen."
  //
  // `fehler` wie an allen sechs Abschnitten zuvor. G bekommt sie damit erstmals; an
  // 224 gespeicherten Abschnitts-Texten (08/2026) trug KEIN einziger G-Text eine
  // Aufzählung, die Schließung dieser Lücke ist also verhaltensneutral gemessen.
  regel(
    AUFZAEHLUNGEN_REGEL_ID,
    'Keine Aufzählungen im Fließtext',
    'keine_aufzaehlungen',
    {},
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
  // `keineAufzaehlungen` steht seit v6.36 NICHT mehr hier, sondern als
  // `AUFZAEHLUNGEN_REGEL_ID` im Standardsatz des Workflows — sie galt an sechs von
  // sieben Abschnitten wortgleich und war damit keine Eigenschaft dieses Abschnitts.
  // Rollout auf Bestands-Shares: `applyGaStandardsatz`.
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
  beschreibung: A_BESCHREIBUNG,
  // v2: Der Beleg→Satz-Marker-Kontrakt (Journey-Paket 4) ist zurückgebaut — das interne
  // Modell lief mit dem Kontrakt in einen langen Reasoning-Loop und lieferte keine
  // verwertbare Ausgabe mehr. Der Quellenbezug wird jetzt rein deterministisch aus der
  // Wortüberlappung abgeleitet (belegAbleitung.ts), NICHT vom Modell erfragt.
  // v3: Satzzahl einheitlich 9–11 (Vorgabe + Modifier-Richtwerte, Prosa nennt keine
  // Zahl mehr) — Rollout auf Bestands-Shares über `applyAUmfangKuratiert`.
  // v4: Zeichenlimit 1.000 → 1.100 mit Herkunft am Wert — Rollout über
  // `applyAZeichenHerkunft`.
  // v5: Veröffentlichungs-Kontrakt (Zweck, Weglass-Liste, Länge als Schreib-Anweisung)
  // + Beschreibung mit Umfang — Rollout über `applyAVeroeffentlichung`.
  // `buildKurzfassungPrompt` bleibt BYTE-IDENTISCH: zwei ältere Migrationen vergleichen
  // ihre Ausgabe (`applyBelegKontraktRevert`, `applyUmfangDedup`). Der Zusatz liegt
  // darum in `mitVeroeffentlichungsKontrakt`, die auch die Migration benutzt.
  // v6: Standardsatz am Workflow — die vier Form-Regeln stehen nicht mehr hier
  // (`regelIds: []`, keine `keineAufzaehlungen`-Vorgabe), sie kommen aus
  // `ZIM_EP_DEF.standardRegelIds`. Die aufgelöste Regelliste bleibt dieselbe.
  version: 6,
  promptTemplate: mitVeroeffentlichungsKontrakt(buildKurzfassungPrompt(false)),
  systemPrompt: SEED_SYSTEM_PROMPT,
  maxTokens: 2048,
  modifiers: A_MODIFIERS,
  regelIds: [],
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

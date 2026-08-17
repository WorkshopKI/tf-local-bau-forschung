/**
 * Frageplan — was die interne KI aus einer natürlichsprachigen Frage macht.
 *
 * Die Suche hatte bis hierher zwei Quellen für Suchnadeln: den **Wortstamm**
 * (dasselbe Wort in anderer Form, [wortstamm.ts](src/core/services/search/wortstamm.ts))
 * und das **Embedding** (dasselbe Thema, ohne Namen). Die zweite kann
 * Nachbarschaft messen, aber keine Begriffe BENENNEN — und ohne benennbare
 * Begriffe gibt es nichts anzuzeigen und nichts abzuwählen
 * ([suche-relevanz.md §5](docs/architecture/suche-relevanz.md)).
 *
 * Dieses Modul ist die dritte Quelle. Die KI liefert **Leitbegriffe mit ihren
 * Schreibweisen**, nicht Suchläufe: ein Leitbegriff wird EIN Suchteil, seine
 * Schreibweisen werden dessen Nadeln. Das ist der Grund, warum die vorhandene
 * Wertung trägt — ein Suchteil gilt als getroffen, sobald IRGENDEINE seiner
 * Nadeln trifft (`t.nadeln.some`), und `abdeckung = getroffen / teile.length`
 * misst damit, wie viele der GEFRAGTEN SACHEN ein Vorhaben behandelt. Genau das
 * meint „hauptsächlich" in einer Frage wie „Vorhaben, in denen es hauptsächlich
 * um Normung und Standards geht".
 *
 * Lägen die Schreibweisen stattdessen als gleichrangige Begriffe nebeneinander,
 * zählte jede einzeln: ein reines Normungs-Vorhaben träfe 3 von 8 Begriffen
 * (0,375 → „gering") statt 1 von 2 Sachen (0,5 → „mittel"). Die Gruppierung ist
 * deshalb keine Kosmetik, sondern die Bedingung dafür, dass die Zahl stimmt.
 *
 * **Rein**: kein React, kein IDB, kein Transport — und keine Uhr. Das laufende
 * Jahr reicht der Aufrufer herein, damit „seit 2023" ohne `new Date()` in eine
 * Jahresliste aufgelöst werden kann und die Prompt-Bildung testbar bleibt.
 *
 * **Kein Plugin-Import.** Liegt in der Such-SCHICHT, weil die Wortlaut-Stufe
 * (`plugins/antraege`) und die Suchseite (`plugins/suche`) ihn beide brauchen und
 * `core` auf kein Plugin zeigen darf — dieselbe Begründung wie bei
 * [trefferstelle.ts](src/core/services/search/trefferstelle.ts).
 */
import { stripMarkdownWrapper, parseJsonArrayTolerant } from '@/core/services/ai/json-tolerant';
import type { StatusCategory } from '@/core/utils/status-canonical';
import {
  KATEGORIE_REIHENFOLGE,
  KATEGORIE_TEXTE,
  istStatusCategory,
} from '@/core/utils/status-category-labels';
import { FELD_PRAEFIX, feldAusPraefix } from './feldpraefix';
import { SUCHBEREICH_LABEL, type Suchbereich } from './suchbereich';
import type { Trefferfeld } from './trefferstelle';

/**
 * Ein Leitbegriff — eine der Sachen, nach denen gefragt wurde.
 *
 * Wird EIN Suchteil. `begriff` ist seine Identität (der Chip, die Abwahl),
 * `nadeln` sind die Zeichenketten, mit denen tatsächlich verglichen wird.
 */
export interface PlanBegriff {
  /** Wie die Sache heißt — das, was als Chip erscheint. Darf mehrere Wörter haben. */
  begriff: string;
  /** Womit verglichen wird: klein geschrieben, entdoppelt, `begriff` immer dabei. */
  nadeln: readonly string[];
  /**
   * `true` = Einschränkung, die zutreffen MUSS („in Bayern"). `false` = eine der
   * gefragten Sachen, von denen eine genügt.
   *
   * Die Unterscheidung ist der Grund, warum eine Ortsangabe bedeutet, was sie
   * sagt: die Themen sind untereinander ODER-verknüpft, eine Einschränkung wäre
   * darin nur eine weitere Alternative — „in Bayern" lieferte dann auch
   * bayerische Vorhaben ohne jeden Themenbezug.
   */
  pflicht: boolean;
  /** Nur in diesem Feld nachsehen. Fehlt = im eingestellten Bereich. */
  feld?: Trefferfeld;
}

/**
 * Die Facetten, die ein Plan setzen darf.
 *
 * Bewusst nur zwei. `status` und `jahr` sind das, was eine Frage tatsächlich
 * ausdrückt („noch offene Vorhaben", „seit 2023"); `antragstyp` ist ein
 * plugin-eigenes Vokabular und `trefferstelle` beschreibt das Ergebnis, nicht die
 * Absicht — beides gehört nicht in eine Frage. Was hier fehlt, landet sichtbar in
 * `ignoriert`.
 */
export interface PlanFacetten {
  status: readonly StatusCategory[];
  /** Vierstellige Jahreszahlen, aufgelöst — „seit 2023" kommt als Liste an. */
  jahr: readonly string[];
}

export interface Frageplan {
  /**
   * Die Frage, aus der dieser Plan entstand — seine Identität.
   *
   * Weicht der Feldtext davon ab, ist der Plan zu verwerfen: eine Deutungszeile,
   * die eine andere Frage beschreibt als die im Feld, ist eine Legende, die lügt.
   */
  frage: string;
  leitbegriffe: readonly PlanBegriff[];
  facetten: PlanFacetten;
  /** Worin gesucht wird, falls die Frage es nahelegt. Fehlt = Einstellung behalten. */
  bereich?: Suchbereich;
  /**
   * Was aus der Frage NICHT umgesetzt wurde, im Klartext. Wird angezeigt.
   *
   * Enthält nur echte Verluste: Frage- und Gewichtungswörter sind hier
   * herausgefiltert (`benenntKeinenVerlust`). Eine Zeile „nicht berücksichtigt:
   * hauptsächlich · Vorhaben" ließ die Suche dümmer aussehen, als sie ist — an
   * der einen Stelle, die Vertrauen herstellen soll.
   */
  ignoriert: readonly string[];
}

/**
 * Wie viele Sachen ein Plan führen darf.
 *
 * Der Deckel ist nicht Kosmetik: `abdeckung` teilt durch die Anzahl der Teile.
 * Wer eine Frage in zwölf Leitbegriffe zerlegt, drückt damit jeden Treffer nach
 * unten — ein Vorhaben, das zwei der zwölf behandelt, käme auf 0,17 und wäre
 * „gering", obwohl es die Frage beantwortet.
 */
export const MAX_LEITBEGRIFFE = 6;

/** Wie viele Schreibweisen je Leitbegriff. Mehr bringt keine Treffer dazu, die
 *  der Stamm nicht auch fände, kostet aber Vergleiche je Korpuseintrag. */
export const MAX_NADELN = 12;

/**
 * Kürzeste zulässige Nadel.
 *
 * Verglichen wird mit `includes()` über den kleingeschriebenen Volltext. Eine
 * dreistellige Nadel ist damit ein Treffer auf alles: `din` steckt in „bedingt"
 * und „ordinär", `iso` in „Isolierung" und „Isotop", `ki` in „Technik" und
 * „Kinetik". Wer sie selbst eintippt, sieht was er tut — eine vom Modell still
 * ergänzte Nadel dieser Länge verseuchte das Ergebnis ohne sichtbare Ursache.
 *
 * Der Prompt sagt das Modell deshalb an, Kürzel auszuschreiben; was trotzdem zu
 * kurz kommt, fällt heraus und steht in `ignoriert`.
 */
export const MIN_NADEL_LEN = 4;

/** Deckel für die Frage im Prompt. Eine Frage ist ein Satz, kein Dokument — und
 *  ein langer Einwurf träfe sonst das Kontextfenster des Standard-Ziels. */
export const MAX_FRAGE_LEN = 600;

/** Die Bereiche, die ein Plan wählen darf. `dokumente` fehlt mit Absicht: es
 *  legt die Wortlaut-Stufe still (leere Feldmenge), und damit wären genau die
 *  Leitbegriffe wirkungslos, um die es hier geht. */
const PLANBARE_BEREICHE: readonly Suchbereich[] = ['alles', 'inhalt', 'einrichtung', 'standort'];

/**
 * Wörter, die die gesuchten DINGE benennen statt ein Thema.
 *
 * Sie sind keine Begriffe — und sie sind auch kein Verlust: „Vorhaben" ist das
 * Wort für das, was die Suche ohnehin findet. Bis v4.78 sagte der Prompt beides
 * zugleich („sind keine Begriffe" und „melde alles Nicht-Übersetzte"), und das
 * Modell meldete gehorsam das Wort, das auszulassen ihm befohlen war: unter der
 * Trefferliste stand „nicht berücksichtigt: Vorhaben".
 */
const FRAGEWORTE: readonly string[] = [
  'welche', 'welcher', 'welches', 'zeig mir', 'zeige', 'gibt es', 'finde',
  'suche', 'liste', 'vorhaben', 'projekt', 'projekte', 'antrag', 'anträge',
];

/**
 * Wörter, die eine Gewichtung ausdrücken („hauptsächlich um Normung").
 *
 * Auch sie sind kein Verlust, aus dem entgegengesetzten Grund: sie werden
 * BEANTWORTET, nämlich von der Rangfolge. `abdeckung` misst, wie viele der
 * gefragten Sachen ein Vorhaben behandelt, und hebt die, die alle behandeln
 * (siehe Kopfkommentar). Sie als „nicht berücksichtigt" auszuweisen, wäre eine
 * Legende, die das Gegenteil dessen behauptet, was die Liste tut.
 */
const GEWICHTUNGSWOERTER: readonly string[] = [
  'hauptsächlich', 'vor allem', 'schwerpunktmäßig', 'primär', 'überwiegend',
  'vorrangig', 'in erster linie', 'vornehmlich', 'insbesondere', 'besonders',
];

/** Bindewörter, die eine Meldung nicht tragen — sie entscheiden nicht, ob ein
 *  Eintrag einen Verlust benennt („vor allem und Vorhaben" tut es nicht). */
const FUELLWOERTER: ReadonlySet<string> = new Set([
  'und', 'oder', 'die', 'der', 'das', 'den', 'dem', 'ein', 'eine', 'einen',
  'es', 'sich', 'um', 'in', 'im', 'von', 'für', 'zu', 'ist', 'sind', 'nicht',
]);

/** Aufgeteilt, weil Mehrwortphrasen VOR der Wortzerlegung verschwinden müssen —
 *  sonst bliebe von „vor allem" ein „allem" stehen, das in keiner Liste steht. */
const KEIN_VERLUST_MEHRWORT: readonly string[] = [...FRAGEWORTE, ...GEWICHTUNGSWOERTER]
  .filter(w => w.includes(' '));
const KEIN_VERLUST_EINWORT: ReadonlySet<string> = new Set(
  [...FRAGEWORTE, ...GEWICHTUNGSWOERTER].filter(w => !w.includes(' ')),
);

/**
 * Benennt dieser Eintrag gar keinen Verlust?
 *
 * Wahr, wenn nach Abzug der Frage- und Gewichtungswörter nichts Tragendes übrig
 * bleibt. Der Prompt sagt dem Modell dasselbe; dieser Filter ist der Gurt für
 * die Wortform, die tatsächlich auftrat („hauptsächlich", „Vorhaben") — die
 * Reparatur hängt damit nicht an der Laune des Modells.
 */
function benenntKeinenVerlust(eintrag: string): boolean {
  let text = eintrag.toLowerCase();
  for (const p of KEIN_VERLUST_MEHRWORT) text = text.split(p).join(' ');
  const woerter = text.split(/[^a-zäöüß]+/).filter(Boolean);
  if (woerter.length === 0) return true;
  return woerter.every(w => KEIN_VERLUST_EINWORT.has(w) || FUELLWOERTER.has(w));
}

// ── Prompt ───────────────────────────────────────────────────────────────────

/**
 * Regel gegen mehrstufige Plan-/Werkzeug-Schleifen. Wortgleich zur
 * `EIN_ZUG_REGEL` in [feedbackImprove.ts](src/core/services/feedback/feedbackImprove.ts) —
 * dieselbe Bridge, dasselbe Verhalten.
 */
const EIN_ZUG_REGEL = 'Antworte in EINEM Zug: kein Plan, keine Zwischenschritte, keine Werkzeuge, kein sichtbares Nachdenken — nur der JSON-Block.';

/** Die Feldnamen, die ein Plan ansprechen darf — aus dem Code, nicht abgeschrieben. */
function feldListe(): string {
  return (Object.entries(FELD_PRAEFIX) as [Trefferfeld, string][])
    .map(([, praefix]) => praefix)
    .join(' · ');
}

/** Die Arbeitslisten-Werte samt Bezeichnung — ebenfalls aus der Einzelquelle. */
function statusListe(): string {
  return KATEGORIE_REIHENFOLGE
    .map(k => `${k} (${KATEGORIE_TEXTE[k].lang})`)
    .join(' · ');
}

function bereichListe(): string {
  return PLANBARE_BEREICHE.map(b => `${b} (${SUCHBEREICH_LABEL[b]})`).join(' · ');
}

/** Eine Wortliste, wie sie im Prompt erscheint — aus der Konstante, nicht
 *  abgeschrieben: sonst filterte der Parser nach anderen Wörtern, als der Prompt
 *  nennt. */
function wortListe(woerter: readonly string[]): string {
  return woerter.map(w => `„${w}"`).join(', ');
}

/**
 * Der Prompt für den Frageplan.
 *
 * **Ohne Beispiel-JSON.** Der Parser nimmt ein balanciertes Objekt aus der
 * Antwort; ein Modell, das eine Schablone wiederholt, lieferte sonst die
 * Schablone als Ergebnis — dieselbe Lehre wie in
 * [gedaechtnis/prompt.ts](src/core/services/assistent/gedaechtnis/prompt.ts).
 * Die Felder stehen deshalb als Aufzählung da, nicht als Codeblock.
 *
 * `heuteJahr` kommt von außen (dieses Modul kennt keine Uhr) und löst relative
 * Zeitangaben auf.
 */
export function baueFrageplanPrompt(
  frage: string,
  heuteJahr: number,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'Du übersetzt eine Frage in einen Suchplan für eine Datenbank deutscher Förderanträge (ZIM).',
    'Du suchst NICHT selbst und beantwortest die Frage NICHT — du benennst nur, wonach gesucht werden soll.',
    '',
    'Antworte mit GENAU EINEM JSON-Objekt mit diesen Schlüsseln:',
    '',
    '- "begriffe": Liste der Sachen, nach denen gefragt wird. Je Eintrag ein Objekt mit:',
    '    "begriff"  — wie die Sache heißt, kurz und im Klartext (erscheint dem Nutzer)',
    '    "nadeln"   — Liste von Zeichenketten, die im Text vorkommen können: Schreibweisen,',
    '                 Wortformen, Synonyme, Komposita-Bestandteile. Klein geschrieben.',
    '    "pflicht"  — true, wenn die Frage das als EINSCHRÄNKUNG nennt (ein Ort, eine',
    '                 Einrichtung, ein Kennzeichen). false, wenn es eines der gefragten',
    '                 THEMEN ist. Im Zweifel false.',
    '    "feld"     — optional, wenn die Sache nur in EINEM Feld stehen kann.',
    `                 Erlaubt: ${feldListe()}`,
    '- "status": Liste von Arbeitslisten-Werten, falls die Frage einen Bearbeitungsstand nennt.',
    `    Erlaubt: ${statusListe()}`,
    '- "jahr": Liste vierstelliger Jahreszahlen, falls die Frage einen Zeitraum nennt.',
    `    Das laufende Jahr ist ${heuteJahr}. Zeiträume ausschreiben: „seit 2023" wird zur`,
    `    vollständigen Liste 2023 bis ${heuteJahr}.`,
    `- "bereich": optional, worin gesucht wird. Erlaubt: ${bereichListe()}`,
    '- "ignoriert": Liste kurzer Klartext-Sätze über alles aus der Frage, das du NICHT',
    '    in den Plan übersetzt hast. Lieber hier benennen als raten.',
    '',
    'Regeln:',
    `- Höchstens ${MAX_LEITBEGRIFFE} Einträge in "begriffe". Fasse zusammen, was dieselbe Sache meint:`,
    '  „Normung" und „Standards" sind ZWEI Sachen; „Normung", „Normen" und „Normierung" sind',
    '  EINE Sache mit drei Schreibweisen und gehören in DENSELBEN Eintrag.',
    `- Jede Nadel hat mindestens ${MIN_NADEL_LEN} Zeichen. Kürzel deshalb ausschreiben`,
    '  („künstliche intelligenz" statt „ki") oder mit Wortkontext geben („ki-basiert").',
    '  Kürzere Nadeln träfen als Teilzeichenkette beliebige fremde Wörter.',
    '- Nimm nur Begriffe auf, die in einem Antragstext wirklich vorkommen können.',
    '  Frageworte benennen das, wonach ohnehin gesucht wird. Sie sind keine',
    '  Begriffe und gehören auch NICHT nach "ignoriert":',
    `    ${wortListe(FRAGEWORTE)}`,
    '- Gewichtungswörter beantwortet die Rangfolge selbst: Vorhaben, die MEHR',
    '  der gefragten Sachen behandeln, stehen oben. Auch sie gehören nicht nach',
    '  "ignoriert" — sie gehen nicht verloren:',
    `    ${wortListe(GEWICHTUNGSWOERTER)}`,
    '- Erfinde keine Feld-, Status- oder Bereichswerte. Was nicht in den Listen steht,',
    '  gehört nach "ignoriert".',
    EIN_ZUG_REGEL,
  ].join('\n');

  const userPrompt = [
    'Frage:',
    '"""',
    frage.trim().slice(0, MAX_FRAGE_LEN),
    '"""',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

// ── Parser ───────────────────────────────────────────────────────────────────

function istRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function alsListe(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function alsText(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

/**
 * Die Nadeln eines Leitbegriffs: klein, entdoppelt, gedeckelt — und der Begriff
 * selbst ist immer dabei.
 *
 * Der Begriff MUSS mitlaufen, weil er das ist, was der Nutzer im Chip liest. Ein
 * Chip „Normung", der nicht nach „normung" sucht, wäre eine falsche Auskunft.
 * Zu kurze Nadeln fallen heraus (siehe `MIN_NADEL_LEN`) und werden gemeldet.
 */
function baueNadelListe(
  begriff: string,
  roh: unknown,
  verworfen: string[],
): string[] {
  const gesehen = new Set<string>();
  const out: string[] = [];
  const nimm = (s: string): void => {
    const klein = s.trim().toLowerCase();
    if (klein.length === 0 || gesehen.has(klein)) return;
    if (klein.length < MIN_NADEL_LEN) {
      verworfen.push(klein);
      return;
    }
    gesehen.add(klein);
    if (out.length < MAX_NADELN) out.push(klein);
  };
  nimm(begriff);
  for (const n of alsListe(roh)) if (typeof n === 'string') nimm(n);
  return out;
}

/**
 * Ein Leitbegriff aus dem Rohobjekt. `null`, wenn nichts Verwertbares übrig
 * bleibt — ein Eintrag ohne Namen oder ohne eine einzige tragfähige Nadel ist
 * kein Suchteil, sondern ein Teiler, der jeden Treffer schlechter macht.
 */
function leseBegriff(roh: unknown, verworfen: string[]): PlanBegriff | null {
  if (!istRecord(roh)) return null;
  const begriff = alsText(roh.begriff);
  if (begriff.length === 0) return null;

  const nadeln = baueNadelListe(begriff, roh.nadeln, verworfen);
  if (nadeln.length === 0) return null;

  // Das Feld wird mit demselben Auflöser gelesen wie ein getipptes Präfix — ein
  // Modell, das `org_ast` statt `ast` schreibt, meint dasselbe Feld.
  const feldRoh = alsText(roh.feld);
  const feld = feldRoh.length > 0 ? feldAusPraefix(feldRoh) : undefined;
  if (feldRoh.length > 0 && feld === undefined) {
    verworfen.push(`Feld „${feldRoh}"`);
  }

  return { begriff, nadeln, pflicht: roh.pflicht === true, feld };
}

/**
 * Liest den Frageplan aus der Modellantwort.
 *
 * `null` heißt „nichts Verwertbares" — der Aufrufer fällt dann auf die
 * Stichwortsuche zurück und sagt es. Es gibt bewusst **keinen Retry**: ein
 * zweiter Lauf kostet den Nutzer die Wartezeit noch einmal und liefert bei einem
 * Modell, das gerade Prosa schreibt, wieder Prosa (dieselbe Entscheidung wie in
 * der Gedächtnis-Konsolidierung).
 *
 * Verworfen wird **still, aber nicht heimlich**: alles, was herausfällt, steht
 * danach in `ignoriert` und damit in der Deutungszeile.
 */
export function parseFrageplan(roh: string, frage: string): Frageplan | null {
  const text = stripMarkdownWrapper(roh ?? '');
  // Der Sammler liefert jedes balancierte Top-Level-Objekt der Antwort. Genommen
  // wird das LETZTE: schreibt das Modell erst eine Erläuterung mit Beispiel und
  // dann das Ergebnis, ist das Ergebnis das hintere.
  const objekte = parseJsonArrayTolerant(text).filter(istRecord);
  const obj = objekte[objekte.length - 1];
  if (!obj) return null;

  const verworfen: string[] = [];

  const leitbegriffe: PlanBegriff[] = [];
  for (const eintrag of alsListe(obj.begriffe)) {
    if (leitbegriffe.length >= MAX_LEITBEGRIFFE) {
      verworfen.push(`mehr als ${MAX_LEITBEGRIFFE} Begriffe`);
      break;
    }
    const b = leseBegriff(eintrag, verworfen);
    if (b) leitbegriffe.push(b);
  }
  // Ein Plan ohne ein einziges Thema ist kein Plan: eine reine Einschränkung
  // („alles in Bayern") liefe als ODER-Menge über nichts.
  if (leitbegriffe.length === 0) return null;
  if (leitbegriffe.every(b => b.pflicht)) return null;

  const status: StatusCategory[] = [];
  for (const s of alsListe(obj.status)) {
    const t = alsText(s);
    if (istStatusCategory(t)) {
      if (!status.includes(t)) status.push(t);
    } else if (t.length > 0) {
      verworfen.push(`Status „${t}"`);
    }
  }

  const jahr: string[] = [];
  for (const j of alsListe(obj.jahr)) {
    const t = typeof j === 'number' ? String(j) : alsText(j);
    if (/^\d{4}$/.test(t)) {
      if (!jahr.includes(t)) jahr.push(t);
    } else if (t.length > 0) {
      verworfen.push(`Jahr „${t}"`);
    }
  }

  const bereichRoh = alsText(obj.bereich);
  const bereich = PLANBARE_BEREICHE.find(b => b === bereichRoh);
  if (bereichRoh.length > 0 && bereich === undefined) {
    verworfen.push(`Bereich „${bereichRoh}"`);
  }

  // Die Meldungen des Modells zuerst — sie sind die verständlicheren; die
  // technisch verworfenen Werte dahinter.
  //
  // Gefiltert wird NUR die Liste des Modells: was der Parser oben verworfen hat
  // (ein unbekanntes Feld, eine zu kurze Nadel), ist immer ein Verlust. Die
  // Meldungen des Modells sind es nicht immer — es meldet auch Wörter, die es
  // nach Anweisung übergangen hat.
  const ignoriert: string[] = [];
  for (const i of alsListe(obj.ignoriert)) {
    const t = alsText(i);
    if (t.length === 0 || ignoriert.includes(t)) continue;
    if (benenntKeinenVerlust(t)) continue;
    ignoriert.push(t);
  }
  for (const v of verworfen) if (!ignoriert.includes(v)) ignoriert.push(v);

  return {
    frage: frage.trim(),
    leitbegriffe,
    facetten: { status, jahr },
    bereich,
    ignoriert,
  };
}

// ── Anwendung ────────────────────────────────────────────────────────────────

/**
 * Die Leitbegriffe, die noch mitsuchen — ohne die abgewählten.
 *
 * Sind ALLE Themen abgewählt, kommt der volle Plan zurück. Dieselbe Regel wie in
 * [deutung.ts](src/plugins/suche/deutung.ts): eine leere Anfrage wäre der Sprung
 * in den Startzustand, und dort sähe der Nutzer seine Chips nicht mehr und käme
 * nicht zurück.
 */
export function aktiveLeitbegriffe(
  plan: Frageplan,
  abgewaehlt: readonly string[],
): readonly PlanBegriff[] {
  if (abgewaehlt.length === 0) return plan.leitbegriffe;
  const aus = new Set(abgewaehlt.map(w => w.toLowerCase()));
  const uebrig = plan.leitbegriffe.filter(b => !aus.has(b.begriff.toLowerCase()));
  if (uebrig.length === 0 || uebrig.every(b => b.pflicht)) return plan.leitbegriffe;
  return uebrig;
}

/**
 * Die Nadeln der aktiven Leitbegriffe — für die Markierung im Treffertext.
 *
 * Markiert wird, wonach gesucht wurde. Die Frage selbst taugt dafür nicht: aus
 * „Welche Vorhaben drehen sich um Normung?" würden sonst „welche" und „drehen"
 * angestrichen.
 */
export function planMarkierWoerter(
  plan: Frageplan,
  abgewaehlt: readonly string[],
): string[] {
  const out: string[] = [];
  for (const b of aktiveLeitbegriffe(plan, abgewaehlt)) {
    for (const n of b.nadeln) if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** Trägt der Plan überhaupt eine Einschränkung? Steuert nur die Anzeige. */
export function hatPflichtteile(plan: Frageplan): boolean {
  return plan.leitbegriffe.some(b => b.pflicht);
}

/**
 * Bindet der Plan die Suche an bestimmte Felder oder Einschränkungen?
 *
 * Das hat eine Nebenwirkung, die man sehen können muss: Ein genanntes Feld kann
 * weder der Dokumentenindex noch die Ähnlichkeitssuche einhalten — beide fallen
 * dann weg (`feldSuche` in `useUnifiedSearch`). Bis v4.68 blieb der Haken
 * „Ähnlichkeitssuche" dabei gesetzt und wirkungslos.
 *
 * Steht hier und nicht zweimal an den Aufrufstellen: Suchlauf und Oberfläche
 * müssen dieselbe Antwort geben, sonst zeigt die eine an, was die andere nicht
 * tut.
 */
export function planSchraenktEin(teile: readonly PlanBegriff[] | undefined): boolean {
  return teile?.some(t => t.feld !== undefined || t.pflicht) === true;
}

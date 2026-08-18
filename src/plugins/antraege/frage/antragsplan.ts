/**
 * Antragsplan — was die interne KI aus einer Frage an die FÖRDERANTRAGS-Liste
 * macht.
 *
 * Der [Frageplan](src/core/services/search/frageplan.ts) übersetzt eine Frage in
 * **Textnadeln**: Leitbegriffe mit ihren Schreibweisen, mit denen über den
 * Volltext verglichen wird. Für die Dokumenten-Suche ist das die ganze Aufgabe.
 * Die Fragen, die an die Antragsliste gestellt werden, sind aber anderer Art —
 * sie enthalten oft **kein einziges Textthema**:
 *
 *  - „alle Einzelvorhaben (nur bei FuE und DS) aus 2025 und 2026, die noch
 *    keinen PreCheck auf Verbundebene haben"
 *  - „alle Anträge in Bearbeitung, die länger als 2 Monate kein neues Kürzel
 *    bekommen haben, für Bearbeiter THÜ"
 *  - „alle Netzwerke, die für Phase 2 abgelehnt wurden"
 *
 * Das sind **Metadaten-Kombinationen**, und für jede einzelne Achse hat die
 * Seite längst ein Bedienelement. Dieses Modul übersetzt deshalb nicht in
 * Nadeln, sondern in die **vorhandenen Achsen** — Pillen und Chips gehen an,
 * sichtbar und von Hand korrigierbar (`wendeAntragsplanAn`).
 *
 * Drei Regeln, die das Ganze tragen:
 *
 *  1. **Die KI wählt, sie filtert nicht.** Jeder Wertevorrat kommt aus der
 *     Einzelquelle im Code in den Prompt (`statusWerteZeile`, `VB_PHASE_LABELS`,
 *     `PROJEKTART_TITEL`, `PRECHECK_BUCKET_ORDER`). Was nicht in den Listen
 *     steht, ist erfunden und fällt heraus.
 *  2. **Was herausfällt, wird genannt.** Alles Nicht-Übersetzte steht in
 *     `ignoriert` und damit in der Deutungszeile. Ein Plan, der eine
 *     Einschränkung stillschweigend fallen lässt, liefert eine Liste, die mehr
 *     zeigt als gefragt war — und sagt es nicht.
 *  3. **Themen bleiben Themen.** `leitbegriffe` sind `PlanBegriff` aus dem
 *     Frageplan, unverändert. Die Wortlaut-Stufe der Antrags-Suche nimmt sie
 *     bereits entgegen (`WortlautOptionen.planTeile`); ein zweites Nadelformat
 *     wäre eine Gabelung ohne Anlass.
 *
 * **Rein**: kein React, kein IDB, kein Transport — und keine Uhr. Das laufende
 * Jahr reicht der Aufrufer herein, damit „seit 2024" ohne `new Date()` auflösbar
 * bleibt und die Prompt-Bildung testbar ist.
 *
 * **Im Plugin, nicht in `core`**: `Projektart` und `PrecheckBucket` sind
 * plugin-eigenes Vokabular, und `core` darf auf kein Plugin zeigen.
 */
import { einZugRegel } from '@/core/services/ai/ein-schuss-lauf';
import {
  stripMarkdownWrapper, parseJsonArrayTolerant, istRecord, alsListe, alsText,
} from '@/core/services/ai/json-tolerant';
import {
  MAX_FRAGE_LEN,
  baueIgnoriertListe,
  begriffeRegelZeilen,
  begriffeSchemaZeilen,
  leseLeitbegriffe,
  type PlanBegriff,
} from '@/core/services/search/frageplan';
import { getStatusValuesByCategory, type StatusCategory } from '@/core/utils/status-canonical';
import {
  KATEGORIE_REIHENFOLGE, KATEGORIE_TEXTE, istStatusCategory,
} from '@/core/utils/status-category-labels';
import { VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import {
  PRECHECK_BUCKET_ORDER, type PrecheckBucket,
} from '../filter/precheckQuickfilter';
import {
  PROJEKTART_ORDER, PROJEKTART_TITEL, type Projektart,
} from '../filter/projektartQuickfilter';

/**
 * Der Plan: je Feld **eine vorhandene Achse** der Antrags-Seite.
 *
 * Flach und nicht baumartig, obwohl der `Bedingung`-Baum aus `core/status`
 * ausdrucksstärker wäre. Der Grund ist die Korrigierbarkeit: für jede Achse hier
 * gibt es ein Bedienelement, das den gesetzten Wert anzeigt und ändern lässt.
 * Ein Bedingungsbaum hätte auf dieser Seite keinen Editor — der Nutzer bekäme
 * ein Ergebnis, das er nur neu erfragen, aber nicht nachjustieren kann.
 */
export interface Antragsplan {
  /**
   * Die Frage, aus der dieser Plan entstand — seine Identität.
   *
   * Weicht der Feldtext davon ab, ist der Plan zu verwerfen: eine Deutungszeile,
   * die eine andere Frage beschreibt als die im Feld, ist eine Legende, die lügt.
   */
  frage: string;
  /** Arbeitslisten-Kategorien. Werden beim Anwenden in Rohwerte aufgelöst. */
  status: readonly StatusCategory[];
  /** Fördervarianten (`vb_phase`): 1 NW 1 · 2 NW 2 · 3 FuE · 4 DL · 5 DS. */
  vbPhasen: readonly number[];
  /** Vierstellige Jahre des Antragseingangs — „seit 2024" kommt als Liste an. */
  jahre: readonly string[];
  /** Fehlt = die Frage schränkt die Projektart nicht ein. */
  projektart?: Projektart;
  /** Fehlt = die Frage sagt nichts über den PreCheck. */
  precheck?: PrecheckBucket;
  /** Personenkürzel, wie die Frage sie nennt — Normalisierung beim Anwenden. */
  bearbeiter: readonly string[];
  /** Mehr als so viele TAGE ohne neu gesetztes Kürzel. Fehlt = keine Schwelle. */
  stillstandTage?: number;
  /** Themen — dieselbe Mechanik wie im Frageplan, oft leer. */
  leitbegriffe: readonly PlanBegriff[];
  /** Was aus der Frage NICHT umgesetzt wurde, im Klartext. Wird angezeigt. */
  ignoriert: readonly string[];
}

/**
 * Obergrenze der Stillstands-Schwelle in Tagen.
 *
 * Zehn Jahre. Nicht als Schutz vor Unsinn — eine zu große Schwelle liefert
 * schlicht keine Treffer —, sondern gegen eine Zahl, die ein Modell als
 * Millisekunden oder als Datum liefert: `20250101` Tage wäre keine Schwelle mehr,
 * sondern ein stillschweigend leeres Ergebnis.
 */
export const MAX_STILLSTAND_TAGE = 3650;

/**
 * Die Projektarten, die eine Frage wählen darf — **ohne `'alle'`**.
 *
 * `'alle'` ist der Wert für „keine Einschränkung", und genau das drückt das
 * Fehlen des Feldes schon aus. Als wählbarer Wert wäre er schädlich: ein Plan,
 * der `'alle'` setzt, RÄUMT eine von Hand gesetzte Projektart ab, ohne dass die
 * Frage die Projektart erwähnt hätte.
 */
const WAEHLBARE_PROJEKTARTEN: readonly Projektart[] = PROJEKTART_ORDER.filter(a => a !== 'alle');

/** Dieselbe Regel für den PreCheck: `'Alle'` heißt „keine Einschränkung". */
const WAEHLBARE_PRECHECKS: readonly PrecheckBucket[] = PRECHECK_BUCKET_ORDER.filter(b => b !== 'Alle');

// ── Prompt ───────────────────────────────────────────────────────────────────

/**
 * Die Arbeitslisten-Kategorien, die eine Frage wählen darf — **nur die, die im
 * aktiven Katalog wirklich einen Rohwert haben**.
 *
 * Der Unterschied zum Frageplan ist keine Kosmetik, sondern folgt daraus, was die
 * Auswahl steuert: dort eine Suchfacette (ohne Treffer = leeres Ergebnis), hier
 * einen Feld-Wert-Filter über `status`. Eine Kategorie ohne Rohwerte setzte einen
 * Filter, der nichts vergleicht — am eingebauten Katalog gemessen trifft das
 * `abgelehnt`: null Rohwerte, weil die Ablehnungen dort als
 * „abgelehnt/zurückgezogen" unter `abgeschlossen` liegen. Ein Modell, dem
 * `abgelehnt` angeboten wird, wählt es für „…die abgelehnt wurden" völlig zu Recht
 * — und die Frage käme ohne diese Einschränkung zurück.
 *
 * Wird bei **jedem Aufruf** abgeleitet, nie als Modul-Konstante: der kuratierte
 * Katalog wird nach dem Modul-Import gesetzt, und eine beim Import gerechnete
 * Menge rechnete dauerhaft mit dem Code-Seed (die Lehre aus `chipStatusValues`,
 * v2.403). Welche Kategorien belegt sind, entscheidet damit der Katalog des
 * Teams, nicht diese Datei.
 */
function statusWerteZeile(): string {
  return KATEGORIE_REIHENFOLGE
    .filter(k => getStatusValuesByCategory(k).length > 0)
    .map(k => `${k} (${KATEGORIE_TEXTE[k].lang})`)
    .join(' · ');
}

/** Die Fördervarianten samt Beschriftung — aus `VB_PHASE_LABELS`, nicht abgeschrieben. */
function phasenZeile(): string {
  return Object.entries(VB_PHASE_LABELS)
    .map(([n, label]) => `${n} (${label})`)
    .join(' · ');
}

/**
 * Die Projektarten samt ihrer Definition.
 *
 * Die Definition ist `PROJEKTART_TITEL` — der Tooltip, der am Knopf steht. Er
 * ist die Einzelquelle dafür, was „Einzelprojekt" in dieser App bedeutet
 * („FuE- oder DS-Antrag, dessen Verbund genau ein Teilvorhaben hat"), und er
 * beantwortet die Klammer, die Nutzer selbst dazuschreiben. Ihn hier zu
 * paraphrasieren hieße, dieselbe Regel ein zweites Mal zu formulieren.
 */
function projektartZeilen(): string[] {
  return WAEHLBARE_PROJEKTARTEN.map(a => `      ${a} — ${PROJEKTART_TITEL[a]}`);
}

/**
 * Der Prompt für den Antragsplan.
 *
 * **Ohne Beispiel-JSON**, dieselbe Lehre wie beim Frageplan: ein Modell, das
 * eine Schablone vor sich sieht, liefert die Schablone. Die Felder stehen als
 * Aufzählung da, nicht als Codeblock.
 */
export function baueAntragsplanPrompt(
  frage: string,
  heuteJahr: number,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'Du übersetzt eine Frage in einen Filterplan für eine Liste deutscher Förderanträge (ZIM).',
    'Du suchst NICHT selbst, zählst NICHT und beantwortest die Frage NICHT — du benennst nur,',
    'welche Filter die App setzen soll. Die App filtert danach selbst.',
    '',
    'Antworte mit GENAU EINEM JSON-Objekt mit diesen Schlüsseln. Lass jeden Schlüssel weg,',
    'den die Frage nicht anspricht — ein weggelassener Filter schränkt nicht ein.',
    '',
    '- "status": Liste von Arbeitslisten-Werten, falls die Frage einen Bearbeitungsstand nennt.',
    `    Erlaubt: ${statusWerteZeile()}`,
    '- "phasen": Liste von Fördervarianten-Nummern, falls die Frage die Antragsart nennt.',
    `    Erlaubt: ${phasenZeile()}`,
    '    Netzwerkanträge sind die Phasen 1 und 2 — „Netzwerk in Phase 2" ist also 2, nicht 1.',
    '- "jahre": Liste vierstelliger Jahreszahlen des ANTRAGSEINGANGS, falls die Frage',
    `    einen Zeitraum nennt. Das laufende Jahr ist ${heuteJahr}. Zeiträume ausschreiben:`,
    `    „seit 2024" wird zur vollständigen Liste 2024 bis ${heuteJahr}.`,
    '- "projektart": genau EIN Wert, falls die Frage Einzel- gegen Kooperationsvorhaben abgrenzt.',
    ...projektartZeilen(),
    '- "precheck": genau EIN Wert, falls die Frage den PreCheck nennt.',
    `    Erlaubt: ${WAEHLBARE_PRECHECKS.join(' · ')}`,
    '    „noch kein PreCheck gemacht" und „PreCheck steht aus" sind BEIDE "offen" —',
    '    die App unterscheidet nicht zwischen „fehlt" und „ausstehend".',
    '- "bearbeiter": Liste der Personenkürzel, die die Frage nennt (kurze Buchstabenfolgen).',
    '    Schreib sie ab, wie sie in der Frage stehen; die App normalisiert selbst.',
    '- "stillstandTage": eine ZAHL in Tagen, falls die Frage nach Stillstand fragt —',
    '    „seit X ist nichts passiert", „kein neues Kürzel seit X", „hängt seit X".',
    '    Monate umrechnen: 2 Monate sind 60, ein halbes Jahr ist 180.',
    ...begriffeSchemaZeilen(),
    '- "ignoriert": Liste kurzer Klartext-Sätze über alles aus der Frage, das du NICHT',
    '    in den Plan übersetzt hast. Lieber hier benennen als raten.',
    '',
    'Regeln:',
    '- Eine Frage kann NUR Filter nennen und gar kein Thema. Dann bleibt "begriffe" leer —',
    '  das ist der Normalfall, kein Mangel.',
    ...begriffeRegelZeilen(),
    '- Erfinde keine Status-, Phasen-, Projektart- oder PreCheck-Werte. Was nicht in den',
    '  Listen steht, gehört nach "ignoriert".',
    einZugRegel('der JSON-Block'),
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

/** Die Arbeitslisten-Kategorien; Unbekanntes wird gemeldet, nicht geraten. */
function leseStatus(roh: unknown, verworfen: string[]): StatusCategory[] {
  const out: StatusCategory[] = [];
  for (const s of alsListe(roh)) {
    const t = alsText(s);
    if (istStatusCategory(t)) {
      if (!out.includes(t)) out.push(t);
    } else if (t.length > 0) {
      verworfen.push(`Status „${t}"`);
    }
  }
  return out;
}

/** Fördervarianten. Nur Nummern, die `VB_PHASE_LABELS` wirklich kennt. */
function lesePhasen(roh: unknown, verworfen: string[]): number[] {
  const out: number[] = [];
  for (const p of alsListe(roh)) {
    const n = typeof p === 'number' ? p : Number(alsText(p));
    if (Number.isInteger(n) && VB_PHASE_LABELS[n] !== undefined) {
      if (!out.includes(n)) out.push(n);
    } else {
      const t = typeof p === 'number' ? String(p) : alsText(p);
      if (t.length > 0) verworfen.push(`Phase „${t}"`);
    }
  }
  return out;
}

function leseJahre(roh: unknown, verworfen: string[]): string[] {
  const out: string[] = [];
  for (const j of alsListe(roh)) {
    const t = typeof j === 'number' ? String(j) : alsText(j);
    if (/^\d{4}$/.test(t)) {
      if (!out.includes(t)) out.push(t);
    } else if (t.length > 0) {
      verworfen.push(`Jahr „${t}"`);
    }
  }
  return out;
}

/** Ein Wert aus einem geschlossenen Vokabular. `undefined` = nicht gesetzt. */
function leseWahl<T extends string>(
  roh: unknown,
  erlaubt: readonly T[],
  achse: string,
  verworfen: string[],
): T | undefined {
  const t = alsText(roh);
  if (t.length === 0) return undefined;
  const treffer = erlaubt.find(e => e.toLowerCase() === t.toLowerCase());
  if (treffer) return treffer;
  // „alle" ist kein Fehler des Modells, sondern die Aussage „keine
  // Einschränkung" — und die steht schon im fehlenden Feld. Als Verlust zu
  // melden, was gar keiner ist, wäre dieselbe Unehrlichkeit wie die Zeile
  // „nicht berücksichtigt: hauptsächlich" (Frageplan v4.78).
  if (t.toLowerCase() !== 'alle') verworfen.push(`${achse} „${t}"`);
  return undefined;
}

/**
 * Die Stillstands-Schwelle in Tagen.
 *
 * `undefined` bei allem, was keine brauchbare Tageszahl ist — eine Null, eine
 * Kommazahl oder eine Jahreszahl als Tagesmenge wären ein Filter, der etwas
 * anderes tut als die Frage sagt.
 */
function leseStillstandTage(roh: unknown, verworfen: string[]): number | undefined {
  if (roh === undefined || roh === null || roh === '') return undefined;
  const n = typeof roh === 'number' ? roh : Number(alsText(roh));
  if (Number.isInteger(n) && n >= 1 && n <= MAX_STILLSTAND_TAGE) return n;
  const t = typeof roh === 'number' ? String(roh) : alsText(roh);
  if (t.length > 0) verworfen.push(`Stillstand „${t}" Tage`);
  return undefined;
}

/**
 * Liest den Antragsplan aus der Modellantwort.
 *
 * `null` heißt „nichts Verwertbares" — der Aufrufer bleibt dann bei der
 * Stichwortsuche und sagt es. Es gibt bewusst **keinen Retry**: ein zweiter Lauf
 * kostet den Nutzer die Wartezeit noch einmal und liefert bei einem Modell, das
 * gerade Prosa schreibt, wieder Prosa.
 *
 * **Ein Plan, der nichts setzt, ist keiner.** Anders als beim Frageplan reicht
 * ein Thema allein nicht als Bedingung — hier zählt JEDE Achse. Aber eine
 * Antwort ohne eine einzige gesetzte Achse würde die Liste unverändert lassen
 * und dabei behaupten, die Frage verstanden zu haben. Das ist der Fall, in dem
 * die Stichwortsuche die ehrlichere Antwort ist.
 */
export function parseAntragsplan(roh: string, frage: string): Antragsplan | null {
  const text = stripMarkdownWrapper(roh ?? '');
  // Genommen wird das LETZTE balancierte Top-Level-Objekt: schreibt das Modell
  // erst eine Erläuterung mit Beispiel und dann das Ergebnis, ist das Ergebnis
  // das hintere.
  const objekte = parseJsonArrayTolerant(text).filter(istRecord);
  const obj = objekte[objekte.length - 1];
  if (!obj) return null;

  const verworfen: string[] = [];

  const status = leseStatus(obj.status, verworfen);
  const vbPhasen = lesePhasen(obj.phasen, verworfen);
  const jahre = leseJahre(obj.jahre, verworfen);
  const projektart = leseWahl(obj.projektart, WAEHLBARE_PROJEKTARTEN, 'Projektart', verworfen);
  const precheck = leseWahl(obj.precheck, WAEHLBARE_PRECHECKS, 'PreCheck', verworfen);
  const stillstandTage = leseStillstandTage(obj.stillstandTage, verworfen);
  const leitbegriffe = leseLeitbegriffe(obj.begriffe, verworfen);

  const bearbeiter: string[] = [];
  for (const b of alsListe(obj.bearbeiter)) {
    const t = alsText(b);
    if (t.length > 0 && !bearbeiter.includes(t)) bearbeiter.push(t);
  }

  const setztEtwas = status.length > 0
    || vbPhasen.length > 0
    || jahre.length > 0
    || projektart !== undefined
    || precheck !== undefined
    || bearbeiter.length > 0
    || stillstandTage !== undefined
    || leitbegriffe.length > 0;
  if (!setztEtwas) return null;

  return {
    frage: frage.trim(),
    status,
    vbPhasen,
    jahre,
    ...(projektart !== undefined ? { projektart } : {}),
    ...(precheck !== undefined ? { precheck } : {}),
    bearbeiter,
    ...(stillstandTage !== undefined ? { stillstandTage } : {}),
    leitbegriffe,
    ignoriert: baueIgnoriertListe(obj.ignoriert, verworfen),
  };
}

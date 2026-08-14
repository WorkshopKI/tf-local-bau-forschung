/**
 * **Was zu tun ist** — das To-do der Zeile, aus der To-do-Engine. Rein.
 *
 * Bis v3.40 beantwortete die Kopfkarte „was ist zu tun?" nur mit Knöpfen. Die
 * Antwort selbst steht seit v2.390 in der Engine (`ermittleTodosAlleRollen`) und
 * war im Board zu sehen, nicht am Antrag. Hier wird sie gelesen — **nicht neu
 * gerechnet**: dieselbe Kaskade, derselbe Bedingungs-Evaluator, dieselben
 * Sperren (Pitfall #47).
 *
 * **Die Einheit ist das Teilvorhaben, die Zeile ist es nicht.** Die Regeln lesen
 * überwiegend TV-Spalten; alle Teilvorhaben eines Verbunds in einen Topf geworfen
 * bekäme ein fertiges TV das To-do seines Nachbarn (`OffeneAufgaben`). Eine
 * verdichtete Verbundzeile wertet deshalb **je Teilvorhaben** aus und faltet
 * danach — und die Faltung verschweigt nicht, dass sie eine ist: was die übrigen
 * Teilvorhaben sagen, steht als `weitere` daneben.
 *
 * **Zwei Regelsätze, zwei Fragen.** Angezeigt wird der Satz der *eigenen* Rolle
 * (Rollenwahl aus dem Profil). Die Adresse für „Liegt bei" kommt dagegen immer
 * aus dem **AB-Satz** — genau wie im Board: das Urteil des Wächters soll sich
 * nicht verschieben, nur weil jemand seine Anzeige umschaltet.
 */
import { REGELSATZ_DEFAULT } from '@/core/status/regelsatz';
import type { TodoErgebnis } from '@/core/status/todo-engine';
import type { Rolle } from '@/core/status/typen';

/** Ein Teilvorhaben mit der Auswertung aller Regelsätze. */
export interface TvTodo {
  aktenzeichen: string;
  todos: Record<Rolle, TodoErgebnis>;
}

/** Eine Aufgabe und die Teilvorhaben, die sie tragen. */
export interface AufgabenGruppe {
  text: string;
  aktenzeichen: string[];
}

export interface Aufgabe {
  /** Der gelesene Regelsatz. Gehört an die Anzeige — sonst liest man eine
   *  fremde Sicht als die eigene. */
  rolle: Rolle;
  /** Der To-do-Text; `null` = keine Regel dieses Satzes traf. */
  text: string | null;
  /** Das zugehörige Ergebnis — Quelle für „abgeleitet" und die Herleitung. */
  ergebnis: TodoErgebnis | null;
  /** Immer gefüllt: die Herkunft bzw. der Grund, warum nichts dasteht. */
  grund: string;
  /** Abweichende Aufgaben der übrigen Teilvorhaben. Leer bei einem TV. */
  weitere: AufgabenGruppe[];
  /** Teilvorhaben, die die gezeigte Aufgabe tragen. */
  tv: string[];
  /** Wie viele Teilvorhaben ausgewertet wurden. */
  tvGesamt: number;
}

/** Die eine Adresse der Zeile — Eingabe für den Stillstands-Wächter. */
export interface AdressLage {
  /**
   * Das To-do, das `pruefeStillstand` speist; `null`, wenn es keine EINE Adresse
   * gibt. Der Wächter setzt daraus seine `rolle` — geraten wird nichts.
   */
  todo: TodoErgebnis | null;
  /**
   * Warten die Teilvorhaben auf **verschiedene** Rollen? Dann hat die Zeile
   * keine Adresse, und das ist ein eigenes Urteil, kein Schweigen (Pitfall #44).
   */
  uneinig: boolean;
}

export interface AufgabenEingabe {
  jeTv: readonly TvTodo[];
  /** Der Regelsatz, der angezeigt wird. */
  rolle: Rolle;
  /** Führt die geladene Fassung überhaupt To-do-Regeln? */
  ohneRegeln: boolean;
}

/** Wessen Schreibtisch ein Ergebnis benennt; `null` = keiner. */
function adresseVon(e: TodoErgebnis): Rolle | 'ast' | null {
  return e.wartetAuf ?? e.zustaendig[0] ?? null;
}

/**
 * Die Adresse der Zeile aus dem **AB-Satz**, über die Teilvorhaben gefaltet.
 *
 * Benennen zwei Teilvorhaben verschiedene Rollen, gibt es für die Zeile keine
 * eine Adresse — dann wird `null` zurückgegeben und `uneinig` gesetzt, statt die
 * erste zu nehmen und die zweite zu verschweigen.
 */
export function adresseFuerWaechter(jeTv: readonly TvTodo[]): AdressLage {
  const mitTodo = jeTv
    .map(t => t.todos[REGELSATZ_DEFAULT])
    .filter(e => e.todo !== null);
  const mitAdresse = mitTodo.filter(e => adresseVon(e) !== null);
  const verschieden = new Set(mitAdresse.map(e => adresseVon(e)!));
  if (verschieden.size > 1) return { todo: null, uneinig: true };
  return { todo: mitAdresse[0] ?? mitTodo[0] ?? null, uneinig: false };
}

/** Die Aufgaben-Gruppen in Kaskaden-Reihenfolge (die der Teilvorhaben). */
function gruppiere(jeTv: readonly TvTodo[], rolle: Rolle): AufgabenGruppe[] {
  const out: AufgabenGruppe[] = [];
  for (const tv of jeTv) {
    const text = tv.todos[rolle].todo;
    if (text === null) continue;
    const da = out.find(g => g.text === text);
    if (da) da.aktenzeichen.push(tv.aktenzeichen);
    else out.push({ text, aktenzeichen: [tv.aktenzeichen] });
  }
  return out;
}

const OHNE_REGELN = 'Die geladene Fassung führt keine To-do-Regeln — ohne Kaskade gibt es keine Aufgabe.';
const OHNE_TV = 'Kein Teilvorhaben geladen — ohne Datensatz gibt es nichts auszuwerten.';

/** Warum keine Regel traf — eine greifende Sperre ist ein Ergebnis, keine Lücke. */
function grundOhneTreffer(jeTv: readonly TvTodo[], rolle: Rolle): string {
  const sperren = [...new Set(jeTv.flatMap(t => t.todos[rolle].gesperrtDurch))];
  return sperren.length > 0
    ? `Keine Aufgabe mehr — gesperrt durch ${sperren.join(', ')}.`
    : 'Kein To-do ermittelt — keine Regel dieses Regelsatzes trifft zu.';
}

/** Die Herkunft eines Treffers: welche Regel, und ob sie der Rolle gehört. */
function grundMitTreffer(e: TodoErgebnis): string {
  const regel = e.beschreibung ?? e.regelId ?? 'unbenannte Regel';
  return e.quelle === 'abgeleitet'
    ? `Abgeleitet aus Regel ${e.abgeleitetAus ?? '?'} — für diese Rolle gibt es dazu noch keine eigene Regel.`
    : `Aus ${regel}.`;
}

export function baueAufgabe(e: AufgabenEingabe): Aufgabe {
  const leer = {
    rolle: e.rolle, text: null, ergebnis: null, weitere: [], tv: [], tvGesamt: e.jeTv.length,
  };
  if (e.ohneRegeln) return { ...leer, grund: OHNE_REGELN };
  if (e.jeTv.length === 0) return { ...leer, grund: OHNE_TV };

  const gruppen = gruppiere(e.jeTv, e.rolle);
  const erste = gruppen[0];
  if (erste === undefined) return { ...leer, grund: grundOhneTreffer(e.jeTv, e.rolle) };

  // Das Ergebnis-Objekt der ersten Gruppe — es trägt Belege, Beschreibung und
  // die Herkunft. Über `aktenzeichen[0]` gesucht statt mitgeschleppt, damit die
  // Gruppierung ohne Zweitstruktur auskommt.
  const traeger = e.jeTv.find(t => t.aktenzeichen === erste.aktenzeichen[0])!;
  const ergebnis = traeger.todos[e.rolle];
  return {
    rolle: e.rolle,
    text: erste.text,
    ergebnis,
    grund: grundMitTreffer(ergebnis),
    weitere: gruppen.slice(1),
    tv: erste.aktenzeichen,
    tvGesamt: e.jeTv.length,
  };
}

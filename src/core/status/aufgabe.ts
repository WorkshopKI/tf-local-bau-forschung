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
import { REGELSATZ_DEFAULT } from './regelsatz';
import { ROLLE_LABEL, sortiereRollen } from './rollen';
import type { TodoErgebnis } from './todo-engine';
import type { Rolle } from './typen';

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
  /**
   * Kein To-do, **weil eine Sperre griff** — ein Ergebnis, keine Lücke.
   *
   * Dieselbe Unterscheidung wie im Board (`zustaendigkeitVon`: `fertig` vs.
   * `ohne`). Sie ist der Grund, warum ein Vorgang mit Schlussvermerk auf der
   * Startseite nicht mehr als Rückstand zählt, obwohl sein amtlicher Status noch
   * offen sagt — gemessen am 20.08.2026 traf das drei Vorgänge, und zwar die
   * beiden ältesten einer einzigen Kürzel-Liste.
   */
  gesperrt: boolean;
  /** Ids der greifenden Sperren; erklärt, warum die Kaskade schweigt. */
  gesperrtDurch: string[];
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
 * Die Adresse in **einer Zeile**: „wartet auf QS", „liegt bei AB/FB/Jur".
 *
 * Für enge Flächen (Startseiten-Zeile, Kanban-Karte), wo für die
 * Wächter-getriebene Kachel {@link ../../plugins/antraege/ausklapp/kopfkarte/liegtBei.ts}
 * kein Platz ist. Dieselben Wörter wie dort — die Kurzform ist eine Kürzung,
 * kein zweites Vokabular.
 *
 * **`wartetAuf` schlägt `zustaendig`.** Wo eine Regel beides trägt, ist
 * „wartet auf X" die genauere Aussage: sie sagt, dass hier gerade niemand von
 * uns handeln kann. `null` heißt „keine Rolle benannt" — nicht „niemand".
 */
export function adressText(e: TodoErgebnis): string | null {
  if (e.wartetAuf !== null) {
    return `wartet auf ${e.wartetAuf === 'ast' ? 'Antragsteller' : ROLLE_LABEL[e.wartetAuf]}`;
  }
  if (e.zustaendig.length === 0) return null;
  return `liegt bei ${sortiereRollen(e.zustaendig).map(r => ROLLE_LABEL[r]).join('/')}`;
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

/** Die Sperren, die über ALLE ausgewerteten Teilvorhaben griffen. */
function sperrenVon(jeTv: readonly TvTodo[], rolle: Rolle): string[] {
  return [...new Set(jeTv.flatMap(t => t.todos[rolle].gesperrtDurch))];
}

/** Warum keine Regel traf — eine greifende Sperre ist ein Ergebnis, keine Lücke. */
function grundOhneTreffer(sperren: readonly string[]): string {
  return sperren.length > 0
    ? `Keine Aufgabe mehr — gesperrt durch ${sperren.join(', ')}.`
    : 'Kein To-do ermittelt — keine Regel dieses Regelsatzes trifft zu.';
}

/** Die Herkunft eines Treffers: welche Regel, und ob sie der Rolle gehört. */
function grundMitTreffer(e: TodoErgebnis): string {
  const regel = e.beschreibung ?? e.regelId ?? 'unbenannte Regel';
  if (e.quelle !== 'abgeleitet') return `Aus ${regel}.`;
  const woher = e.abgeleitetArt === 'zustaendig'
    ? `Regel ${e.abgeleitetAus ?? '?'} nennt diese Rolle ausdrücklich als mitzuständig`
    : `Regel ${e.abgeleitetAus ?? '?'} wartet auf diese Rolle`;
  return `Abgeleitet: ${woher} — einen eigenen Regelsatz gibt es dazu noch nicht.`;
}

/**
 * Die Aufgabe **einer Zeile aus dem Bestandslauf** — für Startseite und Liste.
 *
 * Nimmt die Aktenzeichen, die diese Zeile trägt (bei einer Verbundzeile alle
 * Teilvorhaben des Clusters, sonst genau eines), und schlägt sie im Register des
 * Laufs nach. Was dort fehlt (noch nicht gerechnet, außerhalb des
 * Betrachtungsbereichs), fällt still heraus — die Faltung sagt über `tvGesamt`,
 * wie viele es am Ende waren.
 *
 * `null`, wenn KEINES der Aktenzeichen im Register steht: dann ist der Lauf für
 * diese Zeile noch nicht gelaufen, und das ist etwas anderes als „keine
 * Aufgabe". Der Aufrufer zeigt dafür einen Platzhalter, nie eine zweite Antwort.
 */
export function aufgabeAusBestand(
  aktenzeichen: readonly string[],
  register: ReadonlyMap<string, TvTodo>,
  rolle: Rolle,
  ohneRegeln: boolean,
): Aufgabe | null {
  const jeTv: TvTodo[] = [];
  for (const az of aktenzeichen) {
    const treffer = register.get(az);
    if (treffer) jeTv.push(treffer);
  }
  if (jeTv.length === 0) return null;
  return baueAufgabe({ jeTv, rolle, ohneRegeln });
}

export function baueAufgabe(e: AufgabenEingabe): Aufgabe {
  const leer = {
    rolle: e.rolle, text: null, ergebnis: null, weitere: [], tv: [], tvGesamt: e.jeTv.length,
    gesperrt: false, gesperrtDurch: [] as string[],
  };
  if (e.ohneRegeln) return { ...leer, grund: OHNE_REGELN };
  if (e.jeTv.length === 0) return { ...leer, grund: OHNE_TV };

  const sperren = sperrenVon(e.jeTv, e.rolle);
  const gruppen = gruppiere(e.jeTv, e.rolle);
  const erste = gruppen[0];
  if (erste === undefined) {
    return {
      ...leer,
      grund: grundOhneTreffer(sperren),
      gesperrt: sperren.length > 0,
      gesperrtDurch: sperren,
    };
  }

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
    // Ein Treffer schlägt die Sperre: sie hat dann nur einzelne Stränge
    // stillgelegt (S1/S2), nicht das Verfahren beendet. Die Ids stehen trotzdem
    // da — sie erklären, warum ein NACHBAR-Strang schweigt.
    gesperrt: false,
    gesperrtDurch: sperren,
  };
}

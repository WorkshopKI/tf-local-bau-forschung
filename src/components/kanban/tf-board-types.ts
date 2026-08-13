/**
 * Schnittstelle des Board-Primitivs. Getrennt von `TfBoard.tsx`, damit ein
 * Aufrufer die Typen importieren kann, ohne die Komponente zu ziehen (Muster:
 * `components/tree/tf-tree-types.ts`).
 *
 * Leitsatz der Grenze: das Primitiv kennt `key`, `label`, einen Farbwert, eine
 * Liste und eine Zahl. Es kennt keinen Status, keinen Speicher und keine Uhr.
 * Was eine Bahn BEDEUTET, entscheidet der Aufrufer — Lane-Schlüssel binden an
 * `StatusCategory` (Pitfall #12) bzw. `FeedbackStatus` (Pitfall #21), und beides
 * hat hier nichts verloren.
 */
import type { TfBahnWunsch, TfBahnWuensche } from './tfBoardBahn';

/** Strukturell statt `LucideIcon`: auch dynamische Resolver (`getLucideIcon`)
 *  liefern eine Komponente dieser Form. */
export type TfBoardIcon = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}>;

/**
 * Was eine Bahn sagt, die die aktive Sicht gar nicht füllen KANN. Gesetzt heißt:
 * die Bahn ist nicht leer, sondern unerreichbar — ihre „0" wäre eine
 * Falschaussage (der Grund, warum ein auf „umgesetzt" gesetztes Ticket spurlos
 * verschwand, v3.39).
 *
 * Die ENTSCHEIDUNG trifft der Aufrufer, die Darstellung das Primitiv.
 */
export interface TfBoardUnerreichbar {
  /** Steht auf der Schiene STATT der Zahl (z.B. „nicht in dieser Sicht"). */
  hinweis: string;
  /** Ganzer Satz für den `title` — muss den Ausweg nennen. */
  titel: string;
  /** Klick auf die Schiene. Ohne Callback ist sie nicht bedienbar. */
  onKlick?: () => void;
}

export interface TfBoardBahn<T> {
  /** React-Key UND Drop-Ziel-Schlüssel. */
  key: string;
  label: string;
  /** Fertiger CSS-Farbwert (Theme-Token, z.B. `var(--tf-fb-lane-neu)`) — wird
   *  als `--tfb-c` injiziert; alle Tönungen entstehen per `color-mix`
   *  (dark-aware). Kein Hex. */
  accent: string;
  items: readonly T[];
  /** Zähler-Pille. Default `items.length`; bei gekappten Bahnen die GESAMT-Zahl. */
  gesamt?: number;
  /** Ohne Icon zeichnet das Primitiv den Akzentpunkt. Beides ist gültig: das
   *  Board führt sechs Status ohne eigenes Icon-Vokabular, die Home-Widgets
   *  Status-Kategorien mit etabliertem. */
  icon?: TfBoardIcon;
  /** Karten-Spalten INNERHALB der Bahn. */
  spalten?: 1 | 2;
  /** Zeile unter dem Kopf (Board: die Summenzeile). */
  zusatz?: React.ReactNode;
  /**
   * Fußzeile unter den Karten. Für „mehr anzeigen" gibt es zwei verschiedene
   * Dinge, deshalb zwei Wege: hier steht ein WEG-NAVIGIEREN („+ N weitere →"
   * öffnet die Liste), das DOM-Budget derselben Optik läuft über `nachladen`.
   */
  fuss?: React.ReactNode;
  /** Titel-Zusatz der Schmalschiene (Default: `${label} — leer`). */
  leerTitel?: string;
  unerreichbar?: TfBoardUnerreichbar;
}

/**
 * Nur was auch verdrahtet ist — ein Flag, das nichts tut, wäre eine Falle
 * (docs/architecture/tree-komponenten.md).
 */
export interface TfBoardFeatures {
  /**
   * Kopf UND Schiene werden zum Einklapp-Schalter. Ohne das Flag ist eine leere
   * Schiene stumm und ein voller Kopf eine Zeile statt eines Knopfes.
   */
  einklappbar?: boolean;
  /**
   * Karten scrollen IN ihrer Bahn (Board in fester Höhe) statt die Bahn wachsen
   * zu lassen (Widget in einer Karte).
   */
  bahnScrollt?: boolean;
}

/**
 * Der Einklapp-Zustand von AUSSEN. Ohne diese Naht hält jede Bahn ihren Wunsch
 * selbst — flüchtig, was für ein Board richtig ist, das man beim nächsten Besuch
 * ohnehin neu aufbaut.
 *
 * Gesetzt heißt: der Aufrufer besitzt den Zustand und darf ihn überleben lassen.
 * Das Primitiv persistiert nichts (es kennt keinen Speicher) — es fragt und
 * meldet. Wirkt nur zusammen mit `features.einklappbar`; ohne das Flag gibt es
 * keine Geste, die etwas zu melden hätte.
 */
export interface TfBoardEinklapp {
  /** Wunsch je Bahn-Schlüssel; fehlender Schlüssel = `auto`. */
  wuensche: TfBahnWuensche;
  onWunsch: (key: string, wunsch: TfBahnWunsch) => void;
}

/**
 * DOM-Budget je Bahn. Gesetzt ⇒ das Primitiv kappt selbst, rendert „+ N weitere"
 * und fängt bei Bestandswechsel wieder oben an (sonst zeigt eine frisch
 * gefilterte Bahn mit drei Treffern noch das aufgeklappte Limit von vorhin).
 */
export interface TfBoardNachladen {
  start: number;
  schritt: number;
}

/**
 * Was der Aufrufer auf seinen Kartenknoten spreizt, damit Ziehen entsteht.
 *
 * Absichtlich OPAK: das ist der Platz, an dem eine Bibliothek später `ref`,
 * `attributes` und `listeners` unterbringt, ohne dass ein Aufrufer sich ändert —
 * dieselbe Naht, über die `@headless-tree` hinter `TfTree` sitzt. Heute steckt
 * hier `{ draggable, onDragStart }`.
 */
export type TfBoardZiehProps = Readonly<Record<string, unknown>>;

/**
 * Die Drop-Naht. Alles-oder-nichts: gesetzt heißt „hier wird gezogen", nicht
 * gesetzt heißt „hier nicht" — das Recht ist board-weit (Rolle + Schreibrecht),
 * nie je Karte, deshalb gibt es kein `canDrag`.
 *
 * Ebenso kein `canDrop`: ein Ablehnen müsste im `dragover` sichtbar werden, und
 * dort gibt der Browser die gezogene Id nicht heraus. Ein Prädikat, das erst
 * beim Fallenlassen greift, verspräche eine Rückmeldung, die es nicht gibt.
 */
export interface TfBoardDnd<T> {
  /** Stabile Id einer Karte — die Währung der Naht. */
  idOf: (item: T) => string;
  /**
   * Einzahl, weil das Primitiv genau eine gezogene Karte kennt. Ob die ihre
   * Mehrfachauswahl mitnimmt, ist eine fachliche Regel und bleibt beim Aufrufer
   * (`zuBewegen` in `auswahl.ts`).
   */
  onDrop: (gezogeneId: string, zielKey: string) => void;
}

export interface TfBoardProps<T> {
  bahnen: readonly TfBoardBahn<T>[];
  /**
   * Karten-Renderer — MUSS ein Element mit stabilem `key` liefern. `zieh` gehört
   * auf den Karten-Wurzelknoten; ohne `dnd` ist es ein leeres Objekt.
   */
  renderCard: (item: T, bahn: TfBoardBahn<T>, zieh: TfBoardZiehProps) => React.ReactNode;
  /** `aria-label` der Bahnspur. Pflicht (Präzedenz `TfTree`). */
  label: string;
  /**
   * `gedeckelt` = Bahnen wachsen zwischen Boden und Deckel, darunter scrollt die
   * Spur waagerecht (Board). `geteilt` = Bahnen teilen die Breite (Widget).
   */
  layout?: 'gedeckelt' | 'geteilt';
  features?: TfBoardFeatures;
  /** Einklapp-Zustand von außen (persistierbar). Ohne die Prop hält ihn jede
   *  Bahn selbst — dann ist er mit dem nächsten Aufbau weg. */
  einklapp?: TfBoardEinklapp;
  nachladen?: TfBoardNachladen;
  dnd?: TfBoardDnd<T>;
  /**
   * Zusatz-Klassen der Wurzel — der Haken, an dem Aufrufer-CSS für die KARTEN
   * hängt (`.fb-board.dicht .fb-karte` bleibt so wortgleich bestehen) und an dem
   * die Seite entscheidet, wo die Spur sitzt.
   */
  className?: string;
}

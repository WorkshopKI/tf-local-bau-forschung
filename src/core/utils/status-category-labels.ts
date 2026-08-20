/**
 * Wie die Arbeitslisten-Achse **heißt** — an genau einer Stelle.
 *
 * **Warum es diese Datei gibt.** Bis v2.409 führten vier Module ihre eigenen
 * Kategorienamen: eine `switch`-Funktion in `groupAggregates.ts` (einem Plugin,
 * importiert von einem anderen Plugin), eine Record-Tabelle im Status-Cockpit,
 * eine Kurzform-Tabelle im Quickfilter („Abgeschl.") und die Section-Header in
 * `antragGroups.ts`. Vier Vokabulare für dieselben neun Werte — sie liefen
 * auseinander, sobald einer davon angefasst wurde.
 *
 * **Die Umbenennung von v2.409.** Vier der neun Kategorienamen waren wortgleich
 * mit ZAH-Phasennamen („Prüfung", „Entscheidung", „Begleitung",
 * „Abgeschlossen"). Zwei Spalten nebeneinander, halb dieselben Wörter, keine
 * sagt wozu — das liest jeder als Widerspruch. Die Wortwahl folgt jetzt der
 * Frage, die die **Arbeitsliste** beantwortet — wer ist am Zug, ist es erledigt
 * — statt dem Verfahrensablauf, den die Phase beschreibt.
 *
 * `begleitung` bleibt bewusst stehen, obwohl es mit einem Phasennamen
 * kollidiert: es ist das eingeführte Wort der Fachseite. Diese eine verbleibende
 * Dopplung wird gegebenenfalls über die **Phasen**beschriftung aufgelöst (die
 * ist seit v2.409 frei), nicht über die Kategorie.
 *
 * **`entscheidung` heißt seit v2.413.1 „Zu entscheiden".** „Entscheidungsreif" war
 * ein unschrumpfbares Einzelwort von 117 px und passte in die 170-px-Lanes des
 * Kanban nur mit Ellipse — abgekürzt las es sich wieder wie der
 * Verfahrensschritt „Entscheidung", also genau die Verwechslung, die v2.409
 * beseitigt hat. Die Verbform trägt dieselbe Aussage, bricht an der Wortgrenze
 * und reiht sich neben `offen` („Zu bearbeiten") in dieselbe Frageform ein.
 *
 * **`nachforderung` heißt seit v4.134 „Nachforderung läuft".** Der alte Name
 * „Wartet auf Antragsteller" beschrieb eine LAGE, die Kategorie umfasst aber
 * genau EINEN Status — „NF gestellt" (bestandsweit 46 Vorgänge). Wer wegen
 * einer versandten Ablehnung oder Rücknahmeempfehlung auf den Antragsteller
 * wartet, steht in `entscheidung`. Auf der Startseite stand die Bahn deshalb
 * auf 0, während zehn Karten daneben „wartet auf Antragsteller" sagten — die
 * Bahn-Überschrift widersprach den Karten unter ihr. **Wer wartet, sagt die
 * To-do-Kaskade je Zeile** (`aufgabenAnzeige`, `wartetAuf`); die Kategorie sagt,
 * WO im Verfahren der Vorgang steht. Zwei Fragen, zwei Antworten — der
 * Kategoriename darf die zweite nicht vortäuschen.
 *
 * **Die Aggregate tragen eigene Namen.** Reiter und Abschnitte in
 * *Förderanträge* fassen Kategorien zusammen — „Vor Entscheidung" sind drei,
 * „Beendet" zwei. Sie dürfen deshalb NICHT den Namen einer ihrer Kategorien
 * erben: ein Reiter „Zu bearbeiten", der drei Kategorien meint, von denen eine
 * ebenfalls „Zu bearbeiten" heißt, wäre genau die Verwechslung eine Ebene höher.
 * Der Konventionstest `status-label-namensraeume-disjunkt` hält das fest.
 *
 * Rein: keine IO, kein React, keine Uhr.
 */
import type { StatusCategory } from './status-canonical';

/** Lange und kurze Schreibweise. Die Kurzform ist für Leisten mit Zählern. */
export interface Beschriftung {
  lang: string;
  /** Kurzform für enge Leisten; gleich `lang`, wo nichts zu kürzen ist. */
  kurz: string;
}

/**
 * Die neun Arbeitslisten-Bezeichnungen. **Einzelquelle** — kein Modul führt
 * eigene Kategorienamen (Konventionstest `status-labels-single-source`).
 */
export const KATEGORIE_TEXTE: Readonly<Record<StatusCategory, Beschriftung>> = {
  offen: { lang: 'Zu bearbeiten', kurz: 'Zu bearb.' },
  in_pruefung: { lang: 'In Arbeit', kurz: 'In Arbeit' },
  nachforderung: { lang: 'Nachforderung läuft', kurz: 'Nachforderung' },
  entscheidung: { lang: 'Zu entscheiden', kurz: 'Zu entsch.' },
  bewilligt: { lang: 'Bewilligt', kurz: 'Bewilligt' },
  begleitung: { lang: 'Begleitung', kurz: 'Begleitung' },
  abgelehnt: { lang: 'Abgelehnt', kurz: 'Abgelehnt' },
  abgeschlossen: { lang: 'Erledigt', kurz: 'Erledigt' },
  sonstige: { lang: 'Ohne Zuordnung', kurz: 'Ohne Zuord.' },
};

/**
 * Die neun Werte in Taxonomie-Reihenfolge — von „am Zug" bis „erledigt".
 *
 * Stand bis v3.47 zweimal wortgleich da (Status-Cockpit-Selects und die
 * Lane-Auswahl der Home-Widgets). Der dritte Leser (das Kanban-Vollbild, das
 * ALLE Kategorien mit Karten zeigt) wäre die dritte Kopie gewesen — also zieht
 * sie hierher, neben die Beschriftungen, die dieselbe Achse beschreiben.
 *
 * `Object.keys(KATEGORIE_TEXTE)` täte es nicht: die Schlüsselreihenfolge eines
 * Records ist eine Zusage der Sprache über Einfügereihenfolge, keine über
 * fachliche Ordnung — wer die Tabelle alphabetisch sortierte, verschöbe damit
 * stillschweigend jede Auswahlliste der App.
 */
export const KATEGORIE_REIHENFOLGE: readonly StatusCategory[] = [
  'offen', 'in_pruefung', 'nachforderung', 'entscheidung',
  'bewilligt', 'begleitung', 'abgelehnt', 'abgeschlossen', 'sonstige',
];

const KATEGORIE_WERTE = new Set<string>(KATEGORIE_REIHENFOLGE);

/**
 * Ist diese Zeichenkette eine Kategorie? Der Prüfstein für Werte, die aus einem
 * gespeicherten Stand zurückkommen — eine Config überlebt Umbenennungen, der
 * Typ tut es nicht.
 */
export function istStatusCategory(wert: string): wert is StatusCategory {
  return KATEGORIE_WERTE.has(wert);
}

/**
 * Zusammenfassungen mehrerer Kategorien. Ihre Namen kommen mit keiner
 * Kategoriebezeichnung überein — das ist die Zusage, nicht ein Zufall.
 *
 * - `vorEntscheidung` — offen + in_pruefung + entscheidung: alles, was vor der
 *   Entscheidung liegt, egal wer gerade schreibt.
 * - `beendet` — abgeschlossen + abgelehnt: die Arbeit ist getan, im Guten wie
 *   im Schlechten. Dieselbe Menge wie `isTerminalStatus`.
 * - `arbeitsvorrat` — das Gegenstück dazu: alles Nicht-Terminale.
 */
export const AGGREGAT_TEXTE = {
  vorEntscheidung: { lang: 'Vor Entscheidung', kurz: 'Vor Entsch.' },
  beendet: { lang: 'Beendet', kurz: 'Beendet' },
  arbeitsvorrat: { lang: 'Arbeitsvorrat', kurz: 'Arbeitsvorrat' },
} as const satisfies Record<string, Beschriftung>;

export type AggregatId = keyof typeof AGGREGAT_TEXTE;

/** Die Arbeitslisten-Bezeichnung einer Kategorie. */
export function getStatusCategoryLabel(cat: StatusCategory): string {
  return KATEGORIE_TEXTE[cat].lang;
}

/**
 * Kurzform für enge Leisten (Quickfilter-Pille mit Zähler). Zweites Feld
 * derselben Quelle statt einer zweiten Tabelle — genau daran lief die alte
 * Kurzform-Map („Abgeschl.") vom Rest weg.
 */
export function getStatusCategoryLabelKurz(cat: StatusCategory): string {
  return KATEGORIE_TEXTE[cat].kurz;
}

/** Die Bezeichnung einer Zusammenfassung. */
export function getAggregatLabel(id: AggregatId): string {
  return AGGREGAT_TEXTE[id].lang;
}

/** Kurzform einer Zusammenfassung. */
export function getAggregatLabelKurz(id: AggregatId): string {
  return AGGREGAT_TEXTE[id].kurz;
}

/**
 * CSS-Farbe je Kategorie für die Mini-Dots in der Verbund-Kachel.
 *
 * Lag bis v2.409 neben der alten Label-Funktion in `plugins/antraege/` und wurde
 * von `plugins/home/` und `plugins/suche/` quer importiert — ein Plugin, das für
 * zwei andere die Wahrheit hält. Sie zieht mit den Beschriftungen um, weil sie
 * dieselbe Achse beschreibt.
 *
 * Noch Hex statt Theme-Token (Phase-1-Stand); die Kanban-Lanes führen mit
 * `--tf-kanban-*` bereits Tokens für dieselben neun Keys.
 */
export function getStatusCategoryColor(cat: StatusCategory): string {
  switch (cat) {
    case 'offen': return '#94a3b8'; // slate-400 (neutral/eingang)
    case 'in_pruefung': return '#3b82f6'; // blue-500
    case 'nachforderung': return '#f59e0b'; // amber-500
    case 'entscheidung': return '#8b5cf6'; // violet-500
    case 'bewilligt': return '#10b981'; // emerald-500
    case 'begleitung': return '#14b8a6'; // teal-500
    case 'abgelehnt': return '#ef4444'; // red-500
    case 'abgeschlossen': return '#6b7280'; // gray-500
    case 'sonstige': return '#d1d5db'; // gray-300
  }
}

/**
 * **Was in der Zeile steht** — die eine Formel für Startseite, Kanban-Karte und
 * Tabellenspalte.
 *
 * Bis v4.132 rechnete jede dieser Flächen „was ist zu tun?" selbst, und zwar mit
 * einer Tabelle über den rohen Status
 * ([naechsterSchritt.ts](../utils/naechsterSchritt.ts)), die die gesetzten
 * Kürzel nicht kennt. Sie sagte dem FB „Gutachten freigeben", während `D_AT4`
 * längst gesetzt war und die Kaskade „in QS" sagte — bei 101 von 102 Vorgängen
 * mit diesem Status (Bestand vom 20.08.2026).
 *
 * Fünf Zustände, und jeder sagt, woher er kommt:
 *
 * | `quelle`    | wann | was steht da |
 * |---|---|---|
 * | `kaskade`   | eine Regel des EIGENEN Satzes trifft | ihr To-do + die Adresse |
 * | `fremd`     | nur ein fremder Satz trifft (v4.136) | dessen To-do + „liegt bei …", gedämpft |
 * | `gesperrt`  | kein To-do, aber eine Sperre griff | „Keine Aufgabe mehr" + der Grund |
 * | `rueckfall` | gar keine Regel trifft, auch keine fremde | die alte Formel |
 * | `laedt`     | der Bestandslauf ist noch nicht durch | „…" |
 *
 * **`fremd` ist der Normalfall der FB-Sicht**, solange es keine FB-Regeln gibt:
 * „in QS" wartet auf die QS, „GA schreiben" liegt bei der AB — beide nennen den
 * FB nicht, also hat er dort nichts zu tun. Das ist eine Auskunft, keine
 * Anweisung, und wird als solche gezeigt (gedämpft, mit Adresse). Bis v4.136
 * stand dort der Rückfall und damit eine Handlung, die keine war.
 *
 * **Nie zwei Antworten hintereinander.** Solange gerechnet wird, steht dort ein
 * Platzhalter und nicht der Rückfall — ein Text, der sich nach fünf Sekunden in
 * einen anderen verwandelt, ist schlimmer als einer, der auf sich warten lässt.
 *
 * **Ausnahme: der Stand von vor dem Import** (`vorlaeufig`). Nach einer
 * Datenaktualisierung rechnet der Bestandslauf erst nach dem Veröffentlichen neu;
 * bis dahin steht die Kaskaden-Aussage des alten Bestands da, als solche
 * markiert (Symbol + Tooltip). Sie ist keine zweite Antwort neben der ersten,
 * sondern die erste mit Datum — der Platzhalter über allen Zeilen las sich als
 * Hänger. Nur wo die Kaskade etwas gesagt hatte: Platzhalter und Rückfall haben
 * keinen alten Stand.
 *
 * Rein und ohne React.
 */
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import type { Aufgabe } from './aufgabe';
import { adressText } from './aufgabe';
import type { TodoRegel } from './typen';

/**
 * Arbeitslisten, in denen eine greifende Sperre **keine Nachricht** ist.
 *
 * Ein bewilligter Antrag trägt naturgemäß einen Zuwendungsbescheid, und der
 * sperrt die Kaskade (S0b) — „Keine Aufgabe mehr" wäre dort zugleich banal und
 * zu viel behauptet: in der Begleitphase steht die VN-Prüfung noch aus. Die
 * Meldung gehört in die **Antragsphase**, wo ein Schlussvermerk über einem
 * offenen Status eine echte Abweichung ist.
 */
const SPERRE_IST_ERWARTBAR: ReadonlySet<StatusCategory> = new Set<StatusCategory>([
  'bewilligt', 'begleitung', 'abgeschlossen', 'abgelehnt',
]);

export type AufgabenQuelle = 'kaskade' | 'fremd' | 'gesperrt' | 'rueckfall' | 'laedt';

/**
 * Trifft eine Regel — die eigene oder eine fremde?
 *
 * Die Unterscheidung „meine Aufgabe / fremde Aufgabe" trägt die **Adresse** in
 * Worten („wartet auf QS", „liegt bei AB"), nicht eine Graustufe: `--tf-text-tertiary`
 * misst 2,62:1 gegen den hellen Grund und liegt damit unter AA. Der Aufgabentext
 * ist der Haupttext der Zeile; in der FB-Sicht wären das 16 von 19 Zeilen.
 * Gedämpft wird nur `gesperrt` — dort steht „Keine Aufgabe mehr", und daran geht
 * nichts verloren.
 */
export function regelTraf(q: AufgabenQuelle): boolean {
  return q === 'kaskade' || q === 'fremd';
}

export interface AufgabenAnzeige {
  /** Der Text der Zeile. Leer nur, wenn es wirklich nichts zu sagen gibt. */
  text: string;
  quelle: AufgabenQuelle;
  /**
   * Die Nebenzeile: „wartet auf QS", „liegt bei AB/FB" — oder bei einer Sperre
   * deren Beschreibung. Leer, wenn keine Rolle benannt ist.
   */
  neben: string;
  /** Tooltip: die Herleitung bzw. der Grund. Immer gefüllt. */
  titel: string;
  /**
   * Die Aufgabe gehört nur EINEM Teil der Teilvorhaben — „2 von 4 TV".
   * Leer, wenn alle dasselbe sagen. Eine Faltung, die sich nicht zu erkennen
   * gibt, ist schlimmer als keine.
   */
  anteil: string;
  /**
   * Die Aussage stammt aus dem Bestand VOR der letzten Datenaktualisierung und
   * steht nur, bis neu gerechnet ist. Nur gesetzt, wenn wahr.
   */
  vorlaeufig?: true;
}

const PLATZHALTER = '…';

/**
 * Nebenzeile einer Zeile außerhalb des Bestandslaufs. Sichtbar, nicht nur im
 * Tooltip: ein Rückfall, der sich nicht zu erkennen gibt, liest sich wie eine
 * Kaskaden-Aussage (Pitfall #46).
 */
export const AUSSERHALB_LAUF_NEBEN = 'ältere Richtlinie – aus dem Status abgeleitet';

/** Die Beschreibungen der greifenden Sperren, in Kaskaden-Reihenfolge. */
function sperrNamen(ids: readonly string[], regeln: readonly TodoRegel[]): string[] {
  const namen: string[] = [];
  for (const r of regeln) {
    if (!ids.includes(r.id)) continue;
    namen.push(r.beschreibung ?? r.id);
  }
  // Ids ohne Regel (eine Fassung, die die Sperre nicht mehr führt) gehen nicht
  // verloren — sie stehen als Id da, statt still zu verschwinden.
  for (const id of ids) {
    if (!regeln.some(r => r.id === id)) namen.push(id);
  }
  return namen;
}

export interface AnzeigeEingabe {
  /** Die gefaltete Aufgabe; `null` = für diese Zeile liegt noch nichts vor. */
  aufgabe: Aufgabe | null;
  /** Die alte Formel als Rückfall (`schrittText`). Darf leer sein. */
  rueckfall: string;
  /** Läuft der Bestandslauf noch? Dann ist `null` kein Ergebnis, sondern Warten. */
  laeuftNoch: boolean;
  /**
   * Die Daten des Laufs stammen aus dem Bestand vor der letzten
   * Datenaktualisierung (`useZeilenAufgaben().vorlaeufig`). Markiert jede
   * Aussage, die aus ihnen kommt.
   */
  vorlaeufig?: boolean;
  /**
   * Die Zeile gehört zu einer Richtlinie, die der Bestandslauf nicht rechnet
   * (älter als die vorige). Dann heißt `aufgabe === null`: die Kaskade wurde
   * nicht gefragt — und die Nebenzeile sagt das.
   */
  ausserhalbLauf?: boolean;
  /** Die Regeln der geltenden Fassung — nur zum Benennen der Sperren. */
  regeln?: readonly TodoRegel[];
  /**
   * Der rohe Status der Zeile. Entscheidet allein darüber, ob eine greifende
   * Sperre gemeldet wird ({@link SPERRE_IST_ERWARTBAR}) — ohne ihn wird sie
   * immer gemeldet, wie in einer Liste, die ohnehin nur die Antragsphase führt.
   */
  status?: string | null;
}

/** Vorangestellt im Tooltip einer vorläufigen Aussage. */
const VORLAEUFIG_TITEL = 'Stand vor der letzten Datenaktualisierung — wird gerade neu berechnet.';

export function aufgabenAnzeige(e: AnzeigeEingabe): AufgabenAnzeige {
  const a = anzeigeAusAufgabe(e);
  // Vorläufig ist nur, was aus den alten Laufdaten kam. Platzhalter und reiner
  // Rückfall (`aufgabe === null`) haben keinen alten Stand, den man markieren könnte.
  if (!e.vorlaeufig || e.aufgabe === null) return a;
  return { ...a, vorlaeufig: true, titel: `${VORLAEUFIG_TITEL} ${a.titel}` };
}

function anzeigeAusAufgabe(e: AnzeigeEingabe): AufgabenAnzeige {
  const { aufgabe, rueckfall, laeuftNoch } = e;

  if (aufgabe === null) {
    if (laeuftNoch) {
      return {
        text: PLATZHALTER, quelle: 'laedt', neben: '', anteil: '',
        titel: 'Die Aufgabe wird gerade aus den gesetzten Kürzeln ermittelt.',
      };
    }
    if (e.ausserhalbLauf) {
      return {
        text: rueckfall, quelle: 'rueckfall', neben: AUSSERHALB_LAUF_NEBEN, anteil: '',
        titel: `${rueckfall ? `${rueckfall} — ` : ''}abgeleitet aus dem Status. Die Kaskade rechnet nur `
          + 'die aktuelle und die vorige Richtlinie; dieser Vorgang gehört zu einer älteren.',
      };
    }
    return {
      text: rueckfall, quelle: 'rueckfall', neben: '', anteil: '',
      titel: rueckfall
        ? `${rueckfall} — abgeleitet aus dem Status, nicht aus den gesetzten Kürzeln.`
        : 'Kein Status hinterlegt.',
    };
  }

  const anteil = aufgabe.tvGesamt > 1 && aufgabe.tv.length < aufgabe.tvGesamt
    ? `${aufgabe.tv.length} von ${aufgabe.tvGesamt} TV`
    : '';

  const sperreMelden = aufgabe.gesperrt
    && !(e.status != null && SPERRE_IST_ERWARTBAR.has(getStatusCategory(e.status)));
  if (sperreMelden) {
    const namen = sperrNamen(aufgabe.gesperrtDurch, e.regeln ?? []);
    return {
      text: 'Keine Aufgabe mehr',
      quelle: 'gesperrt',
      neben: namen.join(' · '),
      anteil: '',
      titel: `${aufgabe.grund} Der amtliche Status sagt noch etwas anderes — die Kürzel sind der jüngere Stand.`,
    };
  }

  if (aufgabe.text === null) {
    return {
      text: rueckfall, quelle: 'rueckfall', neben: '', anteil: '',
      titel: `${aufgabe.grund} Gezeigt wird deshalb die Ableitung aus dem Status.`,
    };
  }

  return {
    text: aufgabe.text,
    quelle: aufgabe.gelesenAls === aufgabe.rolle ? 'kaskade' : 'fremd',
    neben: aufgabe.ergebnis ? (adressText(aufgabe.ergebnis) ?? '') : '',
    anteil,
    titel: [
      aufgabe.grund,
      ...aufgabe.weitere.map(g => `Weitere: ${g.text} (${g.aktenzeichen.length} TV)`),
    ].join(' '),
  };
}

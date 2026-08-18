/**
 * „Suchen in" — worin die Suche überhaupt nachsieht.
 *
 * Der Korpus hält die Antragsfelder ohnehin getrennt vor
 * ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts)); die
 * Beschränkung ist damit eine Whitelist, kein Eingriff in einen Index.
 *
 * Wozu das gut ist, zeigt der Handoff an einem echten Fall: „Standards" findet
 * die „HPC Standards GmbH" — ein Treffer im Firmennamen, nicht im Thema. Wer
 * fachlich sucht, will die Einrichtung ausschließen können.
 *
 * Rein — kein React, kein IDB.
 */
import type { Trefferfeld } from './trefferstelle';

export type Suchbereich = 'alles' | 'inhalt' | 'dokumente' | 'einrichtung' | 'standort';

/**
 * Die Beschriftungen — Reihenfolge = Reihenfolge im Aufklapper: erst der weite
 * Standard, dann die Einschränkungen vom Inhalt zur Herkunft.
 *
 * Der Standard hieß bis v4.44.0 „Titel, Beschreibung, Dokumente". Die
 * Aufzählung nannte drei von acht Feldern und las sich damit als Einschränkung,
 * die sie nie war: Einrichtung, Ort, Akronym, Aktenzeichen, Deskriptoren und
 * Web-Adresse waren immer mit dabei. Zweimal gemeldet als „Feld X wird nicht
 * durchsucht", beide Male stimmte es nicht — gesucht wurde in einem der
 * „nur …"-Bereiche. Erst der Gegensatz „alle …" ⇄ „nur …" macht sichtbar,
 * welche Wahl etwas WEGNIMMT.
 *
 * Seit v4.100 heißt er **„alle Vorhabensfelder"** statt „alle Felder". Der
 * Zusatz ist keine Verzierung, sondern die Gegenbuchung zu `NICHT_IM_STANDARD`:
 * die Arbeitsnotizen hängen am Vorgang und laufen nicht mehr mit. „alle Felder"
 * wäre damit genau die Sorte Name, die diesen Bereich schon zweimal in eine
 * Fehlmeldung geführt hat — einer, der mehr zusagt, als er hält. Was der Name
 * zusagt, hält der Guard in `wortstamm.test.ts` fest.
 *
 * „Wer" und „wo" sind seit v4.15.0 GETRENNT. Zusammengelegt beantwortete der
 * Bereich zwei Fragen auf einmal: wer nach einem Ort suchte, bekam die
 * Firmennamen dazu (und umgekehrt) — und genau das Trennen war der Zweck der
 * Beschränkung. Der Korpus hält beide Felder ohnehin einzeln vor.
 */
export const SUCHBEREICH_LABEL: Record<Suchbereich, string> = {
  alles: 'alle Vorhabensfelder',
  inhalt: 'nur Titel & Kurzbeschreibung',
  dokumente: 'nur Dokumente',
  einrichtung: 'nur Einrichtung',
  standort: 'nur Ort, Bundesland & Wahlkreis',
};

/**
 * Die drei Trefferfelder, die in KEINEM Bereich mitlaufen — jedes aus einem
 * eigenen Grund, und jedes auf einem anderen Weg trotzdem erreichbar.
 *
 *  - `dokument` hängt am Dokumentenindex (`bereichNutztDokumente`),
 *  - `aehnlichkeit` an ihrem eigenen Schalter,
 *  - `notiz` **nur noch am Feld-Präfix** `notiz:` (bzw. `bemerkung:`,
 *    `wichtig:`, `t_yw:`, `t_hint:` — [feldpraefix.ts](./feldpraefix.ts)).
 *
 * Warum die Arbeitsnotiz seit v4.100 nicht mehr im Standard steht: sie hängt am
 * VORGANG, nicht am Vorhaben, und trägt entsprechend Verwaltungsverkehr. Am
 * Bestand gezählt (12 358 Anträge, `T_YW` + `T_HINT`): 5 345 tragen eine Notiz,
 * und **1 054 davon nennen eine Vollmacht** — „vollmacht" ist mit 1 010
 * Vorkommen das dritthäufigste Wort dieser Felder überhaupt, hinter den beiden
 * Feldnamen selbst. Danach kommen `iban` (187), `zahlungsstopp` (167),
 * `fristverlängerung` (110) und durchgehend Personennamen.
 *
 * Wer fachlich sucht, bekam davon Treffer, deren einziger Grund ein
 * Bevollmächtigten-Name war — und die Beleg-Spalte „Notiz" schrieb ihn in die
 * Tabelle. Gemeldet als „warum kann ich die Spalte Notiz nicht abwählen".
 * Nicht die Spalte war das Problem, sondern der Treffer darunter: die Spalte
 * ist sein Beleg ([autoSpalten.ts](src/plugins/suche/autoSpalten.ts)) und
 * verschwindet jetzt mit ihm.
 *
 * Der Preis ist benannt statt versteckt: der Standardbereich heißt seit
 * derselben Version **„alle Vorhabensfelder"** und nicht mehr „alle Felder" —
 * ein Name, der mehr zusagt, als er hält, war zweimal die Ursache einer
 * Fehlmeldung (siehe `SUCHBEREICH_LABEL`).
 */
export const NICHT_IM_STANDARD: readonly Trefferfeld[] = ['dokument', 'aehnlichkeit', 'notiz'];

/**
 * Welche Antragsfelder die Wortlaut-Stufe prüft.
 *
 * Akronym, Aktenzeichen und Verbundkennzeichen gehören zu den INHALTLICHEN
 * Bereichen, weil sie die Identität eines Vorhabens sind: wer ein FKZ eintippt,
 * meint dieses Vorhaben, egal welchen Bereich er eingestellt hat. In „nur
 * Einrichtung" und „nur Ort, Bundesland & Wahlkreis" haben sie nichts zu suchen
 * — dort ist die Frage „wer" bzw. „wo", nicht „welches".
 *
 * `dokumente` liefert eine LEERE Menge: die Wortlaut-Stufe trägt dann nichts
 * bei, alle Treffer kommen aus dem Dokumentenindex. Sonst stünde unter „nur
 * Dokumente" ein Antrag, der über sein Akronym gefunden wurde.
 *
 * `alles` führt JEDES Antragsfeld, das der Korpus kennt — der Name ist eine
 * Zusage, keine Beschreibung. Ein neues `Trefferfeld` gehört deshalb hier
 * eingetragen, sonst sucht der Standardbereich stillschweigend weniger als er
 * verspricht. Die einzigen Ausnahmen stehen benannt in `NICHT_IM_STANDARD`;
 * der Guard in `wortstamm.test.ts` prüft, dass es bei diesen dreien bleibt.
 */
export function bereichFelder(bereich: Suchbereich): ReadonlySet<Trefferfeld> {
  switch (bereich) {
    case 'inhalt':
      return new Set<Trefferfeld>([
        'titel', 'kurzbeschreibung', 'akronym', 'aktenzeichen', 'verbundkennzeichen',
      ]);
    case 'einrichtung':
      // Die Web-Adresse gehoert hierher, weil sie dieselbe Frage beantwortet:
      // wer ist das. Sie ist der einzige Weg zu Einrichtungen, die ihr Kuerzel
      // NICHT im Namen fuehren — „GMBU" steht im ganzen Bestand in keinem
      // Organisationsfeld, wohl aber in `gmbu.de`.
      return new Set<Trefferfeld>(['organisation', 'domain']);
    case 'standort':
      // Der Wahlkreis gehoert zum „wo": er nennt in 5 274 von 14 218 Faellen
      // einen Ort, der im Standort-Feld NICHT vorkommt. Ohne ihn faende „nur
      // Ort & Bundesland" weniger als der Standardbereich — und der Nutzer haette
      // keinen Weg, das zu sehen. Die Beschriftung nennt ihn deshalb mit.
      return new Set<Trefferfeld>(['standort', 'bundesland', 'wahlkreis']);
    case 'dokumente':
      return new Set<Trefferfeld>();
    case 'alles':
    default:
      // `notiz` steht hier NICHT — die Begruendung oben in `NICHT_IM_STANDARD`.
      return new Set<Trefferfeld>([
        'titel', 'kurzbeschreibung', 'deskriptoren',
        'akronym', 'aktenzeichen', 'verbundkennzeichen',
        'organisation', 'domain', 'standort', 'bundesland',
        'netzwerk', 'wahlkreis',
      ]);
  }
}

/** Wird der Dokumentenindex befragt? In den reinen Stammdaten-Bereichen nicht —
 *  sonst käme unter „nur Einrichtung" ein Vorhabensbeschreibungs-Treffer. */
export function bereichNutztDokumente(bereich: Suchbereich): boolean {
  return bereich === 'alles' || bereich === 'dokumente';
}

/** Toleranter Leser für die Persistenz. Ein gemerkter Wert, den diese Fassung
 *  nicht mehr führt, fällt auf den weitesten Bereich zurück — nie auf einen
 *  engeren, der stillschweigend Treffer unterschlüge. */
export function parseSuchbereich(roh: string | null): Suchbereich {
  if (roh === 'inhalt' || roh === 'dokumente' || roh === 'einrichtung' || roh === 'standort') {
    return roh;
  }
  return 'alles';
}

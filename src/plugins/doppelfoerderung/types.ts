/**
 * Die vier Formen, in denen die Doppelförderungs-Prüfung ihre Daten führt.
 *
 * Sie stehen zusammen, weil sie eine Kette bilden: aus der Excel-Zeile
 * (`MeldungsZeile`) werden Schlagworte, aus den Schlagworten Befunde
 * (`TrefferBefund`), aus den Befunden ein Urteil (`ZeilenErgebnis`). Jede Stufe
 * behält, was die vorige geliefert hat — die Kette ist nachvollziehbar, nicht
 * nur ihr Ende.
 */
import type { TraegerBezug } from './services/traeger';

export type { TraegerBezug };

/** Eine Zeile der gemeldeten Frühkoordinierungs-Liste. */
export interface MeldungsZeile {
  /** 1-basierte Zeilennummer im Blatt — die Zahl, die im Excel danebensteht. */
  zeilenNr: number;
  /** Förderkennzeichen der Meldung (Spalte FKZ). Leer, wenn die Datei keins führt. */
  fkz: string;
  /** Spalte „Thema". */
  thema: string;
  /** Spalte „Aufgabenbeschreibung". */
  aufgabenbeschreibung: string;
  /**
   * Bundesmittel in Euro — `null`, wenn die Zelle keinen lesbaren Betrag trug.
   *
   * `null` heisst NICHT „null Euro": eine Zeile ohne lesbaren Betrag wird
   * getrennt ausgewiesen, statt still unter die Schwelle zu fallen.
   */
  betrag: number | null;
  /** Rohtext der Betragszelle — steht in der Anzeige, wenn `betrag` null ist. */
  betragRoh: string;
  /**
   * Zuwendungsempfänger / Auftragnehmer — **Beleg, nicht nur Anzeige**.
   *
   * Trägt die Träger-Achse ([traeger.ts](./services/traeger.ts)): dieselbe
   * Einrichtung hier und im Bestand ist die einzige der drei Achsen, die eine
   * Tatsache feststellt statt Nähe zu schätzen. Bei Netzwerk- und
   * Zentrums-Meldungen steht hier die Netzwerkmanagement-Einrichtung.
   */
  zuwendungsempfaenger: string;
  /**
   * LP-Systematik-Code der Zuarbeit — die Gattung, die die Liste selbst nennt.
   *
   * An der 72er-Liste trägt `GE2317` exakt die 22 Zentrums-Meldungen. Der Code
   * wird **nicht ausgewertet**, nur geführt und angezeigt: er ist Fremddaten aus
   * einem anderen Haus, und was seine Werte bedeuten, steht nicht in dieser App.
   */
  lpSystematik: string;
  /** Laufzeit als „von – bis", rein zur Anzeige. Leer, wenn die Datei keine führt. */
  laufzeit: string;
  /**
   * Die weiteren Zeilen desselben Verbunds, wenn Teilvorhaben gefaltet wurden.
   *
   * Leer bei ungefalteten Zeilen. Die Faltung spart KI-Läufe (45 Meldungen der
   * Beispielliste sind 26 Vorhaben) und druckt dasselbe Urteil nicht sechsmal.
   */
  weitereFkz: readonly string[];
}

/** Was `leseMeldungsListe` aus einer Datei macht. */
export interface MeldungsListe {
  /** Name des gelesenen Blattes. */
  blatt: string;
  /** Alle Datenzeilen in Dateireihenfolge — ungefiltert. */
  zeilen: readonly MeldungsZeile[];
}

/**
 * Welche Stufen einen Antrag gefunden haben.
 *
 * `beide` meint Wortlaut **und** Ähnlichkeit; der Träger-Bezug steht daneben in
 * `TrefferBefund.traeger`, weil er keine Fund-Stufe ist, sondern eine
 * Eigenschaft des Fundes — er kann jede der beiden Stufen begleiten oder allein
 * stehen.
 */
export type TrefferQuelle = 'wortlaut' | 'aehnlichkeit' | 'beide' | 'traeger';

/** Ein gefundenes ZIM-Vorhaben samt der Belege, die es getragen haben. */
export interface TrefferBefund {
  /** Förderkennzeichen = Schlüssel im Suchkorpus. */
  aktenzeichen: string;
  /** Verbund-Id für den Deep-Link (`antragDetailPfad`); leer = Standalone. */
  verbundId: string;
  /** Verbund-Titel; leer, wenn der Antrag keinen führt. */
  verbundTitel: string;
  /** Teilvorhaben-Titel. */
  titel: string;
  /** Kurzbeschreibung / Vorhabeninhalt. */
  kurzbeschreibung: string;
  /** Welche der Schlagworte dieser Zeile wörtlich vorkamen. */
  getroffeneWorte: readonly string[];
  /**
   * Die Zahl, gegen die die Schwelle prüft — **ohne** die zu weiten Schlagworte.
   *
   * Nicht `getroffeneWorte.length`: ein Wort, das ein Fünftel des Bereichs
   * trifft („Automatisierung", 852 von 4.327), belegt nichts und zählt deshalb
   * nicht mit (`WORT_ZAEHLT_NICHT_ANTEIL`). Ohne diese Trennung bevorzugt das
   * Urteil systematisch die weiten Trios — an der 72er-Liste die häufigste
   * Fehlerquelle der Wortlaut-Achse.
   */
  abdeckung: number;
  /** Alle getroffenen Schlagworte gezählt, auch die zu weiten — für die Anzeige. */
  abdeckungRoh: number;
  /** Führt dieser Antrag denselben Zuwendungsempfänger wie die Meldung? */
  traeger: TraegerBezug | null;
  /** `VB_PHASE` des Antrags (1/2 = Netzwerk, 3 = FuE, 5 = Studie); `null` = unbekannt. */
  vbPhase: number | null;
  /** Kosinus-Ähnlichkeit der Ähnlichkeitsstufe; `null` = sie fand ihn nicht. */
  aehnlichkeit: number | null;
  quelle: TrefferQuelle;
  /** Rohstatus aus dem Fachsystem, rein zur Anzeige (Pitfall #12: nie vergleichen). */
  status: string;
  /** Antragsdatum, rein zur Anzeige. */
  antragsdatum: string;
  antragsteller: string;
}

/**
 * Warum eine Zeile so beurteilt wurde.
 *
 * `unklar` ist **kein Nein**: es steht für „die Wortlaut-Achse konnte hier
 * nichts sagen", weil kein einziges Schlagwort im Bereich vorkam. An der
 * 72er-Liste traf das fünf Meldungen; drei davon lagen mit der Ähnlichkeit
 * knapp unter der Schwelle. Sie als „keine Übereinstimmung" auszugeben behauptet
 * eine Prüfung, die nicht stattgefunden hat.
 */
export type UrteilGrund = 'traeger' | 'schlagworte' | 'aehnlichkeit' | 'keine' | 'unklar';

/** Wie viele Anträge des Bereichs ein Schlagwort wörtlich trifft. */
export interface SchlagwortTreffer {
  wort: string;
  treffer: number;
}

/**
 * Was auf einer der drei Achsen zur Wahl stand — und was gewonnen hat.
 *
 * Das Modell liefert je Achse mehrere Vorschläge, von eng nach weit. Welcher
 * davon das Urteil trägt, entscheidet **nicht** das Modell, sondern der
 * Bestand: die App schlägt jeden Vorschlag nach und nimmt den engsten, der
 * überhaupt etwas trifft, ohne zu fluten ([wortwahl.ts](./services/wortwahl.ts)).
 *
 * Die verworfenen Vorschläge bleiben stehen, weil eine stille Ersetzung eine
 * Behauptung wäre: der Nutzer sieht am Chip, was das Modell zuerst wollte und
 * warum es nicht genommen wurde.
 */
export interface AchsenWahl {
  /** Das Wort, das diese Achse im Urteil vertritt. */
  wort: string;
  /** Die übrigen Vorschläge derselben Achse mit ihrer Trefferzahl, in Modellreihenfolge. */
  alternativen: readonly SchlagwortTreffer[];
  /** `true`, wenn nicht der erste Vorschlag des Modells gewonnen hat. */
  nachgeschlagen: boolean;
}

/** Das Ergebnis einer Zeile: Schlagworte, Befunde, Urteil. */
export interface ZeilenErgebnis {
  zeile: MeldungsZeile;
  /** Die drei Schlagworte — von der KI vorgeschlagen, vom Nutzer änderbar. */
  schlagworte: readonly string[];
  /**
   * Je Schlagwort seine Trefferzahl im Bereich.
   *
   * Steht neben `schlagworte`, weil die Anzeige sie an jedem Chip braucht und
   * das Urteil sie zum Aussortieren der zu weiten Wörter — beides ohne einen
   * zweiten Lauf über den Korpus.
   */
  schlagwortTreffer: readonly SchlagwortTreffer[];
  /**
   * Je Achse, was zur Wahl stand — nur bei Schlagworten aus dem KI-Lauf.
   *
   * Trägt der Nutzer die Worte von Hand ein, gibt es nichts nachzuschlagen und
   * das Feld bleibt leer.
   */
  wortwahl?: readonly AchsenWahl[];
  /** Alle Befunde, sortiert: Abdeckung absteigend, dann Ähnlichkeit. */
  befunde: readonly TrefferBefund[];
  uebereinstimmung: boolean;
  grund: UrteilGrund;
  /** Gesetzt, wenn der KI-Lauf dieser Zeile scheiterte; dann ist `befunde` leer. */
  fehler?: string;
  /**
   * Gesetzt, wenn die Ähnlichkeitsstufe an DIESER Zeile scheiterte.
   *
   * Nur der zeilen-eigene Grund steht hier — ein Grund, der den ganzen Lauf
   * betrifft, stünde sonst an jeder der 29 Karten dieselbe Meldung.
   */
  aehnlichkeitAusfall?: AehnlichkeitsAusfall;
}

/**
 * Warum die Ähnlichkeitsstufe nichts beitragen konnte.
 *
 * Vier Gründe, weil es vier verschiedene Zustände sind — und weil sie vorher
 * alle dasselbe aussahen: keine Ähnlichkeitswerte. Genau das kostete beim
 * Abnehmen von v6.25.1 drei Fehlversuche, denn ein nicht geladenes Modell liest
 * sich wie ein kaputtes Feature.
 *
 * Die ersten drei gelten für den ganzen Lauf und stehen deshalb einmal im Kopf
 * der Seite; `einbetten-schlug-fehl` betrifft eine einzelne Zeile und steht an
 * ihrer Karte.
 */
export type AehnlichkeitAus =
  /** Das Embedding-Modell war beim Start des Laufs nicht geladen. */
  | 'modell-fehlt'
  /** Das Modell lief, aber der Bestand trägt keine Einbettungen. */
  | 'vektoren-fehlen'
  /** Die Einbettungen liessen sich nicht lesen. */
  | 'vektoren-unlesbar'
  /** Das Modell konnte genau diese Zeile nicht einbetten. */
  | 'einbetten-schlug-fehl';

/** Der Grund plus die rohe Meldung — der Teil, der vorher im `catch` verschwand. */
export interface AehnlichkeitsAusfall {
  aus: AehnlichkeitAus;
  /** Was die Ausnahme sagte; `null`, wenn es keine gab (Zustand statt Fehler). */
  meldung: string | null;
}

/** Der Betrachtungsbereich: welche Anträge überhaupt verglichen werden. */
export interface BereichsWahl {
  /** Antragsdatum ab heute minus so vielen Jahren; `null` = ohne Jahresgrenze. */
  jahre: number | null;
  /** Nur FuE-Vorhaben, Netzwerke und Studien — Dienstleistung und Irrläufer raus. */
  nurFueNetzwerkStudie: boolean;
  /** Abgelehnte und zurückgezogene Vorhaben ausschliessen. */
  ohneAbgelehnte: boolean;
}

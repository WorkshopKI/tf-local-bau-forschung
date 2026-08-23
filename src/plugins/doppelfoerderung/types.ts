/**
 * Die vier Formen, in denen die Doppelförderungs-Prüfung ihre Daten führt.
 *
 * Sie stehen zusammen, weil sie eine Kette bilden: aus der Excel-Zeile
 * (`MeldungsZeile`) werden Schlagworte, aus den Schlagworten Befunde
 * (`TrefferBefund`), aus den Befunden ein Urteil (`ZeilenErgebnis`). Jede Stufe
 * behält, was die vorige geliefert hat — die Kette ist nachvollziehbar, nicht
 * nur ihr Ende.
 */

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
  /** Zuwendungsempfänger / Auftragnehmer, rein zur Anzeige. */
  zuwendungsempfaenger: string;
  /** Laufzeit als „von – bis", rein zur Anzeige. Leer, wenn die Datei keine führt. */
  laufzeit: string;
}

/** Was `leseMeldungsListe` aus einer Datei macht. */
export interface MeldungsListe {
  /** Name des gelesenen Blattes. */
  blatt: string;
  /** Alle Datenzeilen in Dateireihenfolge — ungefiltert. */
  zeilen: readonly MeldungsZeile[];
}

/** Welche Stufe einen Antrag gefunden hat. */
export type TrefferQuelle = 'wortlaut' | 'aehnlichkeit' | 'beide';

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
  /** Länge von `getroffeneWorte` — die Zahl, gegen die die Schwelle prüft. */
  abdeckung: number;
  /** Kosinus-Ähnlichkeit der Ähnlichkeitsstufe; `null` = sie fand ihn nicht. */
  aehnlichkeit: number | null;
  quelle: TrefferQuelle;
  /** Rohstatus aus dem Fachsystem, rein zur Anzeige (Pitfall #12: nie vergleichen). */
  status: string;
  /** Antragsdatum, rein zur Anzeige. */
  antragsdatum: string;
  antragsteller: string;
}

/** Warum eine Zeile als Übereinstimmung gilt. */
export type UrteilGrund = 'schlagworte' | 'aehnlichkeit' | 'keine';

/** Das Ergebnis einer Zeile: Schlagworte, Befunde, Urteil. */
export interface ZeilenErgebnis {
  zeile: MeldungsZeile;
  /** Die drei Schlagworte — von der KI vorgeschlagen, vom Nutzer änderbar. */
  schlagworte: readonly string[];
  /** Alle Befunde, sortiert: Abdeckung absteigend, dann Ähnlichkeit. */
  befunde: readonly TrefferBefund[];
  uebereinstimmung: boolean;
  grund: UrteilGrund;
  /** Gesetzt, wenn der KI-Lauf dieser Zeile scheiterte; dann ist `befunde` leer. */
  fehler?: string;
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

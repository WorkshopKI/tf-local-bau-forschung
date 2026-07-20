/**
 * Datenmodell der Förderfähigkeits-Checkliste.
 *
 * Abgeleitet aus den Papier-Checklisten der Fachprüfung (`check-KMU`,
 * Entscheidungshilfe `Inno-Score`). Zwei Eigenheiten der Vorlage prägen das
 * Modell:
 *
 * 1. **Fünfwertiger Status.** Das Formular hat die Spalten erfüllt / nicht
 *    erfüllt / n. z. / NF notw. / NF erfüllt. Die beiden NF-Spalten bleiben
 *    eigene Status, obwohl man sie auf „unklar" abbilden könnte: nur so ist
 *    später unterscheidbar, ob ein Item durch eine erledigte Nachforderung
 *    erfüllt wurde oder durch eine Neubewertung — und nur so ergibt sich die
 *    NF-Dauer aus dem Verlauf.
 * 2. **Bedingte Blöcke.** Mehrere Abschnitte beginnen mit „Sofern …" und
 *    entfallen sonst komplett. Das ist keine Anzeige-Spielerei: ein entfallener
 *    Block darf den Abschluss nicht blockieren.
 */

/** Fünf Bewertungsspalten der Papiervorlage plus „noch nicht bewertet". */
export type MapItemStatus =
  | 'offen'
  | 'erfuellt'
  | 'nicht-erfuellt'
  | 'nicht-zutreffend'
  | 'nf-notwendig'
  | 'nf-erfuellt';

export type MapItemArt = 'binaer' | 'skala';

/**
 * Prüfklasse (aus dem Prüfaspekte-Konzept): steuert Vorbelegung und Werkzeug.
 * `R` rechnerisch aus dem JSON · `K` Grenzwert-Konformität · `S` semantische
 * Prüfung im Text · `E` externe Recherche oder Anlagen-Sichtung.
 */
export type MapPruefklasse = 'R' | 'K' | 'S' | 'E';

export type MapStufe = 'B0' | 'B1' | 'B2' | 'B3';

/** Woher ein Item stammt — macht Ergänzungen der App von der Vorlage unterscheidbar. */
export type MapHerkunft = 'check-kmu' | 'inno-score' | 'app';

export interface MapSkalaAnker {
  stufe: MapStufe;
  punkte: 0 | 1 | 2 | 3;
  /** Kurzname der Stufe („unzureichend", „übertroffen"). */
  kurz: string;
  /** Ankertexte WÖRTLICH aus der Entscheidungshilfe. */
  merkmale: readonly string[];
}

/**
 * Bedingung, unter der ein Item überhaupt zu bewerten ist. Entfällt die
 * Bedingung, gilt das Item als nicht anwendbar — es zählt weder als offen noch
 * blockiert es den Abschluss.
 */
export type MapBedingung =
  | { art: 'manuell'; frage: string }
  | { art: 'innoScoreUnter'; schwelle: number }
  | { art: 'auftraegeDritteGeplant' };

/**
 * Verknüpfung zu deterministisch Berechnetem. Das Item wird damit NICHT
 * automatisch bewertet — die Bewertung bleibt beim Menschen; angezeigt wird der
 * Befund als Vorbelegung mit „Befund übernehmen".
 */
export interface MapVorbelegung {
  /** Rechencheck-Befund-IDs, die dieses Item betreffen (Präfix-Vergleich). */
  befundPraefixe?: readonly string[];
  /** Der Anteil nicht benannten Personals ist hier die einschlägige Kennzahl. */
  nnAnteil?: boolean;
}

export interface MapChecklistenItem {
  /** Stabile ID — Bewertungen referenzieren sie über Versionen hinweg. */
  id: string;
  gruppe: string;
  kriterium: string;
  art: MapItemArt;
  klasse: MapPruefklasse;
  herkunft: MapHerkunft;
  aktiv: boolean;
  hinweis?: string;
  /** Fundstelle in der Richtlinie oder der Vorlage. */
  fundstelle?: string;
  bedingung?: MapBedingung;
  vorbelegung?: MapVorbelegung;
  /**
   * Zusätzliche Suchbegriffe für die Nachforderungs-Bausteine. Ohne Angabe
   * sucht der Abschluss mit dem Kriteriumstext — die Begriffe hier schärfen
   * dort nach, wo die Vorlage andere Wörter benutzt als die Bausteine.
   */
  nfSuchbegriffe?: readonly string[];
  /**
   * Prüfaspekte A–J der Antrag-Aufbereitung, über die dieses Kriterium seine
   * Fundstellen in der Vorhabensbeschreibung bezieht. Ohne Angabe zeigt das
   * Kriterium keine Fundstellen-Vorschläge — besser als beliebige.
   */
  aspekte?: readonly string[];
  /** Nur bei `art: 'skala'` — genau die vier Stufen B0…B3. */
  anker?: readonly MapSkalaAnker[];
}

export interface MapChecklistenDefinition {
  id: 'zim-fachpruefung-ep';
  titel: string;
  /** Wird bei jeder Speicherung im Editor um 1 erhöht. */
  version: number;
  geaendertAm: string;
  geaendertVon: string | null;
  quellen: readonly string[];
  /** Ab dieser Punktzahl entfällt die vertiefte Einzelprüfung. */
  innoScoreKurzpfad: number;
  items: readonly MapChecklistenItem[];
}

// ---------------------------------------------------------------------------
// Prüfstand
// ---------------------------------------------------------------------------

export interface MapItemBewertung {
  itemId: string;
  status: MapItemStatus;
  /** Nur bei Skala-Items. */
  stufe?: MapStufe;
  /** Pflicht bei „nicht erfüllt", „NF notwendig" und bei Punktabweichung. */
  bemerkung?: string;
  autor: string | null;
  geaendertAm: string;
}

export interface MapVerlaufEintrag {
  zeitstempel: string;
  autor: string | null;
  itemId: string;
  von: { status: MapItemStatus; stufe?: MapStufe } | null;
  nach: { status: MapItemStatus; stufe?: MapStufe };
}

export interface MapPruefung {
  version: 1;
  einreichungId: string;
  /** Stand der Checkliste beim Prüfstart — laufende Prüfungen wandern nicht mit. */
  checklisteVersion: number;
  /** Antworten auf manuelle Bedingungen (`bedingung.art === 'manuell'`). */
  bedingungen: Record<string, boolean>;
  bewertungen: Record<string, MapItemBewertung>;
  /**
   * Bewertungen zu Items, die es in der aktuellen Definition nicht mehr gibt.
   * Bewusst aufbewahrt statt still verworfen — sonst verschwindet Prüfarbeit
   * unbemerkt, wenn jemand die Checkliste ändert.
   */
  verwaisteBewertungen: MapItemBewertung[];
  verlauf: MapVerlaufEintrag[];
  begonnenAm: string;
  aktualisiertAm: string;
}

/**
 * Einheitlicher Ergebnistyp fuer die uebergreifende Suchseite.
 *
 * Aggregiert Treffer aus zwei bestehenden Suchen:
 *  - Foerderantraege ([antraege-search-service.ts](src/plugins/antraege/services/antraege-search-service.ts))
 *  - Dokumente ([orama-store.ts](src/core/services/search/orama-store.ts) `hybridSearch`)
 *
 * Diskriminierende Union via `type`. Antrags-spezifische und Dokument-
 * spezifische Felder sind optional — Konsumenten muessen nach `type` switchen.
 *
 * `score` ist 0..1 normalisiert (siehe Plan, "Score-Strategie pragmatisch pro
 * Quelle"). `method` zeigt welche Pipeline-Stufe den Treffer geliefert hat;
 * fuer Antrags-Hits mit mehreren Treffer-Quellen wird die mit dem hoechsten
 * Score gewaehlt.
 */
import type { StatusCategory } from '@/core/utils/status-canonical';
import type { Trefferfeld, RelevanzStufe } from '@/core/services/search/trefferstelle';

export type SearchResultType = 'antrag' | 'dokument';
export type SearchMethod = 'fulltext' | 'vector' | 'hybrid';

/**
 * Belegstelle aus einem Dokument, unter seinen Antrag gefaltet.
 *
 * `quelle` ist Dateiname bzw. Abschnittsüberschrift — eine SEITENZAHL steht
 * nicht zur Verfügung: der Orama-Index führt je Abschnitt nur
 * `id/text/title/source/tags/type` ([orama-store.ts](src/core/services/search/orama-store.ts)).
 */
export interface Textstelle {
  quelle: string;
  text: string;
}

export interface UnifiedSearchResult {
  /** Stabile ID innerhalb des Result-Sets. Antraege: Aktenzeichen.
   *  Dokumente: Chunk-ID aus dem Orama-Index. */
  id: string;
  type: SearchResultType;
  /** 0..1 normalisiert. */
  score: number;
  method: SearchMethod;

  // ----- Gemeinsame Felder -----
  /** Anzeigetitel. Antraege: Vorhaben-Titel. Dokumente: Heading des Chunks. */
  title: string;
  /** Kurzer Vorschautext (~250–300 Zeichen). */
  snippet: string;

  // ----- Herkunft des Treffers (v4.5) -----
  /** In welchen Feldern der Treffer lag — Grundlage der Trefferstellen-Tags,
   *  der Relevanz und der Facette „Trefferstelle". */
  trefferfelder?: Trefferfeld[];
  /** Drei Stufen aus `score`. Vorberechnet, damit Liste und Tabelle dieselbe
   *  Stufe zeigen und niemand die Schwellen ein zweites Mal führt. */
  relevanzStufe?: RelevanzStufe;
  /** Belegstelle aus einem Dokument, das zu diesem Antrag gehört. Nur gesetzt,
   *  wenn ein Dokumenttreffer unter den Antrag gefaltet wurde. */
  textstelle?: Textstelle;
  /**
   * Der Ort, genau in der Form, in der die Suche darin nachsieht
   * (`AntragTextEntry.standort`, z. B. „Hamburg · Wedel").
   *
   * Reines BELEG-Feld, kein Sortier-/Filtervertrag: es steht hier, weil die
   * Fundstelle „Ort" sonst in keiner Zeile und keiner Spalte auftaucht. Bewusst
   * NICHT `ortAst` (= nur die CSV-Spalte `ort_ast`): gesucht wird auch im
   * Ausführungsort, und eine Zelle, in der das Suchwort dann fehlt, behauptet
   * eine Erklärung, die sie nicht liefert.
   */
  standort?: string;
  /** Bundesland im Klartext (`AntragTextEntry.bundesland`, z. B. „Sachsen").
   *  Seit v4.81 vom Ort getrennt und deshalb ein eigener Beleg — dieselbe
   *  Begründung wie bei `standort`. */
  bundesland?: string;
  /** Deskriptoren-Text (Technologie/Branche/Anwendung + ZT-Klartexte). Zweiter
   *  Beleg ohne eigenen Platz im Ergebnis — dieselbe Begründung wie `standort`. */
  deskriptoren?: string;
  /**
   * Kurzbeschreibung / Abstract des Vorhabens (`AntragTextEntry.abstract`).
   *
   * Die Trefferliste zeigt sie nicht — sie lebt hier für Konsumenten, die den
   * INHALT brauchen statt der Zeile. Erster davon ist der Kontext, den die Suche
   * dem Assistenten anheftet: bis v4.77 trug er je Treffer nur Titel und
   * Antragsteller, und ein Modell, das nach dem Thema gefragt wird, reimte sich
   * den Rest aus dem Titel zusammen.
   */
  kurzbeschreibung?: string;
  /** Web-Adresse der Einrichtung, aus der Kontakt-Mail abgeleitet
   *  (`bergmann@gmbu.de` → `gmbu.de`). Dritter Beleg dieser Art: wer über das
   *  Kürzel „GMBU" hierher gefunden hat, sieht in der Zeile sonst nur den
   *  ausgeschriebenen Namen — und damit keinen Grund für den Treffer. */
  domain?: string;
  /** Netzwerkangabe roh wie im Export (`"LOHCmobil" 16KN065602_AM`) — Name und
   *  Kennzeichen des Netzwerks. Beleg wie oben: steht in keiner anderen Zelle. */
  netzwerk?: string;
  /** Wahlkreis der ausführenden Stelle. Beleg wie oben — und der Grund, warum
   *  ein Treffer erscheint, dessen Ortsfeld das Suchwort gar nicht enthält. */
  wahlkreis?: string;
  /** Die Arbeitsnotizen am Vorgang („Wichtig" + „Bemerkung", zusammengezogen).
   *  Der stärkste Fall dieser Regel: der Satz steht nirgends sonst in der App
   *  außer auf der Detailseite des Antrags. */
  notiz?: string;
  /** Kennzeichen des Verbunds (`ZKN073232`). Beleg wie oben: die Trefferliste
   *  zeigt das FKZ des Teilvorhabens, nie die Nummer seines Verbunds — wer über
   *  sie hierher gefunden hat, sähe sonst keinen Grund für den Treffer. */
  verbundkennzeichen?: string;

  // ----- Antrags-spezifisch (nur wenn type === 'antrag') -----
  /** Foerderkennzeichen / Aktenzeichen. */
  fkz?: string;
  /** Programm-Name (oder ID falls Name unbekannt). */
  programm?: string;
  /** Unterprogramm-Label (sprechender Name) oder — solange die Labels noch nicht
   *  geladen sind bzw. kein Name kuratiert ist — der rohe Unterprogramm-Code.
   *  Für die kombinierte „Programm/Unterprogramm"-Anzeige in der Suchtabelle. */
  unterprogramm?: string;
  /** Der rohe Code, unabhängig vom Label — für den Bereichs-Abgleich. */
  unterprogrammCode?: string;
  /**
   * Der Treffer liegt außerhalb des Betrachtungsbereichs.
   *
   * Die Suche bleibt am Vollbestand (Pitfall #46) — sie ist Evidenz, kein
   * Arbeitsvorrat. Ohne diese Marke sähe ein Treffer aus einem stillgelegten
   * Altprogramm wie ein Widerspruch zur Liste aus, die ihn nicht führt.
   */
  ausserhalbBereich?: boolean;
  antragsteller?: string;
  /** Roh-Status-String aus CSV. */
  status?: string;
  /** Kanonische Status-Kategorie (UI-Gruppierung). */
  statusKategorie?: StatusCategory;
  /** Antragsdatum als ISO oder dd.mm.yyyy (was im CSV steht). */
  antragsdatum?: string;
  /** Bewilligungsdatum (Canonical bewilligung_datum). */
  bewilligungsdatum?: string;
  /** Laufzeitbeginn (Canonical laufzeitbeginn). */
  laufzeitbeginn?: string;
  /** Laufzeitende (Canonical laufzeitende). */
  laufzeitende?: string;
  /** Ort des Antragstellers (Canonical ort_ast). */
  ortAst?: string;
  /** Zuwendung / Foerdersumme in EUR (Canonical foerdersumme). */
  zuwendung?: number;
  /** Tage seit Frist-Datum, falls ueberfaellig. Kommt in spaeterem Prompt. */
  ueberfaelligTage?: number;
  /** Verbund-Phase (vb_phase aus CSV) — fuer die Antragstyp-Anzeige in
   *  der Suche-Tabelle (FuE=3, DS=5, DL=4, NW=1|2). */
  vbPhase?: number;

  // ----- Dokument-spezifisch (nur wenn type === 'dokument') -----
  dateiname?: string;
  /** DMS-Dokumenttyp aus der Metadaten-Klassifizierung (z.B. 'Gutachten',
   *  'Stellungnahme'). */
  dokumentTyp?: string;
  /** Aktenzeichen des zugehoerigen Antrags, sofern aus Phase-2-Manifest
   *  bekannt. */
  zugehoerigerAntragFkz?: string;
  /** Programm-Name des zugehoerigen Antrags, falls aufloesbar. */
  zugehoerigesProgramm?: string;

  // ----- KI-Analyse-spezifisch -----
  /** LLM-Begründung, warum dieser Treffer für die Such-/Analysefrage relevant
   *  ist (2–3 Sätze). Wird NICHT von der Hybrid-Suche gesetzt, sondern nur als
   *  Overlay nach „Mit KI analysieren" über die bestehenden Treffer gelegt
   *  (`begruendungById` aus der Analyse-Pipeline). */
  begruendung?: string;
}

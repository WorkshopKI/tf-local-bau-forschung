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

export type SearchResultType = 'antrag' | 'dokument';
export type SearchMethod = 'fulltext' | 'vector' | 'hybrid';

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

  // ----- Antrags-spezifisch (nur wenn type === 'antrag') -----
  /** Foerderkennzeichen / Aktenzeichen. */
  fkz?: string;
  /** Programm-Name (oder ID falls Name unbekannt). */
  programm?: string;
  /** Unterprogramm-Label (sprechender Name) oder — solange die Labels noch nicht
   *  geladen sind bzw. kein Name kuratiert ist — der rohe Unterprogramm-Code.
   *  Für die kombinierte „Programm/Unterprogramm"-Anzeige in der Suchtabelle. */
  unterprogramm?: string;
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

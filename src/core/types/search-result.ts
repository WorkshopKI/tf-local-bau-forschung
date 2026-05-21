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
  antragsteller?: string;
  /** Roh-Status-String aus CSV. */
  status?: string;
  /** Kanonische Status-Kategorie (UI-Gruppierung). */
  statusKategorie?: StatusCategory;
  /** Antragsdatum als ISO oder dd.mm.yyyy (was im CSV steht). */
  antragsdatum?: string;
  /** Netzwerk-Groesse, falls bekannt. */
  nwGroesse?: string;
  /** Themen-Kategorie / Branche, falls bekannt. */
  kategorie?: string;
  /** Tage seit Frist-Datum, falls ueberfaellig. Kommt in spaeterem Prompt. */
  ueberfaelligTage?: number;

  // ----- Dokument-spezifisch (nur wenn type === 'dokument') -----
  dateiname?: string;
  /** Orama-Index `type`-Feld (z.B. 'dokument', 'bauantrag'). */
  dokumentTyp?: string;
  /** Aktenzeichen des zugehoerigen Antrags, sofern aus Phase-2-Manifest
   *  bekannt. */
  zugehoerigerAntragFkz?: string;
  /** Programm-Name des zugehoerigen Antrags, falls aufloesbar. */
  zugehoerigesProgramm?: string;
}

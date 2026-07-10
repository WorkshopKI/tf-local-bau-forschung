/**
 * Assistent-Panel (Phase 1) — Datenmodell des deterministischen Kontext-Assemblers.
 *
 * Der Assembler ist eine REINE Funktion: er nimmt Route, selektierte Entität,
 * Nutzerfrage, bisherige Turns und (optional) bereits ausgeführte Orama-Treffer
 * entgegen und baut daraus EINEN vollständigen Prompt-Text. Er berechnet nichts
 * Neues — Status/Phase/Frist/nächster Schritt kommen aus den bestehenden reinen
 * Funktionen der App (`naechsterSchritt`, `fristAmpelFromDays`, `getStatusLabel`,
 * `getStatusCategory`); das LLM formuliert nur.
 *
 * Bewusst OHNE React/IDB/Netzwerk (node-testbar). Das Orama-Retrieval (unrein,
 * Singleton-DB) läuft im Controller und wird als `treffer` hereingereicht — so
 * bleibt der Assembler byte-deterministisch.
 */
import type { OramaSearchResult } from '@/core/services/search/orama-store';

export type AssistentEntitaetArt = 'antrag' | 'verbund';

/**
 * Selektierte Entität, wie der Controller sie aus dem Antraege-Store aufbereitet.
 * Rohe Domänenwerte (`status`, `precheckLabel`) reicht der Assembler in die
 * bestehenden reinen Fakten-Funktionen — Ableitungen (Status-Label, nächster
 * Schritt, Frist-Ampel) passieren IM Assembler und sind damit mitgetestet.
 * Werte, die Domänen-Mappings außerhalb des Assembler-Scopes brauchen
 * (`phaseLabel`, `stammdaten`), füllt der Controller vor.
 */
export interface KontextEntitaet {
  art: AssistentEntitaetArt;
  /** FKZ (Antrag) bzw. Verbund-ID. */
  id: string;
  /** Anzeige-Titel (Akronym/Kurztitel); Fallback = id. */
  titel: string;
  /** Roh-Status (→ getStatusLabel/getStatusCategory/naechsterSchritt). */
  status?: string;
  /**
   * PreCheck-Label (`precheck_status_label`) — aktiviert die PreCheck-Regel in
   * `naechsterSchritt`. `undefined` = Regel überspringen (Legacy), `null`/`''` =
   * „PreCheck nachweislich nicht vorhanden".
   */
  precheckLabel?: string | null;
  /** Menschliches Phasen-Label (Controller füllt via vb-phase-mappings). */
  phaseLabel?: string;
  /**
   * Vorformatierter Frist-Hinweis, z. B. „in 45 T (im Zeitplan)". Der Controller
   * baut ihn aus den PLUGIN-lokalen Frist-Helfern (`fristAnzeige` /
   * `daysUntilFristAware`) — so bleibt der Assembler frei von Plugin-Importen
   * und von `Date.now()`. Fehlt eine berechenbare Frist → weglassen.
   */
  fristHinweis?: string;
  /** Anzahl anstehender Fristen (Verbund: TVs mit Frist) — nur für die Chips. */
  fristenAnzahl?: number;
  /** Kleine, kuratierte Stammdaten-Zeilen (schon UI-fertig, Label→Wert). */
  stammdaten?: ReadonlyArray<{ label: string; wert: string }>;
}

export interface AssistentTurn {
  rolle: 'nutzer' | 'assistent';
  text: string;
}

export interface AssistentKontextEingabe {
  /** Menschliche Beschreibung der aktuellen Ansicht, z. B. „Detailseite Verbund". */
  routeBeschreibung: string;
  entitaet: KontextEntitaet | null;
  frage: string;
  /** Bisherige Turns dieser Panel-Sitzung (chronologisch, ältester zuerst). */
  turns: ReadonlyArray<AssistentTurn>;
  /** Bereits ausgeführtes Orama-Retrieval (roh, score-sortiert). `null`/`[]` = kein Retrieval. */
  treffer: ReadonlyArray<OramaSearchResult> | null;
}

export interface AssistentPrompt {
  /** Vollständiger, an das interne Modell zu sendender Prompt-Text. */
  promptText: string;
  /**
   * n-geordnete, geschwellte, gekappte Teilmenge der Treffer — genau die im
   * Retrieval-Block als `[n]` eingebundenen Quellen. Der Controller mappt sie
   * via `buildChatSources` auf `ChatSource[]` (Anzeige-Zitate).
   */
  verwendeteTreffer: OramaSearchResult[];
  /** Kurzbeschreibung für die Kontext-Chips („Verbund X · Begutachtung · 2 Fristen"). */
  kontextBeschreibung: string;
}

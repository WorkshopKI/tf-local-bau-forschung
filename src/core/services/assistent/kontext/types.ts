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
  /**
   * „Was ist an diesem Vorgang zu tun?" — das Ergebnis der **To-do-Kaskade**,
   * wortgleich mit dem, was die Karten der App zeigen (`aufgabenAnzeige`).
   *
   * Der Assembler bevorzugt es vor `naechsterSchritt`/`schrittText`. Ohne dieses
   * Feld sprach der Faktenblock allein die alte Status-Formel, und der Assistent
   * widersprach der Karte daneben: sie sagte „Widerspruch gg Abl bearbeiten ·
   * liegt bei AB/FB/Jur", er sagte „Ablehnungsbescheid erstellen" (gemessen an
   * DynaMaint, 10.09.2026). Die Kaskade ist die Quelle, die Formel der Rückfall
   * (CLAUDE.md → „Was ist zu tun?").
   *
   * Der Controller füllt es aus der **bereits gerechneten** Ablage; liegt keine
   * vor, bleibt das Feld weg und der Assembler nimmt wieder die Formel.
   */
  aufgabe?: {
    /** Der Aufgabentext der Zeile. */
    text: string;
    /**
     * `false` = der Text kommt aus der alten Status-Formel, weil keine Regel
     * griff. Ein Rückfall, der sich nicht zu erkennen gibt, spricht die
     * widerlegte Formel, als wäre sie belegt — der Faktenblock sagt es dazu.
     */
    ausKaskade: boolean;
    /** Die Nebenzeile der Karte: „wartet auf QS", „liegt bei AB/FB". */
    neben?: string;
  };
}

export interface AssistentTurn {
  rolle: 'nutzer' | 'assistent';
  text: string;
}

/** Eine einzelne Frist-Zeile der Arbeitsvorrat-Übersicht (schon prompt-fertig). */
export interface ArbeitsvorratFrist {
  /** Anzeige-Titel (Akronym/Kurztitel/FKZ). */
  titel: string;
  /** Vorformatierter Frist-Hinweis, z. B. „in 3 T (dringend)". */
  hinweis: string;
  /** Nächster Handlungsschritt (`naechsterSchritt().aktion`), falls gemappt. */
  aktion?: string;
}

/**
 * Kompakte, deterministische Übersicht des Arbeitsvorrats — vom Controller aus dem
 * Antraege-Store aufbereitet und NUR im Kein-Entität-Fall (Liste/Startseite) in den
 * Faktenblock injiziert. So tragen die Quick Actions „Fristen"/„Was ist heute dran?"
 * auch ohne selektierte Entität deterministische Fakten (statt einer geratenen
 * LLM-Antwort). Der Assembler rendert sie nur, er berechnet nichts.
 */
export interface ArbeitsvorratUebersicht {
  /** Anzahl nicht-terminaler Anträge („In Arbeit"). */
  gesamtInArbeit: number;
  /** Davon überfällig (Frist-Ampel rot). */
  ueberfaellig: number;
  /** Davon dringend (Frist-Ampel orange/gelb). */
  dringend: number;
  /** Die dringlichsten Anträge (nächste Frist zuerst), gekappt. */
  naechsteFristen: ReadonlyArray<ArbeitsvorratFrist>;
}

/**
 * Ein dem aktuellen Vorhaben (Verbund) zugeordnetes Dokument — deterministisch vom
 * Controller über die Tag-Relation (Verbund-ID) aufgelöst. So „kennt" der Assistent
 * die Antragsdokumente entitäts-scoped (nicht nur per zufälligem Volltext-Treffer).
 */
export interface VorhabenDokument {
  /** Menschliches Typ-Label (z. B. „Vorhabensbeschreibung", „Arbeitsplan (Anlage 5)"). */
  typLabel: string;
  /** Dateiname des Dokuments. */
  name: string;
  /** Frontmatter-freier, gekappter Auszug (Prompt-Explosion vermeiden). */
  auszug: string;
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
  /**
   * Aktive Gedächtnis-Einträge (Assistent Phase 2) — deterministisch vom Controller
   * geladen (nur bei Flag + beiden Opt-ins). Nur der `text` je Eintrag; als
   * „Hintergrundwissen"-Block NACH dem System- und VOR dem Faktenblock eingefügt.
   * `undefined`/`[]` = kein Gedächtnis-Block. Wird bei Budget-Überschreitung
   * ZUERST gekürzt (Hintergrundwissen kann veraltet sein).
   */
  gedaechtnis?: ReadonlyArray<{ text: string }>;
  /**
   * Dem aktuellen Vorhaben (Verbund) zugeordnete Dokumente — deterministisch vom
   * Controller über die Tag-Relation aufgelöst (VB/Anlage 5/Marketing/…). Als
   * „Dokumente zum Vorhaben"-Block eingefügt (NACH den Fakten, VOR dem globalen
   * Retrieval). Im Budget nach Gedächtnis/Historie/Retrieval gekürzt (entitäts-
   * scoped → am wertvollsten). `undefined`/`[]` = kein Block.
   */
  vorhabenDokumente?: ReadonlyArray<VorhabenDokument>;
  /**
   * Deterministische Arbeitsvorrat-Übersicht — nur im Kein-Entität-Fall (Liste/
   * Startseite) vom Controller gefüllt, damit „Fristen"/„Was ist heute dran?" auch
   * ohne selektierte Entität faktengestützt sind. Als eigener Block NACH den Fakten
   * eingefügt; deterministisch → wird im Budget NIE gekürzt. `undefined`/`null` =
   * kein Block (bei selektierter Entität trägt deren eigener Faktenblock).
   */
  arbeitsvorratUebersicht?: ArbeitsvorratUebersicht | null;
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
  /** Anzahl der TATSÄCHLICH eingebundenen Gedächtnis-Einträge (nach Budget-Kürzung)
   *  — für den Kontext-Chip „Gedächtnis: N Einträge". */
  gedaechtnisAnzahl: number;
}
